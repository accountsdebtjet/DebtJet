# Debt Recovery: the claim records which terms the interest rests on (document, acceptance,
# evidence, clause), the evidence pack prints it, and a lodged claim keeps the terms as they were.
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
        await pg.evaluate("""Object.assign(window.__DB.debtors[0], {legal_name:'BLUESTONE LEGAL PTY LTD', acn:'004085616', abn:'53004085616', abn_status:'Active', address_line1:'Level 4, 120 Edward St', suburb:'Brisbane', state:'QLD', postcode:'4000', debtor_kind:'company'})""")
        # Give the seeded terms the wording relied on for interest, and a fingerprint on the evidence file.
        await pg.evaluate("""(()=>{ const d=window.__DB.org_terms_documents.find(x=>x.id==='seed-terms');
          d.limits.evidence={rate:{source:'ai',clause:'5.1',quote:'Interest is payable on overdue amounts at 12% per annum from the due date.',found:true}};
          window.__DB.terms_evidence.forEach(e=>{ e.sha256='a1b2c3d4e5f60718293a4b5c6d7e8f90aabbccddeeff00112233445566778899'; }); })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(900)
        await pg.click('.nav-btn[data-view="recovery"]'); await pg.wait_for_timeout(900)
        await pg.click('[data-rtab-btn="eligibility"]'); await pg.wait_for_timeout(500)
        claim = await pg.inner_text('#recRoot')
        await pg.click('[data-rtab-btn="claim"]'); await pg.wait_for_timeout(500)
        check('Under “Seed terms of trade”, accepted 1 Jan 2026 (1 evidence item), cl 5.1.' in claim, 'Claim check names the terms, acceptance, evidence and clause', claim[:600])
        check('Only claim interest your terms' not in claim, 'No advice-style wording in the claim checks')
        btn = await pg.query_selector('#recStartBtn')
        if btn and not await btn.is_disabled(): await btn.click(); await pg.wait_for_timeout(1200)
        snap = await pg.evaluate("JSON.stringify((window.__DB.recovery_matters[0]||{}).claim_snapshot && window.__DB.recovery_matters[0].claim_snapshot.terms)")
        check('"title":"Seed terms of trade"' in snap and '"accepted_on":"2026-01-01"' in snap and '"clause":"5.1"' in snap, 'Starting the file saves the terms in the claim snapshot', snap[:400])
        await pg.click('[data-rtab-btn="evidence"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-ract="print-pack"]'); await pg.wait_for_timeout(500)
        pack = await pg.inner_text('#recPrint')
        check('3. Terms and acceptance' in pack, 'Pack has a Terms and acceptance section')
        check('Seed terms of trade · Terms of trade' in pack, 'Pack names the document')
        check('1 Jan 2026 · Signed credit application' in pack, 'Pack shows when and how the terms were accepted')
        check('File: Signed credit application.pdf' in pack and 'SHA-256): a1b2c3d4e5f60718' in pack, 'Pack lists the evidence with its file fingerprint')
        check('Up to 12% a year, simple (cl 5.1)' in pack and 'Interest is payable on overdue amounts at 12% per annum' in pack, 'Pack quotes the clause the interest rests on')
        check('4. Chronology' in pack and '5. Disputed points' in pack, 'Later sections renumbered')
        await pg.screenshot(path='rec_terms_pack.png', full_page=True)
        # Once lodged, the pack keeps the terms as saved, even if the live terms change.
        await pg.evaluate("""(()=>{ const m=recMatters[0]; m.status='lodged'; m.claim_snapshot.terms.document.title='Terms as lodged';
          window.__DB.org_terms_documents.find(x=>x.id==='seed-terms').title='Edited later'; termsDocs.forEach(d=>{ if(d.id==='seed-terms') d.title='Edited later'; }); })()""")
        await pg.click('[data-ract="print-pack"]'); await pg.wait_for_timeout(400)
        pack2 = await pg.inner_text('#recPrint')
        check('Terms as lodged' in pack2 and 'Edited later' not in pack2, 'Lodged claim keeps the terms as they were', pack2[:300])
        # No accepted terms and no interest: the pack says so plainly.
        await pg.evaluate("""(()=>{ termsAccepts.length=0; const m=recMatters[0]; m.status='preparing'; recState.options=Object.assign({}, recState.options||{}, {include_interest:false}); m.checklist.options.include_interest=false; })()""")
        await pg.click('[data-ract="print-pack"]'); await pg.wait_for_timeout(400)
        pack3 = await pg.inner_text('#recPrint')
        check('No interest or fees are claimed. No terms document is recorded for this customer in DebtJet.' in pack3, 'Without terms, the pack says so', pack3[:500])
        print('errs', errs); await b.close()
asyncio.run(main())
