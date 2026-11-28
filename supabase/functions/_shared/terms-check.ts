// Server-side check of interest against the customer's accepted terms.
// Plain TypeScript with no imports, so edge functions can use it and the unit tests can run it directly.
// Each deployed function folder keeps its own copy of this file (supabase/functions/<name>/terms-check.ts);
// keep those copies identical to this one.
//
// Rules (the same ones the app shows; see resolveTerms() / clampToLimits() / invoiceCharges() in js/charges.js):
//  - Interest only under an accepted terms document with evidence ("evidence" or "verified"):
//    the customer's own record first, else the latest record for one of its contact groups.
//  - The document must be a valid kind, not archived, with confirmed limits and rules.
//  - Rules are held to what the terms allow (rate, method, start).
//  - No interest on invoices issued before the acceptance date, disputed invoices, or waived invoices.
//    With "approve each invoice" mode, only invoices approved for charging.
//  - The period can't start before the terms' start, and the amount can't exceed what the rate allows.

export const VALID_KINDS = ["terms_of_trade", "terms_of_service", "credit_application", "quote_or_contract"];
const DAY = 86400000;

export function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10);
}
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(String(toISO).slice(0, 10) + "T00:00:00Z") - Date.parse(String(fromISO).slice(0, 10) + "T00:00:00Z")) / DAY);
}
const fmt = (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const money = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The acceptance that applies: the customer's own (evidenced) record, else the latest evidenced group record. */
export function pickAcceptance(accs: any[], debtorId: string, groupIds: Set<string> | string[]): any | null {
  const groups = groupIds instanceof Set ? groupIds : new Set(groupIds);
  const proven = (accs || []).filter((a) => a && (a.evidence_grade === "evidence" || a.evidence_grade === "verified"));
  return proven.filter((a) => a.debtor_id === debtorId).sort((a, b) => String(b.accepted_on).localeCompare(String(a.accepted_on)))[0]
    || proven.filter((a) => a.group_id && groups.has(a.group_id)).sort((a, b) => String(b.accepted_on).localeCompare(String(a.accepted_on)))[0]
    || null;
}

/** The document's rules, held to its limits. Null when the document can't be used for charging. */
export function clampedRules(doc: any): any | null {
  if (!doc || !VALID_KINDS.includes(doc.kind) || doc.archived || !doc.limits || !doc.rules || !doc.rules_confirmed_at) return null;
  const I = doc.limits.interest || {};
  const r = JSON.parse(JSON.stringify(doc.rules));
  if (r.interest_enabled) {
    if (!I.allowed) r.interest_enabled = false;
    if (I.max_rate_pa != null && Number(r.rate_pa) > Number(I.max_rate_pa)) r.rate_pa = Number(I.max_rate_pa);
    if (r.method === "compound_monthly" && I.method !== "compound_monthly") r.method = "simple";
    const LS = I.start || "due_date", LG = Number(I.grace_days) || 0, b = r.interest_start, g = Number(r.grace_days) || 0;
    const within = LS === "due_date" || (LS === "after_grace" && b === "after_grace" && g >= LG)
      || (LS === "first_demand" && (b === "first_demand" || b === "final_demand")) || (LS === "final_demand" && b === "final_demand");
    if (!within) { r.interest_start = LS; r.grace_days = LG; }
  }
  return r;
}

/** First day interest can count from, or null if it hasn't started (or can't, e.g. no demand letter yet). */
export function interestStart(rules: any, dueISO: string, demand: { first?: string; final?: string }, todayISO: string): string | null {
  if (!dueISO) return null;
  const due = String(dueISO).slice(0, 10);
  const grace = Number(rules.grace_days || 0);
  const basis = rules.interest_start || "after_grace";
  if (basis === "due_date") return due;
  if (basis === "after_grace") return isoAddDays(due, grace);
  if (basis === "grace_backdated") return daysBetween(due, todayISO) >= Math.max(1, grace) ? due : null;
  const letter = basis === "final_demand" ? demand.final : demand.first;
  if (!letter) return null;
  const l = String(letter).slice(0, 10);
  return l > due ? l : due;
}

/** Most interest the rules allow on this balance for the period (before any cap). */
export function maxInterest(rules: any, balance: number, fromISO: string, toISO: string): number {
  const days = daysBetween(fromISO, toISO);
  const rate = Number(rules.rate_pa) || 0;
  if (days <= 0 || rate <= 0 || balance <= 0) return 0;
  return rules.method === "compound_monthly" ? balance * (Math.pow(1 + rate / 12, days / (365 / 12)) - 1) : balance * rate * days / 365;
}

export type PostingInput = {
  invoice: { id: string; debtor_id: string; issued_date?: string | null; due_date?: string | null };
  acceptance: any | null;          // from pickAcceptance()
  doc: any | null;                 // the acceptance's document
  disputed: boolean;               // latest note on the invoice is a dispute
  decision: string | null;         // "apply" | "waive" | null
  applyMode: string;               // "auto" | "manual"
  demand: { first?: string; final?: string };
  todayISO: string;
  balance: number;                 // what is owing now (Xero's amount due)
  from: string; to: string;        // the period being posted
  interest: number;                // the amount being posted
  rate_pa?: number | null;         // the rate the app used (optional)
  priorInterest?: number;          // interest already posted on this invoice (for a cap)
};

/** ok:true with the allowed maximum, or ok:false with a plain-English reason. */
export function checkPosting(p: PostingInput): { ok: true; max: number; rules: any } | { ok: false; error: string } {
  const no = (error: string) => ({ ok: false as const, error });
  if (!p.acceptance) return no("No accepted terms with evidence for this customer, so no interest can be charged. Record the acceptance and evidence in Interest & Fees → Terms & rules.");
  const rules = clampedRules(p.doc);
  if (!rules) return no("The accepted terms document isn't ready for charging (confirm what it allows and save the rules in Terms & rules).");
  if (!rules.interest_enabled || !(Number(rules.rate_pa) > 0)) return no("The terms on file don't allow interest, or interest is switched off in the rules.");
  const issued = String(p.invoice.issued_date || p.invoice.due_date || "").slice(0, 10);
  if (issued && issued < String(p.acceptance.accepted_on)) return no("This invoice was issued before the customer accepted the terms (" + fmt(p.acceptance.accepted_on) + "), so no interest can be charged.");
  if (p.disputed) return no("This invoice is disputed, so no interest can be charged.");
  if (p.decision === "waive") return no("Interest on this invoice was waived.");
  if ((p.applyMode || "auto") === "manual" && p.decision !== "apply") return no("This invoice hasn't been approved for interest yet.");
  if (p.balance < Number(rules.min_balance || 0)) return no("The balance is below the minimum in your rules.");
  const start = interestStart(rules, String(p.invoice.due_date || ""), p.demand, p.todayISO);
  if (!start) return no("Under the terms, interest hasn't started on this invoice yet.");
  if (p.from < start) return no("Under the terms, interest on this invoice can only count from " + fmt(start) + ".");
  if (p.rate_pa != null && Number(p.rate_pa) > Number(rules.rate_pa) + 1e-9) return no("The rate used (" + r2(Number(p.rate_pa) * 100) + "% a year) is above what the terms allow (" + r2(Number(rules.rate_pa) * 100) + "%).");
  // Interest earned between from and to, counting from the terms' start (matters for monthly compounding).
  let max = maxInterest(rules, p.balance, start, p.to) - maxInterest(rules, p.balance, start, p.from);
  if (rules.cap_pct) max = Math.min(max, Math.max(0, p.balance * Number(rules.cap_pct) - Number(p.priorInterest || 0)));
  max = r2(max);
  if (p.interest > max + 0.01) return no("That's more interest than the terms allow for this period: up to " + money(max) + " on " + money(p.balance) + ".");
  return { ok: true, max, rules };
}
