# Statement text boxes use the rich editor: bold, lists and inserted clauses show on the statement; Undo still works.
import asyncio, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from check import check
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1440,'height':1000}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.click('.nav-btn[data-view="statements"]'); await pg.select_option('#stmtShowMode','all'); await pg.wait_for_timeout(300)
        await pg.click('.contact-check >> nth=0'); await pg.wait_for_timeout(300)
        await pg.click('[data-stab="statement"]'); await pg.wait_for_timeout(600)
        await pg.click('[data-txt-sec="cover"] .ld-switch'); await pg.wait_for_timeout(200)
        check(await pg.eval_on_selector('#stmtNotes-rich', 'e=>!e.hidden && e.isContentEditable'), 'Message box is a rich editor when switched on')
        check(await pg.eval_on_selector('#stmtNotes', 'e=>e.hidden'), 'The plain box stays hidden (it only stores the text)')
        await pg.click('#stmtNotes-rich')
        await pg.keyboard.press('Control+b'); await pg.keyboard.type('Thank you'); await pg.keyboard.press('Control+b'); await pg.keyboard.type(' for your business.')
        await pg.wait_for_timeout(700)
        md = await pg.input_value('#stmtNotes')
        check(md == '**Thank you** for your business.', 'Bold is stored as markup', md)
        html = await pg.eval_on_selector('#statementPaper .sd-cover', 'e=>e.innerHTML')
        check('<b>Thank you</b>' in html and '**' not in html, 'Statement shows bold, not asterisks', html)
        # Insert a clause from the Insert panel into the focused box.
        await pg.click('#stmtNotes-rich'); await pg.wait_for_timeout(200)
        clause = await pg.query_selector('#insPanel .as-clause-main')
        await clause.click(); await pg.wait_for_timeout(700)
        md2 = await pg.input_value('#stmtNotes')
        check(md2.startswith('**Thank you** for your business.\n\n') and len(md2) > len(md) + 10, 'Inserted wording goes into the rich box', md2[:120])
        # Remove with Undo.
        await pg.click('[data-ts-clear="cover"]'); await pg.wait_for_timeout(400)
        check(await pg.input_value('#stmtNotes') == '' and (await pg.inner_text('#stmtNotes-rich')).strip() == '', 'Remove clears the box')
        await pg.click('.toast-undo'); await pg.wait_for_timeout(500)
        check(await pg.input_value('#stmtNotes') == md2 and 'Thank you' in await pg.inner_text('#stmtNotes-rich'), 'Undo puts it back in the box')
        # A list in the closing message.
        await pg.click('[data-txt-sec="closing"] .ld-switch'); await pg.click('#stmtTxt-closing-rich')
        await pg.evaluate("(()=>{ const ta=document.getElementById('stmtTxt-closing'); ta.value='- Pay by EFT\\n- Quote the reference'; stmtRichRefresh(ta); ta.dispatchEvent(new Event('input',{bubbles:true})); })()")
        await pg.wait_for_timeout(700)
        closing = await pg.evaluate("[...document.querySelectorAll('#statementPaper .sd-cover')].map(e=>e.innerHTML).join('|')")
        check('<ul><li>Pay by EFT</li><li>Quote the reference</li></ul>' in closing, 'Lists show as lists on the statement', closing[-200:])
        await pg.screenshot(path='stmt_rich.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
