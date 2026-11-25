import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";

// DebtJet AI review of a business's own terms of trade / service.
// Reads the uploaded file (PDF, Word .docx or text) or the text written in the app, asks Claude
// to pull out what matters for interest and fees (payment terms, interest clause, fees, recovery
// costs, how the customer agrees), and saves the review on the document row. Nothing changes the
// Interest & Fees rules here: the app shows the findings and a person chooses to apply them.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_TEXT = 120000;

function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f: any) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("That Word file has no readable text.");
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const str = { type: "string" };
const numOrNull = { anyOf: [{ type: "number" }, { type: "null" }] };
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    is_terms: { type: "boolean" },
    document_kind: { type: "string", enum: ["terms_of_trade", "terms_of_service", "credit_application", "other"] },
    summary: str,
    acceptance: str,
    governing_law: str,
    payment_terms: { type: "object", additionalProperties: false, properties: {
      days: numOrNull,
      basis: { type: "string", enum: ["invoice_date", "end_of_month", "on_completion", "other", "not_stated"] },
      text: str, clause: str,
    }, required: ["days", "basis", "text", "clause"] },
    interest: { type: "object", additionalProperties: false, properties: {
      stated: { type: "boolean" },
      rate_pa_percent: numOrNull,
      rate_text: str,
      method: { type: "string", enum: ["simple", "compound_monthly", "not_stated"] },
      start: { type: "string", enum: ["due_date", "after_days", "first_demand", "final_demand", "not_stated"] },
      start_days: numOrNull,
      clause: str, quote: str,
    }, required: ["stated", "rate_pa_percent", "rate_text", "method", "start", "start_days", "clause", "quote"] },
    fees: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      name: str,
      type: { type: "string", enum: ["fixed", "percent"] },
      amount: numOrNull,
      trigger: { type: "string", enum: ["overdue_invoice", "per_reminder_or_statement", "dishonoured_payment", "recovery_costs", "other"] },
      after_days: numOrNull,
      clause: str, quote: str,
      debtjet_can_charge: { type: "boolean" },
      note: str,
    }, required: ["name", "type", "amount", "trigger", "after_days", "clause", "quote", "debtjet_can_charge", "note"] } },
    recovery_costs: { type: "object", additionalProperties: false, properties: {
      stated: { type: "boolean" }, scope: str, clause: str,
    }, required: ["stated", "scope", "clause"] },
    key_points: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      topic: str, finding: str, clause: str,
      effect: { type: "string", enum: ["supports_charges", "limits_charges", "neutral", "missing"] },
    }, required: ["topic", "finding", "clause", "effect"] } },
    cautions: { type: "array", items: str },
  },
  required: ["is_terms", "document_kind", "summary", "acceptance", "governing_law", "payment_terms", "interest", "fees", "recovery_costs", "key_points", "cautions"],
};

const SYSTEM =
  "You review an Australian business's OWN terms of trade or terms of service for DebtJet, software that works out interest and fees on the business's overdue invoices. " +
  "Report only what the document actually says, with its clause numbers (or headings if unnumbered). Never invent a rate, fee, number or clause. " +
  "If something is not in the document, say it is not stated. Quotes must be copied exactly and kept under 30 words. " +
  "You are not giving legal advice: do not say whether a clause is enforceable, do not predict outcomes of disputes, tribunals or court, and do not recommend suing. " +
  "Cautions are short, general points for the business to check with its own adviser, for example: " +
  "the terms only bind a customer who agreed to them before the supply (signed application, accepted quote, or clearly provided terms); " +
  "standard-form contracts with small businesses or consumers are covered by the unfair contract terms laws; " +
  "a fixed late fee should reflect the business's genuine costs rather than act as a penalty; " +
  "a very high interest rate (well above commercial rates) can be challenged; " +
  "interest should not be charged on disputed amounts. Only include cautions that apply to this document. " +
  "debtjet_can_charge is true only for a fee DebtJet can add automatically: a fixed or percentage amount on overdue invoices, or once per reminder or statement. " +
  "Dishonour fees, actual recovery or legal costs and anything event-based are false, with a note saying it must be added manually when it happens. " +
  "key_points: 4 to 10 points that matter for chasing unpaid invoices (payment terms, interest, fees, recovery costs, how the customer accepts the terms, " +
  "disputes process, suspending supply, retention of title or security, guarantees, how payments are applied). Use effect 'missing' for an important topic the document does not cover. " +
  "Write in plain Australian English. If the document is not terms of trade or service at all, set is_terms false and explain in summary.";

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
    const { data: doc } = await sb.from("org_terms_documents").select("*").eq("id", p.document_id).maybeSingle();
    if (!doc) return json({ error: "Document not found." }, 404);

    // Build the document part of the message.
    let part: any;
    if (doc.source === "text") {
      part = { type: "text", text: "DOCUMENT (" + doc.title + "):\n" + String(doc.body_text || "").slice(0, MAX_TEXT) };
    } else {
      const { data: blob, error } = await sb.storage.from("terms-docs").download(doc.storage_path);
      if (error || !blob) return json({ error: "Couldn't open the uploaded file." }, 404);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mime = doc.mime || blob.type;
      if (mime === "application/pdf" || /\.pdf$/i.test(doc.file_name || "")) {
        part = { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) }, title: doc.title };
      } else if (mime === DOCX || /\.docx$/i.test(doc.file_name || "")) {
        const t = docxText(bytes);
        if (!t) return json({ error: "That Word file has no readable text." }, 422);
        part = { type: "text", text: "DOCUMENT (" + doc.title + "):\n" + t.slice(0, MAX_TEXT) };
      } else {
        part = { type: "text", text: "DOCUMENT (" + doc.title + "):\n" + new TextDecoder().decode(bytes).slice(0, MAX_TEXT) };
      }
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ ok: false, error: "DebtJet AI isn't set up yet: add ANTHROPIC_API_KEY to the Supabase Edge Function secrets." }, 503);
    const model = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 4000, system: SYSTEM,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: [part, { type: "text", text: "Review this document as described. Return the JSON." }] }],
      }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) {
      console.error("Anthropic API error", JSON.stringify(ai));
      return json({ ok: false, error: "DebtJet AI returned an error: " + (ai?.error?.message || aiRes.status) }, 502);
    }
    const text = (ai.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    let review: any;
    try { review = JSON.parse(text); } catch (_e) {
      console.error("Could not parse AI JSON", text.slice(0, 500));
      return json({ ok: false, error: "The review couldn't be read. Please try again." }, 502);
    }

    const { data: saved, error: upErr } = await sb.from("org_terms_documents")
      .update({ review, review_model: model, reviewed_at: new Date().toISOString(), reviewed_by: u.user.id,
        kind: review.document_kind || doc.kind })
      .eq("id", doc.id).select("*").maybeSingle();
    if (upErr) console.error("save review", upErr);
    return json({ ok: true, document: saved || { ...doc, review }, model });
  } catch (e) {
    console.error("review-terms error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
