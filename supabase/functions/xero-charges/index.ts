import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { pickAcceptance, checkPosting } from "./terms-check.ts";

// Posts interest on overdue invoices to Xero as DRAFT sales invoices, one per overdue
// invoice, using the account and tax rate chosen in DebtJet. Nothing is approved or sent
// in Xero: the business reviews and approves each draft there.
//
// Every item is re-checked here against the customer's accepted terms (terms-check.ts):
// the app's figure is never trusted on its own.
//
// Actions:
//   load  -> revenue accounts + tax rates from Xero, refreshes the status of earlier drafts
//   post  -> creates the drafts for the items sent (max 25 per call)

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const REVENUE_TYPES = ["REVENUE", "SALES", "OTHERINCOME"];
const STATUS_MAP: Record<string, string> = { DRAFT: "draft", SUBMITTED: "draft", AUTHORISED: "authorised", PAID: "paid", VOIDED: "voided", DELETED: "deleted" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUIDISH = /^[0-9a-fA-F-]{36}$/;

function brisbaneToday(): string {
  // Australian businesses: use the AEST date (UTC+10, no daylight saving in QLD).
  return new Date(Date.now() + 10 * 3600_000).toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400_000).toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
const money = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

async function xeroToken(service: any, orgId: string) {
  const { data: conn } = await service.from("xero_connections").select("tenant_id, tenant_name").eq("org_id", orgId).maybeSingle();
  if (!conn) throw new UserError("Xero isn't connected for this organisation.");
  const { data: refreshToken } = await service.rpc("get_xero_refresh_token", { p_org_id: orgId });
  const secret = Deno.env.get("XERO_CLIENT_SECRET");
  if (!refreshToken || !secret) throw new UserError("Could not read the Xero connection. Try reconnecting Xero in Integrations.");
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(XERO_CLIENT_ID + ":" + secret) },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const tok = await res.json();
  if (!res.ok || !tok.access_token) throw new UserError("Xero rejected the connection. Please reconnect Xero in Integrations.");
  // Xero rotates the refresh token on every use: save the new one straight away.
  await service.rpc("store_xero_connection", { p_org_id: orgId, p_refresh_token: tok.refresh_token, p_tenant_id: conn.tenant_id, p_tenant_name: conn.tenant_name });
  return { access: tok.access_token as string, tenant: conn.tenant_id as string, scope: String(tok.scope || "") };
}

class UserError extends Error {}

async function xero(t: { access: string; tenant: string }, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch("https://api.xero.com/api.xro/2.0" + path, {
    method,
    headers: { Authorization: "Bearer " + t.access, "Xero-tenant-id": t.tenant, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: res.ok, status: res.status, data, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => ({}));
    const orgId = String(body.org_id || "");
    const action = String(body.action || "");
    if (!UUIDISH.test(orgId)) return json({ error: "org_id is required" }, 400);

    const { data: member } = await user.from("org_members").select("role").eq("org_id", orgId).eq("user_id", u.user.id).maybeSingle();
    if (!member) return json({ error: "Not a member of this organisation." }, 403);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "load") {
      const t = await xeroToken(service, orgId);
      const [acc, tax] = await Promise.all([
        xero(t, "GET", '/Accounts?where=' + encodeURIComponent('Status=="ACTIVE"')),
        xero(t, "GET", '/TaxRates?where=' + encodeURIComponent('Status=="ACTIVE"')),
      ]);
      if (acc.status === 401 || acc.status === 403 || tax.status === 401 || tax.status === 403) {
        return json({ ok: false, needs_reconnect: true, error: "DebtJet needs permission to read your Xero accounts and tax rates. Reconnect Xero in Integrations, then try again." });
      }
      if (!acc.ok || !tax.ok) return json({ ok: false, error: "Xero didn't return your accounts and tax rates. Please try again." }, 502);
      const accounts = (acc.data?.Accounts || [])
        .filter((a: any) => REVENUE_TYPES.includes(a.Type) && a.Code)
        .map((a: any) => ({ code: a.Code, name: a.Name, type: a.Type, tax_type: a.TaxType || null }))
        .sort((a: any, b: any) => (a.type === "OTHERINCOME" ? -1 : 0) - (b.type === "OTHERINCOME" ? -1 : 0) || String(a.code).localeCompare(String(b.code)));
      const taxRates = (tax.data?.TaxRates || []).map((r: any) => ({
        tax_type: r.TaxType, name: r.Name, rate: Number(r.EffectiveRate ?? r.DisplayTaxRate ?? 0), revenue: !!r.CanApplyToRevenue,
      }));

      // Refresh the status of earlier drafts so approved, voided or deleted ones show correctly.
      const { data: live } = await service.from("charge_postings").select("id, xero_invoice_id, status")
        .eq("org_id", orgId).in("status", ["draft", "authorised"]).not("xero_invoice_id", "is", null).order("created_at", { ascending: false }).limit(100);
      let refreshed = 0;
      if (live && live.length) {
        const ids = live.map((p: any) => p.xero_invoice_id).join(",");
        const r = await xero(t, "GET", "/Invoices?IDs=" + encodeURIComponent(ids) + "&summaryOnly=true");
        if (r.ok) {
          for (const inv of r.data?.Invoices || []) {
            const st = STATUS_MAP[inv.Status];
            const p = live.find((x: any) => x.xero_invoice_id === inv.InvoiceID);
            if (p && st && st !== p.status) {
              await service.from("charge_postings").update({ status: st, xero_invoice_number: inv.InvoiceNumber || null, updated_at: new Date().toISOString() }).eq("id", p.id);
              refreshed++;
            }
          }
        }
      }
      return json({ ok: true, accounts, tax_rates: taxRates, refreshed });
    }

    if (action === "post") {
      const items = Array.isArray(body.items) ? body.items.slice(0, 25) : [];
      if (!items.length) return json({ error: "Nothing to post." }, 400);

      const { data: cfg } = await service.from("charge_posting_settings").select("*").eq("org_id", orgId).maybeSingle();
      if (!cfg || !cfg.account_code || (cfg.line_amount_types !== "NoTax" && !cfg.tax_type)) {
        return json({ error: "Choose the Xero account and tax rate for interest first (owners and admins can set these)." }, 400);
      }

      const today = brisbaneToday();
      const results: any[] = [];
      const ready: any[] = [];

      // 1. Check each item against DebtJet's own records (RLS limits this to the user's org).
      const ids = items.map((i: any) => String(i.invoice_id || "")).filter((x: string) => UUIDISH.test(x));
      const { data: invs } = await user.from("invoices").select("id, org_id, invoice_number, source, external_id, status, debtor_id, case_id, issued_date, due_date").eq("org_id", orgId).in("id", ids);
      const { data: prior } = await service.from("charge_postings").select("invoice_id, period_to, status, interest").eq("org_id", orgId).in("invoice_id", ids).not("status", "in", "(voided,deleted)");
      const seen = new Set<string>();
      for (const it of items) {
        const id = String(it.invoice_id || "");
        if (seen.has(id)) continue;
        seen.add(id);
        const inv = (invs || []).find((x: any) => x.id === id);
        const interest = r2(Number(it.interest));
        const from = String(it.period_from || ""), to = String(it.period_to || "");
        const fail = (msg: string) => results.push({ invoice_id: id, ok: false, error: msg });
        if (!inv) { fail("Invoice not found."); continue; }
        if (inv.source !== "xero" || !inv.external_id) { fail("Only invoices that came from Xero can have interest posted to Xero."); continue; }
        if (inv.status === "paid") { fail("This invoice is marked as paid."); continue; }
        if (!(interest > 0) || interest > 1000000) { fail("The interest amount isn't valid."); continue; }
        if (!ISO.test(from) || !ISO.test(to) || to < from || to > addDays(today, 1)) { fail("The interest period isn't valid."); continue; }
        const overlap = (prior || []).some((p: any) => p.invoice_id === id && p.period_to >= from);
        if (overlap) { fail("Interest for part of this period has already been posted. Refresh and try again."); continue; }
        const priorInterest = r2((prior || []).filter((p: any) => p.invoice_id === id).reduce((t: number, p: any) => t + (Number(p.interest) || 0), 0));
        ready.push({ it, inv, interest, from, to, balance: r2(Number(it.balance) || 0), priorInterest });
      }
      if (!ready.length) return json({ ok: true, results });

      // 1b. What the customer's accepted terms allow (read with the user's own access).
      const debtorIds = [...new Set(ready.map((r) => r.inv.debtor_id).filter(Boolean))];
      const caseIds = [...new Set(ready.map((r) => r.inv.case_id).filter(Boolean))];
      const readyIds = ready.map((r) => r.inv.id);
      const none = Promise.resolve({ data: [] as any[] });
      const [accR, grpR, decR, noteR, letR, setR] = await Promise.all([
        user.from("terms_acceptances").select("document_id, debtor_id, group_id, accepted_on, evidence_grade").eq("org_id", orgId),
        debtorIds.length ? user.from("contact_group_members").select("group_id, debtor_id").in("debtor_id", debtorIds) : none,
        user.from("invoice_charge_decisions").select("invoice_id, decision").in("invoice_id", readyIds),
        user.from("case_notes").select("invoice_id, category, occurred_at").in("invoice_id", readyIds).order("occurred_at", { ascending: false }),
        caseIds.length ? user.from("letters").select("case_id, type, sent_at").in("case_id", caseIds).eq("status", "sent").order("sent_at", { ascending: true }) : none,
        user.from("org_charge_settings").select("apply_mode").eq("org_id", orgId).maybeSingle(),
      ]);
      const groupsOf: Record<string, string[]> = {};
      for (const g of (grpR.data || []) as any[]) (groupsOf[g.debtor_id] = groupsOf[g.debtor_id] || []).push(g.group_id);
      const decisionOf: Record<string, string> = {};
      for (const d of (decR.data || []) as any[]) decisionOf[d.invoice_id] = d.decision;
      const latestNote: Record<string, string> = {};
      for (const n of (noteR.data || []) as any[]) if (n.invoice_id && !(n.invoice_id in latestNote)) latestNote[n.invoice_id] = n.category;
      const demandOf: Record<string, { first?: string; final?: string }> = {};
      for (const l of (letR.data || []) as any[]) {
        const d = (demandOf[l.case_id] = demandOf[l.case_id] || {});
        const at = String(l.sent_at || "").slice(0, 10); if (!at) continue;
        if (!d.first && ["first_demand", "final_demand", "pre_legal"].includes(l.type)) d.first = at;
        if (!d.final && ["final_demand", "pre_legal"].includes(l.type)) d.final = at;
      }
      const applyMode = (setR as any).data?.apply_mode || "auto";
      for (const r of ready) r.acc = pickAcceptance(accR.data || [], r.inv.debtor_id, groupsOf[r.inv.debtor_id] || []);
      const docIds = [...new Set(ready.map((r) => r.acc?.document_id).filter(Boolean))];
      const { data: docs } = docIds.length
        ? await user.from("org_terms_documents").select("id, kind, limits, rules, rules_confirmed_at, archived").in("id", docIds)
        : { data: [] as any[] };
      for (const r of ready) r.doc = (docs || []).find((d: any) => d.id === r.acc?.document_id) || null;

      const t = await xeroToken(service, orgId);

      // 2. Check the source invoices in Xero: still approved and owing the balance DebtJet used.
      const srcIds = ready.map((r) => r.inv.external_id).join(",");
      const src = await xero(t, "GET", "/Invoices?IDs=" + encodeURIComponent(srcIds));
      if (!src.ok) return json({ ok: false, error: "Couldn't read the invoices from Xero. Please try again.", results }, 502);
      const srcById: Record<string, any> = {};
      for (const s of src.data?.Invoices || []) srcById[s.InvoiceID] = s;

      const toCreate: any[] = [];
      for (const r of ready) {
        const s = srcById[r.inv.external_id];
        const fail = (msg: string) => results.push({ invoice_id: r.inv.id, ok: false, error: msg });
        if (!s) { fail("Xero couldn't find this invoice."); continue; }
        if (s.Status !== "AUTHORISED") { fail("In Xero this invoice is " + String(s.Status).toLowerCase() + ", so no interest was posted."); continue; }
        const due = r2(Number(s.AmountDue) || 0);
        if (r.balance && Math.abs(due - r.balance) > 0.05) {
          fail("Xero shows " + money(due) + " owing but DebtJet used " + money(r.balance) + ". Sync from Xero and check payments, then try again.");
          continue;
        }
        // Held to the accepted terms, on the balance Xero shows.
        const chk = checkPosting({
          invoice: r.inv, acceptance: r.acc, doc: r.doc, disputed: latestNote[r.inv.id] === "dispute",
          decision: decisionOf[r.inv.id] || null, applyMode, demand: demandOf[r.inv.case_id] || {}, todayISO: today,
          balance: due, from: r.from, to: r.to, interest: r.interest,
          rate_pa: Number(r.it.rate_pa) > 0 ? Number(r.it.rate_pa) : null, priorInterest: r.priorInterest,
        });
        if (!chk.ok) { fail(chk.error); continue; }
        const days = Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400_000);
        const rate = Number(chk.rules.rate_pa) > 0 && Number(chk.rules.rate_pa) < 1 ? Math.round(Number(chk.rules.rate_pa) * 10000) / 100 : null;
        const desc = "Interest on overdue invoice " + (s.InvoiceNumber || r.inv.invoice_number || "") +
          (rate ? " at " + rate + "% p.a." : "") + " on " + money(due) +
          ", " + fmtDate(r.from) + " to " + fmtDate(r.to) + " (" + days + " day" + (days === 1 ? "" : "s") + ")";
        const line: any = { Description: desc.slice(0, 4000), Quantity: 1, UnitAmount: r.interest, AccountCode: cfg.account_code };
        if (cfg.line_amount_types !== "NoTax") line.TaxType = cfg.tax_type;
        toCreate.push({
          r, s,
          invoice: {
            Type: "ACCREC",
            Contact: { ContactID: s.Contact?.ContactID },
            Date: today,
            DueDate: addDays(today, Number(cfg.due_days) || 0),
            LineAmountTypes: cfg.line_amount_types,
            Reference: ("Interest on " + (s.InvoiceNumber || r.inv.invoice_number || "")).slice(0, 255),
            CurrencyCode: s.CurrencyCode || undefined,
            Status: "DRAFT",
            LineItems: [line],
          },
        });
      }

      // 3. Create the drafts in one request. The idempotency key makes a retry safe.
      if (toCreate.length) {
        const raw = orgId + "|" + toCreate.map((c) => c.r.inv.id + ":" + c.r.from + ":" + c.r.to + ":" + c.r.interest).join(",");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
        const key = "debtjet-int-" + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
        const created = await xero(t, "PUT", "/Invoices?summarizeErrors=false", { Invoices: toCreate.map((c) => c.invoice) }, { "Idempotency-Key": key });
        if (!created.ok && !created.data?.Invoices) {
          const msg = created.status === 401 || created.status === 403
            ? "DebtJet doesn't have permission to create invoices in Xero. Reconnect Xero in Integrations."
            : "Xero didn't accept the drafts (" + created.status + ").";
          toCreate.forEach((c) => results.push({ invoice_id: c.r.inv.id, ok: false, error: msg }));
        } else {
          const out = created.data?.Invoices || [];
          for (let i = 0; i < toCreate.length; i++) {
            const c = toCreate[i], x = out[i] || {};
            const errs = (x.ValidationErrors || []).map((e: any) => e.Message).filter(Boolean);
            if (errs.length || !x.InvoiceID || x.InvoiceID === "00000000-0000-0000-0000-000000000000") {
              results.push({ invoice_id: c.r.inv.id, ok: false, error: errs.join(" ") || "Xero didn't create this draft." });
              continue;
            }
            const { error: insErr } = await service.from("charge_postings").insert({
              org_id: orgId, invoice_id: c.r.inv.id, provider: "xero", source_external_id: c.r.inv.external_id,
              xero_invoice_id: x.InvoiceID, xero_invoice_number: x.InvoiceNumber || null,
              period_from: c.r.from, period_to: c.r.to, interest: c.r.interest,
              account_code: cfg.account_code, tax_type: cfg.line_amount_types === "NoTax" ? null : cfg.tax_type, line_amount_types: cfg.line_amount_types,
              status: STATUS_MAP[x.Status] || "draft", created_by: u.user.id,
            });
            if (insErr) console.error("charge_postings insert failed", insErr.message);
            // Leave a note on the original invoice's history in Xero (best effort).
            await xero(t, "PUT", "/Invoices/" + encodeURIComponent(c.r.inv.external_id) + "/History", {
              HistoryRecords: [{ Details: ("DebtJet created draft interest invoice " + (x.InvoiceNumber || "") + " for " + money(c.r.interest) + " (" + fmtDate(c.r.from) + " to " + fmtDate(c.r.to) + ").").slice(0, 250) }],
            }).catch(() => null);
            results.push({ invoice_id: c.r.inv.id, ok: true, xero_invoice_id: x.InvoiceID, xero_invoice_number: x.InvoiceNumber || null, saved: !insErr });
          }
        }
      }
      return json({ ok: true, results });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ ok: false, error: e.message }, 400);
    console.error("xero-charges error", e);
    return json({ ok: false, error: "Something went wrong talking to Xero." }, 500);
  }
});
