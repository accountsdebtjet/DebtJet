"""Run every browser test against index.html with the fake Supabase backend.

Usage (from the repo root):
    pip install playwright && python -m playwright install chromium
    python tests/e2e/run_all.py            # all tests
    python tests/e2e/run_all.py run40      # one test

Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
A test fails if it crashes, or if it reports page errors ("errs [...]" not empty).
Screenshots go to tests/e2e/out/ (ignored by git).
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

# Known harmless noise (Playwright double-handling a dialog in some tests).
NOISE = ['Cannot accept dialog which is already handled']

def page_errors(text):
    bad = []
    for m in re.finditer(r"^errs (\[.*\])$", text, re.M):
        if m.group(1) != '[]':
            bad.append(m.group(1))
    return bad

def run(name):
    p = subprocess.run([sys.executable, os.path.join(HERE, name + '.py')], cwd=OUT,
                       capture_output=True, text=True, timeout=300)
    out = p.stdout + p.stderr
    failed = p.returncode != 0 and not any(n in out for n in NOISE)
    errs = page_errors(out)
    ok = not failed and not errs
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok:
        print('\n'.join(out.strip().splitlines()[-15:]))
    return ok

if __name__ == '__main__':
    names = sys.argv[1:] or sorted(
        (f[:-3] for f in os.listdir(HERE) if re.match(r'run\d+\.py$', f)),
        key=lambda n: int(n[3:]))
    results = [run(n) for n in names]
    print(f"\n{sum(results)}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)
