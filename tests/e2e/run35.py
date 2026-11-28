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
        await pg.click('.nav-btn[data-view="statements"]'); await pg.select_option('#stmtShowMode','all'); await pg.wait_for_timeout(900)
        await pg.click('#stmtContactList .contact-check >> nth=0'); await pg.wait_for_timeout(400)
        await pg.click('#stmtContactList .contact-check >> nth=1'); await pg.wait_for_timeout(400)
        print('ask', (await pg.inner_text('.dj-ask'))[:160].replace('\n',' | ') if await pg.query_selector('.dj-ask') else None)
        await pg.click('.dj-ask [data-ask="c1"]'); await pg.wait_for_timeout(300)
        await pg.fill('.dj-ask-in input', 'Test Group'); await pg.click('.dj-ask [data-ask="yes"]'); await pg.wait_for_timeout(900)
        print('groups in db', await pg.evaluate("(window.__DB.contact_groups||[]).map(g=>g.name)"), 'members', await pg.evaluate("(window.__DB.contact_group_members||[]).length"))
        print('ticked', await pg.eval_on_selector_all('#stmtContactList .contact-check:checked','e=>e.length'))
        await pg.select_option('#stmtShowMode','groups'); await pg.wait_for_timeout(400)
        print('group heads', await pg.eval_on_selector_all('.grp-head b','e=>e.map(x=>x.textContent)'))
        await pg.select_option('#stmtShowMode','none'); await pg.wait_for_timeout(300)
        print('none mode count', await pg.eval_on_selector_all('#stmtContactList .contact-group','e=>e.length'))
        await pg.click('#stmtUntickAllInv'); await pg.wait_for_timeout(300); await pg.click('#stmtTickAllInv'); await pg.wait_for_timeout(300)
        print('inv ticked', await pg.eval_on_selector_all('.inv-check:checked','e=>e.length'))
        await pg.click('[data-stab="templates"]'); await pg.wait_for_timeout(800); await pg.click('#stmtTplCustomise'); await pg.wait_for_timeout(500)
        print('designer', await pg.evaluate("[document.getElementById('stmtDesigner') ? document.getElementById('stmtDesigner').innerHTML.length : -1, !!document.querySelector('[data-path=\"summary_style\"]'), document.querySelectorAll('#stmtDesigner details, #stmtDesigner [data-group]').length]"))
        await pg.evaluate("document.querySelectorAll('#stmtDesigner details').forEach(d=>d.open=true)")
        for v in ['headline','breakdown','ageing']:
            await pg.evaluate("v => { var e=document.querySelector('[data-path=\"summary_style\"]'); if(e){ e.value=v; e.dispatchEvent(new Event('change',{bubbles:true})); e.dispatchEvent(new Event('input',{bubbles:true})); } }", v); await pg.wait_for_timeout(500)
            print(v, await pg.evaluate("[!!document.querySelector('#statementPaper .sd-big'), !!document.querySelector('#statementPaper .sd-strip')]"))
        await pg.evaluate("() => { var e=document.querySelector('[data-path=\"desc_mode\"]'); if(e){ e.value='below'; e.dispatchEvent(new Event('change',{bubbles:true})); e.dispatchEvent(new Event('input',{bubbles:true})); } }"); await pg.wait_for_timeout(500)
        print('fulldesc rows', await pg.eval_on_selector_all('#statementPaper .sd-fulldesc','e=>e.length'))
        await pg.click('[data-sch-open]'); await pg.wait_for_timeout(200); await pg.screenshot(path='h_sch.png')
        await pg.click('[data-sch="3"]'); await pg.wait_for_timeout(400)
        print('overdue colour', await pg.evaluate("getComputedStyle(document.querySelector('#statementPaper .sd-od')||document.body).color"))
        await pg.click('[data-stab="statement"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='h_stmt.png')
        print(errs); await b.close()
asyncio.run(main())
