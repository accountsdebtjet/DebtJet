import asyncio, os
HERE=os.path.dirname(os.path.abspath(__file__))
APP='file://'+os.path.abspath(os.path.join(HERE,'..','..','index.html'))
CHROME=os.environ.get('CHROME_PATH') or None
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1440,'height':1000}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.goto(APP); await pg.wait_for_timeout(900)
        await pg.evaluate("window.__DB.xero_connections=[{org_id:'org1', tenant_name:'Demo Company (AU)'}]")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        # ---- xero posting
        await pg.click('.nav-btn[data-view="interest"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(800)
        print('settings open', await pg.eval_on_selector('#xpSettings','e=>e.open'), 'acc opts', await pg.eval_on_selector_all('#xpAccount option','e=>e.map(o=>o.textContent)'))
        print('tax groups', await pg.eval_on_selector_all('#xpTax optgroup','e=>e.map(g=>g.label+":"+g.children.length)'))
        print('ready rows', await pg.eval_on_selector_all('#xpReady tbody tr','e=>e.length'), await pg.inner_text('#xpReadyCount'), '|', await pg.inner_text('#xpSkipped'))
        await pg.screenshot(path='xp0.png', full_page=True)
        await pg.select_option('#xpAccount', '270'); await pg.select_option('#xpTax', 'BASEXCLUDED')
        await pg.click('#xpSaveSettings'); await pg.wait_for_timeout(400)
        print('summary', await pg.inner_text('#xpSettingsSummary'))
        await pg.check('#xpAll'); await pg.wait_for_timeout(200)
        print('sel', await pg.inner_text('#xpSelInfo'), await pg.inner_text('#xpPostBtn'))
        before = await pg.eval_on_selector_all('#xpReady tbody tr','e=>e.length')
        await pg.click('#xpPostBtn'); await pg.wait_for_timeout(400)
        if await pg.query_selector('.dj-ask [data-ask="yes"]'): await pg.click('.dj-ask [data-ask="yes"]')
        await pg.wait_for_timeout(1200)
        body = await pg.evaluate("JSON.stringify(window.__writes.filter(w=>w.fn==='xero-charges' && w.body.action==='post').map(w=>w.body.items[0]))")
        print('posted body', body[:300])
        print('ready after', await pg.eval_on_selector_all('#xpReady tbody tr','e=>e.length'), 'posted rows', await pg.eval_on_selector_all('#xpPosted tbody tr','e=>e.length'), (await pg.inner_text('#xpReady'))[:200].replace('\n',' | '))
        await pg.screenshot(path='xp1.png', full_page=True)
        # simulate approval + sync of first interest invoice: add as invoice
        await pg.evaluate("""(()=>{ const cp=window.__DB.charge_postings[0]; const src=window.__DB.invoices.find(i=>i.id===cp.invoice_id);
          window.__DB.invoices.push(Object.assign({}, src, {id:'int1', invoice_number:cp.xero_invoice_number, description:'Interest', amount:cp.interest, external_id:cp.xero_invoice_id, due_date:'2026-10-01', issued_date:'2026-09-20'}));
          cp.status='authorised'; window.__src=src.id; })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(1000)
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(300)
        await pg.fill('#chgSearch', await pg.evaluate("window.__DB.invoices.find(i=>i.id===window.__src).invoice_number")); await pg.wait_for_timeout(300)
        print('int row', (await pg.inner_text('#chgTable'))[:300].replace('\n',' | '))
        await pg.click('[data-chgtab="invoices"]'); await pg.wait_for_timeout(600)
        print('posted status', await pg.eval_on_selector_all('#xpPosted tbody tr td:last-child','e=>e.map(x=>x.innerText)'))
        print(errs); await b.close()
asyncio.run(main())
