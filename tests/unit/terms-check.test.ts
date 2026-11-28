// Unit tests for the server-side interest check (supabase/functions/_shared/terms-check.ts).
// Run: node --experimental-strip-types --test tests/unit/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPosting, pickAcceptance, clampedRules, interestStart } from "../../supabase/functions/_shared/terms-check.ts";

const doc = {
  kind: "terms_of_trade", archived: false, rules_confirmed_at: "2026-07-01T00:00:00Z",
  limits: { interest: { allowed: true, max_rate_pa: 0.12, method: "simple", start: "due_date", grace_days: 0 } },
  rules: { interest_enabled: true, rate_pa: 0.10, method: "simple", interest_start: "after_grace", grace_days: 7, min_balance: 0, cap_pct: null },
};
const acc = { document_id: "d1", debtor_id: "b1", group_id: null, accepted_on: "2026-07-01", evidence_grade: "evidence" };
const base = {
  invoice: { id: "i1", debtor_id: "b1", issued_date: "2026-07-15", due_date: "2026-08-12" },
  acceptance: acc, doc, disputed: false, decision: null, applyMode: "auto", demand: {},
  todayISO: "2026-11-28", balance: 4781.01, from: "2026-08-19", to: "2026-11-28", interest: 132.30, rate_pa: 0.10,
};
const err = (r: any) => (r.ok ? "" : r.error);

test("allows interest that matches the terms", () => {
  const r: any = checkPosting(base);
  assert.equal(r.ok, true);
  assert.equal(r.max, 132.30); // 4781.01 × 10% × 101 ÷ 365
});
test("refuses more interest than the rate allows", () => {
  assert.match(err(checkPosting({ ...base, interest: 150 })), /more interest than the terms allow/);
});
test("refuses a rate above the rules", () => {
  assert.match(err(checkPosting({ ...base, rate_pa: 0.15 })), /above what the terms allow/);
});
test("rules above the document's limit are held to the limit", () => {
  const hi = { ...doc, rules: { ...doc.rules, rate_pa: 0.20 } };
  assert.equal(clampedRules(hi).rate_pa, 0.12);
  assert.match(err(checkPosting({ ...base, doc: hi, rate_pa: 0.20, interest: 200 })), /above what the terms allow/);
});
test("refuses without an evidenced acceptance", () => {
  assert.equal(pickAcceptance([{ ...acc, evidence_grade: "declared" }], "b1", []), null);
  assert.match(err(checkPosting({ ...base, acceptance: null })), /No accepted terms with evidence/);
});
test("uses the contact group's acceptance when the customer has none", () => {
  const g = { ...acc, debtor_id: null, group_id: "g1" };
  assert.equal(pickAcceptance([g], "b1", ["g1"]), g);
  assert.equal(pickAcceptance([g], "b1", ["g2"]), null);
});
test("refuses invoices issued before acceptance", () => {
  assert.match(err(checkPosting({ ...base, invoice: { ...base.invoice, issued_date: "2026-06-23" } })), /issued before the customer accepted/);
});
test("refuses disputed, waived and unapproved invoices", () => {
  assert.match(err(checkPosting({ ...base, disputed: true })), /disputed/);
  assert.match(err(checkPosting({ ...base, decision: "waive" })), /waived/);
  assert.match(err(checkPosting({ ...base, applyMode: "manual" })), /hasn't been approved/);
  assert.equal(checkPosting({ ...base, applyMode: "manual", decision: "apply" }).ok, true);
});
test("refuses a period starting before the terms allow", () => {
  assert.match(err(checkPosting({ ...base, from: "2026-08-12", interest: 141.47 })), /can only count from 19 Aug 2026/);
});
test("refuses unusable documents", () => {
  assert.match(err(checkPosting({ ...base, doc: { ...doc, rules_confirmed_at: null } })), /isn't ready for charging/);
  assert.match(err(checkPosting({ ...base, doc: { ...doc, kind: "other" } })), /isn't ready for charging/);
  assert.match(err(checkPosting({ ...base, doc: { ...doc, archived: true } })), /isn't ready for charging/);
  assert.match(err(checkPosting({ ...base, doc: { ...doc, limits: { interest: { allowed: false } } } })), /don't allow interest/);
});
test("letter-of-demand start needs the letter", () => {
  const r = { ...doc.rules, interest_start: "first_demand" };
  assert.equal(interestStart(r, "2026-08-12", {}, "2026-11-28"), null);
  assert.equal(interestStart(r, "2026-08-12", { first: "2026-09-01" }, "2026-11-28"), "2026-09-01");
});
test("a later period (after an earlier posting) is checked on its own days", () => {
  const r: any = checkPosting({ ...base, from: "2026-10-31", interest: 36.68 }); // 28 days
  assert.equal(r.ok, true);
  assert.equal(r.max, 36.68);
  assert.match(err(checkPosting({ ...base, from: "2026-10-31", interest: 37.99 })), /more interest than the terms allow/);
});
test("cap includes interest already posted", () => {
  const capped = { ...doc, rules: { ...doc.rules, cap_pct: 0.02 } }; // 2% of 4781.01 = 95.62
  assert.match(err(checkPosting({ ...base, doc: capped, priorInterest: 90 })), /up to \$5\.62/);
});
