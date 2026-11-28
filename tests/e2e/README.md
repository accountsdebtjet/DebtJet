# Browser tests

`python tests/e2e/run_all.py` runs every `runNN.py` against `index.html`, with a fake Supabase backend (`fake-supabase.js`). Nothing touches the real database.

- **Pass/fail:** a test passes only if it doesn't crash, shows no page errors, and meets every expectation for it in `expect.py`. Interest sums printed in the form `$X × R% × D days ÷ 365 = $Y` are also re-calculated and must match to the cent.
- **New test:** copy a recent one (`run41.py` is a short example). Either add `(what, regex)` lines for it in `expect.py`, or use `check(condition, 'what should be true', actual)` from `check.py`. A test with no checks fails.
- **Fixed date:** the fake backend pins the app's clock to **28 Nov 2026**, so days overdue, due/not-due and interest are the same every day. To test another day, set `window.__TEST_NOW` in an init script.
- **Screenshots** go to `tests/e2e/out/` (not committed). GitHub keeps them for 7 days when a run fails.
- **One test:** `python tests/e2e/run_all.py run40`
