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
        await pg.add_init_script("window.print=function(){window.__printed=(window.__printed||0)+1}")
        await pg.add_init_script("window.__SEED_GROUP=true")
        async def toast(): return await pg.evaluate("(document.querySelector('.toast')||document.getElementById('toast')||{}).textContent||''")
        await pg.goto(APP); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="statements"]'); await pg.select_option('#stmtShowMode','all'); await pg.wait_for_timeout(600)
        print('tabs', await pg.evaluate("[...document.querySelectorAll('[data-stab]')].map(b=>b.textContent.trim())"))
        print('overview', (await pg.inner_text('#acctCard'))[:400].replace('\n',' | '))
        await pg.screenshot(path='a40_over.png', full_page=True)
        await pg.click('#stmtContactList .contact-head .cn'); await pg.wait_for_timeout(500)
        print('checked after Account click', await pg.evaluate("[...document.querySelectorAll('.contact-check:checked')].length"))
        print('acct', (await pg.inner_text('#acctCard'))[:600].replace('\n',' | '))
        await pg.click('[data-acct-new]'); await pg.wait_for_timeout(700)
        print('tab now', await pg.evaluate("document.querySelector('[data-stab].active').textContent"), 'recipient', await pg.input_value('#stmtRecipientName'))
        await pg.click('#stmtPrintBtn'); await pg.wait_for_timeout(500)
        # bank safety confirm may appear
        for _ in range(3):
            t = await pg.evaluate("(document.querySelector('.dj-ask-t')||{}).textContent||''")
            print('ask:', t[:90])
            if 'Did you send' in t: await pg.click('.dj-ask [data-ask="c2"]'); await pg.wait_for_timeout(900); break
            elif t: await pg.click('.dj-ask [data-ask="yes"], .dj-ask [data-ask^="c"]'); await pg.wait_for_timeout(500)
            else: break
        print('printed', await pg.evaluate("window.__printed"), 'statements', await pg.evaluate("window.__DB.statements.map(s=>[s.status,s.sent_via,!!s.sent_at])"))
        await pg.click('[data-stab="contacts"]'); await pg.wait_for_timeout(500)
        print('acct after', (await pg.inner_text('#acctCard'))[:900].replace('\n',' | '))
        await pg.screenshot(path='a40_acct.png', full_page=True)
        # undo sent then mark manually
        await pg.click('[data-st-undo]'); await pg.wait_for_timeout(300); await pg.click('.dj-ask [data-ask="yes"]'); await pg.wait_for_timeout(700)
        print('after undo', await pg.evaluate("window.__DB.statements.map(s=>s.status)"))
        await pg.click('[data-st-mark]'); await pg.wait_for_timeout(300)
        await pg.select_option('[data-sf="via"]','post'); await pg.click('[data-st-save]'); await pg.wait_for_timeout(800)
        print('after mark', await pg.evaluate("window.__DB.statements.map(s=>[s.status,s.sent_via])"), await toast())
        # group view
        await pg.select_option('#stmtShowMode','groups'); await pg.wait_for_timeout(400)
        g = await pg.query_selector('[data-acct-grp]'); print('group btn', bool(g))
        if g:
            await g.click(); await pg.wait_for_timeout(400)
            print('grp', (await pg.inner_text('#acctCard'))[:700].replace('\n',' | '))
            await pg.screenshot(path='a40_grp.png', full_page=True)
        hist = await pg.evaluate("document.querySelector('#hist-stmt .hist-who').textContent")
        print('hist who', hist)
        print('errs', errs)
        await b.close()
asyncio.run(main())
