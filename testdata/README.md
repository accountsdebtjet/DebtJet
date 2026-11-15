# DebtJet test data

Everything here is **fictional**. Every debtor email address uses plus-addressing on DebtJet's own mailbox (`accounts+<name>@debtjet.com.au`), so any test letter or statement "sent" to a debtor lands back in DebtJet's inbox.

Regenerate with `python3 generate.py && python3 make_loader.py`. The output is identical each time.

| File | What it's for |
|---|---|
| `out/xero_sales_invoices_150.csv` | 150 invoices (189 lines) for 40 clients, in Xero's Sales Invoice import template. Use a **Xero Demo Company**, not your real Xero organisation. |
| `out/debtjet_invoices_150.csv` | The same 150 invoices in DebtJet's own CSV format (Account Statements → Import CSV). Amounts include GST. |
| `out/DemoEmails.gs` | Apps Script that puts 150 debtor emails into your Gmail inbox under the label "DebtJet Demo 2". Nothing is actually sent. |
| `out/demo_emails_answer_key.csv` | The expected category for each email, for checking the AI's answers. |
| `out/demo_emails_150.json` | The raw email data. |

**What the emails cover:** promises to pay (including part payments), disputes, "already paid" replies and remittance advice, hardship, payment plan requests, contact changes, vague acknowledgements, queries (copy of invoice, GST, bank details, statement request), out-of-office auto-replies, insolvency or business-closed notices, mixed promise-and-dispute emails, emails from a personal address, and two prompt-injection attempts.
