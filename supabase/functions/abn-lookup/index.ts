import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ABN Lookup (Australian Business Register) for debtor contact cards.
//   { abn }            -> official details for that ABN
//   { acn }            -> official details for that ACN
//   { name }           -> up to 10 candidate businesses by name
//   + { debtor_id, save: true } -> store the details on the debtor and record whether
//                                  the debtor's name matches the register.
// The GUID (free, from abr.business.gov.au) lives in the ABR_GUID secret and never
// reaches the browser. Row-level security still limits which debtors can be updated.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
function validAbn(abn: string) {
  if (!/^\d{11}$/.test(abn)) return false;
  const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const d = abn.split("").map(Number); d[0] -= 1;
  return d.reduce((s, x, i) => s + x * w[i], 0) % 89 === 0;
}
function validAcn(acn: string) {
  if (!/^\d{9}$/.test(acn)) return false;
  const d = acn.split("").map(Number);
  const sum = d.slice(0, 8).reduce((s, x, i) => s + x * (8 - i), 0);
  return (10 - (sum % 10)) % 10 === d[8];
}
// Names compared without punctuation, case, "Pty Ltd"-style suffixes or a leading "The".
const SUFFIX = /\b(pty|ltd|limited|proprietary|p\/l|co|company|inc|incorporated|the|trust|trustee|for|atf|as trustee for)\b/g;
const norm = (s: string) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
function similarity(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter(Boolean)), B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / Math.min(A.size, B.size);
}
function nameCheck(ours: string, legal: string, businessNames: string[]) {
  const all = [legal, ...businessNames].filter(Boolean);
  if (all.some((n) => norm(n) === norm(ours))) return "match";
  if (all.some((n) => similarity(ours, n) >= 0.6)) return "similar";
  return "different";
}

async function abr(path: string, params: Record<string, string>, guid: string) {
  const q = new URLSearchParams({ ...params, callback: "cb", guid });
  const res = await fetch("https://abr.business.gov.au/json/" + path + "?" + q.toString());
  const text = await res.text();
  const m = text.match(/^\s*cb\(([\s\S]*)\)\s*;?\s*$/);
  return JSON.parse(m ? m[1] : text);
}
function shape(d: any) {
  return {
    abn: digits(d.Abn) || null,
    acn: digits(d.Acn) || null,
    legal_name: d.EntityName || null,
    entity_type: d.EntityTypeName || null,
    abn_status: d.AbnStatus || null,
    abn_status_from: d.AbnStatusEffectiveFrom || null,
    gst_from: d.Gst || null,
    abr_state: d.AddressState || null,
    abr_postcode: d.AddressPostcode || null,
    business_names: Array.isArray(d.BusinessName) ? d.BusinessName.filter(Boolean) : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);
    const guid = Deno.env.get("ABR_GUID");
    if (!guid) return json({ ok: false, error: "ABN Lookup isn't set up yet: add your free ABR GUID as the ABR_GUID secret in Supabase." }, 503);

    const p = await req.json();

    if (p.name && !p.abn && !p.acn) {
      const name = String(p.name).slice(0, 120);
      const r = await abr("MatchingNames.aspx", { name, maxResults: "10" }, guid);
      if (r.Message) return json({ ok: false, error: r.Message });
      const names = (r.Names || []).map((n: any) => ({
        abn: digits(n.Abn), name: n.Name, name_type: n.NameType, status: n.AbnStatus,
        current: n.IsCurrent, state: n.State, postcode: n.Postcode, score: n.Score,
      }));
      return json({ ok: true, results: names });
    }

    let details: any;
    if (p.acn) {
      const acn = digits(p.acn);
      if (!validAcn(acn)) return json({ ok: false, code: "invalid_acn", error: "That ACN isn't valid (check digit fails)." });
      details = await abr("AcnDetails.aspx", { acn }, guid);
    } else {
      const abn = digits(p.abn);
      if (!validAbn(abn)) {
        if (p.debtor_id && p.save) await sb.from("debtors").update({ name_check: "invalid_abn", abr_checked_at: new Date().toISOString() }).eq("id", p.debtor_id);
        return json({ ok: false, code: "invalid_abn", error: "That ABN isn't valid (check digits fail). Check it for typos." });
      }
      details = await abr("AbnDetails.aspx", { abn }, guid);
    }
    if (details.Message || !details.Abn) {
      if (p.debtor_id && p.save) await sb.from("debtors").update({ name_check: "not_found", abr_checked_at: new Date().toISOString() }).eq("id", p.debtor_id);
      return json({ ok: false, code: "not_found", error: details.Message || "No business found on the ABN register." });
    }
    const out = shape(details);

    let check: string | null = null;
    if (p.debtor_id) {
      const { data: d } = await sb.from("debtors").select("id, name").eq("id", p.debtor_id).maybeSingle();
      if (!d) return json({ error: "Debtor not found." }, 404);
      check = out.abn_status && out.abn_status.toLowerCase() !== "active" ? "cancelled" : nameCheck(d.name, out.legal_name || "", out.business_names);
      if (p.save) {
        const { error } = await sb.from("debtors").update({
          ...out, abn: out.abn, acn: out.acn && /^\d{9}$/.test(out.acn) ? out.acn : null,
          name_check: check, abr_checked_at: new Date().toISOString(),
        }).eq("id", p.debtor_id);
        if (error) return json({ ok: false, error: "Could not save: " + error.message }, 500);
      }
    }
    return json({ ok: true, details: out, name_check: check });
  } catch (e) {
    console.error("abn-lookup error", e);
    return json({ error: "ABN Lookup failed: " + String((e as Error).message || e) }, 500);
  }
});
