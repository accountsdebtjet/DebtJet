import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Drafts a factual response to ONE point the debtor disputes, using only the business's own
// records (invoices, payments, letters sent, logged correspondence, notes, case events).
// Every factual sentence must cite an evidence key; anything the records don't support is
// returned as a "gap" instead of being written. No legal argument, no predictions.
// Nothing is saved here: the app shows the draft and the user edits and approves it.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in." }, 401);

    const p = await req.json();
    // Row-level security limits every read below to the user's own organisation.
    const { data: c } = await sb.from("cases").select("id, org_id, debtor_id").eq("id", p.case_id).maybeSingle();
    if (!c) return json({ error: "Case not found." }, 404);
    const debtorSays = clip(p.debtor_says, 4000).trim();
    if (!debtorSays && !p.list_only) return json({ error: "Enter what the debtor says first." }, 400);
    const focusInvoice = p.invoice_id ? String(p.invoice_id) : null;
    const pick: string[] | null = Array.isArray(p.evidence_keys) && p.evidence_keys.length ? p.evidence_keys.map(String).slice(0, 60) : null;

    const [{ data: org }, { data: debtor }, { data: invoices }, { data: payments }, { data: letters }, { data: log }, { data: notes }, { data: events }] = await Promise.all([
      sb.from("organizations").select("name").eq("id", c.org_id).maybeSingle(),
      sb.from("debtors").select("name, legal_name").eq("id", c.debtor_id).maybeSingle(),
      sb.from("invoices").select("id, invoice_number, description, amount, issued_date, due_date, status").eq("debtor_id", c.debtor_id).order("due_date"),
      sb.from("payments").select("invoice_id, amount, paid_at, method").eq("case_id", c.id).order("paid_at"),
      sb.from("letters").select("id, type, subject, sent_at, send_via, status").eq("case_id", c.id).eq("status", "sent").order("sent_at"),
      sb.from("correspondence_log").select("id, direction, channel, occurred_at, subject, summary").eq("debtor_id", c.debtor_id).order("occurred_at").limit(60),
      sb.from("case_notes").select("id, invoice_id, category, summary, dispute_reason, occurred_at, source").eq("debtor_id", c.debtor_id).order("occurred_at").limit(60),
      sb.from("case_events").select("id, event_type, title, body, occurred_at").eq("case_id", c.id).order("occurred_at").limit(60),
    ]);

    // Evidence keys are stable and human-readable so the user can check each citation.
    const invNo: Record<string, string> = {};
    const evidence: { key: string; type: string; date: string | null; text: string }[] = [];
    (invoices || []).forEach((i: any) => {
      invNo[i.id] = i.invoice_number;
      evidence.push({ key: "INV:" + i.invoice_number, type: "invoice", date: i.issued_date,
        text: `Invoice ${i.invoice_number} issued ${i.issued_date || "?"}, due ${i.due_date || "?"}, amount $${Number(i.amount).toFixed(2)}, status ${i.status}. Description: ${clip(i.description, 300) || "(none)"}` });
    });
    (payments || []).forEach((x: any, n: number) => evidence.push({ key: "PAY:" + (n + 1), type: "payment", date: x.paid_at,
      text: `Payment of $${Number(x.amount).toFixed(2)} received ${x.paid_at}${x.invoice_id ? " against " + (invNo[x.invoice_id] || "an invoice") : ""} (${x.method || "method not recorded"}).` }));
    (letters || []).forEach((l: any, n: number) => evidence.push({ key: "LTR:" + (n + 1), type: "letter", date: l.sent_at,
      text: `Letter sent (${String(l.type).replace(/_/g, " ")}) on ${String(l.sent_at).slice(0, 10)} via ${l.send_via || "?"}. Subject: ${clip(l.subject, 200)}` }));
    (log || []).forEach((x: any, n: number) => evidence.push({ key: "LOG:" + (n + 1), type: "correspondence", date: x.occurred_at,
      text: `${x.direction === "in" ? "Received from debtor" : x.direction === "out" ? "Sent to debtor" : "Internal note"} by ${x.channel} on ${String(x.occurred_at).slice(0, 10)}${x.subject ? " (" + clip(x.subject, 120) + ")" : ""}: ${clip(x.summary, 700)}` }));
    // Hardship notes can hold health or personal details: never sent to the model or cited.
    (notes || []).filter((x: any) => x.category !== "hardship").forEach((x: any, n: number) => evidence.push({ key: "NOTE:" + (n + 1), type: "note", date: x.occurred_at,
      text: `${x.source === "manual" ? "Staff note" : "Summary of an email from the debtor"} on ${String(x.occurred_at).slice(0, 10)} (${x.category}${x.invoice_id ? ", " + (invNo[x.invoice_id] || "invoice") : ""}): ${clip(x.summary, 700)}${x.dispute_reason ? " Dispute reason: " + clip(x.dispute_reason, 300) : ""}` }));
    (events || []).forEach((x: any, n: number) => evidence.push({ key: "EVT:" + (n + 1), type: "event", date: x.occurred_at,
      text: `${clip(x.title, 160)} on ${String(x.occurred_at).slice(0, 10)}${x.body ? ": " + clip(x.body, 300) : ""}` }));

    if (p.list_only) return json({ ok: true, all_evidence_keys: evidence });
    const used = pick ? evidence.filter((e) => pick.includes(e.key)) : evidence;
    if (!used.length) return json({ ok: false, error: "There are no records to draft from yet. Add invoices, notes or correspondence first.", evidence }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ ok: false, error: "AI drafting isn't set up yet: add ANTHROPIC_API_KEY to the Supabase Edge Function secrets.", evidence }, 503);
    const model = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";

    const system =
      "You help an Australian business write a short, factual response to one point a customer disputes about an unpaid invoice. " +
      "The business will review, edit and approve it, and may use it in a tribunal or court application it prepares itself. " +
      "STRICT RULES: (1) Use ONLY facts found in EVIDENCE. Never invent dates, amounts, conversations, documents or events. " +
      "(2) End every sentence that states a fact with its evidence key(s) in square brackets, e.g. [INV:1043] or [LOG:2][LTR:1]. " +
      "(3) If the business's position on a point is not supported by EVIDENCE, do not write it; list it in gaps as the record that is missing. " +
      "If EVIDENCE supports the customer's point, say so plainly in gaps; do not hide or downplay it. " +
      "(4) No legal argument: no legislation, case law, legal tests, predictions of outcome, threats or advice. " +
      "(5) Neutral and courteous: do not call the customer dishonest or comment on their motives. Summaries of the customer's emails are their claims, not proven facts. " +
      "(6) Write in the first person plural for the business ('we'), plain text, Australian English, no markdown, under 250 words. " +
      "(7) questions_for_you: up to 4 short questions the business should answer to fill gaps.";
    const facts = {
      business: org?.name || "the business",
      customer: debtor?.legal_name || debtor?.name || "the customer",
      today: new Date().toISOString().slice(0, 10),
      disputed_invoice: focusInvoice ? invNo[focusInvoice] || null : null,
      customer_says: debtorSays,
      EVIDENCE: used,
    };
    const schema = { type: "object", additionalProperties: false, properties: {
      response: { type: "string" },
      used_evidence: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      questions_for_you: { type: "array", items: { type: "string" } },
    }, required: ["response", "used_evidence", "gaps", "questions_for_you"] };

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 1200, system,
        output_config: { format: { type: "json_schema", schema } },
        messages: [{ role: "user", content: "FACTS (JSON):\n" + JSON.stringify(facts) + "\n\nWrite the response to what the customer says." }],
      }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) {
      console.error("Anthropic API error", JSON.stringify(ai));
      return json({ ok: false, error: "The AI service returned an error: " + (ai?.error?.message || aiRes.status), evidence }, 502);
    }
    const text = (ai.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    let out: any;
    try { out = JSON.parse(text); } catch (_e) { return json({ ok: false, error: "The AI reply couldn't be read. Please try again.", evidence }, 502); }

    // Check citations against the evidence actually supplied; flag any that don't exist.
    const keys = new Set(used.map((e) => e.key));
    const cited = Array.from(new Set(String(out.response || "").match(/\[([A-Z]+:[^\]]+)\]/g) || [])).map((m) => m.slice(1, -1));
    const unknown = cited.filter((k) => !keys.has(k));
    const usedEv = used.filter((e) => cited.includes(e.key) || (out.used_evidence || []).includes(e.key));
    return json({ ok: true, model, draft: { response: out.response, gaps: out.gaps || [], questions: out.questions_for_you || [] },
      evidence: usedEv, unknown_citations: unknown, all_evidence_keys: evidence.map((e) => ({ key: e.key, type: e.type, date: e.date, text: e.text })) });
  } catch (e) {
    console.error("dispute-response error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
