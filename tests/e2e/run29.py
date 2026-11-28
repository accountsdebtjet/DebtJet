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
        await pg.evaluate("""Object.assign(window.__DB.debtors[0], {legal_name:'BLUESTONE LEGAL PTY LTD', acn:'004085616', abn:'53004085616', abn_status:'Active', address_line1:'Level 4, 120 Edward St', suburb:'Brisbane', state:'QLD', postcode:'4000', debtor_kind:'company'})""")
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="claim"]'); await pg.wait_for_timeout(500)
        btn = await pg.query_selector('#recStartBtn')
        print('start disabled', await btn.is_disabled() if btn else None)
        if btn and not await btn.is_disabled(): await btn.click(); await pg.wait_for_timeout(1200)
        print('rich editors', await pg.eval_on_selector_all('#recRoot .rec-rich','e=>e.length'), 'assist', await pg.eval_on_selector_all('#insPanel .as-clause','e=>e.length'))
        await pg.click('[data-raddsec="chronology"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-raddsec="orders"]'); await pg.wait_for_timeout(300)
        await pg.click('#recRoot .rec-rich[data-rich-for="details"]')
        await pg.fill('#insPanel .as-q','letter of demand'); await pg.wait_for_timeout(300)
        await pg.click('#insPanel .as-clause-main'); await pg.wait_for_timeout(400)
        print('details:', (await pg.eval_on_selector('#recRoot [data-rf="details"]','e=>e.value'))[-200:])
        await pg.click('[data-ract="save-app"]'); await pg.wait_for_timeout(900)
        print('secs after save', await pg.eval_on_selector_all('#recRoot .rec-sec .rec-sec-title','e=>e.map(x=>x.value)'))
        await pg.screenshot(path='rec_rich.png', full_page=True)
        print(errs); await b.close()
asyncio.run(main())
