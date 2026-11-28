# DebtJet backlog (28 Nov 2026)

How to use this list:
- Agents pick the top unblocked item in the highest-priority section, follow `CLAUDE.md`, and tick the item off with the date and commit.
- **Size:** S is about one session, M is 2–3 sessions, L needs to be split first.
- **Parallel:** says which items can run at the same time as others. Since F5, each area has its own file in `js/`, so items in different areas rarely clash.
- **Owner** means it needs you: an account, approval, a decision, or money.

Company registration is 1 July 2027. There is no customer launch date yet.

---

## P0 — Foundations that make agents faster and safer
Do these first. Each one speeds up everything after it.

| # | Item | Size | Parallel | Notes |
|---|---|---|---|---|
| F1 | ✅ `CLAUDE.md` with the rules and workflow | S | — | Done 28 Nov 2026 |
| F2 | ✅ Browser tests moved into the repo (`tests/e2e/`, `run_all.py`) | S | — | Done 28 Nov 2026. 13 tests pass. |
| F3 | ✅ Run the tests automatically on every push (GitHub Actions) | S | — | Done 28 Nov 2026 (`.github/workflows/tests.yml`). Syntax check plus all browser tests; screenshots are kept for 7 days when a run fails. First run: 13/13 passed in about 2 minutes. |
| F4 | ✅ Real pass/fail checks in the tests | M | — | Done 28 Nov 2026. 122 checks across 13 tests (`tests/e2e/expect.py`, `check.py`), plus interest sums re-calculated to the cent. The test clock is pinned to 28 Nov 2026, so results don't drift. Proven: switching off the "issued before acceptance" rule fails two checks. |
| F5 | ✅ Split `index.html` into `css/app.css` and 15 files in `js/` (plain scripts, no build step) | M | — | Done 28 Nov 2026. Test output and screenshots are identical before and after. `tools/check-scripts.js` (also run on GitHub) guards against duplicate names and load-order mistakes. |
| F6 | ✅ Morning health check | S | — | Done 28 Nov 2026. Scheduled task "DebtJet nightly health check" runs daily at 6:31 am Brisbane (read-only): script check, tests, GitHub runs, Supabase security and performance advisors, and yesterday's commits. Report by push notification and email. |
| F7 | Test database: a Supabase branch (or a second free project) for agents to try migrations on before live | S | Yes | **Owner:** branching needs a paid Supabase plan; a second free project works too. |
| F8 | Fix or retire old tests run5, run6 and run21 (written for older layouts) | S | Yes | |

## P1 — Product: finish the core journey
| # | Item | Size | Parallel | Notes |
|---|---|---|---|---|
| P1 | Send statements and letters from the user's own Gmail or Outlook, and mark them sent automatically | L | Yes | Split it: Gmail send (data stays with Google), Outlook send, then logging and auto-sent. Sending is always in the business's own name. |
| P2 | Server-side terms check in `xero-charges`: re-check the accepted terms before posting interest (don't trust the app's figure) | S | Yes | Edge function only. |
| P3 | Debt Recovery: snapshot the terms document, acceptance evidence and clause references into the claim and evidence pack | M | Yes | Recovery area only. |
| P4 | Xero payments sync, so part-paid invoices have the right balance | M | Yes | Fixes the known interest-posting limit. |
| P5 | Interest & Fees: rework the Calculator tab to match the terms-based rules | M | Yes | Interest & Fees area only. |
| P6 | Teammates: invite staff, set roles (owner, admin, member), and turn on leaked-password protection | M | Yes | **Owner:** decide the roles. |
| P7 | Contact groups: push DebtJet-made groups to Xero, remove one contact from a group, and manage groups from the contact card | M | Yes | |
| P8 | Debt Recovery: let the user leave out time-barred invoices instead of blocking the whole case | S | Yes | |
| P9 | Debt Recovery: when a claim is over a state's limit, show the next forum up (facts only, no advice) | M | Yes | |
| P10 | Letters: CourtSA Final Notice template (SA pre-action notice) | S | Yes | |
| P11 | Use the rich editor for statement cover messages and dispute responses | S | Yes | |
| P12 | "One next step" header on every case (journey rail plus one primary action) | M | Yes | |

## P2 — Integrations
| # | Item | Size | Parallel | Notes |
|---|---|---|---|---|
| I1 | ServiceM8 connector: import jobs, quotes, signed documents and acceptance evidence | L | Yes | **Owner:** register as a ServiceM8 Development Partner first. |
| I2 | QuickBooks connection (OAuth, invoices, post charges) | L | Yes | **Owner:** create an Intuit developer app. |
| I3 | Outlook add-in using Azure OpenAI in DebtJet's own Azure account | L | Yes | **Owner:** Azure account. |
| I4 | Deploy the Gmail summariser and install the add-on, then test with the demo emails | S | Yes | **Owner:** run the steps in `google/README.md` (an agent can guide you). |
| I5 | AI in the debtor portal (answers from the business's records only, with human approval) | M | Later | |

## Before taking customers (people, not agents)
These need a human sign-off. Agents can prepare drafts and question lists.
- [ ] **One-off legal review** of the positioning (software, not collection), letter templates, and the disputed-facts feature. Options: a university law clinic, a small-business legal service, or a fixed-fee consult.
- [ ] **Privacy policy and client terms** covering sub-processors (Google, Microsoft, Anthropic, Supabase) and cross-border disclosure.
- [ ] **Independent security check** before real customer data is stored.
- [ ] **Google Workspace Marketplace** verification for the Gmail add-on (OAuth consent screen, move the Apps Script project to the `debtjet` Cloud project).
- [ ] **Accounts:** upgrade Google Cloud to a full account; note the Anthropic API key's expiry date and renew it before then.
- [ ] **Confirm the TAS minor civil claim limit** with the Hobart registry ($15,000 under SR 2023/77 vs $5,000 on the court's page).

## Recently done
- 28 Nov 2026: Accounts tab (contacts and history merged), statement sent status with auto-detect, Quick find, compact contact rows, bank warning moved to an insert clause.
- 25–27 Nov 2026: terms-based interest and fees with acceptance evidence, terms review by AI, a verified "what these terms allow".
