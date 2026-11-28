import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Keeps DebtJet contact groups and Xero contact groups in step (backlog P7).
//
// Actions (any member of the organisation):
//   push   {group_id}             -> creates a DebtJet-made group in Xero with its members, and links it
//   add    {group_id, debtor_id}  -> adds a contact to a group (in Xero too, if the group is linked)
//   remove {group_id, debtor_id}  -> takes a contact out of a group (in Xero too, if the group is linked)
//
// Groups made only in DebtJet don't need this function for add/remove, but it handles them as well.
// xero-sync keeps linked groups' members in step with Xero on every sync, so linked groups are changed
// in Xero first, then in DebtJet.

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUIDISH = /^[0-9a-fA-F-]{36}$/;
class UserError extends Error {}

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
  return { access: tok.access_token as string, tenant: conn.tenant_id as string };
}

async function xero(t: { access: string; tenant: string }, method: string, path: string, body?: unknown) {
  const res = await fetch("https://api.xero.com/api.xro/2.0" + path, {
    method,
    headers: { Authorization: "Bearer " + t.access, "Xero-tenant-id": t.tenant, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.status === 401 || res.status === 403) throw new UserError("DebtJet doesn't have permission to change contact groups in Xero. Reconnect Xero in Integrations.");
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => ({}));
    const orgId = String(body.org_id || ""), action = String(body.action || ""), groupId = String(body.group_id || ""), debtorId = String(body.debtor_id || "");
    if (!UUIDISH.test(orgId) || !UUIDISH.test(groupId)) return json({ error: "org_id and group_id are required" }, 400);

    const { data: member } = await user.from("org_members").select("role").eq("org_id", orgId).eq("user_id", u.user.id).maybeSingle();
    if (!member) return json({ error: "Not a member of this organisation." }, 403);
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Read with the user's own access (RLS keeps this to their organisation).
    const { data: group } = await user.from("contact_groups").select("id, name, xero_group_id").eq("org_id", orgId).eq("id", groupId).maybeSingle();
    if (!group) return json({ error: "Group not found." }, 404);

    if (action === "push") {
      if (group.xero_group_id) return json({ ok: true, already: true, xero_group_id: group.xero_group_id });
      const { data: mem } = await user.from("contact_group_members").select("debtor_id").eq("group_id", groupId);
      const ids = (mem || []).map((m: any) => m.debtor_id);
      const { data: debtors } = ids.length ? await user.from("debtors").select("id, name, xero_contact_id").eq("org_id", orgId).in("id", ids) : { data: [] as any[] };
      const inXero = (debtors || []).filter((d: any) => d.xero_contact_id);
      const notInXero = (debtors || []).filter((d: any) => !d.xero_contact_id).map((d: any) => d.name);
      if (!inXero.length) return json({ ok: false, error: "None of this group's contacts came from Xero, so there is nothing to put in a Xero group." });
      const t = await xeroToken(service, orgId);
      const made = await xero(t, "PUT", "/ContactGroups", { ContactGroups: [{ Name: String(group.name).slice(0, 50) }] });
      const xg = made.data?.ContactGroups?.[0];
      if (!made.ok || !xg?.ContactGroupID) {
        const msg = (xg?.ValidationErrors || []).map((e: any) => e.Message).join(" ") || made.data?.Message || "Xero didn't create the group (" + made.status + ").";
        return json({ ok: false, error: msg });
      }
      const add = await xero(t, "PUT", "/ContactGroups/" + xg.ContactGroupID + "/Contacts", { Contacts: inXero.map((d: any) => ({ ContactID: d.xero_contact_id })) });
      if (!add.ok) return json({ ok: false, error: "The group was created in Xero, but Xero didn't accept its contacts (" + add.status + "). Try again, or add them in Xero." });
      const { error: upErr } = await user.from("contact_groups").update({ xero_group_id: xg.ContactGroupID, updated_at: new Date().toISOString() }).eq("id", groupId);
      if (upErr) return json({ ok: false, error: "Created in Xero, but DebtJet couldn't link it: " + upErr.message });
      // Contacts that aren't in Xero would drop out at the next sync (Xero groups follow Xero), so say which.
      return json({ ok: true, xero_group_id: xg.ContactGroupID, added: inXero.length, not_in_xero: notInXero });
    }

    if (action === "add" || action === "remove") {
      if (!UUIDISH.test(debtorId)) return json({ error: "debtor_id is required" }, 400);
      const { data: d } = await user.from("debtors").select("id, name, xero_contact_id").eq("org_id", orgId).eq("id", debtorId).maybeSingle();
      if (!d) return json({ error: "Contact not found." }, 404);
      if (group.xero_group_id) {
        if (!d.xero_contact_id) return json({ ok: false, error: d.name + " isn't a Xero contact, so it can't be in a group that comes from Xero." });
        const t = await xeroToken(service, orgId);
        const r = action === "add"
          ? await xero(t, "PUT", "/ContactGroups/" + group.xero_group_id + "/Contacts", { Contacts: [{ ContactID: d.xero_contact_id }] })
          : await xero(t, "DELETE", "/ContactGroups/" + group.xero_group_id + "/Contacts/" + d.xero_contact_id);
        if (!r.ok && !(action === "remove" && r.status === 404)) return json({ ok: false, error: "Xero didn't " + (action === "add" ? "add the contact to" : "remove the contact from") + " the group (" + r.status + ")." });
      }
      if (action === "add") {
        const { error } = await user.from("contact_group_members").upsert({ group_id: groupId, debtor_id: debtorId, org_id: orgId }, { onConflict: "group_id,debtor_id" });
        if (error) return json({ ok: false, error: error.message });
      } else {
        const { error } = await user.from("contact_group_members").delete().eq("group_id", groupId).eq("debtor_id", debtorId);
        if (error) return json({ ok: false, error: error.message });
      }
      return json({ ok: true, in_xero: !!group.xero_group_id });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ ok: false, error: e.message }, 400);
    console.error("xero-groups error", e);
    return json({ ok: false, error: "Something went wrong talking to Xero." }, 500);
  }
});
