# Debt Recovery: an invoice past the time limit no longer blocks the whole claim.
# The user can leave it out (facts only), and the rest can be claimed.
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
        await pg.evaluate("""(()=>{ Object.assign(window.__DB.debtors[0], {legal_name:'BLUESTONE LEGAL PTY LTD', acn:'004085616', abn:'53004085616', abn_status:'Active', address_line1:'Level 4, 120 Edward St', suburb:'Brisbane', state:'QLD', postcode:'4000', debtor_kind:'company'});
          const i=window.__DB.invoices.find(x=>x.invoice_number==='INV-3112'); i.issued_date='2019-05-01'; i.due_date='2019-06-01'; })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="eligibility"]'); await pg.wait_for_timeout(400)
        elig = await pg.inner_text('#recRoot')
        check('Time limit may have passed' in elig and 'INV-3112 fell due more than 6 years ago' in elig, 'Old invoice is flagged', elig[:300])
        check('tick “Leave out invoices past the time limit”' in elig, 'Check says how to claim the others')
        await pg.click('[data-rtab-btn="claim"]'); await pg.wait_for_timeout(400)
        btn = await pg.query_selector('#recStartBtn')
        check(btn is None or await btn.is_disabled(), 'Starting a file is blocked while the old invoice is in the claim')
        tog = await pg.query_selector('[data-ropt="leave_out_stale"]')
        check(tog is not None, 'Claim amount offers to leave out invoices past the time limit')
        label = await pg.evaluate("document.querySelector('[data-ropt=\"leave_out_stale\"]').parentElement.innerText")
        check('INV-3112 · $715.62' in label, 'The option names the invoice and amount', label)
        total_before = await pg.evaluate("recClaim(recCase(), recMatter()).total")
        await pg.check('[data-ropt="leave_out_stale"]'); await pg.wait_for_timeout(500)
        cl = await pg.evaluate("(()=>{ const c=recClaim(recCase(), recMatter()); return {total:c.total, items:c.items.map(i=>i.invoice_number), left:c.leftOut.map(i=>i.invoice_number)}; })()")
        check('INV-3112' not in cl['items'] and cl['left'] == ['INV-3112'], 'The old invoice is left out of the claim', cl)
        check(cl['total'] < total_before, 'The amount claimed drops', (total_before, cl['total']))
        btn = await pg.query_selector('#recStartBtn')
        check(btn is not None and not await btn.is_disabled(), 'A file can now be started for the rest')
        await pg.click('[data-rtab-btn="eligibility"]'); await pg.wait_for_timeout(400)
        elig2 = await pg.inner_text('#recRoot')
        check('Left out: past the time limit' in elig2 and 'INV-3112 ($715.62) fell due more than 6 years ago and is not in this claim.' in elig2, 'Eligibility records what was left out', elig2[:400])
        check('Time limit may have passed' not in elig2, 'No longer blocked')
        await pg.screenshot(path='rec_timebar.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
