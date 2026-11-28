# Payments synced from Xero (payments.source = 'xero'): balances drop by them everywhere,
# interest is worked out on what is still owing, and the chronology names them.
import asyncio, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from check import check
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1400,'height':1000}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.add_init_script("window.print=function(){}")
        await pg.goto(APP); await pg.wait_for_timeout(800)
        async def row(inv):
            return await pg.evaluate("(n)=>{ const r=[...document.querySelectorAll('#chgTable tbody tr[data-row]')].find(r=>r.querySelector('b').textContent===n); return r? r.innerText.replace(/\\s+/g,' ') : '' }", inv)
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(500)
        before = await row('INV-3109')
        # Xero sync records a credit note and a part-payment against INV-3109 ($4,781.01).
        await pg.evaluate("""window.__DB.payments.push(
          {invoice_id:'i3109', amount:500, paid_at:'2026-10-02', method:'credit_note', source:'xero', external_id:'cn:C1:X'},
          {invoice_id:'i3109', amount:281.01, paid_at:'2026-10-20', method:'payment', source:'xero', external_id:'pay:P1:X'})""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(1000)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(500)
        after = await row('INV-3109')
        check('$4,781.01' in before, 'Before: full balance', before)
        check('$4,000.00' in after, 'After: balance is what Xero still shows owing', after)
        await pg.evaluate("(()=>{ const r=[...document.querySelectorAll('#chgTable tbody tr[data-row]')].find(r=>r.querySelector('b').textContent==='INV-3109'); r.querySelector('.chev, [data-more], button:last-child').click(); })()")
        await pg.wait_for_timeout(300)
        work = await pg.evaluate("document.querySelector('#chgTable').innerText")
        check('Interest: $4,000.00 × 10%' in work, 'Interest is worked out on the balance after Xero payments', work[:400])
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="evidence"]'); await pg.wait_for_timeout(500)
        pack = await pg.evaluate("recPackHtml(recCase(), recMatter() || {status:'preparing', applicant:{}, respondent:{}}, recClaim(recCase(), recMatter()))")
        check('Credit note applied' in pack and '$500.00 · from Xero' in pack, 'Chronology names the Xero credit note', pack[:200])
        check('$281.01 · from Xero' in pack, 'Chronology shows the Xero payment')
        print('errs', errs); await b.close()
asyncio.run(main())
