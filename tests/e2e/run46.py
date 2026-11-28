# Debt Recovery: a claim over a state's limit says, as facts, which court hears larger claims (with the court's page).
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
        await pg.evaluate("""(()=>{ Object.assign(window.__DB.debtors[0], {legal_name:'BLUESTONE LEGAL PTY LTD', abn:'53004085616', abn_status:'Active', address_line1:'Level 4, 120 Edward St', suburb:'Brisbane', state:'QLD', postcode:'4000', debtor_kind:'company'});
          window.__DB.invoices.find(x=>x.invoice_number==='INV-3108').amount = 15000; })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="eligibility"]'); await pg.wait_for_timeout(400)
        async def check_text(): return await pg.inner_text('#recRoot')
        async def link(): return await pg.evaluate("[...document.querySelectorAll('#recRoot .rec-checks a')].map(a=>a.href)")
        t = await check_text()
        check('Over the $25,000.00 limit' in t, 'QLD: claim over the QCAT limit is flagged', t[:300])
        check('Claims up to $150,000 go to the Magistrates Court of Queensland, and claims from $150,001 to $750,000 to the District Court.' in t, 'QLD: says which courts hear larger claims')
        check('DebtJet’s steps here cover QCAT only.' in t, 'Says what DebtJet covers')
        check('https://www.courts.qld.gov.au/types-of-cases/money-disputes/about-money-disputes' in await link(), 'Links to the court’s own page')
        await pg.select_option('#recJurSelect', 'SA'); await pg.wait_for_timeout(500)
        t = await check_text()
        check('Civil (General Claims) Division' in t and 'Claims over $100,000 go to the District Court or the Supreme Court.' in t, 'SA: names the General Claims Division and the courts above it', t[:400])
        await pg.select_option('#recJurSelect', 'ACT'); await pg.wait_for_timeout(500)
        t = await check_text()
        check('abandon the amount over $25,000.00' in t and 'Claims between $25,001 and $250,000 go to the ACT Magistrates Court' in t, 'ACT: abandon option plus the larger-claims court', t[:400])
        await pg.select_option('#recJurSelect', 'NT'); await pg.wait_for_timeout(500)
        t = await check_text()
        check('Claims between $25,001 and $250,000 go to the Local Court. Claims over $250,000 go to the Supreme Court.' in t, 'NT: Local Court and Supreme Court')
        check('should' not in t.split('Over the')[1][:400] if 'Over the' in t else True, 'No advice wording ("should") in the over-limit text')
        await pg.screenshot(path='rec_over_limit.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
