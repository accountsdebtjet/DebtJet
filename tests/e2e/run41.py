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
        await pg.add_init_script("window.__SEED_GROUP=true")
        await pg.goto(APP); await pg.wait_for_timeout(1000)
        await pg.evaluate("window.__DB.debtor_contacts.push({debtor_id: window.__DB.invoices.find(i=>i.invoice_number==='INV-3109').debtor_id, org_id:'org1', name:'Catherine Moss', email:'catherine@bluestone.example', role:'Accounts payable'})")
        await pg.keyboard.press('/'); await pg.wait_for_timeout(300)
        print('focused', await pg.evaluate("document.activeElement.id"))
        await pg.keyboard.type('blue'); await pg.wait_for_timeout(300)
        print('results', (await pg.inner_text('#qfPanel')).replace('\n',' | ')[:400])
        await pg.screenshot(path='a41_qf.png', clip={'x':500,'y':0,'width':900,'height':520})
        await pg.fill('#qfInput',''); await pg.keyboard.type('catherine'); await pg.wait_for_timeout(300)
        print('people', (await pg.inner_text('#qfPanel')).replace('\n',' | ')[:200])
        await pg.fill('#qfInput',''); await pg.keyboard.type('3110'); await pg.wait_for_timeout(300)
        print('inv', (await pg.inner_text('#qfPanel')).replace('\n',' | ')[:200])
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
        print('view', await pg.evaluate("[...document.querySelectorAll('.view')].find(v=>!v.hidden).getAttribute('data-view')"), '| acct:', await pg.inner_text('#acctTitle'))
        await pg.keyboard.press('Control+k'); await pg.keyboard.type('group'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        print('acct2:', await pg.inner_text('#acctTitle'))
        await pg.keyboard.press('Control+k'); await pg.keyboard.type('zzzz'); await pg.wait_for_timeout(200)
        print('none', (await pg.inner_text('#qfPanel'))[:80].replace('\n',' | '))
        await pg.keyboard.press('Escape'); print('closed', await pg.evaluate("document.getElementById('qfPanel').hidden"))
        print('errs', errs)
        await b.close()
asyncio.run(main())
