/* DebtJet: letters.js
 * Letters of Demand: clause library, letter model, editor, AI draft, print and send.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* =====================================================================
     LETTERS OF DEMAND v2
     A letter = subject + ordered blocks (paragraphs, headings, amounts table,
     pay-by box, payment details, divider) + settings, drawn in the shared
     brand design (an Account Statements design) with optional overrides.
     ===================================================================== */
  var TPL_LABEL = { reminder:'Friendly reminder', second_reminder:'Second reminder', first_demand:'First letter of demand', final_demand:'Final letter of demand', pre_legal:'Notice before legal action', plan:'Payment plan letter', dispute:'Dispute letter', other:'Other letter' };
  var STAGE_ORDER = ['reminder','second_reminder','first_demand','final_demand','pre_legal','plan','dispute','other'];

  // ---- Clause library: Australian, plain English, ACCC/ASIC Debt collection guideline in mind.
  // intent:true = says what the business will do next; only use it if that decision is made.
  var CLAUSES = [
    { cat:'Opening', key:'open_reminder', label:'Overdue reminder', text:'Our records show that {{invoice_list}}, due on {{due_date}}, {{is_are}} now overdue.' },
    { cat:'Opening', key:'open_friendly', label:'Friendly check-in', text:'We hope all is well. This is a friendly reminder that payment of {{invoice_list}} is now {{days_overdue}} days overdue. It may simply have been missed.' },
    { cat:'Opening', key:'open_second', label:'Second reminder', text:'We wrote to you on {{last_letter_date}} about the overdue amount on your account. Our records show it remains unpaid.' },
    { cat:'Opening', key:'open_first_demand', label:'Letter of demand', text:'We refer to your account with {{business_name}}. Despite our earlier reminders, the amount set out below remains outstanding, and we now formally request payment.' },
    { cat:'Opening', key:'open_final', label:'Final demand', text:'This is our final letter of demand about the overdue amount on your account. We have written to you previously and have not received payment or a proposal to pay.' },
    { cat:'Opening', key:'open_pre_legal', label:'Before legal action', text:'We have written to you on several occasions about this debt. As we have not received payment or a proposal to pay, we are writing to tell you what we intend to do next.' },
    { cat:'Opening', key:'open_part_paid', label:'Part-payment received', text:'Thank you for your recent payment. After applying it to your account, an amount of {{total_owing}} remains outstanding.' },
    { cat:'Amount owed', key:'amt_total', label:'Total and breakdown', text:'The total now owing is {{total_owing}}, made up of {{principal}} in unpaid invoices{{charges_phrase}}.' },
    { cat:'Amount owed', key:'amt_table', label:'See the table', text:'The invoices and amounts owing are set out below.' },
    { cat:'Amount owed', key:'amt_interest_terms', label:'Interest under terms', text:'Under our terms of trade, interest is charged on overdue amounts at {{interest_rate}} per year until paid.' },
    { cat:'Amount owed', key:'amt_disputed_excluded', label:'Disputed amounts excluded', text:'This letter does not ask for payment of {{disputed_list}}, which you have disputed and we are reviewing.' },
    { cat:'Payment request', key:'pay_soon', label:'Pay soon', text:'Please arrange payment at your earliest convenience.' },
    { cat:'Payment request', key:'pay_by', label:'Pay by a date', text:'Please pay {{total_owing}} by {{pay_by_date}}.' },
    { cat:'Payment request', key:'pay_within', label:'Pay within N days', text:'We request payment of {{total_owing}} within {{pay_days}} days of the date of this letter, that is, by {{pay_by_date}}.' },
    { cat:'Payment request', key:'pay_methods', label:'How to pay', text:'You can pay by bank transfer using the details below. Please quote reference {{payment_reference}} so we can match your payment.' },
    { cat:'Payment request', key:'pay_part', label:'Pay what you can', text:"If you can't pay the full amount now, please pay what you can and contact us to agree how the balance will be paid." },
    { cat:'Payment request', key:'pay_already', label:'Already paid?', text:'If you have paid in the last few days, thank you, and please disregard this letter. Sending us the remittance details helps us match your payment.' },
    { cat:'Payment plans', key:'plan_offer', label:'Offer a plan', text:'If you are unable to pay in full, we are happy to discuss a payment arrangement. Please contact us by {{pay_by_date}} so we can agree on something that works for both of us.' },
    { cat:'Payment plans', key:'plan_confirm', label:'Confirm a plan', text:'This letter confirms the payment arrangement we have agreed. Please make each instalment on time, and if your circumstances change, contact us before an instalment is due.' },
    { cat:'Payment plans', key:'plan_broken', label:'Missed instalment', text:'Our records show that an agreed instalment has not been received. Please contact us within 7 days so we can discuss how to get the arrangement back on track.' },
    { cat:'Hardship', key:'hardship', label:'Financial difficulty', text:'If you are experiencing financial difficulty, please let us know. We will consider your circumstances and can discuss options such as more time to pay or instalments.' },
    { cat:'Disputes', key:'dispute_invite', label:'Invite a dispute', text:'If you believe any part of this amount is not owed, please tell us why as soon as possible so we can look into it.' },
    { cat:'Disputes', key:'dispute_ack', label:'Acknowledge a dispute', text:'We acknowledge the concerns you have raised about {{disputed_list}}. We are reviewing them and will not seek payment of the disputed amount while our review is underway.' },
    { cat:'Next steps', key:'next_further', label:'Consider next steps', text:'If we do not receive payment or hear from you by {{pay_by_date}}, we will consider our options to recover the debt.', intent:true },
    { cat:'Next steps', key:'next_supply', label:'Suspend credit', text:'Until your account is brought up to date, we may suspend further supply on credit terms.', intent:true },
    { cat:'Next steps', key:'next_agent', label:'Refer to a collector', text:'If the account is not resolved by {{pay_by_date}}, we intend to refer it to a debt collection agency.', intent:true },
    { cat:'Next steps', key:'next_legal', label:'Start legal proceedings', text:'If the account is not resolved by {{pay_by_date}}, we intend to start legal proceedings to recover the debt, which may include a claim for interest and legal costs as allowed by law.', intent:true },
    { cat:'SA pre-action notice', key:'open_sa_notice', label:'SA: notice of intended claim', text:'This is our written notice that we intend to start a claim against you in the Magistrates Court of South Australia. We are giving you this notice before we start that claim.' },
    { cat:'SA pre-action notice', key:'sa_claimant', label:'SA: our name and address for service', text:'Our full name and address for service: {{business_name}}, {{our_address}}.' },
    { cat:'SA pre-action notice', key:'sa_proposed', label:'SA: the proposed claim', text:'The proposed claim is for {{total_owing}}, being {{principal}} in unpaid invoices{{charges_phrase}}, plus the costs of filing and serving the claim. The invoices are listed below.' },
    { cat:'SA pre-action notice', key:'sa_response', label:'SA: your written response', text:'Please give us a written response within 21 days of receiving this notice. Your response should include your full name and address for service; your response to each part of the proposed claim, including the nature of any dispute; details of any counterclaim or set-off; any offer to settle; and whether you agree to a meeting or mediation.' },
    { cat:'SA pre-action notice', key:'sa_next', label:'SA: claim after 21 days', text:'If the amount is not paid, or we do not receive your response, within 21 days of you receiving this notice, we intend to file the claim in the Magistrates Court of South Australia without further notice.', intent:true },
    { cat:'Closing', key:'close_contact', label:'Contact us', text:'If you have any questions, please contact us on {{our_contact}}.' },
    { cat:'Closing', key:'close_thanks', label:'Thank you', text:'Thank you for your prompt attention to this matter.' },
    { cat:'Closing', key:'close_disregard', label:'Disregard if paid', text:'If you have already paid, please disregard this letter.' }
  ];
  var CLAUSE_BY_KEY = {}; CLAUSES.forEach(function(c){ CLAUSE_BY_KEY[c.key] = c; });
  var LETTER_VARS = [
    ['debtor_name','Debtor (legal name)'], ['trading_name','Debtor (name on file)'], ['contact_name','Contact person'], ['first_name','Contact first name'],
    ['invoice_list','Invoice numbers'], ['due_date','Earliest due date'], ['days_overdue','Days overdue'], ['principal','Invoices owing'],
    ['interest','Interest'], ['fees','Fees'], ['total_owing','Total owing'], ['interest_rate','Interest rate'], ['pay_days','Days to pay'],
    ['pay_by_date','Pay-by date'], ['payment_reference','Payment reference'], ['last_letter_date','Last letter date'], ['disputed_list','Disputed invoices'],
    ['business_name','Your business name'], ['our_address','Your address (Settings)'], ['our_contact','Your contact details'], ['today','Today’s date']
  ];
  LETTER_VARS.forEach(function(v){ DJ_FIELD_LABEL[v[0]] = v[1]; }); DJ_FIELD_LABEL.charges_phrase = 'Interest and fees (phrase)';
  var LD_DEFAULT_SETTINGS = { design_source: 'default', overrides: {}, pay_days: 7, salutation: 'dear_contact', table: 'per_invoice', show_interest: true, show_fees: true,
    show_ref: true, show_abn: true, private_conf: false, spacing: 'normal', sign_name: '', sign_title: 'Accounts team', our_contact: '', signature: null };
  var B = function(t, extra){ return Object.assign({ type: t }, extra || {}); };
  var C = function(k){ return { type: 'text', text: CLAUSE_BY_KEY[k].text, clause: k }; };
  var BUILTIN_LETTERS = {
    reminder_friendly: { name:'Friendly reminder', stage:'reminder', description:'Gentle first nudge. No demands, no charges talk.', subject:'Payment reminder: {{invoice_list}}',
      blocks:[C('open_friendly'), C('amt_table'), B('table'), C('pay_soon'), B('payment'), C('pay_already'), C('close_contact')], settings:{ table:'per_invoice', show_ref:false } },
    reminder_second: { name:'Second reminder', stage:'second_reminder', description:'Firmer follow-up with a pay-by date and an offer to talk.', subject:'Second reminder: overdue account',
      blocks:[C('open_second'), C('amt_total'), B('table'), C('pay_by'), B('payment'), C('plan_offer'), C('close_contact')], settings:{ pay_days:7 } },
    first_demand: { name:'First letter of demand', stage:'first_demand', description:'Formal demand with a deadline, charges breakdown and dispute invitation.', subject:'Letter of demand: overdue account {{invoice_list}}',
      blocks:[C('open_first_demand'), C('amt_total'), B('table'), C('amt_interest_terms'), C('pay_within'), B('paybox'), B('payment'), C('plan_offer'), C('dispute_invite'), C('next_further'), C('close_contact')], settings:{ pay_days:14 } },
    final_demand: { name:'Final letter of demand', stage:'final_demand', description:'Last demand before referral. Only send if you intend the stated next step.', subject:'Final letter of demand: {{total_owing}} overdue',
      blocks:[C('open_final'), C('amt_total'), B('table'), C('pay_within'), B('paybox'), B('payment'), C('plan_offer'), C('hardship'), C('dispute_invite'), C('next_agent'), C('close_contact')], settings:{ pay_days:7, private_conf:true } },
    pre_legal: { name:'Notice before legal action', stage:'pre_legal', description:'Tells the debtor legal proceedings are intended.', subject:'Notice of intended legal proceedings',
      blocks:[C('open_pre_legal'), C('amt_total'), B('table'), C('pay_within'), B('paybox'), B('payment'), C('plan_offer'), C('dispute_invite'), C('next_legal'), C('close_contact')], settings:{ pay_days:14, private_conf:true } },
    sa_pre_action: { name:'SA pre-action notice', stage:'pre_legal', description:'South Australia: your own written notice of an intended Magistrates Court claim, giving 21 days to respond. The alternative is a Final Notice (Form P1) made in CourtSA.', subject:'Notice of intended claim in the Magistrates Court of South Australia',
      blocks:[C('open_sa_notice'), C('sa_claimant'), C('sa_proposed'), B('table'), C('pay_within'), B('paybox'), B('payment'), C('sa_response'), C('sa_next'), C('close_contact')], settings:{ pay_days:21, private_conf:true } },
    part_paid: { name:'Part-payment received', stage:'reminder', description:'Thanks for a payment and confirms the balance.', subject:'Payment received: balance outstanding',
      blocks:[C('open_part_paid'), B('table'), C('pay_by'), B('payment'), C('plan_offer'), C('close_thanks')], settings:{ pay_days:14 } },
    plan_confirm: { name:'Payment plan confirmation', stage:'plan', description:'Confirms an agreed arrangement.', subject:'Payment arrangement confirmed',
      blocks:[C('plan_confirm'), C('amt_total'), B('table'), B('payment'), C('close_contact')], settings:{ table:'summary', show_ref:false } },
    plan_broken: { name:'Missed instalment', stage:'plan', description:'Supportive follow-up when an instalment is missed.', subject:'Missed payment instalment',
      blocks:[C('plan_broken'), C('amt_total'), B('payment'), C('hardship'), C('close_contact')], settings:{ table:'none' } },
    dispute_ack: { name:'Dispute acknowledgement', stage:'dispute', description:'Acknowledges a dispute and pauses collection of the disputed amount.', subject:'Your query about your account',
      blocks:[C('dispute_ack'), C('amt_disputed_excluded'), B('table'), C('pay_soon'), B('payment'), C('close_contact')], settings:{ table:'per_invoice' } }
  };

  var ldKey = null, ldTpl = null, ldDirty = false, ldTab = 'content', ldAi = false, ldFocusEl = null, ldViewing = null, ldFlagsCache = [];
  function cloneTpl(t){ return JSON.parse(JSON.stringify(t)); }
  function ldSettings(){ return Object.assign({}, LD_DEFAULT_SETTINGS, ldTpl.settings || {}, { overrides: Object.assign({}, (ldTpl.settings || {}).overrides || {}) }); }
  function legacyToBlocks(row){
    var blocks = Array.isArray(row.blocks) && row.blocks.length ? row.blocks : [{ type: 'text', text: row.body_template || '' }, { type: 'table' }, { type: 'payment' }];
    return { name: row.name, stage: row.stage || row.type || 'other', description: row.description || '', subject: row.subject_template || '', blocks: blocks, settings: row.settings || {} };
  }
  function loadLetterTemplate(key){
    if(key.indexOf('builtin:') === 0){ var b = BUILTIN_LETTERS[key.slice(8)] || BUILTIN_LETTERS.reminder_friendly; ldTpl = cloneTpl(b); }
    else { var row = letterTemplates.filter(function(t){ return t.id === key; })[0]; ldTpl = row ? cloneTpl(legacyToBlocks(row)) : cloneTpl(BUILTIN_LETTERS.reminder_friendly); if(!row) key = 'builtin:reminder_friendly'; }
    ldTpl.settings = Object.assign({}, LD_DEFAULT_SETTINGS, ldTpl.settings || {});
    ldKey = key; ldDirty = false; ldAi = false;
  }

  // ---- Design: the shared brand (an Account Statements design) plus this template's overrides.
  function brandSettings(source){
    if(!source || source === 'default'){
      var def = stmtTemplates.filter(function(t){ return t.is_default; })[0];
      return def ? def.settings : (TPL_PRESETS.classic.o);
    }
    if(source.indexOf('preset:') === 0) return (TPL_PRESETS[source.slice(7)] || TPL_PRESETS.classic).o;
    var row = stmtTemplates.filter(function(t){ return t.id === source; })[0];
    return row ? row.settings : TPL_PRESETS.classic.o;
  }
  function letterDesign(st){
    var base = normaliseTpl(brandSettings(st.design_source));
    var o = st.overrides || {};
    var d = deepMerge(base, { colors: o.colors || {} });
    ['font','heading_font','font_size','table_style','density','header_style','logo_position'].forEach(function(k){ if(o[k] !== undefined && o[k] !== null && o[k] !== '') d[k] = o[k]; });
    if(o.hide_logo){ d.logo = null; d.hide_logo = true; }
    return normaliseTpl(d);
  }

  // ---- Letter model for a case: invoices, charges under the Interest & Fees rules, totals, variables.
  function buildLetterModel(c, st){
    var items = c.invoices.filter(function(i){ return (i.outstanding || 0) > 0; }).map(function(i){
      var bal = r2(i.outstanding);
      var disputed = !!disputedInvoices[i.id];
      var ch = invoiceCharges({ id: i.id, case_id: c.id, debtor_id: c.debtor_id || (c.debtor || {}).id, issued_date: i.issued_date, due_date: i.due_date, balance: bal, disputed: disputed });
      return { id: i.id, debtor_id: c.debtor_id || (c.debtor || {}).id, invoice_number: i.invoice_number, description: i.description, due_date: i.due_date, issued_date: i.issued_date, amount: Number(i.amount), paid: i.paid || 0,
        balance: bal, daysOverdue: Math.max(0, daysPastDue(i.due_date)), disputed: disputed,
        interest: ch.applied ? ch.interest : 0, fees: ch.applied ? ch.feeTotal : 0, feeLines: ch.applied ? ch.fees : [], chargesApplied: ch.applied, fullyPaid: false };
    }).sort(function(a, b){ return String(a.due_date).localeCompare(String(b.due_date)); });
    var live = items.filter(function(i){ return !i.disputed; });
    var sum = function(a, k){ return r2(a.reduce(function(s, x){ return s + (Number(x[k]) || 0); }, 0)); };
    var sFees = calcStatementFees(live);
    var T = { principal: sum(live, 'balance'), interest: sum(live, 'interest'), fees: r2(sum(live, 'fees') + sFees.reduce(function(s, f){ return s + f.amount; }, 0)), statement_fees: sFees, disputed: sum(items.filter(function(i){ return i.disputed; }), 'balance') };
    T.total = r2(T.principal + T.interest + T.fees);
    var today = new Date(); var payBy = new Date(today.getTime() + (Number(st.pay_days) || 7) * 864e5);
    var nums = live.map(function(i){ return i.invoice_number; }).filter(Boolean);
    var d = c.debtor;
    var contact = d.contact_name || '';
    var dd = demandDates[c.id] || {};
    var lastLetter = (ldLastLetter[c.id] || null);
    var ref = 'LD-' + today.toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(c.id).replace(/-/g, '').slice(0, 4).toUpperCase();
    var listText = function(arr){ return arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr.at(-1); };
    var vars = {
      debtor_name: letterAddresseeName(d), trading_name: d.name || '', contact_name: contact || 'Accounts team', first_name: (contact.split(' ')[0] || 'there'),
      invoice_list: nums.length > 4 ? nums.slice(0, 3).join(', ') + ' and ' + (nums.length - 3) + ' more invoices' : (nums.length > 1 ? 'invoices ' : 'invoice ') + listText(nums),
      is_are: nums.length > 1 ? 'are' : 'is',
      due_date: live.length ? fmt(live[0].due_date) : '', days_overdue: String(live.reduce(function(m, i){ return Math.max(m, i.daysOverdue); }, 0)),
      principal: money(T.principal), interest: money(T.interest), fees: money(T.fees), total_owing: money(T.total),
      charges_phrase: (T.interest ? ', plus ' + money(T.interest) + ' interest' : '') + (T.fees ? (T.interest ? ' and ' : ', plus ') + money(T.fees) + ' in fees' : ''),
      interest_rate: rateForDebtor(c.debtor_id || d.id) ? r2(rateForDebtor(c.debtor_id || d.id) * 100) + '%' : '{{interest_rate}}',
      pay_days: String(st.pay_days || 7), pay_by_date: fmt(payBy), payment_reference: nums.length === 1 ? nums[0] : ref,
      last_letter_date: lastLetter ? fmt(lastLetter) : (dd.first ? fmt(dd.first) : 'an earlier date'),
      disputed_list: listText(items.filter(function(i){ return i.disputed; }).map(function(i){ return i.invoice_number; })) || 'the disputed invoices',
      business_name: currentOrg.name, our_address: currentOrg.address ? String(currentOrg.address).replace(/\s*\n\s*/g, ', ') : '{{our_address}}', our_contact: st.our_contact || [currentOrg.phone, currentOrg.billing_email].filter(Boolean).join(' or ') || '{{our_contact}}', today: fmt(today)
    };
    return { c: c, debtor: d, items: items, totals: T, vars: vars, date: today, payBy: payBy, ref: ref };
  }
  var ldLastLetter = {};
  async function loadLastLetters(){
    var r = await sb.from('letters').select('case_id, sent_at').eq('org_id', currentOrg.id).eq('status', 'sent').order('sent_at', { ascending: false }).limit(500);
    ldLastLetter = {}; (r.data || []).forEach(function(l){ if(!ldLastLetter[l.case_id]) ldLastLetter[l.case_id] = l.sent_at; });
  }
  // Text: escape, then fill {{fields}}, then **bold** and *italic*. Unknown fields stay visible (and get flagged).
  function fillLetterText(text, vars, plain){
    if(!plain) return String(text || '').split('\n').map(function(l){ return djInline(l, vars, 'html'); }).join('<br>');
    var s = String(text || '');
    s = s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, function(m, k){
      if(!Object.prototype.hasOwnProperty.call(vars, k) || /^\{\{/.test(vars[k])) return plain ? m : '<span class="ld-missing">' + m + '</span>';
      return plain ? vars[k] : escapeHtml(vars[k]);
    });
    if(!plain) s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
    else s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2');
    return s;
  }

  function renderLetterDoc(m, tpl, st, design, edit){
    var t = design, c = t.colors, S = '.ld';
    var pad = { compact: '4px 7px', regular: '6px 9px', roomy: '9px 11px' }[t.density];
    var gap = { compact: '8px', normal: '12px', relaxed: '17px' }[st.spacing] || '12px';
    var css = '<style>'
      + S+'{font-family:'+fontCss(t.font)+';font-size:'+t.font_size+'px;line-height:1.6;color:'+c.text+';background:#fff;padding:36px 42px 30px;}'
      + S+' .ld-name,'+S+' .ld-subj,'+S+' h3{font-family:'+fontCss(t.heading_font)+';color:'+c.heading+';}'
      + S+' .ld-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:26px;}'
      + S+' .ld-head.right{flex-direction:row-reverse;}'+S+' .ld-head.right .ld-from{text-align:left;}'
      + S+' .ld-head.centred{flex-direction:column;align-items:center;text-align:center;}'
      + S+' .ld-band{background:'+c.accent+';color:'+c.band_text+';margin:-36px -42px 26px;padding:22px 42px;}'
      + S+' .ld-band .ld-name,'+S+' .ld-band .ld-muted{color:'+c.band_text+';}'
      + S+' .ld-logo{max-height:'+t.logo_height+'px;max-width:220px;display:block;margin-bottom:6px;}'
      + S+' .ld-head.centred .ld-logo{margin:0 auto 6px;}'
      + S+' .ld-name{font-size:1.25em;font-weight:700;}'
      + S+' .ld-from{white-space:pre-line;font-size:.86em;text-align:right;}'
      + S+' .ld-muted{color:'+c.muted+';}'
      + S+' .ld-top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:20px;}'
      + S+' .ld-to{line-height:1.5;}'+S+' .ld-meta{text-align:right;font-size:.92em;line-height:1.6;}'
      + S+' .ld-pc{font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.78em;color:'+c.accent+';margin-bottom:6px;}'
      + S+' .ld-subj{font-weight:700;font-size:1.08em;margin:0 0 '+gap+';padding-bottom:6px;border-bottom:2px solid '+c.accent+';}'
      + S+' p{margin:0 0 '+gap+';}'+S+' ul,'+S+' ol{margin:0 0 '+gap+';padding-left:1.4em;}'+S+' li{margin:0 0 2px;}'+S+' h3{font-size:1.02em;margin:18px 0 8px;}'
      + S+' table.ld-t{width:100%;border-collapse:collapse;margin:4px 0 '+gap+';table-layout:auto;}'+S+' .ld-t th{white-space:normal;vertical-align:bottom;}'+S+' .ld-t td{word-break:normal;}'
      + S+' .ld-t th{background:'+(t.table_style === 'minimal' ? 'transparent' : c.th_bg)+';color:'+c.th_text+';text-align:left;font-size:.8em;text-transform:uppercase;letter-spacing:.04em;padding:'+pad+';}'
      + S+' .ld-t td{padding:'+pad+';color:'+c.text+';background:transparent;}'+S+' .ld-t .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}'+S+' .nw{white-space:nowrap;}'+S+' .ld-t th.num{white-space:normal;}'+S+' table.ld-t{font-size:.92em;}'
      + (t.table_style === 'lined' ? S+' .ld-t th{border-bottom:2px solid '+c.accent+';}'+S+' .ld-t td{border-bottom:1px solid '+c.border+';}' : '')
      + (t.table_style === 'striped' ? S+' .ld-t tbody tr:nth-child(even) td{background:'+c.stripe+';}' : '')
      + (t.table_style === 'boxed' ? S+' .ld-t th,'+S+' .ld-t td{border:1px solid '+c.border+';}' : '')
      + (t.table_style === 'minimal' ? S+' .ld-t th{border-bottom:1px solid '+c.border+';}' : '')
      + S+' .ld-t tr.tot td{font-weight:800;border-top:2px solid '+c.accent+';border-bottom:none;color:'+c.heading+';}'
      + S+' .ld-t tr.sub td{color:'+c.muted+';}'
      + S+' .ld-pay{border:2px solid '+c.accent+';border-radius:10px;padding:12px 16px;margin:4px 0 '+gap+';display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;}'
      + S+' .ld-pay .v{font-size:1.5em;font-weight:800;color:'+c.accent+';font-variant-numeric:tabular-nums;}'
      + S+' .ld-pay .k{font-size:.78em;text-transform:uppercase;letter-spacing:.05em;color:'+c.muted+';}'
      + S+' .ld-bank{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:4px 0 '+gap+';}'
      + S+' .ld-bank > div{border:1px solid '+c.border+';border-radius:8px;padding:9px 12px;}'
      + S+' .ld-bank .k{font-size:.76em;text-transform:uppercase;letter-spacing:.05em;color:'+c.accent+';font-weight:700;margin-bottom:2px;}'
      + S+' .ld-bank dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:1px 10px;}'+S+' .ld-bank dt{color:'+c.muted+';}'+S+' .ld-bank dd{margin:0;font-weight:600;}'
      + S+' hr{border:none;border-top:1px solid '+c.border+';margin:14px 0;}'
      + S+' .ld-sign{margin-top:22px;}'+S+' .ld-sig{max-height:54px;max-width:220px;display:block;margin:6px 0 2px;}'
      + S+' .ld-foot{margin-top:24px;padding-top:10px;border-top:1px solid '+c.border+';font-size:.78em;color:'+c.muted+';white-space:pre-line;}'
      + S+' .ld-missing{background:#fff3cd;color:#8a5a00;border-radius:3px;padding:0 2px;}'
      + '@media print{'+S+'{padding:0;}'+S+' .ld-band{margin:0 0 24px;padding:18px 20px;}'+S+' .ld-pay,'+S+' .ld-bank,'+S+' table.ld-t tr,'+S+' .ld-sign{page-break-inside:avoid;}'+S+' .ld-missing{background:none;}}'
      + '</style>';
    var V = m.vars, d = m.debtor;
    var lgo = effectiveLogo(t);
    var logo = lgo ? '<img class="ld-logo" src="'+lgo+'" alt="" />' : '';
    var who = '<div>'+logo+'<div class="ld-name">'+escapeHtml(currentOrg.name)+'</div></div>';
    var fromTxt = t.from_lines || orgFromLines();
    var from = fromTxt ? '<div class="ld-from ld-muted">'+escapeHtml(fromTxt)+'</div>' : '<div></div>';
    var headCls = t.header_style === 'centred' ? 'centred' : (t.logo_position === 'right' ? 'right' : '');
    var head = '<div class="ld-head '+headCls+'">'+who+from+'</div>';
    if(t.header_style === 'band') head = '<div class="ld-band">'+head+'</div>';
    var postal = postalLines(d);
    var to = '<div class="ld-to">'+(st.private_conf ? '<div class="ld-pc">Private &amp; confidential</div>' : '')
      + '<b>'+escapeHtml(letterAddresseeName(d))+'</b>'
      + (d.contact_name ? '<br>Attention: '+escapeHtml(d.contact_name) : '')
      + (postal.length ? '<br>'+postal.map(escapeHtml).join('<br>') : (d.email ? '<br>'+escapeHtml(d.email) : ''))
      + (st.show_abn && d.abn ? '<br><span class="ld-muted">ABN '+escapeHtml(fmtAbn(d.abn))+'</span>' : '') + '</div>';
    var meta = '<div class="ld-meta">'+escapeHtml(fmt(m.date))+(st.show_ref ? '<br><span class="ld-muted">Our reference</span> '+escapeHtml(m.ref) : '')+'</div>';
    var sal = { dear_contact: 'Dear ' + (d.contact_name || 'Sir or Madam') + ',', dear_first: 'Dear ' + (d.contact_name ? d.contact_name.split(' ')[0] : 'Sir or Madam') + ',', dear_accounts: 'Dear Accounts Payable team,', to_whom: 'To whom it may concern,', none: '' }[st.salutation];
    var T = m.totals;
    var table = function(){
      if(st.table === 'none') return '';
      if(st.table === 'summary' || !m.items.length){
        return '<table class="ld-t"><tbody>'
          + '<tr><td>Unpaid invoices'+(m.items.length ? ' ('+m.items.filter(function(i){ return !i.disputed; }).length+')' : '')+'</td><td class="num">'+money(T.principal)+'</td></tr>'
          + (st.show_interest && T.interest ? '<tr><td>Interest</td><td class="num">'+money(T.interest)+'</td></tr>' : '')
          + (st.show_fees && T.fees ? '<tr><td>Fees</td><td class="num">'+money(T.fees)+'</td></tr>' : '')
          + '<tr class="tot"><td>Total now due</td><td class="num">'+money(T.total)+'</td></tr></tbody></table>';
      }
      var showI = st.show_interest && m.items.some(function(i){ return i.interest; }), showF = st.show_fees && m.items.some(function(i){ return i.fees; });
      var cols = 4 + (showI ? 1 : 0) + (showF ? 1 : 0);
      return '<table class="ld-t"><thead><tr><th>Invoice</th><th class="nw">Due date</th><th class="num">Days overdue</th>'+(showI ? '<th class="num">Interest</th>' : '')+(showF ? '<th class="num">Fees</th>' : '')+'<th class="num">Amount owing</th></tr></thead><tbody>'
        + m.items.map(function(i){
            return '<tr'+(i.disputed ? ' class="sub"' : '')+'><td class="nw">'+escapeHtml(i.invoice_number || '—')+(i.disputed ? ' <i>(disputed, not requested)</i>' : '')+'</td><td class="nw">'+escapeHtml(fmt(i.due_date))+'</td><td class="num">'+(i.daysOverdue || '—')+'</td>'
              + (showI ? '<td class="num">'+(i.interest ? money(i.interest) : '—')+'</td>' : '') + (showF ? '<td class="num">'+(i.fees ? money(i.fees) : '—')+'</td>' : '')
              + '<td class="num">'+money(i.disputed ? i.balance : r2(i.balance + i.interest + i.fees))+'</td></tr>';
          }).join('')
        + (T.statement_fees || []).map(function(f){ return '<tr class="sub"><td colspan="'+(cols - 1)+'">'+escapeHtml(f.name)+'</td><td class="num">'+money(f.amount)+'</td></tr>'; }).join('')
        + '<tr class="tot"><td colspan="'+(cols - 1)+'">Total now due</td><td class="num">'+money(T.total)+'</td></tr></tbody></table>';
    };
    var P = orgPayment;
    var payment = function(){
      if(!P) return '<p class="ld-muted"><span class="ld-missing">Add your bank details under Payment Portal</span></p>';
      var blocks = [];
      if(P.show_bank && P.bsb && P.account_number) blocks.push('<div><div class="k">Bank transfer</div><dl><dt>Account name</dt><dd>'+escapeHtml(P.account_name || '')+'</dd><dt>BSB</dt><dd>'+escapeHtml(P.bsb)+'</dd><dt>Account</dt><dd>'+escapeHtml(P.account_number)+'</dd><dt>Reference</dt><dd>'+escapeHtml(V.payment_reference)+'</dd></dl></div>');
      if(P.show_payid && P.payid) blocks.push('<div><div class="k">PayID</div><dl><dt>PayID</dt><dd>'+escapeHtml(P.payid)+'</dd><dt>Name</dt><dd>'+escapeHtml(P.account_name || '')+'</dd><dt>Reference</dt><dd>'+escapeHtml(V.payment_reference)+'</dd></dl></div>');
      if(P.show_bpay && P.bpay_biller_code) blocks.push('<div><div class="k">BPAY</div><dl><dt>Biller code</dt><dd>'+escapeHtml(P.bpay_biller_code)+'</dd><dt>Ref</dt><dd>'+escapeHtml(V.payment_reference)+'</dd></dl></div>');
      return (blocks.length ? '<div class="ld-bank">'+blocks.join('')+'</div>' : '') + (P.instructions ? '<p class="ld-muted">'+escapeHtml(P.instructions)+'</p>' : '');
    };
    var body = tpl.blocks.map(function(b, bi){
      if(b.off && !edit) return '';
      var inner = blockHtml(b, bi);
      if(!edit) return inner;
      var clause = b.clause && CLAUSE_BY_KEY[b.clause], title = BLOCK_LABEL[b.type] + (clause ? ' · ' + clause.label : '');
      var ctl = '<div class="dj-ctl" contenteditable="false"><label class="ld-switch" title="'+(b.off ? 'Left out of the letter' : 'In the letter')+'"><input type="checkbox" data-ldon="'+bi+'"'+(b.off ? '' : ' checked')+' aria-label="Include '+escapeHtml(title)+'" /><span aria-hidden="true"></span></label>'
        + '<span class="dj-tag">'+escapeHtml(title)+(clause && clause.intent ? ' · intent' : '')+'</span>'
        + '<button type="button" data-ldmove="-1" data-i="'+bi+'" title="Move up"'+(bi === 0 ? ' disabled' : '')+'>↑</button><button type="button" data-ldmove="1" data-i="'+bi+'" title="Move down"'+(bi === tpl.blocks.length - 1 ? ' disabled' : '')+'>↓</button>'
        + (b.type === 'text' ? '<button type="button" data-ldsaveclause="'+bi+'" title="Save to Your clauses">☆</button>' : '')
        + '<button type="button" data-lddel="'+bi+'" title="Remove">✕</button></div>';
      if(b.off) return '<div class="dj-b off" data-bi="'+bi+'">'+ctl+'<div class="dj-offnote">'+escapeHtml(title)+' · left out of the letter</div></div>';
      return '<div class="dj-b'+(ldCur === bi ? ' cur' : '')+'" data-bi="'+bi+'">'+ctl+inner+'</div>';
    }).join('') + (edit ? '<div class="dj-add" contenteditable="false"><span>Add</span><button type="button" data-ldadd="text">Paragraph</button><button type="button" data-ldadd="heading">Heading</button><button type="button" data-ldadd="table">Amounts table</button><button type="button" data-ldadd="paybox">Pay-by box</button><button type="button" data-ldadd="payment">Payment details</button><button type="button" data-ldadd="divider">Divider</button></div>' : '');
    function blockHtml(b, bi){
      if(b.type === 'text') return edit ? '<div class="dj-txt" data-ldb="'+bi+'">'+djRich(b.text, V, 'edit')+'</div>' : ((b.text || '').trim() ? djRich(b.text, V, 'html') : '');
      if(b.type === 'heading') return edit ? '<h3 class="dj-txt" data-ldb="'+bi+'" data-heading="1">'+djInline(b.text || '', V, 'edit')+'</h3>' : '<h3>'+fillLetterText(b.text || '', V)+'</h3>';
      if(b.type === 'table') return table();
      if(b.type === 'paybox') return '<div class="ld-pay"><div><div class="k">Amount due</div><div class="v">'+money(T.total)+'</div></div><div><div class="k">Pay by</div><div class="v">'+escapeHtml(V.pay_by_date)+'</div></div><div><div class="k">Reference</div><div style="font-weight:700;">'+escapeHtml(V.payment_reference)+'</div></div></div>';
      if(b.type === 'payment') return payment();
      if(b.type === 'divider') return '<hr>';
      return '';
    }
    var sign = '<div class="ld-sign">Yours sincerely,'+(st.signature ? '<img class="ld-sig" src="'+st.signature+'" alt="" />' : '<br><br>')
      + (st.sign_name ? '<b>'+escapeHtml(st.sign_name)+'</b><br>' : '') + escapeHtml(st.sign_title || t.sign_off || 'Accounts team') + '<br>' + escapeHtml(currentOrg.name) + '</div>';
    var foot = t.footer ? '<div class="ld-foot">'+escapeHtml(t.footer)+'</div>' : '';
    return css + '<div class="ld">' + head + '<div class="ld-top">' + to + meta + '</div>'
      + (edit ? '<div class="ld-subj dj-subj" data-ldsubj="1">'+djInline(tpl.subject || '', V, 'edit')+'</div>' : '<div class="ld-subj">'+fillLetterText(tpl.subject || '', V)+'</div>') + (sal ? '<p>'+escapeHtml(sal)+'</p>' : '') + body + sign + foot + '</div>';
  }

  // ---- Compliance and content checks shown above the preview.
  function letterChecks(m, tpl, st){
    var w = [];
    var intent = tpl.blocks.filter(function(b){ return !b.off && b.type === 'text' && b.clause && CLAUSE_BY_KEY[b.clause] && CLAUSE_BY_KEY[b.clause].intent; });
    if(intent.length) w.push({ level: 'caution', message: 'This letter says what you will do next (' + intent.map(function(b){ return CLAUSE_BY_KEY[b.clause].label.toLowerCase(); }).join(', ') + '). Under the ACCC/ASIC Debt collection guideline, only say this if you have genuinely decided to do it.' });
    var raw = tpl.subject + ' ' + tpl.blocks.filter(function(b){ return !b.off; }).map(function(b){ return b.text || ''; }).join(' ');
    var unknown = []; raw.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, function(x, k){ if((!Object.prototype.hasOwnProperty.call(m.vars, k) || /^\{\{/.test(m.vars[k])) && unknown.indexOf(k) < 0) unknown.push(k); return x; });
    if(unknown.length) w.push({ level: 'stop', message: 'Fields with no value yet (highlighted): ' + unknown.map(function(k){ return '{{' + k + '}}'; }).join(', ') + (unknown.indexOf('our_contact') >= 0 ? '. Add a phone or email in Settings, or on this template’s Settings tab.' : '') + (unknown.indexOf('interest_rate') >= 0 ? '. Interest is off under Interest & Fees.' : '') });
    if(!postalLines(m.debtor).length) w.push({ level: 'info', message: 'No postal address for this debtor. Add one on their contact card if you will post this letter.' });
    if(m.debtor.name_check === 'different' || m.debtor.name_check === 'cancelled') w.push({ level: 'caution', message: m.debtor.name_check === 'cancelled' ? 'The debtor’s ABN is cancelled. Check ASIC before sending.' : 'The debtor’s name differs from the ABN register. Confirm you have the right legal entity.' });
    if(m.totals.disputed) w.push({ level: 'info', message: 'Disputed invoices are listed but left out of the amount due.' });
    if((tpl.stage === 'first_demand' || tpl.stage === 'final_demand' || tpl.stage === 'pre_legal') && (Number(st.pay_days) || 0) < 7) w.push({ level: 'caution', message: 'Allow the debtor a reasonable time to pay: at least 7 days for a demand.' });
    var hs = histState.letters;
    if(hs && hs.items && hs.key === String(m.debtor.id)){ var cc = contactCounts(hs.items); if(cc.wk >= 3 || cc.mo >= 10) w.push({ level: 'stop', message: 'This debtor has already been contacted ' + cc.wk + ' times in 7 days / ' + cc.mo + ' in 30 days. The guideline limit is 3 a week or 10 a month.' }); }
    if(!m.totals.total) w.push({ level: 'stop', message: 'Nothing is owing on this case.' });
    return w;
  }

  // ---- Page wiring
  function renderLetterTemplateSelect(){
    var sel = document.getElementById('ldTplSelect');
    var groups = STAGE_ORDER.map(function(st){
      var b = Object.keys(BUILTIN_LETTERS).filter(function(k){ return BUILTIN_LETTERS[k].stage === st; }).map(function(k){ return '<option value="builtin:'+k+'"'+(ldKey === 'builtin:'+k ? ' selected' : '')+'>'+escapeHtml(BUILTIN_LETTERS[k].name)+'</option>'; });
      return b.length ? '<optgroup label="Built-in · '+escapeHtml(TPL_LABEL[st])+'">'+b.join('')+'</optgroup>' : '';
    }).join('');
    var mine = letterTemplates.slice().sort(function(a, b){ return STAGE_ORDER.indexOf(a.stage || a.type) - STAGE_ORDER.indexOf(b.stage || b.type) || a.name.localeCompare(b.name); });
    sel.innerHTML = (mine.length ? '<optgroup label="Your templates">'+mine.map(function(t){ return '<option value="'+escapeHtml(t.id)+'"'+(ldKey === t.id ? ' selected' : '')+'>'+escapeHtml(t.name)+' · '+escapeHtml(TPL_LABEL[t.stage || t.type] || '')+'</option>'; }).join('')+'</optgroup>' : '') + groups;
    var custom = ldKey && ldKey.indexOf('builtin:') !== 0;
    document.getElementById('ldDeleteBtn').hidden = !custom;
    document.getElementById('ldStatus').textContent = (ldDirty ? 'Unsaved changes · ' : '') + (ldAi ? 'AI-drafted text · ' : '') + (custom ? 'Your template' : 'Built-in template: “Save as new” keeps your own copy') + (ldTpl && ldTpl.description ? ' — ' + ldTpl.description : '');
  }
  function renderLetterCaseOptions(){
    var sel = document.getElementById('letterCaseSelect');
    var cur = sel.value;
    sel.innerHTML = cases.map(function(c){ return '<option value="'+c.id+'">'+escapeHtml(c.debtor.name)+' — '+escapeHtml(c.invoiceNumber)+' · '+money(c.total)+'</option>'; }).join('');
    if(cur && cases.some(function(c){ return c.id === cur; })) sel.value = cur;
    else if(cases.length) sel.value = cases[0].id;
    if(!ldTpl){ var def = letterTemplates.filter(function(t){ return t.settings && t.settings.is_default; })[0]; loadLetterTemplate(def ? def.id : 'builtin:first_demand'); }
    renderLetterTemplateSelect(); renderLetterEditor();
    loadLastLetters().then(function(){ onLetterTargetChanged(); renderLetterCaseList(); });
    refreshSentLetters();
  }
  function selectLetterCase(id){ document.getElementById('letterCaseSelect').value = id; onLetterTargetChanged(); }
  document.getElementById('letterCaseSelect').addEventListener('change', onLetterTargetChanged);
  function currentLetterCase(){ var id = document.getElementById('letterCaseSelect').value; return cases.filter(function(x){ return x.id === id; })[0]; }
  async function onLetterTargetChanged(){
    ldViewing = null;
    var c = currentLetterCase();
    setHistoryDebtors('letters', c && c.debtor && c.debtor.id ? [c.debtor.id] : []);
    renderLetterPreview(); renderLetterCaseCard();
    letterFlags = c ? await loadNoteFlags(c) : [];
    if(currentLetterCase() === c){ renderLetterPreview(); renderLetterCaseCard(); }
  }
  var letterFlags = [];
  var ldPreviewQueued = false;
  function scheduleLetterPreview(){ if(ldPreviewQueued) return; ldPreviewQueued = true; requestAnimationFrame(function(){ ldPreviewQueued = false; renderLetterPreview(); }); }
  function renderLetterPreview(){
    var paper = document.getElementById('letterPaper');
    if(ldViewing){ paper.innerHTML = ldViewing.html; renderFlags(document.getElementById('letterFlags'), [{ level: 'info', message: 'Showing the letter exactly as sent on ' + fmt(ldViewing.sent_at) + '. Choose a case or template, or switch tabs, to go back.' }]); return; }
    var c = currentLetterCase();
    if(!c || !ldTpl){ paper.innerHTML = '<div class="empty-note" style="padding:30px;">No case selected yet.</div>'; renderFlags(document.getElementById('letterFlags'), []); return; }
    var st = ldSettings();
    var design = letterDesign(st);
    ensureFont(design.font); ensureFont(design.heading_font);
    var m = buildLetterModel(c, st);
    if(paper.contains(document.activeElement) && document.activeElement.closest('[data-dj-edit]')){ ldPreviewPending = true; renderFlags(document.getElementById('letterFlags'), (letterFlags || []).concat(letterChecks(m, ldTpl, st))); return; }
    ldPreviewPending = false;
    paper.innerHTML = renderLetterDoc(m, ldTpl, st, design, true);
    ldAssistVars = m.vars;
    attachLetterEditors(paper, m.vars);
    renderFlags(document.getElementById('letterFlags'), (letterFlags || []).concat(letterChecks(m, ldTpl, st)));
    ['ldSendBtn','ldPrintBtn'].forEach(function(id){ document.getElementById(id).disabled = !m.totals.total; });
  }
  var ldCur = null, ldPreviewPending = false, ldAssistVars = {};
  function letterFields(){ return LETTER_VARS.map(function(v){ return [v[0], v[1]]; }); }
  function attachLetterEditors(paper, vars){
    paper.querySelectorAll('[data-ldb]').forEach(function(el){
      var i = Number(el.getAttribute('data-ldb')), b = ldTpl.blocks[i];
      djAttach(el, { vars: vars, fields: letterFields(), heading: true, singleLine: b.type === 'heading',
        onChange: function(md){ b.text = b.type === 'heading' ? md.replace(/\n+/g, ' ') : md; if(b.clause && CLAUSE_BY_KEY[b.clause] && b.text !== CLAUSE_BY_KEY[b.clause].text) b.edited = true; ldDirty = true; renderLetterTemplateSelect(); },
        onFocus: function(){ ldCur = i; paper.querySelectorAll('.dj-b.cur').forEach(function(x){ x.classList.remove('cur'); }); var w = el.closest('.dj-b'); if(w) w.classList.add('cur'); },
        onBlur: function(){ if(ldPreviewPending) scheduleLetterPreview(); },
        onHeading: function(){ b.type = b.type === 'heading' ? 'text' : 'heading'; if(b.type === 'heading') b.text = String(b.text || '').split('\n')[0].replace(/^\s*([-•]|\d+[.)])\s+/, ''); ldDirty = true; ldPreviewPending = false; document.activeElement.blur(); renderLetterPreview(); renderLetterTemplateSelect(); }
      });
    });
    var sj = paper.querySelector('[data-ldsubj]');
    if(sj) djAttach(sj, { vars: vars, fields: letterFields(), singleLine: true, onChange: function(md){ ldTpl.subject = md.replace(/\n+/g, ' '); ldDirty = true; renderLetterTemplateSelect(); }, onBlur: function(){ if(ldPreviewPending) scheduleLetterPreview(); } });
  }
  // The letter exactly as it will be printed, saved or sent: no editing controls.
  function letterCleanHtml(){
    if(ldViewing) return ldViewing.html;
    var c = currentLetterCase(); if(!c || !ldTpl) return '';
    var st = ldSettings(), design = letterDesign(st);
    return renderLetterDoc(buildLetterModel(c, st), ldTpl, st, design);
  }
  function letterCleanPaper(){ var d = document.createElement('div'); d.className = 'letter-paper'; d.innerHTML = letterCleanHtml(); return d; }
  function ldInsertBlock(nb){
    if(ldTpl.blocks.length >= 60){ toast('A letter can have up to 60 blocks.'); return; }
    var at = ldCur != null && ldCur < ldTpl.blocks.length ? ldCur + 1 : ldTpl.blocks.length;
    ldTpl.blocks.splice(at, 0, nb); ldCur = at;
    ldDirty = true; renderLetterTemplateSelect(); ldPreviewPending = false;
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    renderLetterPreview();
    var el = document.querySelector('#letterPaper [data-bi="'+at+'"]'); if(el){ el.scrollIntoView({ block: 'center', behavior: 'smooth' }); var ed = el.querySelector('[data-dj-edit]'); if(ed && !nb.text) ed.focus(); }
  }
  var LD_ASSIST = { scope: 'letter', aiPurpose: 'letter', builtins: CLAUSES, placeholder: 'e.g. thank them for the part payment and ask for the rest by the 30th',
    canAi: function(){ return !!currentLetterCase(); },
    aiPayload: function(){ var c = currentLetterCase(); return { case_id: c && c.id, template_type: ldTpl && ldTpl.stage, context_text: ldTpl ? ldTpl.blocks.filter(function(b){ return !b.off && (b.type === 'text' || b.type === 'heading'); }).map(function(b){ return djPlain(b.text); }).join('\n\n').slice(0, 3000) : '' }; },
    preview: function(t){ return djRich(t, ldAssistVars, 'html'); },
    insert: function(text, meta){ ldInsertBlock({ type: 'text', text: text, clause: meta && meta.clause && CLAUSE_BY_KEY[meta.clause] ? meta.clause : undefined }); }
  };
  function markLetterDirty(){ ldDirty = true; renderLetterTemplateSelect(); scheduleLetterPreview(); }

  // ---- Editor (Content / Design / Settings tabs)
  var BLOCK_LABEL = { text: 'Paragraph', heading: 'Heading', table: 'Amounts table', paybox: 'Pay-by box', payment: 'Payment details', divider: 'Divider' };
  var ldOpenBlocks = new WeakSet();
  function renderLetterEditor(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-ldtab]'), function(b){ b.classList.toggle('active', b.getAttribute('data-ldtab') === ldTab); });
    var box = document.getElementById('ldEditor'); if(!ldTpl){ box.innerHTML = ''; return; }
    var st = ldSettings();
    if(ldTab === 'content'){
      box.innerHTML = '<div class="as-intro">Write straight on the letter: click any paragraph to edit it, and select text for formatting. Clauses, fields and AI drafting are in the Insert panel on the right.</div>';
    } else if(ldTab === 'content-old'){
      var nOn = ldTpl.blocks.filter(function(b){ return !b.off; }).length;
      var fixedHint = function(b){ return b.type === 'table' ? 'Uses the “Amounts table” choice on Settings: ' + ({ per_invoice: 'one row per invoice', summary: 'totals only', none: 'hidden' }[st.table]) + '.'
        : b.type === 'payment' ? 'Bank, PayID and BPAY details from the Payment Portal.' : b.type === 'paybox' ? 'Highlighted amount due, pay-by date and reference.' : b.type === 'divider' ? 'A line across the page.' : ''; };
      box.innerHTML = '<label class="ld-field">Subject<input data-ld="subject" value="'+escapeHtml(ldTpl.subject || '')+'" maxlength="200" /></label>'
        + '<div class="ld-blocks-bar"><span>'+ldTpl.blocks.length+' sections · '+nOn+' in the letter</span><span><button type="button" class="linkbtn" data-ldexpand="all">Show all text</button> · <button type="button" class="linkbtn" data-ldexpand="none">Hide all</button></span></div>'
        + '<div class="ld-blocks">' + ldTpl.blocks.map(function(b, i){
            var clause = b.clause && CLAUSE_BY_KEY[b.clause];
            var editable = b.type === 'text' || b.type === 'heading';
            var open = editable && ldOpenBlocks.has(b);
            var title = BLOCK_LABEL[b.type] + (clause ? ' · ' + clause.label : '');
            var headTxt = escapeHtml(title) + (clause && clause.intent ? ' <span class="ld-intent" title="States an intended action">intent</span>' : '');
            var snip = editable ? (String(b.text || '').replace(/\s+/g, ' ').trim() || 'Empty, click to write') : fixedHint(b);
            var inner = editable ? '<textarea data-ldb="'+i+'" rows="'+(b.type === 'heading' ? 1 : Math.min(8, Math.max(2, Math.ceil((b.text || '').length / 62))))+'" maxlength="2000">'+escapeHtml(b.text || '')+'</textarea>' : '';
            return '<div class="ld-block'+(editable ? '' : ' fixed')+(open ? ' open' : '')+(b.off ? ' off' : '')+'" data-bi="'+i+'">'
              + '<div class="ld-block-row">'
              + '<label class="ld-switch" title="'+(b.off ? 'Left out of the letter' : 'In the letter')+'"><input type="checkbox" data-ldon="'+i+'"'+(b.off ? '' : ' checked')+' aria-label="Include '+escapeHtml(title)+' in the letter" /><span aria-hidden="true"></span></label>'
              + (editable ? '<button type="button" class="ld-block-toggle" data-ldopen="'+i+'" aria-expanded="'+open+'">' : '<div class="ld-block-toggle">')
              + '<span class="ld-block-title">'+headTxt+'</span><span class="ld-block-snip">'+escapeHtml(snip)+'</span>'
              + (editable ? '</button>' : '</div>')
              + '<span class="ld-block-acts"><button type="button" data-ldmove="-1" data-i="'+i+'" title="Move up"'+(i === 0 ? ' disabled' : '')+'>↑</button><button type="button" data-ldmove="1" data-i="'+i+'" title="Move down"'+(i === ldTpl.blocks.length - 1 ? ' disabled' : '')+'>↓</button>'
              + '<button type="button" data-lddel="'+i+'" title="Remove">✕</button></span>'
              + (editable ? '<button type="button" class="ld-chev" data-ldopen="'+i+'" aria-label="'+(open ? 'Hide' : 'Show')+' text" aria-expanded="'+open+'">›</button>' : '<span class="ld-chev-sp"></span>')
              + '</div>'
              + (open ? '<div class="ld-block-body">'+inner+'</div>' : '')
              + '</div>';
          }).join('') + '</div>'
        + '<div class="ld-add"><button type="button" class="btn sm" data-ldadd="library">+ Clause library</button><button type="button" class="btn sm" data-ldadd="text">+ Paragraph</button>'
        + '<details class="ld-more"><summary class="btn sm ghost">More ▾</summary><div class="ld-more-menu"><button type="button" class="btn sm ghost" data-ldadd="heading">+ Heading</button>'
        + '<button type="button" class="btn sm ghost" data-ldadd="table">+ Amounts table</button><button type="button" class="btn sm ghost" data-ldadd="paybox">+ Pay-by box</button><button type="button" class="btn sm ghost" data-ldadd="payment">+ Payment details</button><button type="button" class="btn sm ghost" data-ldadd="divider">+ Divider</button></div></details></div>'
        + '<div class="ld-varbar"><select id="ldVarPick"><option value="">Insert a field where your cursor is…</option>'+LETTER_VARS.map(function(v){ return '<option value="'+v[0]+'">'+escapeHtml(v[1])+' · {{'+v[0]+'}}</option>'; }).join('')+'</select><span class="hint-r">Switch a section off to leave it out without deleting it. **bold** and *italic* work in any paragraph.</span></div>'
        + '<div class="ld-library" id="ldLibrary" hidden></div>';
    } else if(ldTab === 'design'){
      var o = st.overrides || {}, base = normaliseTpl(brandSettings(st.design_source));
      var srcOpts = '<option value="default"'+(st.design_source === 'default' ? ' selected' : '')+'>Your default statement design</option>'
        + Object.keys(TPL_PRESETS).map(function(k){ return '<option value="preset:'+k+'"'+(st.design_source === 'preset:'+k ? ' selected' : '')+'>Built-in: '+escapeHtml(TPL_PRESETS[k].name)+'</option>'; }).join('')
        + stmtTemplates.map(function(t){ return '<option value="'+escapeHtml(t.id)+'"'+(st.design_source === t.id ? ' selected' : '')+'>Saved: '+escapeHtml(t.name)+'</option>'; }).join('');
      var col = function(k, label){ var on = o.colors && o.colors[k]; return '<label class="ld-col"><span><input type="checkbox" data-ldcolon="'+k+'"'+(on ? ' checked' : '')+' /> '+label+'</span>'+colourField('data-ldcol="'+k+'"'+(on ? '' : ' disabled'), on || base.colors[k])+'</label>'; };
      var sel = function(k, label, opts){ return '<label>'+label+'<select data-ldo="'+k+'"><option value="">Brand ('+escapeHtml(String((opts.filter(function(x){ return x[0] === base[k]; })[0] || [0, base[k]])[1]))+')</option>'+opts.map(function(x){ return '<option value="'+x[0]+'"'+(o[k] === x[0] ? ' selected' : '')+'>'+escapeHtml(x[1])+'</option>'; }).join('')+'</select></label>'; };
      var fonts = FONT_OPTIONS.map(function(f){ return [f.name, f.name]; });
      box.innerHTML = '<label class="ld-field">Brand design<select data-lds="design_source">'+srcOpts+'</select></label>'
        + '<div class="fine" style="margin-top:4px;">Colours, fonts and footer come from this design (Account Statements → Templates). Your logo and business details come from Settings unless the design has its own.</div>'
        + '<h4 class="sub-h">Overrides for this template</h4><div class="ld-grid">'
        + col('accent', 'Accent') + col('heading', 'Headings') + col('text', 'Body text') + col('th_bg', 'Table header') + col('th_text', 'Table header text') + col('border', 'Lines')
        + sel('font', 'Body font', fonts) + sel('heading_font', 'Heading font', fonts)
        + '<label>Text size <span>'+escapeHtml(o.font_size || base.font_size)+'</span><input type="range" min="10" max="15" step="0.5" data-ldo="font_size" value="'+escapeHtml(o.font_size || base.font_size)+'" /></label>'
        + sel('table_style', 'Table style', [['lined','Lined'],['striped','Striped'],['boxed','Boxed'],['minimal','Minimal']])
        + sel('density', 'Table spacing', [['compact','Compact'],['regular','Regular'],['roomy','Roomy']])
        + sel('header_style', 'Letterhead', [['plain','Logo and details'],['band','Coloured band'],['centred','Centred']])
        + sel('logo_position', 'Logo side', [['left','Left'],['right','Right']])
        + '<label>Paragraph spacing<select data-lds="spacing"><option value="compact"'+(st.spacing === 'compact' ? ' selected' : '')+'>Compact</option><option value="normal"'+(st.spacing === 'normal' ? ' selected' : '')+'>Normal</option><option value="relaxed"'+(st.spacing === 'relaxed' ? ' selected' : '')+'>Relaxed</option></select></label>'
        + '<label class="inline-check"><input type="checkbox" data-ldo="hide_logo"'+(o.hide_logo ? ' checked' : '')+' /> Hide the logo</label>'
        + '</div><button type="button" class="btn sm ghost" data-ldreset="1" style="margin-top:10px;">Reset all overrides to the brand</button>';
    } else {
      var stages = STAGE_ORDER.map(function(s){ return '<option value="'+s+'"'+(ldTpl.stage === s ? ' selected' : '')+'>'+escapeHtml(TPL_LABEL[s])+'</option>'; }).join('');
      var opt = function(k, val, label){ return '<option value="'+val+'"'+(st[k] === val ? ' selected' : '')+'>'+escapeHtml(label)+'</option>'; };
      var chk = function(k, label){ return '<label class="inline-check"><input type="checkbox" data-lds="'+k+'"'+(st[k] ? ' checked' : '')+' /> '+label+'</label>'; };
      box.innerHTML = '<div class="ld-grid">'
        + '<label class="span2">Template name<input data-ld="name" maxlength="80" value="'+escapeHtml(ldTpl.name || '')+'" /></label>'
        + '<label>Stage (for history and filters)<select data-ld="stage">'+stages+'</select></label>'
        + '<label>Days to pay<input type="number" min="1" max="90" data-lds="pay_days" value="'+escapeHtml(st.pay_days)+'" /></label>'
        + '<label>Greeting<select data-lds="salutation">'+opt('salutation','dear_contact','Dear [contact name],')+opt('salutation','dear_first','Dear [first name],')+opt('salutation','dear_accounts','Dear Accounts Payable team,')+opt('salutation','to_whom','To whom it may concern,')+opt('salutation','none','No greeting')+'</select></label>'
        + '<label>Amounts table<select data-lds="table">'+opt('table','per_invoice','One row per invoice')+opt('table','summary','Totals only')+opt('table','none','Hidden')+'</select></label>'
        + chk('show_interest', 'Show interest') + chk('show_fees', 'Show fees') + chk('show_ref', 'Show our reference') + chk('show_abn', 'Show debtor ABN') + chk('private_conf', '“Private & confidential” above the address')
        + '<label>Signed by (name)<input data-lds="sign_name" maxlength="80" value="'+escapeHtml(st.sign_name || '')+'" /></label>'
        + '<label>Title / team<input data-lds="sign_title" maxlength="80" value="'+escapeHtml(st.sign_title || '')+'" /></label>'
        + '<label class="span2">Your contact details, for {{our_contact}}<input data-lds="our_contact" maxlength="160" placeholder="Leave empty to use the phone and email from Settings" value="'+escapeHtml(st.our_contact || '')+'" /></label>'
        + '<label class="span2">Signature image (PNG with a clear background works best)<input type="file" accept="image/png,image/jpeg" data-ldsig="1" />'+(st.signature ? '<button type="button" class="linkbtn" data-ldsigdel="1" style="text-align:left;">Remove signature</button>' : '')+'</label>'
        + '<label class="span2">Description (shown when choosing templates)<input data-ld="description" maxlength="300" value="'+escapeHtml(ldTpl.description || '')+'" /></label>'
        + '</div>';
    }
  }
  function renderClauseLibrary(){
    var lib = document.getElementById('ldLibrary'); if(!lib) return;
    var cats = []; CLAUSES.forEach(function(c){ if(cats.indexOf(c.cat) < 0) cats.push(c.cat); });
    lib.innerHTML = '<div class="ld-lib-head"><b>Clause library</b><button type="button" class="linkbtn" data-ldlibclose="1">Close</button></div>' + cats.map(function(cat){
      return '<div class="ld-lib-cat">'+escapeHtml(cat)+'</div>' + CLAUSES.filter(function(c){ return c.cat === cat; }).map(function(c){
        return '<button type="button" class="ld-clause" data-ldclause="'+c.key+'"><b>'+escapeHtml(c.label)+(c.intent ? ' <span class="ld-intent">intent</span>' : '')+'</b><span>'+escapeHtml(c.text)+'</span></button>';
      }).join('');
    }).join('');
    lib.hidden = false;
  }
  (function wireLetterPaper(){
    var paper = document.getElementById('letterPaper');
    paper.addEventListener('change', function(e){
      var on = e.target.getAttribute && e.target.getAttribute('data-ldon'); if(on == null) return;
      var b = ldTpl.blocks[Number(on)]; if(!b) return;
      if(e.target.checked) delete b.off; else b.off = true;
      ldDirty = true; renderLetterTemplateSelect(); renderLetterPreview();
    });
    paper.addEventListener('click', async function(e){
      var t = e.target.closest('button'); if(!t || !ldTpl) return;
      if(t.hasAttribute('data-ldmove')){ var i = Number(t.getAttribute('data-i')), j = i + Number(t.getAttribute('data-ldmove')), bl = ldTpl.blocks; if(j < 0 || j >= bl.length) return; var tmp = bl[i]; bl[i] = bl[j]; bl[j] = tmp; ldCur = j; ldDirty = true; renderLetterTemplateSelect(); renderLetterPreview(); return; }
      if(t.hasAttribute('data-lddel')){ var k = Number(t.getAttribute('data-lddel')), bb = ldTpl.blocks[k]; if(!bb) return; ldTpl.blocks.splice(k, 1); ldCur = null; ldDirty = true; renderLetterTemplateSelect(); renderLetterPreview(); toastUndo((bb.type === 'heading' ? 'Heading' : bb.type === 'text' ? 'Paragraph' : (BLOCK_LABEL[bb.type] || 'Block')) + ' removed.', function(){ ldTpl.blocks.splice(Math.min(k, ldTpl.blocks.length), 0, bb); ldDirty = true; renderLetterTemplateSelect(); renderLetterPreview(); }); return; }
      if(t.hasAttribute('data-ldsaveclause')){ var sb3 = ldTpl.blocks[Number(t.getAttribute('data-ldsaveclause'))]; if(sb3 && (sb3.text || '').trim()) { await saveUserClause('letter', sb3.text, sb3.clause && CLAUSE_BY_KEY[sb3.clause] ? CLAUSE_BY_KEY[sb3.clause].label : ''); if(ldTab === 'content') renderLetterEditor(); } return; }
      if(t.hasAttribute('data-ldadd')){ var kind = t.getAttribute('data-ldadd'); ldInsertBlock(kind === 'text' || kind === 'heading' ? { type: kind, text: '' } : { type: kind }); return; }
    });
  })();
  (function wireLetterEditor(){
    var box = document.getElementById('ldEditor');
    box.addEventListener('focusin', function(e){ if(e.target.matches('textarea[data-ldb], input[data-ld="subject"]')) ldFocusEl = e.target; });
    box.addEventListener('input', function(e){
      var el = e.target, st;
      if(el.hasAttribute('data-ldb')){ var b = ldTpl.blocks[Number(el.getAttribute('data-ldb'))]; b.text = el.value; if(b.clause && b.text !== CLAUSE_BY_KEY[b.clause].text) { b.edited = true; } markLetterDirty(); return; }
      if(el.hasAttribute('data-ld')){ ldTpl[el.getAttribute('data-ld')] = el.value; markLetterDirty(); return; }
      if(el.hasAttribute('data-lds')){ ldTpl.settings = ldTpl.settings || {}; var k = el.getAttribute('data-lds'); ldTpl.settings[k] = el.type === 'checkbox' ? el.checked : (k === 'pay_days' ? Math.min(90, Math.max(1, parseInt(el.value, 10) || 7)) : el.value); markLetterDirty(); if(k === 'design_source') renderLetterEditor(); return; }
      if(el.hasAttribute('data-ldo')){ st = ldTpl.settings = ldTpl.settings || {}; st.overrides = st.overrides || {}; var ok = el.getAttribute('data-ldo');
        var v = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
        if(v === '' || v === false) delete st.overrides[ok]; else st.overrides[ok] = v;
        if(ok === 'font' || ok === 'heading_font') ensureFont(v);
        if(el.type === 'range') el.previousElementSibling.textContent = v;
        markLetterDirty(); return; }
      if(el.hasAttribute('data-ldcol')){ st = ldTpl.settings; st.overrides = st.overrides || {}; st.overrides.colors = st.overrides.colors || {}; st.overrides.colors[el.getAttribute('data-ldcol')] = el.value; markLetterDirty(); return; }
    });
    box.addEventListener('change', function(e){
      var el = e.target;
      if(el.tagName === 'SELECT' && (el.hasAttribute('data-lds') || el.hasAttribute('data-ldo') || el.hasAttribute('data-ld'))){ el.dispatchEvent(new Event('input', { bubbles: true })); if(el.getAttribute('data-ld') === 'stage') renderLetterTemplateSelect(); return; }
      if(el.type === 'checkbox' && (el.hasAttribute('data-lds') || el.hasAttribute('data-ldo'))){ el.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if(el.hasAttribute('data-ldcolon')){
        var k = el.getAttribute('data-ldcolon'), st = ldTpl.settings; st.overrides = st.overrides || {}; st.overrides.colors = st.overrides.colors || {};
        var pick = box.querySelector('[data-ldcol="'+k+'"]');
        if(el.checked){ st.overrides.colors[k] = pick.value; pick.disabled = false; } else { delete st.overrides.colors[k]; pick.disabled = true; }
        markLetterDirty(); return;
      }
      if(el.id === 'ldVarPick' && el.value){
        var tok = '{{' + el.value + '}}', t = ldFocusEl && document.body.contains(ldFocusEl) ? ldFocusEl : box.querySelector('textarea[data-ldb]');
        el.value = '';
        if(!t){ toast('Add a paragraph first.'); return; }
        var s0 = t.selectionStart != null ? t.selectionStart : t.value.length;
        t.value = t.value.slice(0, s0) + tok + t.value.slice(t.selectionEnd != null ? t.selectionEnd : s0);
        t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); t.selectionStart = t.selectionEnd = s0 + tok.length; return;
      }
      if(el.hasAttribute('data-ldsig') && el.files && el.files[0]){
        var f = el.files[0]; if(f.size > 3 * 1024 * 1024){ toast('Signature image is over 3 MB.'); return; }
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function(){ var sc = Math.min(1, 480 / img.width, 140 / img.height), cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ldTpl.settings.signature = cv.toDataURL('image/png'); renderLetterEditor(); markLetterDirty(); };
        img.src = url;
      }
    });
    box.addEventListener('change', function(e){
      var on = e.target.getAttribute && e.target.getAttribute('data-ldon'); if(on == null) return;
      var sb2 = ldTpl.blocks[Number(on)]; if(!sb2) return;
      if(e.target.checked) delete sb2.off; else sb2.off = true;
      renderLetterEditor(); markLetterDirty();
    });
    box.addEventListener('click', function(e){
      var t = e.target.closest('button'); if(!t) return;
      if(t.hasAttribute('data-ldopen')){ var ob = ldTpl.blocks[Number(t.getAttribute('data-ldopen'))]; if(ob){ if(ldOpenBlocks.has(ob)) ldOpenBlocks.delete(ob); else ldOpenBlocks.add(ob); } renderLetterEditor(); if(ob && ldOpenBlocks.has(ob)){ var ta = box.querySelector('[data-bi="'+ldTpl.blocks.indexOf(ob)+'"] textarea'); if(ta) ta.focus(); } return; }
      if(t.hasAttribute('data-ldexpand')){ var all = t.getAttribute('data-ldexpand') === 'all'; ldTpl.blocks.forEach(function(x){ if(all && (x.type === 'text' || x.type === 'heading')) ldOpenBlocks.add(x); else ldOpenBlocks.delete(x); }); renderLetterEditor(); return; }
      if(t.hasAttribute('data-ldmove')){ var i = Number(t.getAttribute('data-i')), j = i + Number(t.getAttribute('data-ldmove')); var bl = ldTpl.blocks; var tmp = bl[i]; bl[i] = bl[j]; bl[j] = tmp; renderLetterEditor(); markLetterDirty(); return; }
      if(t.hasAttribute('data-lddel')){ ldTpl.blocks.splice(Number(t.getAttribute('data-lddel')), 1); renderLetterEditor(); markLetterDirty(); return; }
      if(t.hasAttribute('data-ldadd')){
        var kind = t.getAttribute('data-ldadd');
        if(kind === 'library'){ renderClauseLibrary(); document.getElementById('ldLibrary').scrollIntoView({ block: 'nearest' }); return; }
        if(ldTpl.blocks.length >= 60){ toast('A letter can have up to 60 blocks.'); return; }
        var nb = kind === 'text' || kind === 'heading' ? { type: kind, text: '' } : { type: kind }; ldTpl.blocks.push(nb); ldOpenBlocks.add(nb);
        var mm = box.querySelector('.ld-more'); if(mm) mm.open = false;
        renderLetterEditor(); markLetterDirty();
        var last = box.querySelectorAll('textarea[data-ldb]'); if(last.length && (kind === 'text' || kind === 'heading')) last[last.length - 1].focus();
        return;
      }
      if(t.hasAttribute('data-ldclause')){ var k = t.getAttribute('data-ldclause'); var cb = { type: 'text', text: CLAUSE_BY_KEY[k].text, clause: k }; ldTpl.blocks.push(cb); ldOpenBlocks.add(cb); renderLetterEditor(); renderClauseLibrary(); markLetterDirty(); toast('Added “' + CLAUSE_BY_KEY[k].label + '”. Move it with ↑ ↓.'); return; }
      if(t.hasAttribute('data-ldlibclose')){ document.getElementById('ldLibrary').hidden = true; return; }
      if(t.hasAttribute('data-ldreset')){ ldTpl.settings.overrides = {}; renderLetterEditor(); markLetterDirty(); return; }
      if(t.hasAttribute('data-ldsigdel')){ ldTpl.settings.signature = null; renderLetterEditor(); markLetterDirty(); return; }
    });
  })();
  Array.prototype.forEach.call(document.querySelectorAll('[data-ldtab]'), function(b){ b.addEventListener('click', function(){ ldTab = this.getAttribute('data-ldtab'); renderLetterEditor(); }); });
  document.getElementById('ldTplSelect').addEventListener('change', async function(){
    if(ldDirty && !await djAsk('Discard your unsaved changes to this template?')){ this.value = ldKey; return; }
    loadLetterTemplate(this.value); ldViewing = null; renderLetterTemplateSelect(); renderLetterEditor(); renderLetterPreview();
  });
  function letterRow(){ return { org_id: currentOrg.id, name: (ldTpl.name || 'My letter').slice(0, 80), stage: ldTpl.stage || 'other', type: ldTpl.stage || 'other', description: ldTpl.description || null,
    subject_template: ldTpl.subject || '', body_template: ldTpl.blocks.filter(function(b){ return b.type === 'text' && !b.off; }).map(function(b){ return b.text; }).join('\n\n').slice(0, 20000), blocks: ldTpl.blocks, settings: ldTpl.settings }; }
  document.getElementById('ldSaveAsBtn').addEventListener('click', async function(){
    var name = (prompt('Name for this template:', ldKey && ldKey.indexOf('builtin:') === 0 ? 'My ' + (ldTpl.name || 'letter').toLowerCase() : (ldTpl.name || 'My letter') + ' (copy)') || '').trim();
    if(!name) return;
    ldTpl.name = name;
    var r = await sb.from('letter_templates').insert(letterRow()).select('*').single();
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    letterTemplates.push(r.data); ldKey = r.data.id; ldDirty = false; renderLetterTemplateSelect(); renderLetterEditor();
    toast('Template “' + name + '” saved.');
  });
  document.getElementById('ldSaveBtn').addEventListener('click', async function(){
    if(!ldKey || ldKey.indexOf('builtin:') === 0){ document.getElementById('ldSaveAsBtn').click(); return; }
    var row = letterRow(); delete row.org_id;
    var r = await sb.from('letter_templates').update(Object.assign(row, { updated_at: new Date().toISOString() })).eq('id', ldKey).select('*').single();
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    letterTemplates = letterTemplates.map(function(t){ return t.id === r.data.id ? r.data : t; });
    ldDirty = false; ldAi = false; renderLetterTemplateSelect(); toast('Template saved.');
  });
  document.getElementById('ldDeleteBtn').addEventListener('click', async function(){
    var row = letterTemplates.filter(function(t){ return t.id === ldKey; })[0]; if(!row) return;
    if(!await djAsk('Delete the template “' + row.name + '”? Letters already sent keep their own copy.')) return;
    var used = await sb.from('letters').select('id', { count: 'exact', head: true }).eq('template_id', row.id);
    if(used.count){ var up = await sb.from('letters').update({ template_id: null, template_key: 'deleted:' + row.name.slice(0, 60) }).eq('template_id', row.id); if(up.error){ toast('Could not delete: ' + up.error.message); return; } }
    var r = await sb.from('letter_templates').delete().eq('id', row.id);
    if(r.error){ toast('Could not delete: ' + r.error.message); return; }
    letterTemplates = letterTemplates.filter(function(t){ return t.id !== row.id; });
    loadLetterTemplate('builtin:first_demand'); renderLetterTemplateSelect(); renderLetterEditor(); renderLetterPreview(); toast('Template deleted.');
  });
  document.getElementById('ldRevertBtn').addEventListener('click', async function(){ if(ldDirty && !await djAsk('Undo all changes since the template was last saved?')) return; loadLetterTemplate(ldKey); renderLetterTemplateSelect(); renderLetterEditor(); renderLetterPreview(); });

  // ---- AI draft: replaces the paragraphs for this letter only; tables and boxes stay where they are.
  document.getElementById('aiDraftLetterBtn').addEventListener('click', async function(){
    var c = currentLetterCase(); if(!c){ toast('Choose a case first.'); return; }
    var btn = this; btn.disabled = true; btn.textContent = 'Drafting…';
    try{
      var tplText = ldTpl.blocks.filter(function(b){ return b.type === 'text' && !b.off; }).map(function(b){ return b.text; }).join('\n\n');
      var stage = ldTpl.stage || 'other';
      var d = await invokeFn('draft-correspondence', { kind: 'letter', case_id: c.id, template_type: stage, template_text: tplText.slice(0, 4000), template_name: ldTpl.name });
      if(d.flags){ letterFlags = d.flags; }
      if(!d.ok || !d.draft){ toast(d.error || 'AI draft failed.'); renderLetterPreview(); return; }
      var paras = String(d.draft.body || '').split(/\n{2,}/).map(function(p){ return p.trim(); }).filter(Boolean);
      var structural = ldTpl.blocks.filter(function(b){ return b.type !== 'text'; }), offTexts = ldTpl.blocks.filter(function(b){ return b.type === 'text' && b.off; });
      var firstStruct = ldTpl.blocks.findIndex(function(b){ return b.type !== 'text'; });
      var lead = firstStruct < 0 ? paras.length : Math.min(Math.max(1, firstStruct), Math.max(1, paras.length - 1));
      ldTpl.blocks = paras.slice(0, lead).map(function(p){ return { type: 'text', text: p, ai: true }; }).concat(structural).concat(paras.slice(lead).map(function(p){ return { type: 'text', text: p, ai: true }; })).concat(offTexts);
      if(d.draft.subject) ldTpl.subject = d.draft.subject;
      ldAi = true; ldDirty = true; ldTab = 'content';
      renderLetterTemplateSelect(); renderLetterEditor(); renderLetterPreview();
      toast('AI draft ready. ' + (d.draft.recommendation || 'Read and edit it before sending.'));
    } finally { btn.disabled = false; btn.innerHTML = AI_MARK + 'Draft letter with DebtJet AI'; }
  });

  // ---- Print and send (records the letter, with an exact snapshot)
  document.getElementById('ldPrintBtn').addEventListener('click', function(){ window.print(); });
  document.getElementById('ldSendBtn').addEventListener('click', async function(){
    var c = currentLetterCase(); if(!c || !ldTpl){ toast('Nothing to send yet.'); return; }
    var st = ldSettings(), m = buildLetterModel(c, st);
    var checks = (letterFlags || []).concat(letterChecks(m, ldTpl, st)).filter(function(f){ return f.level === 'stop' || f.level === 'caution'; });
    if(checks.length && !window.confirm('Before sending, note:\n\n• ' + checks.map(function(f){ return f.message; }).join('\n• ') + '\n\nRecord this letter as sent anyway?')) return;
    var sendVia = document.getElementById('sendVia').value;
    var subject = fillLetterText(ldTpl.subject || '', m.vars, true);
    var bodyText = ldTpl.blocks.filter(function(b){ return !b.off && (b.type === 'text' || b.type === 'heading'); }).map(function(b){ return fillLetterText(b.text || '', m.vars, true); }).join('\n\n');
    var html = letterCleanHtml();
    var r = await sb.from('letters').insert({ org_id: currentOrg.id, case_id: c.id, template_id: ldKey && ldKey.indexOf('builtin:') !== 0 ? ldKey : null, template_key: ldKey,
      type: ldTpl.stage || 'other', subject: subject, body: bodyText, amount_at_send: m.totals.principal, interest_at_send: m.totals.interest, send_via: sendVia, status: 'sent', sent_at: new Date().toISOString(), created_by: session.user.id,
      snapshot: { html: html, ref: m.ref, totals: m.totals, template_name: ldTpl.name, ai: ldAi } });
    if(r.error){ toast('Could not record the letter: ' + r.error.message); return; }
    await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: 'letter_sent', title: (ldTpl.name || 'Letter') + ' sent' + (ldAi ? ' (AI-drafted)' : ''), body: 'Ref ' + m.ref + ' · ' + money(m.totals.total) + ' · via ' + sendVia, created_by: session.user.id });
    toast('Recorded “' + ldTpl.name + '” as sent to ' + c.debtor.name + '.');
    ldLastLetter[c.id] = new Date().toISOString();
    await loadChargeContext(); refreshSentLetters();
    histState.letters && (histState.letters.loadedKey = null); loadHistory('letters', [c.debtor.id], true);
  });
  var sentLetterRows = [];
  async function refreshSentLetters(){
    var r = await sb.from('letters').select('id, sent_at, type, subject, send_via, status, snapshot, cases(debtors(name))').eq('org_id', currentOrg.id).order('sent_at', { ascending: false }).limit(15);
    sentLetterRows = r.data || [];
    document.getElementById('sentLettersBody').innerHTML = sentLetterRows.length ? sentLetterRows.map(function(l){
      return '<tr><td>'+fmt(l.sent_at)+'</td><td>'+escapeHtml(l.cases && l.cases.debtors ? l.cases.debtors.name : '—')+'</td><td>'+escapeHtml((l.snapshot && l.snapshot.template_name) || TPL_LABEL[l.type] || l.type)+'<div class="sub">'+escapeHtml(l.subject || '')+'</div></td><td>'+escapeHtml(l.send_via || '—')+'</td><td><span class="pill letter_sent">'+escapeHtml(l.status)+'</span></td>'
        + '<td>'+(l.snapshot && l.snapshot.html ? '<button class="btn sm ghost" type="button" data-ldview="'+escapeHtml(l.id)+'">View</button>' : '')+'</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-note">No letters sent yet.</td></tr>';
  }
  document.getElementById('sentLettersBody').addEventListener('click', function(e){
    var id = e.target.getAttribute('data-ldview'); if(!id) return;
    var l = sentLetterRows.filter(function(x){ return x.id === id; })[0]; if(!l) return;
    ldViewing = { html: l.snapshot.html, sent_at: l.sent_at }; setLetterTab('letter', true); renderLetterPreview(); window.scrollTo(0, 0);
  });

