import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Drafts a letter of demand (kind: "letter") or statement notes (kind: "statement")
// from what DebtJet knows: invoices, payments, letters already sent and the email
// notes pushed in by the Chrome extension. Facts and flags (disputes, promises,
// hardship, payment claims) are worked out here in code; Claude only writes the
// wording. Nothing is saved or sent: the app shows the draft for a person to edit.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

type Flag = { level: "stop" | "caution" | "info"; code: string; message: string; invoice_numbers?: string[] };

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
    const kind = p.kind === "statement" ? "statement" : "letter";

    // ---------- Load facts (row-level security limits everything to the user's org) ----------
    let orgId: string, debtorIds: string[], caseRow: any = null;
    if (kind === "letter") {
      const { data: c } = await sb.from("cases").select("id, org_id, debtor_id, status, interest_rate, opened_at").eq("id", p.case_id).maybeSingle();
      if (!c) return json({ error: "Case not found." }, 404);
      caseRow = c; orgId = c.org_id; debtorIds = [c.debtor_id];
    } else {
      debtorIds = (p.debtor_ids || []).slice(0, 20);
      if (!debtorIds.length) return json({ error: "Choose at least one contact." }, 400);
      const { data: d0 } = await sb.from("debtors").select("org_id").eq("id", debtorIds[0]).maybeSingle();
      if (!d0) return json({ error: "Contact not found." }, 404);
      orgId = d0.org_id;
    }

    const [{ data: orgRow }, { data: debtors }, { data: invoices }, { data: notes }] = await Promise.all([
      sb.from("organizations").select("name, abn").eq("id", orgId).maybeSingle(),
      sb.from("debtors").select("id, name, contact_name, email").in("id", debtorIds),
      sb.from("invoices").select("id, debtor_id, case_id, invoice_number, description, amount, issued_date, due_date, status")
        .in("debtor_id", debtorIds).neq("status", "written_off").order("due_date"),
      sb.from("case_notes").select("invoice_id, debtor_id, category, summary, key_points, promised_date, promised_amount, dispute_reason, occurred_at")
        .in("debtor_id", debtorIds).order("occurred_at", { ascending: false }).limit(40),
    ]);

    let invs = (invoices || []).filter((i: any) => i.status !== "paid");
    if (kind === "letter") invs = invs.filter((i: any) => i.case_id === caseRow.id);
    if (kind === "statement" && Array.isArray(p.invoice_ids) && p.invoice_ids.length) {
      const want = new Set(p.invoice_ids);
      invs = (invoices || []).filter((i: any) => want.has(i.id));
    }
    const invIds = invs.map((i: any) => i.id);
    const { data: payments } = invIds.length
      ? await sb.from("payments").select("invoice_id, amount, paid_at").in("invoice_id", invIds)
      : { data: [] as any[] };
    const { data: letters } = kind === "letter"
      ? await sb.from("letters").select("type, sent_at, subject").eq("case_id", caseRow.id).order("sent_at", { ascending: false }).limit(10)
      : { data: [] as any[] };

    // ---------- Work out figures (interest per invoice, by that invoice's own days overdue) ----------
    const now = Date.now();
    const rate = kind === "letter" ? Number(caseRow.interest_rate || 0) : 0;
    const paidBy: Record<string, number> = {};
    (payments || []).forEach((x: any) => { paidBy[x.invoice_id] = (paidBy[x.invoice_id] || 0) + Number(x.amount); });
    const lines = invs.map((i: any) => {
      const paid = round2(paidBy[i.id] || 0);
      const outstanding = round2(Math.max(0, Number(i.amount) - paid));
      const days = i.due_date ? Math.max(0, Math.floor((now - new Date(i.due_date).getTime()) / DAY)) : 0;
      const interest = round2(outstanding * rate * days / 365);
      const debtor = (debtors || []).find((d: any) => d.id === i.debtor_id);
      return { id: i.id, invoice_number: i.invoice_number, debtor: debtor?.name, description: i.description,
               amount: Number(i.amount), paid, outstanding, due_date: i.due_date, days_overdue: days, interest };
    });
    const totals = {
      outstanding: round2(lines.reduce((s, l) => s + l.outstanding, 0)),
      interest: round2(lines.reduce((s, l) => s + l.interest, 0)),
    };

    // ---------- Flags from the email notes ----------
    const today = todayISO();
    const latestByInvoice: Record<string, any> = {};
    (notes || []).forEach((n: any) => { if (n.invoice_id && !latestByInvoice[n.invoice_id]) latestByInvoice[n.invoice_id] = n; });
    const numberOf = (id: string) => lines.find((l) => l.id === id)?.invoice_number || "";
    const flags: Flag[] = [];
    const disputed = lines.filter((l) => latestByInvoice[l.id]?.category === "dispute");
    if (disputed.length) flags.push({ level: "stop", code: "dispute",
      message: "Disputed by the debtor: " + disputed.map((l) => l.invoice_number + (latestByInvoice[l.id].dispute_reason ? " (" + latestByInvoice[l.id].dispute_reason + ")" : "")).join("; ") +
        ". Resolve or respond to the dispute before demanding payment of these invoices.",
      invoice_numbers: disputed.map((l) => l.invoice_number) });
    const recent = (notes || []).filter((n: any) => now - new Date(n.occurred_at).getTime() < 45 * DAY);
    const promises = recent.filter((n: any) => n.category === "promise_to_pay" && n.promised_date);
    const openPromise = promises.find((n: any) => n.promised_date >= today);
    const brokenPromise = promises.find((n: any) => n.promised_date < today);
    if (openPromise) flags.push({ level: "caution", code: "promise_pending",
      message: "Debtor promised to pay" + (openPromise.promised_amount ? " $" + Number(openPromise.promised_amount).toFixed(2) : "") +
        " by " + openPromise.promised_date + (openPromise.invoice_id ? " (" + numberOf(openPromise.invoice_id) + ")" : "") + ". Consider waiting until then." });
    else if (brokenPromise) flags.push({ level: "info", code: "promise_broken",
      message: "Debtor promised to pay by " + brokenPromise.promised_date + " and the invoice is still unpaid." });
    const payClaim = recent.find((n: any) => n.category === "payment_made");
    if (payClaim) flags.push({ level: "caution", code: "payment_claimed",
      message: "Debtor says they have already paid (" + payClaim.occurred_at.slice(0, 10) + "). Check bank records before sending a demand." });
    const hardship = recent.find((n: any) => n.category === "hardship");
    if (hardship) flags.push({ level: "caution", code: "hardship",
      message: "Debtor has raised financial hardship. Offer a payment arrangement; avoid pressure that could be unfair." });
    const planReq = recent.find((n: any) => n.category === "payment_plan_request");
    if (planReq) flags.push({ level: "info", code: "plan_requested", message: "Debtor has asked for a payment plan." });
    const contact = recent.find((n: any) => n.category === "contact_change");
    if (contact) flags.push({ level: "info", code: "contact_change", message: "Contact details changed: " + contact.summary });
    if (!lines.length) flags.push({ level: "stop", code: "nothing_owing", message: "No unpaid invoices on this " + (kind === "letter" ? "case" : "selection") + "." });

    const facts = {
      business: orgRow?.name, today,
      debtors: (debtors || []).map((d: any) => ({ name: d.name, contact_name: d.contact_name })),
      case_status: caseRow?.status || null,
      interest_rate_pa: kind === "letter" ? rate : null,
      invoices: lines.map(({ id, ...l }) => ({ ...l, note: latestByInvoice[id] ? latestByInvoice[id].category : null })),
      totals,
      letters_already_sent: (letters || []).map((l: any) => ({ type: l.type, sent: String(l.sent_at).slice(0, 10) })),
      email_notes: (notes || []).slice(0, 15).map((n: any) => ({
        date: String(n.occurred_at).slice(0, 10), type: n.category, summary: n.summary, key_points: n.key_points,
        invoice: n.invoice_id ? numberOf(n.invoice_id) || "other" : null,
        promised_date: n.promised_date, promised_amount: n.promised_amount, dispute_reason: n.dispute_reason,
      })),
      flags: flags.map((f) => f.message),
    };

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ ok: false, error: "AI drafting isn't set up yet: add ANTHROPIC_API_KEY to the Supabase Edge Function secrets.", flags, lines, totals }, 503);
    const model = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";

    const rules =
      "You draft collection correspondence for an Australian business. Follow the ACCC and ASIC Debt collection guideline: " +
      "be accurate, courteous and not misleading; never threaten action the business has not decided on; no harassment, " +
      "no false urgency, no implying legal processes have started when they haven't. " +
      "Use ONLY the figures, dates and invoice numbers in FACTS; never calculate new totals or invent anything. " +
      "Email notes are summaries of what the debtor wrote; treat them as claims, not proven facts. " +
      "If an invoice is disputed, do not demand it: acknowledge the dispute and say it is being reviewed, and only demand undisputed invoices. " +
      "If the debtor promised to pay, acknowledge the promise and its date. If they say they paid, ask for remittance details. " +
      "If they raised hardship, offer to discuss a payment arrangement and keep the tone supportive. " +
      "Write plain text, Australian English, no markdown.";

    let tool: any, task: string;
    if (kind === "letter") {
      const tplType = ["reminder", "first_demand", "final_demand"].includes(p.template_type) ? p.template_type : "reminder";
      const { data: tpl } = await sb.from("letter_templates").select("name, subject_template, body_template").eq("org_id", orgId).eq("type", tplType).maybeSingle();
      task = "Write a " + tplType.replace("_", " ") + " letter body (greeting to sign-off text excluded; the app adds the letterhead, amounts table and signature). " +
        "Keep it under 220 words. Mention the specific invoices being demanded. The business's usual template, for tone: " +
        JSON.stringify(tpl || null);
      tool = {
        name: "letter_draft", description: "Return the drafted letter.",
        input_schema: { type: "object", properties: {
          subject: { type: "string" },
          body: { type: "string", description: "Plain-text paragraphs separated by blank lines." },
          demanded_invoice_numbers: { type: "array", items: { type: "string" } },
          recommendation: { type: "string", description: "One sentence: whether to send this now, wait, or use a different letter, and why." },
        }, required: ["subject", "body", "demanded_invoice_numbers", "recommendation"] },
      };
    } else {
      task = "Write short 'Account notes' for an account statement covering these contacts: 2-5 plain sentences the recipient will read, " +
        "noting any promises, payment plans, disputed items under review, and what is now due. Neutral and factual.";
      tool = {
        name: "statement_notes", description: "Return the statement notes.",
        input_schema: { type: "object", properties: {
          notes: { type: "string" },
          internal_summary: { type: "string", description: "One or two sentences for staff only (not printed)." },
        }, required: ["notes", "internal_summary"] },
      };
    }

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 1500, system: rules, tools: [tool], tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: "FACTS (JSON):\n" + JSON.stringify(facts) + "\n\nTASK: " + task }],
      }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) {
      console.error("Anthropic API error", JSON.stringify(ai));
      return json({ ok: false, error: "The AI service returned an error: " + (ai?.error?.message || aiRes.status), flags, lines, totals }, 502);
    }
    const out = (ai.content || []).find((b: any) => b.type === "tool_use")?.input || {};

    return json({ ok: true, kind, model, flags, lines, totals, draft: out });
  } catch (e) {
    console.error("draft-correspondence error", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
