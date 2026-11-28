# What-if calculator (reworked): choose the terms, or pick an invoice to use its customer's terms;
# shows the most interest the terms allow and what they allow, with clauses.
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
        await pg.goto(APP); await pg.wait_for_timeout(800)
        # Blue Wren Cafe has no accepted terms in this test.
        await pg.evaluate("""(()=>{ const bw=window.__DB.invoices.find(x=>x.invoice_number==='INV-3029').debtor_id;
          window.__DB.terms_acceptances = window.__DB.terms_acceptances.filter(a=>a.debtor_id!==bw); })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-chgtab="calc"]'); await pg.wait_for_timeout(300)
        opts = await pg.eval_on_selector_all('#calcTerms option', 'e=>e.map(o=>o.textContent)')
        check('Seed terms of trade · Terms of trade' in opts and 'No terms (nothing charged)' in opts, 'Terms list offers the confirmed terms and "no terms"', opts)
        await pg.fill('#calcAmount', '5000'); await pg.fill('#calcDue', '2026-09-01'); await pg.fill('#calcAsAt', '2026-11-28'); await pg.wait_for_timeout(200)
        out = await pg.inner_text('#calcOut')
        check('Most interest these terms allow on this amount' in out and 'At 12% a year' in out, 'Shows the most the terms allow (12%)', out[:600])
        check('What “Seed terms of trade” allow' in out and 'up to 12% a year' in out and 'Terms cl 5.1' in out, 'Lists what the terms allow, with clauses')
        await pg.select_option('#calcTerms', ''); await pg.wait_for_timeout(200)
        out = await pg.inner_text('#calcOut')
        check('No terms chosen, so no interest or fees.' in out and 'Total payable\t$5,000.00' in out, 'With no terms, nothing is charged', out[:400])
        # An invoice brings its customer's terms; the result matches Overdue invoices.
        await pg.select_option('#calcInvoice', label=await pg.evaluate("[...document.querySelectorAll('#calcInvoice option')].find(o=>o.textContent.startsWith('INV-3109')).textContent"))
        await pg.wait_for_timeout(300)
        out = await pg.inner_text('#calcOut'); note = await pg.inner_text('#calcTermsNote')
        check('From Bluestone Legal’s accepted terms (1 Jan 2026).' in note, 'Invoice uses its customer’s accepted terms', note)
        check(await pg.eval_on_selector('#calcTerms', 'e=>e.disabled'), 'Terms are fixed by the invoice')
        check('$132.30' in out, 'Interest matches Overdue invoices for INV-3109', out[:300])
        await pg.select_option('#calcInvoice', label=await pg.evaluate("[...document.querySelectorAll('#calcInvoice option')].find(o=>o.textContent.startsWith('INV-3029')).textContent"))
        await pg.wait_for_timeout(300)
        out = await pg.inner_text('#calcOut'); note = await pg.inner_text('#calcTermsNote')
        check(note.startswith('No terms on file'), 'Invoice with no accepted terms says so', note)
        check('No terms on file: no interest or fees.' in out, 'And charges nothing', out[:300])
        await pg.select_option('#calcInvoice', ''); await pg.wait_for_timeout(200)
        check(not await pg.eval_on_selector('#calcTerms', 'e=>e.disabled'), 'Clearing the invoice lets you choose terms again')
        await pg.screenshot(path='calc_new.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
