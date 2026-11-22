import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Disconnects Xero for one organisation: revokes the refresh token at Xero (which also
// removes DebtJet's access to that Xero organisation), then deletes the stored token and
// connection. Invoices and contacts already synced into DebtJet are kept.
// Owners and admins only.

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { org_id } = await req.json();
    if (!org_id) return json({ error: "org_id is required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);

    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: member } = await svc.from("org_members").select("role").eq("org_id", org_id).eq("user_id", u.user.id).maybeSingle();
    if (!member) return json({ error: "Not a member of this organisation." }, 403);
    if (!["owner", "admin"].includes(String(member.role))) return json({ error: "Only an owner or admin can disconnect Xero." }, 403);

    // Revoke at Xero first. If Xero can't be reached, still remove it here (the token is deleted
    // either way), and tell the user they can also remove DebtJet under Xero's Connected apps.
    let revoked = false;
    const { data: token } = await svc.rpc("get_xero_refresh_token", { p_org_id: org_id });
    const secret = Deno.env.get("XERO_CLIENT_SECRET");
    if (token && secret) {
      try {
        const r = await fetch("https://identity.xero.com/connect/revocation", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + btoa(XERO_CLIENT_ID + ":" + secret) },
          body: new URLSearchParams({ token }),
        });
        revoked = r.ok;
        if (!r.ok) console.error("Xero revocation failed", r.status, await r.text());
      } catch (e) { console.error("Xero revocation error", e); }
    }

    const { error } = await svc.rpc("remove_xero_connection", { p_org_id: org_id });
    if (error) return json({ error: "Could not remove the connection: " + error.message }, 500);
    return json({ ok: true, revoked });
  } catch (e) {
    console.error("xero-disconnect error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
