import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Fetches "Pay online" links for invoices from the business's accounting system, so a
// statement can link each invoice to Xero's online invoice page (which shows Pay now
// when the business has Stripe, GoCardless etc. connected in Xero). Card details never
// touch DebtJet. Links are cached on the invoice for 7 days.
// QuickBooks: same idea via Invoice.InvoiceLink, added when the QuickBooks connection is built.

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const WEEK = 7 * 86400000;

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

    const { org_id, invoice_ids } = await req.json();
    if (!org_id || !Array.isArray(invoice_ids) || !invoice_ids.length) return json({ error: "org_id and invoice_ids are required" }, 400);

    // RLS: only invoices in an org this user belongs to come back.
    const { data: invs } = await user.from("invoices")
      .select("id, org_id, source, external_id, status, pay_url, pay_url_checked_at")
      .eq("org_id", org_id).in("id", invoice_ids.slice(0, 40));
    if (!invs) return json({ error: "Invoices not found." }, 404);

    const links: Record<string, string | null> = {};
    const stale = invs.filter((i: any) => {
      links[i.id] = i.pay_url || null;
      const fresh = i.pay_url_checked_at && Date.now() - new Date(i.pay_url_checked_at).getTime() < WEEK;
      return i.source === "xero" && i.external_id && i.status !== "paid" && !fresh;
    });
    if (!stale.length) return json({ ok: true, links, fetched: 0 });

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await service.from("xero_connections").select("tenant_id, tenant_name").eq("org_id", org_id).maybeSingle();
    if (!conn) return json({ ok: true, links, fetched: 0, note: "Xero isn't connected." });
    const { data: refreshToken } = await service.rpc("get_xero_refresh_token", { p_org_id: org_id });
    const secret = Deno.env.get("XERO_CLIENT_SECRET");
    if (!refreshToken || !secret) return json({ ok: false, links, error: "Could not read the Xero connection. Try reconnecting Xero." }, 400);

    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(XERO_CLIENT_ID + ":" + secret) },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.access_token) return json({ ok: false, links, error: "Xero rejected the connection. Please reconnect Xero in Integrations." }, 400);
    // Xero rotates the refresh token on every use: save the new one straight away.
    await service.rpc("store_xero_connection", { p_org_id: org_id, p_refresh_token: tok.refresh_token, p_tenant_id: conn.tenant_id, p_tenant_name: conn.tenant_name });

    let fetched = 0;
    for (const inv of stale) {
      let link: string | null = null;
      const r = await fetch("https://api.xero.com/api.xro/2.0/Invoices/" + encodeURIComponent(inv.external_id) + "/OnlineInvoice", {
        headers: { Authorization: "Bearer " + tok.access_token, "Xero-tenant-id": conn.tenant_id, Accept: "application/json" },
      });
      if (r.status === 429) break; // Xero rate limit (60/min): keep what we have.
      if (r.ok) {
        const d = await r.json();
        const v = d?.OnlineInvoices?.[0]?.OnlineInvoiceUrl;
        if (typeof v === "string" && /^https:\/\/in\.xero\.com\//.test(v)) link = v;
      }
      await user.from("invoices").update({ pay_url: link, pay_url_checked_at: new Date().toISOString() }).eq("id", inv.id);
      links[inv.id] = link; fetched++;
    }
    return json({ ok: true, links, fetched });
  } catch (e) {
    console.error("pay-links error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
