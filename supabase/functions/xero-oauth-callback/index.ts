import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const XERO_CLIENT_ID = "8531C25BD29F406E840BA5BDD3524D27";
const APP_URL = "https://accountsdebtjet.github.io/DebtJet/";

function redirectTo(status: string) {
  return Response.redirect(`${APP_URL}?xero=${status}`, 302);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam || !code || !state) {
    console.error("Xero callback missing code/state or returned error", errParam);
    return redirectTo("error");
  }

  const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
  if (!clientSecret) {
    console.error("XERO_CLIENT_SECRET is not set as an edge function secret");
    return redirectTo("error");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supabaseUrl}/functions/v1/xero-oauth-callback`;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The state must be a single-use value issued by create_xero_oauth_state to a
  // signed-in member of the organisation within the last 10 minutes. Consuming it
  // deletes it, so it can't be replayed, and it can't be forged from an org ID.
  const { data: orgId, error: stateErr } = await supabase.rpc("consume_xero_oauth_state", { p_state: state });
  if (stateErr || !orgId) {
    console.error("Invalid, expired or already-used Xero OAuth state", stateErr ? JSON.stringify(stateErr) : "");
    return redirectTo("error");
  }

  try {
    const basicAuth = btoa(`${XERO_CLIENT_ID}:${clientSecret}`);
    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error("Xero token exchange failed", JSON.stringify(tokenData));
      return redirectTo("error");
    }

    const connRes = await fetch("https://api.xero.com/connections", {
      headers: { "Authorization": `Bearer ${tokenData.access_token}` },
    });
    const connections = await connRes.json();
    const tenant = Array.isArray(connections) ? connections[0] : null;
    if (!tenant) {
      console.error("No Xero tenant connections returned");
      return redirectTo("error");
    }

    const { error: rpcError } = await supabase.rpc("store_xero_connection", {
      p_org_id: orgId,
      p_refresh_token: tokenData.refresh_token,
      p_tenant_id: tenant.tenantId,
      p_tenant_name: tenant.tenantName,
    });
    if (rpcError) {
      console.error("store_xero_connection failed", JSON.stringify(rpcError));
      return redirectTo("error");
    }

    return redirectTo("connected");
  } catch (e) {
    console.error("Xero OAuth callback error", e);
    return redirectTo("error");
  }
});
