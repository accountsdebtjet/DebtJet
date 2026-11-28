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
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="statements"]'); await pg.select_option('#stmtShowMode','all'); await pg.wait_for_timeout(800)
        print('contacts shown', await pg.eval_on_selector_all('#stmtContactList .contact-group','e=>e.length'), await pg.eval_on_selector('#stmtShowAllBtn','e=>e?e.textContent:null') if await pg.query_selector('#stmtShowAllBtn') else None)
        await pg.click('#stmtContactList .contact-check >> nth=1'); await pg.wait_for_timeout(500)
        await pg.click('[data-stab="statement"]'); await pg.wait_for_timeout(900)
        print('groups', await pg.eval_on_selector_all('#statementPaper tr.sd-grp','e=>e.map(x=>x.textContent)'))
        print('ins top/bottom', await pg.evaluate("[getComputedStyle(document.getElementById('insPanel')).top, getComputedStyle(document.getElementById('insPanel')).bottom, document.querySelector('.app').classList.contains('ins-open')]"))
        flags = await pg.eval_on_selector_all('#stmtWarn .flag-x','e=>e.length'); print('closable flags', flags)
        if flags: await pg.click('#stmtWarn .flag-x'); await pg.wait_for_timeout(200); print('after close', await pg.eval_on_selector_all('#stmtWarn .ai-flag','e=>e.length'))
        print(await pg.evaluate("(function(){var e=document.querySelector('#statementPaper .sd-summary');var b=e.querySelector('.sd-box');var cs=getComputedStyle(e);return [cs.display,cs.flexDirection,e.offsetHeight,b.offsetHeight,e.parentElement.className,getComputedStyle(e.parentElement).display, e.nextElementSibling&&e.nextElementSibling.className]})()"))
        await pg.screenshot(path='e_stmt.png')
        await pg.click('[data-txt-sec="cover"] .ld-switch'); await pg.wait_for_timeout(200)
        await pg.click('#stmtNotes-rich'); await pg.keyboard.type('Thanks for your business.'); await pg.click('[data-txt-sec="closing"] .ld-switch'); await pg.click('#stmtTxt-closing-rich'); await pg.keyboard.type('Call us on 07 5550 1234 with any questions.'); await pg.wait_for_timeout(700)
        print('cover in doc', 'Thanks for your business' in await pg.inner_text('#statementPaper'), 'closing in doc', '5550 1234' in await pg.inner_text('#statementPaper'))
        print('table fits', await pg.evaluate("(function(){var sd=document.querySelector('#statementPaper .sd');var t=sd.querySelector('table.sd-t');var cs=getComputedStyle(sd);return [t.scrollWidth, sd.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight), t.style.fontSize, sd.style.zoom]})()"))
        nb = await pg.query_selector('[data-ln-clear]')
        await pg.fill('#stmtLineNotesBox textarea >> nth=0', 'Stage 2 cabinetry'); await pg.wait_for_timeout(300)
        await pg.click('#stmtLineNotesBox .ln-clear >> nth=0'); await pg.wait_for_timeout(300)
        print('toast', await pg.inner_text('#toast'))
        await pg.click('#toast .toast-undo'); await pg.wait_for_timeout(300)
        print('restored', await pg.eval_on_selector('#stmtLineNotesBox textarea','e=>e.value'))
        await pg.screenshot(path='f_stmt.png')
        box = await pg.query_selector('#stmtLineNotesBox')
        if box: await box.scroll_into_view_if_needed(); await pg.wait_for_timeout(200); await box.screenshot(path='e_notes.png')
        print(errs); await b.close()
asyncio.run(main())
