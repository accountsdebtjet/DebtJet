import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function dateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.substring(0, 10);
}

function contactPhone(contact: any): string | null {
  const phones = contact.Phones || [];
  const p = phones.find((x: any) => x.PhoneType === "DEFAULT" && x.PhoneNumber) ||
    phones.find((x: any) => x.PhoneType === "MOBILE" && x.PhoneNumber) || phones.find((x: any) => x.PhoneNumber);
  if (!p || !p.PhoneNumber) return null;
  return [p.PhoneAreaCode, p.PhoneNumber].filter(Boolean).join(" ");
}

function contactPersonName(contact: any): string | null {
  const own = [contact.FirstName, contact.LastName].filter(Boolean).join(" ").trim();
  if (own) return own;
  const p = (contact.ContactPersons || [])[0];
  if (!p) return null;
  const name = [p.FirstName, p.LastName].filter(Boolean).join(" ").trim();
  return name || null;
}

// Postal address first (where letters go), then the street address.
function contactAddress(contact: any) {
  const list = contact.Addresses || [];
  const a = list.find((x: any) => x.AddressType === "POBOX" && x.AddressLine1) || list.find((x: any) => x.AddressType === "STREET" && x.AddressLine1);
  if (!a) return null;
  const st = String(a.Region || "").trim().toUpperCase();
  return {
    address_line1: a.AddressLine1 || null,
    address_line2: [a.AddressLine2, a.AddressLine3, a.AddressLine4].filter(Boolean).join(", ") || null,
    suburb: a.City || null,
    state: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].includes(st) ? st : null,
    postcode: /^\d{4}$/.test(String(a.PostalCode || "").trim()) ? String(a.PostalCode).trim() : null,
    country: a.Country || null,
  };
}

// Best guess at the debtor type from Xero alone; the user (or the ABN register) can change it.
function guessKind(contact: any): string | null {
  const name = String(contact.Name || "").trim();
  if (/\b(pty\.? ?ltd|limited|ltd)\b/i.test(name) || contact.CompanyNumber) return "company";
  const person = [contact.FirstName, contact.LastName].filter(Boolean).join(" ").trim();
  if (!contact.TaxNumber && person && person.toLowerCase() === name.toLowerCase()) return "individual";
  return null;
}

async function xeroFetch(path: string, accessToken: string, tenantId: string) {
  const res = await fetch(`https://api.xero.com${path}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function fetchAllPages(basePath: string, listKey: string, accessToken: string, tenantId: string, maxPages = 50) {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const data = await xeroFetch(`${basePath}${sep}page=${page}`, accessToken, tenantId);
    const batch = data[listKey] || [];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

const KEEP_FIELDS = ["address_line1", "address_line2", "suburb", "state", "postcode", "country", "acn", "debtor_kind"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { org_id } = await req.json();
    if (!org_id) return json({ error: "org_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Acts as the calling user — every read/write below is still gated by RLS,
    // so a user who isn't a member of org_id simply can't write anything.
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: org } = await supabaseUser.from("organizations").select("id").eq("id", org_id).maybeSingle();
    if (!org) return json({ error: "Not a member of this organisation" }, 403);

    // Service-role client — only used for the parts RLS deliberately locks out of
    // normal users: reading the Vault-stored refresh token and rotating it.
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: conn } = await supabaseService
      .from("xero_connections")
      .select("tenant_id, tenant_name, last_synced_at")
      .eq("org_id", org_id)
      .maybeSingle();
    if (!conn) return json({ error: "Xero isn't connected for this organisation yet." }, 400);

    const { data: refreshToken, error: tokenErr } = await supabaseService.rpc("get_xero_refresh_token", { p_org_id: org_id });
    if (tokenErr || !refreshToken) return json({ error: "Could not read the stored Xero connection. Try reconnecting Xero." }, 400);

    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
    if (!clientSecret) return json({ error: "XERO_CLIENT_SECRET isn't configured on this project." }, 500);

    // 1. Exchange the refresh token for a fresh access token. Xero rotates the
    //    refresh token on every use, so the new one must be saved immediately
    //    or the connection breaks on the next sync.
    const basicAuth = btoa(`${XERO_CLIENT_ID}:${clientSecret}`);
    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Xero token refresh failed", JSON.stringify(tokenData));
      return json({ error: "Xero rejected the stored connection. Please reconnect Xero in Integrations." }, 400);
    }
    const accessToken = tokenData.access_token as string;

    const { error: rotateErr } = await supabaseService.rpc("store_xero_connection", {
      p_org_id: org_id,
      p_refresh_token: tokenData.refresh_token,
      p_tenant_id: conn.tenant_id,
      p_tenant_name: conn.tenant_name,
    });
    if (rotateErr) console.error("Failed to store rotated refresh token", JSON.stringify(rotateErr));

    // 2. Pull customer contacts and upsert them as debtors, keyed by Xero's
    //    ContactID so repeated syncs update rather than duplicate.
    //    Xero owns name, ABN, email and phone. Address, ACN and debtor type only
    //    fill in when DebtJet has none, so edits made in DebtJet are kept.
    const contacts = await fetchAllPages("/api.xro/2.0/Contacts?where=IsCustomer%3D%3Dtrue", "Contacts", accessToken, conn.tenant_id);

    const ids = contacts.map((c: any) => c.ContactID).filter(Boolean);
    const existing: Record<string, any> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabaseUser.from("debtors").select("xero_contact_id, " + KEEP_FIELDS.join(", "))
        .eq("org_id", org_id).in("xero_contact_id", ids.slice(i, i + 200));
      (data || []).forEach((d: any) => { existing[d.xero_contact_id] = d; });
    }

    const debtorRows = contacts.map((c: any) => {
      const old = existing[c.ContactID] || {};
      const addr = contactAddress(c) || {} as any;
      const acn = String(c.CompanyNumber || "").replace(/\D/g, "");
      const keep = (k: string, v: any) => (old[k] !== undefined && old[k] !== null && old[k] !== "") ? old[k] : (v ?? null);
      return {
        org_id,
        xero_contact_id: c.ContactID,
        name: c.Name,
        abn: c.TaxNumber ? String(c.TaxNumber).replace(/\s+/g, "") : null,
        contact_name: contactPersonName(c),
        email: c.EmailAddress || null,
        phone: contactPhone(c),
        address_line1: keep("address_line1", addr.address_line1),
        address_line2: keep("address_line2", addr.address_line2),
        suburb: keep("suburb", addr.suburb),
        state: keep("state", addr.state),
        postcode: keep("postcode", addr.postcode),
        country: keep("country", addr.country),
        acn: keep("acn", acn.length === 9 ? acn : null),
        debtor_kind: keep("debtor_kind", guessKind(c)),
      };
    }).filter((d: any) => d.name);

    let contactIdToDebtorId: Record<string, string> = {};
    if (debtorRows.length) {
      const { data: upserted, error: debtorErr } = await supabaseUser
        .from("debtors")
        .upsert(debtorRows, { onConflict: "org_id,xero_contact_id" })
        .select("id, xero_contact_id");
      if (debtorErr) return json({ error: `Could not save debtors: ${debtorErr.message}` }, 500);
      (upserted || []).forEach((d: any) => { contactIdToDebtorId[d.xero_contact_id] = d.id; });
    }

    // 3. Pull sales invoices (incrementally after the first sync) and upsert
    //    them keyed by Xero's InvoiceID, reusing or opening a case per debtor.
    let invoicePath = `/api.xro/2.0/Invoices?where=Type%3D%3D%22ACCREC%22`;
    const extraHeaders: Record<string, string> = {};
    if (conn.last_synced_at) extraHeaders["If-Modified-Since"] = new Date(conn.last_synced_at).toUTCString();

    const invoices: any[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`https://api.xero.com${invoicePath}&page=${page}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Xero-tenant-id": conn.tenant_id,
          "Accept": "application/json",
          ...extraHeaders,
        },
      });
      if (res.status === 304) break;
      if (!res.ok) {
        const text = await res.text();
        return json({ error: `Xero invoices request failed: ${text}` }, 500);
      }
      const data = await res.json();
      const batch = data.Invoices || [];
      invoices.push(...batch);
      if (batch.length < 100) break;
    }

    let invoicesSynced = 0, invoicesSkipped = 0;
    const caseIdByDebtor: Record<string, string> = {};
    const invoiceRows: any[] = [];

    for (const inv of invoices) {
      const status = inv.Status;
      if (status === "VOIDED" || status === "DELETED" || status === "DRAFT" || status === "SUBMITTED") { invoicesSkipped++; continue; }
      const debtorId = contactIdToDebtorId[inv.Contact?.ContactID];
      if (!debtorId) { invoicesSkipped++; continue; }

      let caseId = caseIdByDebtor[debtorId];
      if (!caseId) {
        const { data: existingCase } = await supabaseUser
          .from("cases").select("id").eq("org_id", org_id).eq("debtor_id", debtorId).neq("status", "resolved").limit(1).maybeSingle();
        if (existingCase) {
          caseId = existingCase.id;
        } else {
          const { data: newCase, error: caseErr } = await supabaseUser
            .from("cases").insert({ org_id, debtor_id: debtorId, status: "new", interest_rate: 0.10 }).select("id").single();
          if (caseErr) { invoicesSkipped++; continue; }
          caseId = newCase.id;
        }
        caseIdByDebtor[debtorId] = caseId;
      }

      const lineDescs = (inv.LineItems || []).map((li: any) => li.Description).filter(Boolean).slice(0, 3).join("; ");
      const amountDue = Number(inv.AmountDue ?? 0);
      const invStatus = status === "PAID" ? "paid" : (amountDue <= 0.009 ? "paid" : "open");

      invoiceRows.push({
        org_id, debtor_id: debtorId, case_id: caseId,
        invoice_number: inv.InvoiceNumber || null,
        description: inv.Reference || lineDescs || "Xero invoice",
        amount: Number(inv.Total ?? 0),
        issued_date: dateOnly(inv.DateString),
        due_date: dateOnly(inv.DueDateString),
        status: invStatus,
        source: "xero",
        external_id: inv.InvoiceID,
      });
    }

    if (invoiceRows.length) {
      const { error: invErr } = await supabaseUser.from("invoices").upsert(invoiceRows, { onConflict: "org_id,source,external_id" });
      if (invErr) return json({ error: `Could not save invoices: ${invErr.message}` }, 500);
      invoicesSynced = invoiceRows.length;
    }

    await supabaseService.from("xero_connections").update({ last_synced_at: new Date().toISOString() }).eq("org_id", org_id);

    return json({
      ok: true,
      contactsSynced: debtorRows.length,
      invoicesSynced,
      invoicesSkipped,
    });
  } catch (e) {
    console.error("xero-sync error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
