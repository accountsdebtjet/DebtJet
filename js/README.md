# js/ — the app's code

The app is plain JavaScript with no build step. `index.html` loads these files **in this order**, and they all share one global scope (like one big script):

| File | What's in it |
|---|---|
| `core.js` | Supabase client, app state, screens, sign-in, start-up, data loading, formatting helpers |
| `cases.js` | Dashboard, Debtors & Cases, contact cards (ABN check), case detail |
| `shell.js` | DebtJet dialog (`djAsk`), paragraph editor, floating toolbar, Insert panel, Style dock |
| `letters.js` | Letters of Demand: clauses, letter model, editor, AI draft, print and send |
| `portal-integrations.js` | Debtor portal preview, Integrations page |
| `statements.js` | Account Statements data, filters, contact list |
| `charges.js` | Charges engine: interest and fees under accepted terms only; evidence checks |
| `statement-templates.js` | Statement templates, designer, model, renderer, preview, save, print |
| `interest-fees.js` | Payment Portal, Interest & Fees, Post to Xero, Terms & rules, acceptance evidence |
| `accounts.js` | Accounts tab (owing and sent), Quick find |
| `history.js` | History & correspondence panel, Account Statements tabs |
| `settings.js` | Connect/import and PDF modals, Settings, colour picker, long descriptions |
| `letters-tabs.js` | Letters of Demand tabs |
| `recovery.js` | Debt Recovery (all states and territories) |
| `main.js` | Start-up. Always last. |

Styles are in `css/app.css`. Markup is in `index.html`.

## Rules
- **Names are global.** A top-level `var` or `function` must not reuse a name from another file.
- **Load order matters for code that runs straight away.** Code at the top level of a file (not inside a function) can only use things from the same file or earlier files. Functions and event handlers can use anything, because they run after every file has loaded.
- **New file?** Add a `<script src="js/name.js?v=…">` line to `index.html` in the right place, and a row above.
- **After changing anything in `js/` or `css/`:**
  1. `node tools/check-scripts.js`: catches syntax errors, duplicate names and load-order mistakes.
  2. `python3 tools/bump-version.py`: makes browsers fetch the new files instead of an old cached copy.
  3. `python tests/e2e/run_all.py`
