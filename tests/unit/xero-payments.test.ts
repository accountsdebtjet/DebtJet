// Unit tests for reading Xero payments (supabase/functions/_shared/xero-payments.ts).
// Run: node --experimental-strip-types --test tests/unit/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentsFromInvoice, xeroDate } from "../../supabase/functions/_shared/xero-payments.ts";

const TODAY = "2026-11-28";
const sum = (rows: any[]) => Math.round(rows.reduce((t, r) => t + r.amount, 0) * 100) / 100;

test("reads Xero's date formats", () => {
  assert.equal(xeroDate("/Date(1764288000000+0000)/"), "2025-11-28");
  assert.equal(xeroDate("/Date(1764280800000+1000)/"), "2025-11-28");
  assert.equal(xeroDate("2026-09-01T00:00:00"), "2026-09-01");
  assert.equal(xeroDate(null), null);
});

test("one row per payment, keyed by Xero id", () => {
  const rows = paymentsFromInvoice({ InvoiceID: "X1", AmountPaid: 1500, AmountCredited: 0,
    Payments: [{ PaymentID: "P1", Amount: 1000, Date: "2026-09-01T00:00:00" }, { PaymentID: "P2", Amount: 500, Date: "2026-10-01T00:00:00" }] }, TODAY);
  assert.deepEqual(rows.map((r) => [r.external_id, r.amount, r.paid_at, r.method]), [
    ["pay:P1:X1", 1000, "2026-09-01", "payment"], ["pay:P2:X1", 500, "2026-10-01", "payment"]]);
});

test("credit notes and prepayment/overpayment allocations count", () => {
  const rows = paymentsFromInvoice({ InvoiceID: "X2", AmountPaid: 300, AmountCredited: 250,
    Payments: [{ PaymentID: "P", Amount: 200, Date: "2026-09-01" }],
    CreditNotes: [{ CreditNoteID: "C", AppliedAmount: 250, Date: "2026-09-05" }],
    Overpayments: [{ OverpaymentID: "O", AppliedAmount: 100, Date: "2026-09-06" }] }, TODAY);
  assert.equal(sum(rows), 550);
  assert.deepEqual(rows.map((r) => r.method), ["payment", "credit_note", "overpayment"]);
});

test("makes up a shortfall with one adjustment, so the balance matches Xero", () => {
  const rows = paymentsFromInvoice({ InvoiceID: "X3", AmountPaid: 800, AmountCredited: 0, UpdatedDateUTC: "/Date(1764288000000+0000)/",
    Payments: [{ PaymentID: "P", Amount: 500, Date: "2026-09-01" }] }, TODAY);
  assert.equal(sum(rows), 800);
  assert.deepEqual(rows[1], { external_id: "adj:X3", amount: 300, paid_at: "2025-11-28", method: "adjustment" });
});

test("part-paid with no payment list still gets the right total", () => {
  const rows = paymentsFromInvoice({ InvoiceID: "X4", AmountPaid: 1000, AmountCredited: 0 }, TODAY);
  assert.deepEqual(rows, [{ external_id: "adj:X4", amount: 1000, paid_at: TODAY, method: "adjustment" }]);
});

test("if the list adds up to more than Xero's totals, trusts the totals", () => {
  const rows = paymentsFromInvoice({ InvoiceID: "X5", AmountPaid: 100, AmountCredited: 0,
    Payments: [{ PaymentID: "P", Amount: 400, Date: "2026-09-01" }] }, TODAY);
  assert.deepEqual(rows.map((r) => [r.external_id, r.amount]), [["adj:X5", 100]]);
});

test("unpaid invoice: nothing recorded; zero and negative amounts ignored", () => {
  assert.deepEqual(paymentsFromInvoice({ InvoiceID: "X6", AmountPaid: 0, AmountCredited: 0 }, TODAY), []);
  assert.deepEqual(paymentsFromInvoice({ InvoiceID: "X7", AmountPaid: 0, AmountCredited: 0, Payments: [{ PaymentID: "P", Amount: 0 }] }, TODAY), []);
});
