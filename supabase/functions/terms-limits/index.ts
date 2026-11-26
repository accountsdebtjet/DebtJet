import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { baselineFromReview, checkEvidence, evidenceNeeds, quoteFound } from "./terms-evidence.ts";

// Confirms "What these terms allow" for one terms document. Only this function (and review-terms) can write
// limits: anything beyond DebtJet AI's reading must come with a quote found word for word in the document and
// containing the value. Every confirmation is logged. Owners and admins only.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const KINDS = ["terms_of_trade", "terms_of_service", "credit_application", "quote_or_contract", "other"];
const r2 = (n: number) => Math.round(Number(n) * 100) / 100;
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

function cleanLimits(L: any) {
  const I = L?.interest || {};
  const start = ["due_date", "after_grace", "first_demand", "final_demand"].includes(I.start) ? I.start : "due_date";
  const rate = Number(I.max_rate_pa);
  return {
    interest: {
      allowed: !!I.allowed && rate > 0 && rate <= 1,
      max_rate_pa: I.allowed && rate > 0 ? Math.round(rate * 10000) / 10000 : null,
      method: I.method === "compound_monthly" ? "compound_monthly" : "simple",
      start, grace_days: start === "after_grace" ? Math.max(0, Math.min(365, Math.round(Number(I.grace_days) || 0))) : 0,
      clause: clip(I.clause, 30), rate_text: clip(I.rate_text, 200),
    },
    fees: (Array.isArray(L?.fees) ? L.fees : []).slice(0, 12).filter((f: any) => String(f?.name || "").trim() && Number(f.max_amount) > 0).map((f: any) => ({
      name: clip(String(f.name).trim(), 40), type: f.type === "percent" ? "percent" : "fixed", max_amount: r2(f.max_amount),
      applies: f.applies === "per_statement" ? "per_statement" : "per_invoice",
      min_after_days: Math.max(1, Math.min(365, Math.round(Number(f.min_after_days) || 1))), clause: clip(f.clause, 30),
    })),
    manual: (Array.isArray(L?.manual) ? L.manual : []).slice(0, 20).map((m: any) => ({ name: clip(m.name, 60), text: clip(m.text, 300), clause: clip(m.clause, 30) })),
  };
}
const START_ORDER: Record<string, number> = { due_date: 0, after_grace: 1, first_demand: 2, final_demand: 3 };
// Rules held within the limits (mirrors clampToLimits in the app).
function clampRules(rules: any, L: any) {
  const r = JSON.parse(JSON.stringify(rules || {})), I = L.interest || {};
  if (r.interest_enabled) {
    if (!I.allowed) r.interest_enabled = false;
    else {
      if (I.max_rate_pa != null && Number(r.rate_pa) > I.max_rate_pa) r.rate_pa = I.max_rate_pa;
      if (r.method === "compound_monthly" && I.method !== "compound_monthly") r.method = "simple";
      const s = r.interest_start, g = Number(r.grace_days) || 0;
      const ok = I.start === "due_date" || (I.start === "after_grace" && s === "after_grace" && g >= I.grace_days)
        || (I.start === "first_demand" && (s === "first_demand" || s === "final_demand")) || (I.start === "final_demand" && s === "final_demand");
      if (!ok) { r.interest_start = I.start; r.grace_days = I.grace_days; }
    }
  }
  r.fees = (r.fees || []).filter((f: any) => {
    const m = L.fees.find((x: any) => x.name.toLowerCase() === String(f.name).toLowerCase());
    if (!m || m.type !== f.type) return false;
    f.applies = m.applies;
    if (Number(f.amount) > m.max_amount) f.amount = m.max_amount;
    if ((Number(f.after_days) || 1) < m.min_after_days) f.after_days = m.min_after_days;
    return true;
  });
  return r;
}
function rulesFromLimits(L: any) {
  const I = L.interest;
  return { interest_enabled: !!I.allowed, rate_pa: I.max_rate_pa || 0, method: I.method, interest_start: I.start, grace_days: I.grace_days,
    min_balance: 0, cap_pct: null, fees: L.fees.map((f: any) => ({ name: f.name, type: f.type, amount: f.max_amount, applies: f.applies, after_days: f.min_after_days })) };
}
function describe(L: any) {
  const I = L.interest, out: Record<string, string> = {};
  out.interest = I.allowed ? "up to " + r2(I.max_rate_pa * 100) + "% a year, " + (I.method === "compound_monthly" ? "compounding allowed" : "simple") + ", " +
    (I.start === "after_grace" ? "after " + I.grace_days + " days overdue" : I.start.replace(/_/g, " ")) : "no interest";
  for (const f of L.fees) out["fee:" + f.name.toLowerCase()] = f.name + " up to " + (f.type === "percent" ? f.max_amount + "%" : "$" + f.max_amount.toFixed(2)) +
    (f.applies === "per_statement" ? " per statement" : " per invoice") + " from " + f.min_after_days + " days";
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);
    const p = await req.json();

    const { data: doc } = await sb.from("org_terms_documents").select("*").eq("id", p.document_id).maybeSingle();
    if (!doc) return json({ error: "Document not found." }, 404);
    const { data: mem } = await admin.from("org_members").select("role").eq("org_id", doc.org_id).eq("user_id", u.user.id).maybeSingle();
    if (!mem || !["owner", "admin"].includes(String(mem.role))) return json({ error: "Only owners and admins can confirm what terms allow." }, 403);

    const kind = KINDS.includes(p.kind) ? p.kind : doc.kind;
    const limits: any = cleanLimits(p.limits);
    const docText = String(doc.doc_text || (doc.source === "text" ? doc.body_text : "") || "");
    const base = baselineFromReview(doc.review);
    const evidence = (p.evidence && typeof p.evidence === "object") ? p.evidence : {};

    // Anything beyond DebtJet AI's reading needs the document's own words.
    const needs = evidenceNeeds(base, limits);
    const problems = checkEvidence(docText, needs, evidence);
    if (problems.length) return json({ ok: false, error: problems[0], problems }, 422);

    // Record where each value comes from.
    const ev: Record<string, any> = {};
    const needKeys = new Set(needs.map((n) => n.key));
    const aiEv = (clause: string, quote: string) => ({ source: "ai", clause, quote: clip(quote, 300), found: quoteFound(docText, quote) });
    const userEv = (k: string) => ({ source: "quote", clause: clip(evidence[k]?.clause, 30), quote: clip(evidence[k]?.quote, 500), found: true });
    if (limits.interest.allowed) {
      for (const k of ["interest", "rate", "method", "start"]) {
        ev[k] = needKeys.has(k) ? userEv(k) : aiEv(base.interest.clause, base.interest.quote);
      }
      limits.interest.clause = limits.interest.clause || (needKeys.has("rate") ? clip(evidence.rate?.clause, 30) : base.interest.clause);
    }
    for (const f of limits.fees) {
      const k = "fee:" + f.name.toLowerCase();
      const b = base.fees.find((x: any) => x.name.toLowerCase() === f.name.toLowerCase());
      ev[k] = needKeys.has(k) ? userEv(k) : aiEv(b?.clause || f.clause, b?.quote || "");
      if (!f.clause) f.clause = ev[k].clause;
    }
    limits.evidence = ev;
    limits.text_checked = !!docText;

    // Log what changed.
    const before = doc.limits ? describe(cleanLimits(doc.limits)) : describe(cleanLimits(base));
    const after = describe(limits);
    const changes: string[] = [];
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[k] !== after[k]) changes.push((before[k] ? before[k] : "(none)") + " → " + (after[k] ? after[k] : "(removed)"));
    }
    const entry = {
      at: new Date().toISOString(), by: u.user.id, by_email: u.user.email || null,
      action: doc.rules_confirmed_at ? "changed" : "confirmed", compared_with: doc.limits ? "previous confirmation" : "DebtJet AI reading",
      changes, quotes: needs.map((n) => ({ what: n.label, clause: clip(evidence[n.key]?.clause, 30), quote: clip(evidence[n.key]?.quote, 500) })),
    };
    const log = (Array.isArray(doc.limits_log) ? doc.limits_log : []).concat([entry]).slice(-100);
    const rules = doc.rules ? clampRules(doc.rules, limits) : rulesFromLimits(limits);

    const { data: saved, error } = await admin.from("org_terms_documents").update({
      kind, limits, limits_log: log, rules, rules_confirmed_at: entry.at, rules_confirmed_by: u.user.id,
    }).eq("id", doc.id).select("*").single();
    if (error) return json({ ok: false, error: "Could not save: " + error.message }, 500);
    return json({ ok: true, document: saved });
  } catch (e) {
    console.error("terms-limits error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
