# Letters of Demand: the SA pre-action notice template (your own notice, instead of a CourtSA Final Notice).
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
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.evaluate("Object.assign(currentOrg, {address:'12 King William St\\nAdelaide SA 5000'})")
        await pg.click('.nav-btn[data-view="letters"]'); await pg.wait_for_timeout(900)
        await pg.click('#ldCaseCard [data-ltab-go="letter"]'); await pg.wait_for_timeout(900)
        opts = await pg.eval_on_selector_all('#ldTplSelect option', 'e=>e.map(o=>o.value+"|"+o.textContent)')
        check(any(o.startswith('builtin:sa_pre_action|SA pre-action notice') for o in opts), 'Template list offers the SA pre-action notice', opts)
        await pg.select_option('#ldTplSelect', 'builtin:sa_pre_action'); await pg.wait_for_timeout(800)
        paper = await pg.inner_text('#letterPaper')
        check('Notice of intended claim in the Magistrates Court of South Australia' in paper, 'Subject names the court')
        check('Our full name and address for service: DebtJet Software Development, 12 King William St, Adelaide SA 5000.' in paper, 'Name and address for service filled from Settings', paper[:500])
        check('The proposed claim is for $' in paper and 'plus the costs of filing and serving the claim' in paper, 'States the proposed claim and amount')
        check('within 21 days of receiving this notice' in paper and 'counterclaim or set-off' in paper and 'meeting or mediation' in paper, 'Asks for the written response the rules describe')
        check('within 21 days of the date of this letter' in paper, 'Pay-within is 21 days')
        check('{{' not in paper, 'No unfilled fields')
        await pg.click('.nav-btn[data-view="letters"]'); await pg.wait_for_timeout(300)
        desc = await pg.evaluate("BUILTIN_LETTERS.pre_legal.description")
        check('advice' not in desc.lower(), 'Pre-legal template no longer tells the user to get advice', desc)
        await pg.screenshot(path='sa_notice.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
