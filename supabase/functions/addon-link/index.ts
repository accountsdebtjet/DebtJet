import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Signed-in DebtJet user asks for a one-time code to connect the Gmail add-on.
// Only a SHA-256 hash of the code is stored; it expires in 10 minutes and works once.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);

    const bytes = crypto.getRandomValues(new Uint8Array(10));
    let raw = "";
    for (let i = 0; i < 10; i++) raw += ALPHABET[bytes[i] % ALPHABET.length];
    const code = raw.slice(0, 5) + "-" + raw.slice(5);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    await admin.from("addon_link_codes").delete().eq("user_id", u.user.id);
    const { error } = await admin.from("addon_link_codes").insert({ code_hash: await sha256(raw), user_id: u.user.id });
    if (error) throw error;

    return json({ ok: true, code, expires_in: 600 });
  } catch (e) {
    console.error("addon-link error", e);
    return json({ error: "Could not create a connection code." }, 500);
  }
});
