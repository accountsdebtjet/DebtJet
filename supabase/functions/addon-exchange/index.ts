import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// The Gmail add-on swaps a one-time connection code for its own DebtJet session.
// The session is separate from the web app's, so signing out of one doesn't affect the other.

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { code } = await req.json().catch(() => ({}));
    const raw = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length !== 10) return json({ error: "That code isn't valid. Codes look like ABCDE-FGH23." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Claim the code atomically: only an unused, unexpired code matches, and it's marked used in the same step.
    const { data: claimed, error: claimErr } = await admin.from("addon_link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code_hash", await sha256(raw)).is("used_at", null).gt("expires_at", new Date().toISOString())
      .select("user_id").maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return json({ error: "That code is wrong, expired or already used. Get a new one in DebtJet → Integrations." }, 400);

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(claimed.user_id);
    if (userErr || !userRes?.user?.email) throw userErr || new Error("User has no email");

    // Mint a fresh session for this user without sending any email.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: userRes.user.email });
    if (linkErr || !link?.properties?.hashed_token) throw linkErr || new Error("No token generated");

    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    let { data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
    if (vErr || !v?.session) {
      ({ data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" }));
    }
    if (vErr || !v?.session) throw vErr || new Error("No session");

    const s = v.session;
    return json({
      ok: true,
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: { id: s.user.id, email: s.user.email },
    });
  } catch (e) {
    console.error("addon-exchange error", e);
    return json({ error: "Could not connect. Please try a new code." }, 500);
  }
});
