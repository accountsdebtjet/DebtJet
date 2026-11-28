import asyncio, os
HERE=os.path.dirname(os.path.abspath(__file__))
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1400,'height':1000}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('Agreed with client')))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='chg1.png', full_page=True)
        kp = await pg.inner_text('#chgKpis'); print('KPIs:', kp.replace('\n',' | '))
        # waive INV-3112
        await pg.click('[data-act="waive"][data-id="i3112"]'); await pg.wait_for_timeout(500)
        st = await pg.inner_text('tr[data-row="i3112"]'); print('after waive:', st.replace('\n',' ')[:160])
        # open working for INV-3109
        await pg.click('[data-act="more"][data-id="i3109"]'); await pg.wait_for_timeout(200)
        print('working:', (await pg.inner_text('.chg-detail')).replace('\n',' / ')[:300])
        # statements: 3112 interest should be 0 now
        await pg.click('.nav-btn[data-view="statements"]'); await pg.select_option('#stmtShowMode','all'); await pg.click('.contact-check[data-debtor="cc99e913"]'); await pg.wait_for_timeout(400)
        row = await pg.evaluate("Array.from(document.querySelectorAll('#statementPaper tr')).map(t=>t.innerText).filter(t=>t.includes('INV-3112'))[0]")
        print('statement 3112 row:', row.replace('\t',' | '))
        # rules: manual mode + Day 10 backdated
        await pg.click('.nav-btn[data-view="interest"]'); await pg.click('[data-chgtab="terms"]'); await pg.wait_for_timeout(200)
        await pg.click('input[name="chgMode"][value="manual"]'); await pg.click('[data-start="10"]'); await pg.check('#chgBackdate'); await pg.wait_for_timeout(300)
        print('explain:', await pg.inner_text('#chgStartExplain'))
        await pg.screenshot(path='chg_rules.png', full_page=True)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(300)
        print('banner:', (await pg.inner_text('#chgBanner'))[:120])
        print('KPIs preview:', (await pg.inner_text('#chgKpis')).replace('\n',' | '))
        await pg.click('[data-chgtab="terms"]'); await pg.click('#chgSaveBtn'); await pg.wait_for_timeout(600)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(300)
        # bulk approve pending
        await pg.select_option('#chgFilter','pending'); await pg.wait_for_timeout(200)
        await pg.check('#chgAll'); await pg.wait_for_timeout(200)
        print('bulk:', await pg.inner_text('#chgBulkCount'))
        await pg.click('[data-bulk="apply"]'); await pg.wait_for_timeout(600)
        await pg.select_option('#chgFilter','all'); await pg.wait_for_timeout(200)
        print('KPIs after approve:', (await pg.inner_text('#chgKpis')).replace('\n',' | '))
        await pg.screenshot(path='chg2.png', full_page=True)
        # calculator with demand basis
        await pg.click('[data-chgtab="terms"]'); await pg.select_option('#chgStart','first_demand'); await pg.click('[data-chgtab="calc"]')
        await pg.fill('#calcDue','2026-09-01'); await pg.fill('#calcDemand','2026-10-01'); await pg.wait_for_timeout(200)
        print('calc:', (await pg.inner_text('#calcOut')).replace('\n',' | ')[:300])
        await pg.screenshot(path='chg_calc.png')
        print(errs or 'NO ERRORS'); await b.close()
asyncio.run(main())
