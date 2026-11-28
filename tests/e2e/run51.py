# Disputed facts: our response uses the rich editor; formatting is saved and shows in the evidence pack once approved.
import asyncio, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from check import check
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
        await pg.add_init_script("window.print=function(){}")
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.evaluate("""(()=>{ const D=window.__DB; const c=D.cases[0];
          D.recovery_disputes=[{id:'d1', org_id:'org1', case_id:c.id, invoice_id:'i3110', debtor_says:'The work was not finished.', raised_via:'email', raised_on:'2026-11-10', our_response:null, approved_at:null, created_at:'2026-11-10T00:00:00Z'}]; })()""")
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="disputes"]'); await pg.wait_for_timeout(600)
        ed = await pg.query_selector('.rec-dispute .rec-rich')
        check(ed is not None and await ed.evaluate('e=>e.isContentEditable'), 'Our response is a rich editor')
        await ed.click(); await pg.keyboard.type('Site report dated 3 Nov shows the work ')
        await pg.keyboard.press('Control+b'); await pg.keyboard.type('was completed'); await pg.keyboard.press('Control+b'); await pg.keyboard.type(' (NOTE:1).')
        await pg.wait_for_timeout(300)
        await pg.click('.rec-dispute [data-dact="save"]'); await pg.wait_for_timeout(700)
        saved = await pg.evaluate("window.__DB.recovery_disputes[0].our_response")
        check(saved == 'Site report dated 3 Nov shows the work **was completed** (NOTE:1).', 'Saved with formatting as markup', saved)
        check('was completed' in await pg.inner_text('.rec-dispute .rec-rich') and '**' not in await pg.inner_text('.rec-dispute .rec-rich'), 'Editor shows formatting after saving, not asterisks')
        await pg.check('.rec-dispute [data-dact="approve"]'); await pg.wait_for_timeout(700)
        check(bool(await pg.evaluate("window.__DB.recovery_disputes[0].approved_at")), 'Response approved')
        check(await pg.eval_on_selector('.rec-rich', 'e=>getComputedStyle(e).fontWeight') == '400', 'Editors in Debt Recovery use normal weight (Bold works)')
        pack = await pg.evaluate("recPackHtml(recCase(), recMatter() || {status:'preparing', applicant:{}, respondent:{}}, recClaim(recCase(), recMatter()))")
        check('<b>was completed</b>' in pack and '**' not in pack.split('5. Disputed points')[1][:800], 'Pack shows the approved response with formatting')
        check('The work was not finished.' in pack, 'Pack shows what the debtor says')
        print('errs', errs); await b.close()
asyncio.run(main())
