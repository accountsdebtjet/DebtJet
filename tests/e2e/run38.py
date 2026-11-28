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
        await pg.add_init_script("window.__NO_TERMS=true")
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(600)
        await pg.set_input_files('#termsFile', files=[{'name':'Acme_Terms.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4'}]); await pg.wait_for_timeout(1300)
        print('ai lines', await pg.eval_on_selector_all('#termsLimits .ev-line','e=>e.map(x=>x.innerText.slice(0,90))'))
        print('no extra wording', await pg.inner_text('#limEvidence'))
        await pg.check('[data-lk="checked"]'); await pg.click('[data-lim="confirm"]'); await pg.wait_for_timeout(800)
        print('confirmed 1', await pg.evaluate("JSON.stringify(window.__DB.org_terms_documents[0].limits.evidence).slice(0,160)"))
        print('read-only', (await pg.inner_text('#termsLimits')).replace('\n',' | ')[:300])
        # change: raise rate, add a fee
        await pg.click('[data-lim="edit"]'); await pg.wait_for_timeout(300)
        await pg.fill('[data-lk="interest.rate_pct"]','15'); await pg.wait_for_timeout(200)
        print('need rate', (await pg.inner_text('#limEvidence')).replace('\n',' | ')[:220])
        await pg.fill('[data-evk="rate"] [data-evq]','interest at 15% per annum on everything'); await pg.wait_for_timeout(100)
        print('made-up quote', await pg.inner_text('[data-evk="rate"] .ev-status'))
        await pg.fill('[data-evk="rate"] [data-evq]','Interest accrues on overdue amounts at 12% per annum calculated daily'); await pg.wait_for_timeout(100)
        print('real quote wrong number', await pg.inner_text('[data-evk="rate"] .ev-status'))
        await pg.check('[data-lk="checked"]'); await pg.click('[data-lim="confirm"]'); await pg.wait_for_timeout(500)
        print('blocked', await pg.inner_text('#limProblems'), '| server called', await pg.evaluate("window.__writes.filter(w=>w.fn==='terms-limits').length"))
        await pg.fill('[data-lk="interest.rate_pct"]','12'); await pg.wait_for_timeout(200)
        await pg.click('[data-lim="addfee"]'); await pg.wait_for_timeout(300)
        rows = await pg.query_selector_all('[data-lf]'); last = rows[-1]
        await (await last.query_selector('[data-lf-k=name]')).fill('Admin fee')
        await (await last.query_selector('[data-lf-k=max_amount]')).fill('15')
        await (await last.query_selector('[data-lf-k=applies]')).select_option('per_statement')
        await (await last.query_selector('[data-lf-k=min_after_days]')).fill('30')
        await pg.wait_for_timeout(200)
        print('need fee', (await pg.inner_text('#limEvidence')).replace('\n',' | ')[:200])
        await pg.fill('[data-evk="fee:admin fee"] [data-evq]','An account administration fee of $15 may be charged once for each overdue account statement we send')
        await pg.fill('[data-evk="fee:admin fee"] [data-evc]','8.5'); await pg.wait_for_timeout(100)
        print('fee quote', await pg.inner_text('[data-evk="fee:admin fee"] .ev-status'))
        await pg.screenshot(path='t38_edit.png', full_page=True)
        if not await pg.is_checked('[data-lk="checked"]'): await pg.check('[data-lk="checked"]')
        await pg.click('[data-lim="confirm"]'); await pg.wait_for_timeout(900)
        print('saved', await pg.evaluate("[window.__DB.org_terms_documents[0].limits.fees.map(f=>f.name+':'+f.max_amount).join(','), JSON.stringify(window.__DB.org_terms_documents[0].limits.evidence['fee:admin fee']), window.__DB.org_terms_documents[0].limits_log.length]"))
        print('read-only 2', (await pg.inner_text('#termsLimits')).replace('\n',' | ')[:420])
        await pg.screenshot(path='t38_done.png', full_page=True)
        # quick-add the new fee to rules
        btns = await pg.eval_on_selector_all('#chgFeeQuick button','e=>e.map(x=>x.textContent)'); print('fee quick', btns)
        # re-read
        await pg.click('[data-lim="reread"]'); await pg.fill('[data-reread]','clause 8.2 says 1% per month'); await pg.click('[data-lim="reread-go"]'); await pg.wait_for_timeout(900)
        print('reread focus sent', await pg.evaluate("JSON.stringify(window.__writes.filter(w=>w.fn==='review-terms').map(w=>w.body.focus||''))"))
        print(errs); await b.close()
asyncio.run(main())
