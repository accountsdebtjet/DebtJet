// Shared by review-terms and terms-limits (copied into each function at deploy).
// "What these terms allow" must be backed by the document: anything beyond DebtJet AI's reading
// needs a quote that appears word for word in the document and contains the value claimed.
// The same logic runs in the app (index.html: termsEv*) for instant feedback; the server decides.

export const norm = (s: unknown) => String(s || "").toLowerCase().normalize("NFKD")
  .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―]/g, "-")
  .replace(/[^a-z0-9%$.]+/g, " ").replace(/\s+/g, " ").trim();

export function quoteFound(docText: string, quote: string): boolean {
  const q = norm(quote);
  if (q.length < 12 || !docText) return false;
  return norm(docText).includes(q);
}

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty one": 21, "twenty eight": 28, thirty: 30, "thirty one": 31, forty: 40, "forty five": 45, sixty: 60, ninety: 90,
};
export function numbersIn(quote: string): number[] {
  const out: number[] = [];
  for (const m of String(quote || "").replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  const t = " " + norm(quote) + " ";
  for (const w of Object.keys(WORDS)) if (t.includes(" " + w + " ")) out.push(WORDS[w]);
  return out;
}
const hasNum = (q: string, n: number) => numbersIn(q).some((x) => Math.abs(x - n) < 0.005);
const monthly = (q: string) => /\b(per|a|each|every) (calendar )?month\b|\bmonthly\b/.test(norm(q));

// DebtJet AI's reading of the document, in the same shape as limits.
export function baselineFromReview(R: any) {
  R = R || {};
  const I = R.interest || {};
  const start = I.start === "after_days" ? (I.start_days ? "after_grace" : "due_date") : (I.start && I.start !== "not_stated" ? I.start : "due_date");
  return {
    interest: {
      allowed: !!I.stated, max_rate_pa: I.rate_pa_percent != null ? Math.round(I.rate_pa_percent * 100) / 10000 : null,
      method: I.method === "compound_monthly" ? "compound_monthly" : "simple",
      start, grace_days: start === "after_grace" ? Math.round(I.start_days || 0) : 0, clause: I.clause || "", quote: I.quote || "",
    },
    fees: (R.fees || []).filter((f: any) => f.debtjet_can_charge && f.amount != null && f.amount > 0).map((f: any) => ({
      name: String(f.name || "Fee").slice(0, 40), type: f.type === "percent" ? "percent" : "fixed", max_amount: Math.round(f.amount * 100) / 100,
      applies: f.trigger === "per_reminder_or_statement" ? "per_statement" : "per_invoice",
      min_after_days: Math.max(1, Math.round(f.after_days || 1)), clause: f.clause || "", quote: f.quote || "",
    })),
  };
}

const START_ORDER: Record<string, number> = { due_date: 0, after_grace: 1, first_demand: 2, final_demand: 3 };
// Is a start rule earlier (more generous) than the baseline?
function startEarlier(s: string, g: number, bs: string, bg: number) {
  if ((START_ORDER[s] ?? 0) !== (START_ORDER[bs] ?? 0)) return (START_ORDER[s] ?? 0) < (START_ORDER[bs] ?? 0);
  return s === "after_grace" && g < bg;
}

export type Need = { key: string; label: string; numbers?: number[]; monthlyOk?: boolean; keyword?: string };
// What in `lim` goes beyond the baseline, and what a quote must contain to support it.
export function evidenceNeeds(base: any, lim: any): Need[] {
  const out: Need[] = [], I = lim.interest || {}, B = base.interest || {};
  if (I.allowed) {
    if (!B.allowed) out.push({ key: "interest", label: "Interest on overdue amounts", keyword: "interest" });
    if (B.max_rate_pa == null || Number(I.max_rate_pa) > Number(B.max_rate_pa) + 1e-9)
      out.push({ key: "rate", label: "Interest rate of " + Math.round(Number(I.max_rate_pa) * 10000) / 100 + "% a year", numbers: [Math.round(Number(I.max_rate_pa) * 10000) / 100], monthlyOk: true });
    if (I.method === "compound_monthly" && B.method !== "compound_monthly") out.push({ key: "method", label: "Compounding interest", keyword: "compound" });
    if (startEarlier(I.start, Number(I.grace_days) || 0, B.allowed ? B.start : "final_demand", Number(B.grace_days) || 0))
      out.push(I.start === "after_grace"
        ? { key: "start", label: "Interest from " + I.grace_days + " days overdue", numbers: [Number(I.grace_days) || 0] }
        : I.start === "due_date" ? { key: "start", label: "Interest from the due date", keyword: "due" }
        : { key: "start", label: "When interest starts", keyword: "demand" });
  }
  for (const f of lim.fees || []) {
    const b = (base.fees || []).find((x: any) => String(x.name).toLowerCase() === String(f.name).toLowerCase());
    const key = "fee:" + String(f.name).toLowerCase(), nums: number[] = [];
    let kw = "";
    if (!b || Number(f.max_amount) > Number(b.max_amount) + 1e-9 || f.type !== b.type) nums.push(Number(f.max_amount));
    if (b && Number(f.min_after_days) < Number(b.min_after_days)) nums.push(Number(f.min_after_days));
    if (b && f.applies !== b.applies) kw = f.applies === "per_statement" ? "statement" : "invoice";
    if (nums.length || kw) out.push({ key, label: f.name + " (" + (f.type === "percent" ? f.max_amount + "%" : "$" + f.max_amount) + ")", numbers: nums, keyword: kw || undefined });
  }
  return out;
}

// Check each need against its quote. Returns problems (empty = all supported).
export function checkEvidence(docText: string, needs: Need[], evidence: Record<string, any>): string[] {
  const bad: string[] = [];
  for (const n of needs) {
    const ev = evidence?.[n.key];
    const q = ev && typeof ev.quote === "string" ? ev.quote : "";
    if (!q.trim()) { bad.push(n.label + ": this goes beyond DebtJet AI's reading, so quote the wording from the document that says it."); continue; }
    if (!docText) { bad.push(n.label + ": DebtJet can't read the text of this file, so the wording can't be checked."); continue; }
    if (!quoteFound(docText, q)) { bad.push(n.label + ": that wording wasn't found in the document. Copy it exactly."); continue; }
    for (const num of n.numbers || []) {
      const ok = hasNum(q, num) || (n.monthlyOk && monthly(q) && hasNum(q, Math.round(num / 12 * 10000) / 10000));
      if (!ok) { bad.push(n.label + ": the quote doesn't contain " + num + (n.monthlyOk ? " (or the monthly equivalent)" : "") + "."); break; }
    }
    if (n.keyword && !norm(q).includes(n.keyword)) bad.push(n.label + ": the quote doesn't mention \"" + n.keyword + "\".");
  }
  return bad;
}
