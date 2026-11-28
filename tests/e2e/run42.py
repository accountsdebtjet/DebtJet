# Xero interest posting: when the server refuses an item (it re-checks the accepted terms),
# the app shows the reason in the DebtJet dialog and still posts the others.
import asyncio, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from check import check
from playwright.async_api import async_playwright
MSG = "This invoice was issued before the customer accepted the terms (1 Jul 2026), so no interest can be charged."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1440,'height':1000}); errs=[]; dialogs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.accept())))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.add_init_script("window.__XC_REJECT = " + repr(MSG))
        await pg.goto(APP); await pg.wait_for_timeout(900)
        await pg.evaluate("window.__DB.xero_connections=[{org_id:'org1', tenant_name:'Demo Company (AU)'}]")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(800)
        await pg.select_option('#xpAccount', '270'); await pg.select_option('#xpTax', 'BASEXCLUDED')
        await pg.click('#xpSaveSettings'); await pg.wait_for_timeout(400)
        await pg.check('#xpAll'); await pg.wait_for_timeout(200)
        n = await pg.eval_on_selector_all('#xpReady tbody tr','e=>e.length')
        await pg.click('#xpPostBtn'); await pg.wait_for_timeout(400)
        if await pg.query_selector('.dj-ask [data-ask="yes"]'): await pg.click('.dj-ask [data-ask="yes"]')
        await pg.wait_for_timeout(1200)
        t = await pg.evaluate("(document.querySelector('.dj-ask')||{}).innerText||''")
        await pg.screenshot(path='xp_reject.png')
        check(n == 6, 'Six invoices ready to post', n)
        check(str(n - 1) + ' drafts created in Xero' in t, 'Dialog says how many drafts were created', t)
        check('1 couldn’t be posted' in t, 'Dialog says one couldn’t be posted', t)
        check(MSG in t, 'Dialog shows the server’s reason', t)
        check(not dialogs, 'No browser alert() used', dialogs)
        await pg.click('.dj-ask [data-ask="yes"]'); await pg.wait_for_timeout(300)
        check(await pg.query_selector('.dj-ask') is None, 'Dialog closes with OK')
        check(len(await pg.evaluate("window.__DB.charge_postings")) == n - 1, 'Only the accepted items were recorded as posted')
        print('errs', errs); await b.close()
asyncio.run(main())
