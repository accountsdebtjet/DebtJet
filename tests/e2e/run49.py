# Contact groups: add a DebtJet-made group to Xero, take a contact out of a group, and manage groups from the contact card.
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
        async def route(r):
            u=r.request.url
            if 'supabase' in u and u.endswith('.js'): await r.fulfill(path=os.path.join(HERE,'fake-supabase.js'), content_type='application/javascript')
            elif u.startswith('file://'): await r.continue_()
            else: await r.abort()
        await pg.route('**/*', route)
        await pg.add_init_script("window.__SEED_GROUP=true")
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.evaluate("""(()=>{ const D=window.__DB; D.xero_connections=[{org_id:'org1', tenant_name:'Demo Company (AU)'}];
          D.debtors[0].xero_contact_id='xc-bluestone';
          const bw=D.invoices.find(i=>i.invoice_number==='INV-3029'); D.debtors.push(Object.assign({}, bw.debtors||{}, {id:bw.debtor_id, name:'Blue Wren Cafe'})); })()""")
        await pg.click('#refreshBtn'); await pg.wait_for_timeout(1000)
        async def ask(): return await pg.evaluate("(document.querySelector('.dj-ask')||{}).innerText||''")
        async def yes(sel='[data-ask="yes"]'):
            await pg.click('.dj-ask ' + sel); await pg.wait_for_timeout(500)
        writes = lambda: pg.evaluate("window.__writes.filter(w=>w.fn==='xero-groups').map(w=>w.body.action+':'+(w.body.debtor_id?'d':'g'))")
        await pg.click('.nav-btn[data-view="statements"]'); await pg.wait_for_timeout(500)
        await pg.select_option('#stmtShowMode', 'groups'); await pg.wait_for_timeout(400)
        push = await pg.query_selector('[data-grp-push]')
        check(push is not None, 'A DebtJet-made group offers "Add to Xero"')
        await push.click(); await pg.wait_for_timeout(300)
        check('Add “Blue Group” to Xero as a contact group?' in await ask(), 'Asks before creating the group in Xero')
        await yes(); await pg.wait_for_timeout(300)
        t = await ask()
        check('now in Xero with 1 contact' in t and 'Blue Wren Cafe' in t, 'Says which contacts aren’t in Xero', t)
        await yes(); await pg.wait_for_timeout(300)
        check(await pg.evaluate("stmtGroups[0].xero_group_id") == 'xg-g1', 'Group is now linked to Xero')
        head = await pg.inner_text('.grp-block .grp-head')
        check('Xero' in head and 'Rename' not in head and 'Add to Xero' not in head, 'Linked group is managed as a Xero group', head)
        # Take Blue Wren out of the (now Xero) group from the groups view.
        await pg.click('.grp-rm[data-did="%s"]' % await pg.evaluate("window.__DB.invoices.find(i=>i.invoice_number==='INV-3029').debtor_id")); await pg.wait_for_timeout(300)
        check('Take Blue Wren Cafe out of “Blue Group”?' in await ask() and 'changes in Xero too' in await ask(), 'Asks before taking a contact out, and says Xero changes too')
        await yes(); await pg.wait_for_timeout(400)
        check(await pg.evaluate("window.__DB.contact_group_members.filter(m=>m.group_id==='g1').length") == 1, 'Contact taken out of the group')
        check(await writes() == ['push:g', 'remove:d'], 'Changes went through Xero (xero-groups)', await writes())
        # Contact card: see, add to and take out of groups.
        await pg.evaluate("openCase(cases[0].id)"); await pg.wait_for_timeout(900)
        card = await pg.inner_text('#contactCard')
        check('CONTACT GROUPS' in card.upper() and 'Blue Group' in card, 'Contact card lists the contact’s groups', card[-300:])
        await pg.select_option('[data-cc-grp-add]', '__new'); await pg.wait_for_timeout(300)
        await pg.fill('.dj-ask-in input', 'Bluestone family'); await yes('[data-ask="yes"]'); await pg.wait_for_timeout(600)
        card = await pg.inner_text('#contactCard')
        check('Bluestone family' in card, 'A new group can be made from the contact card', card[-300:])
        gid = await pg.evaluate("stmtGroups.find(g=>g.name==='Bluestone family').id")
        await pg.click('[data-cc-grp-rm="%s"]' % gid); await pg.wait_for_timeout(300)
        await yes(); await pg.wait_for_timeout(500)
        card = await pg.inner_text('#contactCard')
        check('bluestone family' not in card.upper().split('CONTACT GROUPS')[1].split('ADD TO A GROUP')[0].lower().replace('bluestone legal',''), 'Taken out of a DebtJet group from the contact card')
        check(await writes() == ['push:g', 'remove:d'], 'DebtJet-only groups change without calling Xero', await writes())
        await pg.screenshot(path='cc_groups.png', full_page=True)
        print('errs', errs); await b.close()
asyncio.run(main())
