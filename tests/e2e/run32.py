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
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('.nav-btn[data-view="cases"]'); await pg.wait_for_timeout(500)
        await pg.click('#casesBody tr[data-case]'); await pg.wait_for_timeout(700)
        await pg.screenshot(path='d_case.png')
        await pg.click('.nav-btn[data-view="statements"]'); await pg.wait_for_timeout(800)
        print('stmt contacts tab: panel', await pg.eval_on_selector('#insPanel','e=>!e.hidden'), 'dock', await pg.eval_on_selector('#styleDock','e=>!e.hidden'), 'btn', await pg.eval_on_selector('#tbIns','e=>!e.hidden'))
        await pg.select_option('#stmtShowMode','all'); await pg.wait_for_timeout(200); print('contact row title:', await pg.get_attribute('.contact-head','title'))
        await pg.click('[data-stab="statement"]'); await pg.wait_for_timeout(500)
        print('stmt statement tab: panel', await pg.eval_on_selector('#insPanel','e=>!e.hidden'), 'dock', await pg.eval_on_selector('#styleDock','e=>!e.hidden'))
        await pg.click('[data-stab="contacts"]'); await pg.wait_for_timeout(400)
        print('stmt audit: panel', await pg.eval_on_selector('#insPanel','e=>!e.hidden'))
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(600)
        print('chg kpis visible', await pg.eval_on_selector('#chgKpis','e=>e.offsetParent!==null'))
        await pg.evaluate("(window.__DB.xero_connections = window.__DB.xero_connections || []).push({org_id: window.__DB.organizations[0].id, tenant_name:'Demo Company (AU)', last_synced_at: new Date().toISOString()})")
        await pg.click('.nav-btn[data-view="integrations"]'); await pg.wait_for_timeout(800)
        b2 = await pg.query_selector('[data-provider="xero"]')
        print('xero btn', await b2.inner_text() if b2 else None)
        if b2 and (await b2.inner_text())=='Disconnect': await b2.click(); await pg.wait_for_timeout(800); print('disconnected', await pg.evaluate('window.__xeroDisconnected'))
        print(errs); await b.close()
asyncio.run(main())
