// Turns a Xero invoice into the payments DebtJet should record against it.
// Plain TypeScript with no imports (unit-tested in tests/unit/). Copied into xero-sync/; keep copies identical.
//
// Xero reduces an invoice's AmountDue by payments, credit notes, and prepayment/overpayment
// allocations. Each becomes one DebtJet payment row, keyed by its Xero id so a re-sync updates
// instead of duplicating. If those items don't add up to AmountPaid + AmountCredited (for example,
// Xero left an item out of the list), one "adjustment" row makes up the difference, so DebtJet's
// balance always equals Xero's AmountDue.

export type XeroPaymentRow = { external_id: string; amount: number; paid_at: string; method: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Xero dates come as "/Date(1764288000000+0000)/" or ISO strings. Returns YYYY-MM-DD or null. */
export function xeroDate(s: unknown): string | null {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) {
    let ms = Number(m[1]);
    if (m[2]) { const sign = m[2][0] === "-" ? -1 : 1; ms += sign * (Number(m[2].slice(1, 3)) * 60 + Number(m[2].slice(3, 5))) * 60000; }
    return new Date(ms).toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : null;
}

export function paymentsFromInvoice(inv: any, todayISO: string): XeroPaymentRow[] {
  if (!inv || !inv.InvoiceID) return [];
  const rows: XeroPaymentRow[] = [];
  const add = (id: unknown, amount: unknown, date: unknown, method: string, prefix: string) => {
    const a = r2(Number(amount) || 0);
    if (!id || !(a > 0)) return;
    rows.push({ external_id: prefix + ":" + String(id) + ":" + inv.InvoiceID, amount: a, paid_at: xeroDate(date) || todayISO, method });
  };
  for (const p of inv.Payments || []) add(p.PaymentID, p.Amount, p.Date, "payment", "pay");
  for (const c of inv.CreditNotes || []) add(c.CreditNoteID, c.AppliedAmount, c.Date, "credit_note", "cn");
  for (const p of inv.Prepayments || []) add(p.PrepaymentID, p.AppliedAmount, p.Date, "prepayment", "pre");
  for (const o of inv.Overpayments || []) add(o.OverpaymentID, o.AppliedAmount, o.Date, "overpayment", "over");

  const expected = r2((Number(inv.AmountPaid) || 0) + (Number(inv.AmountCredited) || 0));
  const listed = r2(rows.reduce((t, r) => t + r.amount, 0));
  const when = xeroDate(inv.FullyPaidOnDate) || xeroDate(inv.UpdatedDateUTC) || todayISO;
  const adj = (amount: number) => ({ external_id: "adj:" + inv.InvoiceID, amount: r2(amount), paid_at: when, method: "adjustment" });
  if (listed > expected + 0.01) return expected > 0 ? [adj(expected)] : [];   // the list doesn't match Xero's totals: trust the totals
  if (expected - listed > 0.01) rows.push(adj(expected - listed));
  return rows;
}
