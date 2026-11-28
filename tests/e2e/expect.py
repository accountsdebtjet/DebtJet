"""What each browser test must show. run_all.py checks every test's output against these.

Each entry is (what is being checked, regular expression). The regular expression must match
a line of the test's output (re.M). Keep expectations free of values that change with today's date
(days overdue, interest to date): check the rule or the arithmetic instead.

New tests can also call check() from check.py directly; those lines are counted too.
"""
import re

E = {
 'run4': [
  ('Interest & Fees KPIs show the overdue total', r"^KPIs: Overdue invoices7\$27,232\.00 owing"),
  ('Waiving INV-3112 marks it Waived', r"^after waive: .*INV-3112.*Waived"),
  ('Working shows the accepted terms', r"^working: .*Terms: “Seed terms of trade”, accepted 1 Jan 2026"),
  ('Working shows the interest sum', r"^working: .*Interest: \$4,781\.01 × 10% × \d+ days ÷ 365 = \$[\d,]+\.\d\d"),
  ('Statement row for INV-3112 says Overdue', r"^statement 3112 row: INV-3112.*Overdue$"),
  ('Grace-period explanation mentions backdating', r"^explain: .*backdated to the due date"),
  ('Unsaved rules show a preview banner', r"^banner: Previewing unsaved rules"),
  ('Bulk select picks 5 invoices', r"^bulk: 5 selected"),
  ('Nothing left awaiting approval', r"^KPIs after approve: .*Awaiting approval\$0\.00"),
  ('No page errors', r"^NO ERRORS$"),
 ],
 'run23': [
  ('Xero account list includes Interest Income', r"^settings open True acc opts .*'270 · Interest Income \(Other Income\)'"),
  ('Six invoices are ready to post', r"^ready rows 6 6 invoices"),
  ('Posting summary uses the chosen account and tax', r"^summary 270 · Interest Income · BAS Excluded, tax exclusive · due in 7 days"),
  ('Selecting all offers 6 drafts', r"^sel 6 selected .*Create 6 draft invoices in Xero"),
  ('Posted body carries the invoice and rate', r"^posted body .*\"invoice_id\":\"i3109\".*\"rate_pa\":0\.1"),
  ('After posting, nothing left to post', r"Nothing to post right now\."),
  ('Rows show Draft in Xero after posting', r"^posted status \['Approved', 'Draft in Xero', 'Draft in Xero', 'Draft in Xero', 'Draft in Xero', 'Draft in Xero'\]"),
  ('No page errors', r"^\[\]$"),
 ],
 'run25': [
  ('ABN shown for a business', r"^abn hidden before: False"),
  ('ABN hidden for an individual', r"^abn hidden after: True"),
  ('Contact card editor opens', r"^view after: Edit contact card"),
  ('No page errors', r"^\[\]$"),
 ],
 'run29': [
  ('Recovery can start', r"^start disabled False"),
  ('Claim details use the rich editor', r"^rich editors 1 "),
  ('Claim details state the unpaid amount', r"^details: .*remains unpaid"),
  ('Claim sections saved', r"^secs after save \['Chronology', 'Orders you ask for'\]"),
  ('No page errors', r"^\[\]$"),
 ],
 'run31': [
  ('Insert panel and Style dock open on letters', r"^ins hidden False dock hidden False"),
  ('Paper font size applied', r"^paper font size 13px"),
  ('Chip inserts into the letter', r"^chip inserted 4"),
  ('Interest & Fees hides the panel toggle', r"^interest ins hidden True toggle shown False"),
  ('No peek without hovering', r"^peek False"),
  ('Panel hides after leaving', r"^after leave hidden True"),
  ('No page errors', r"^\[\]$"),
 ],
 'run32': [
  ('Accounts tab hides Insert panel and Style dock', r"^stmt contacts tab: panel False dock False btn False"),
  ('Contact row explains itself on hover', r"^contact row title: Blue Wren Cafe · 1 invoice"),
  ('Statement tab shows Insert panel and Style dock', r"^stmt statement tab: panel True dock True"),
  ('Integrations offers Connect with Xero', r"^xero btn Connect with Xero"),
  ('No page errors', r"^\[\]$"),
 ],
 'run33': [
  ('Two contacts shown', r"^contacts shown 2"),
  ('Statement groups invoices by due status', r"^groups \['Overdue and due now\$[\d,]+\.\d\d'"),
  ('One closable flag, closed by the user', r"^closable flags 1$"),
  ('Flag closes', r"^after close 0$"),
  ('Cover and closing text appear on the statement', r"^cover in doc True closing in doc True"),
  ('Table fits the page width', r"^table fits \[(\d+), \1,"),
  ('Removing a note offers Undo', r"^toast Note removed\. Undo"),
  ('Undo restores the note', r"^restored Stage 2 cabinetry"),
  ('No page errors', r"^\[\]$"),
 ],
 'run35': [
  ('Ticking unrelated contacts asks first', r"^ask .*isn’t grouped with"),
  ('Grouping saves one group with 2 members', r"^groups in db \['Test Group'\] members 2"),
  ('Both contacts ticked', r"^ticked 2$"),
  ('Group view shows the group', r"^group heads \['Test Group'\]"),
  ('Search-only mode still lists ticked contacts', r"^none mode count 2$"),
  ('Invoices ticked', r"^inv ticked \d+$"),
  ('Headline summary style', r"^headline \[True, False\]"),
  ('Breakdown summary style', r"^breakdown \[False, True\]"),
  ('Ageing summary style', r"^ageing \[False, True\]"),
  ('Template overdue colour applied', r"^overdue colour rgb\(194, 65, 12\)"),
  ('No page errors', r"^\[\]$"),
 ],
 'run37': [
  ('Interest & Fees starts on Terms & rules', r"^start tab Terms & rules"),
  ('Without terms, nothing is charged', r"^no terms \[('INV-\d+:No terms on file'(, )?)+\]$"),
  ('Banner explains where to start', r"^banner No interest or fees can be added yet"),
  ('Rules locked until terms exist', r"^rules locked Add your terms above first\."),
  ('Limits pre-filled from the terms', r"^limits form \['12', 'due_date', 'Late payment fee:20:7'\]"),
  ('Rules above the terms are refused', r"^over limit dialog .*Interest rate 15% is above the 12% in the terms"),
  ('Rules within the terms are saved', r"^saved rules .*\"rate_pa\":0\.11"),
  ('Confirmed terms without acceptance still charge nothing', r"^confirmed, no acceptance \[('INV-\d+:No terms on file'(, )?)+\]$"),
  ('Acceptance recorded with its date', r"^acceptances \['cc99e913:2026-07-01'\]"),
  ('Invoice issued before acceptance is not charged', r"^after acceptance .*'INV-3112:Issued before terms accepted'"),
  ('Invoice after acceptance is charged', r"^after acceptance .*'INV-3109:Charging'"),
  ('Other customer without terms is not charged', r"^after acceptance .*'INV-3029:No terms on file'"),
  ('Disputed invoice is not charged', r"^after acceptance .*'INV-3110:Disputed, no charges'"),
  ('No-terms filter lists the uncharged invoices', r"^filter no terms \['INV-3112:Issued before terms accepted', 'INV-3029:No terms on file'\]"),
  ('No page errors', r"^\[\]$"),
 ],
 'run38': [
  ('AI reading lines shown', r"^ai lines \['DebtJet AI read: Interest accrues"),
  ('Values within the AI reading need no extra wording', r"^no extra wording Everything above matches"),
  ('Confirmed limits keep the found quote', r"^confirmed 1 .*\"found\":true"),
  ('Higher rate asks for wording', r"^need rate .*Interest rate of 15%"),
  ('Made-up quote rejected', r"^made-up quote That wording wasn’t found in the document\."),
  ('Quote without the number rejected', r"^real quote wrong number The quote doesn’t contain 15"),
  ('Server refuses the unsupported rate', r"^blocked Interest rate of 15% a year: .* \| server called 2"),
  ('Real fee quote found', r"^fee quote ✓ Found in the document"),
  ('Fee saved with its quote', r"^saved \['Late payment fee:20,Admin fee:15', .*\"found\":true"),
  ('Quick-add offers the admin fee', r"^fee quick \['\+ Admin fee'\]"),
  ('Re-read sends the focus note', r"^reread focus sent \[\"\",\"clause 8\.2 says 1% per month\"\]"),
  ('No page errors', r"^\[\]$"),
 ],
 'run39': [
  ('Overdue customers without evidence listed', r"^overdue list Bluestone Legal .*Record with evidence"),
  ('Form pre-fills the customer', r"^prefilled \['Bluestone Legal'\]"),
  ('Saving without evidence is blocked', r"^no evidence blocked: Add the evidence"),
  ('Declared-only record saved as declared', r"^declared grade \['declared'\]"),
  ('Declared-only record charges nothing', r"^INV-3109 declared -> No evidence on file"),
  ('Gmail evidence keeps a link, not a copy', r"^evidence row .*rfc822msgid"),
  ('Evidence upgrades the grade', r"^grade now \['evidence'\]"),
  ('With evidence, the invoice is charged', r"^INV-3109 with evidence -> Charging"),
  ('Bad email links rejected', r"^bad link: Paste a link to the email"),
  ('Outlook link accepted', r"^outlook evidence gmail,outlook"),
  ('Removing evidence drops the grade', r"^after removing evidence \['declared', 'evidence'\]"),
  ('No page errors', r"^\[\]$"),
 ],
 'run40': [
  ('Tabs are Accounts, Statement, Templates', r"^tabs \['Accounts.*', 'Statement', 'Templates'\]"),
  ('All accounts shows the outstanding total', r"^overview .*OUTSTANDING \| \$28,432\.00"),
  ('Opening an account does not tick it', r"^checked after Account click 0"),
  ('New statement goes to the Statement tab', r"^tab now Statement recipient Blue Wren Cafe"),
  ('Printing asks whether it was sent', r"^ask: Did you send this statement to Blue Wren Cafe\?"),
  ('Answering yes saves and marks it sent', r"^printed 1 statements \[\['sent', 'email', True\]\]"),
  ('Account shows the last statement sent', r"^acct after .*LAST STATEMENT SENT \| \d{1,2} \w{3,4} \d{4}"),
  ('Undo sets it back to draft', r"^after undo \['draft'\]"),
  ('Mark as sent records the method', r"^after mark \[\['sent', 'post'\]\] Marked as sent \(post\)\."),
  ('Group account opens', r"^grp Blue Group .*Contact group · 2 contacts"),
  ('History follows the open account', r"^hist who · Blue Wren Cafe \+ Bluestone Legal"),
  ('No page errors', r"^errs \[\]$"),
 ],
 'run41': [
  ('/ focuses Quick find', r"^focused qfInput"),
  ('Finds contacts and groups', r"^results .*CONTACT GROUPS \| Blue Group"),
  ('Finds contact people', r"^people .*PEOPLE \| Catherine Moss"),
  ('Finds invoices by number', r"^inv INVOICES \| INV-3110 · Bluestone Legal"),
  ('Enter opens the account', r"^view statements \| acct: Bluestone Legal"),
  ('Groups open as accounts', r"^acct2: Blue Group"),
  ('No-match message', r"^none No contacts, groups or invoices match"),
  ('Escape closes', r"^closed True"),
  ('No page errors', r"^errs \[\]$"),
 ],
}

# Interest sums printed anywhere must add up: $balance × rate% × days ÷ 365 = $interest (to the cent).
SUM = re.compile(r"\$([\d,]+\.\d\d) × ([\d.]+)% × (\d+)(?: days)? ÷ 365(?: = |[\s|]*)\$([\d,]+\.\d\d)")

def evaluate(name, output):
    """Returns a list of (ok, label, detail)."""
    out = []
    for label, rx in E.get(name, []):
        out.append((re.search(rx, output, re.M) is not None, label, rx))
    for m in SUM.finditer(output):
        bal, rate, days, got = float(m.group(1).replace(',', '')), float(m.group(2)), int(m.group(3)), float(m.group(4).replace(',', ''))
        want = round(bal * rate / 100 * days / 365 + 1e-9, 2)
        out.append((abs(want - got) < 0.006, f'Interest sum adds up ({m.group(0)})', f'expected ${want:,.2f}'))
    for line in output.splitlines():
        if line.startswith('CHECK '):
            ok = line.startswith('CHECK ok')
            out.append((ok, line[11:].strip(), line))
    return out
