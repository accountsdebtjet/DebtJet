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

        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.click('.nav-btn[data-view="cases"]'); await pg.wait_for_timeout(300)
        await pg.click('#casesBody tr[data-case]'); await pg.wait_for_timeout(600)
        print('view before:', (await pg.inner_text('#contactCard'))[:300].replace('\n',' | '))
        await pg.click('[data-cc="edit"]'); await pg.wait_for_timeout(300)
        print('abn hidden before:', await pg.eval_on_selector('.cc-abn','e=>e.hidden'))
        await pg.select_option('[data-ce="debtor_kind"]','individual'); await pg.wait_for_timeout(200)
        print('abn hidden after:', await pg.eval_on_selector('.cc-abn','e=>e.hidden'), await pg.eval_on_selector('.cc-abn','e=>getComputedStyle(e).display'))
        await (await pg.query_selector('#contactCard')).screenshot(path='kind_edit.png')

        pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('[data-cc="save"]'); await pg.wait_for_timeout(900)
        print('view after:', (await pg.inner_text('#contactCard'))[:400].replace('\n',' | '))
        await (await pg.query_selector('#contactCard')).screenshot(path='kind_view.png')
        print(errs); await b.close()
asyncio.run(main())
