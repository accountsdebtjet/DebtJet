// ---- Test clock: the app always sees 28 Nov 2026, 10:00 am Brisbane, and time moves on normally from there.
// The test data has fixed invoice dates, so this keeps "days overdue", due/not-due and interest the same every day.
// A test can set window.__TEST_NOW (an ISO time) in an init script to use another day.
(function(){
  var RealDate = Date;
  var fixed = RealDate.parse(window.__TEST_NOW || '2026-11-28T00:00:00Z');
  var offset = fixed - RealDate.now();
  function TestDate(){
    if(!(this instanceof TestDate)) return new RealDate(RealDate.now() + offset).toString();
    var a = arguments;
    var d = a.length === 0 ? new RealDate(RealDate.now() + offset) : new (Function.prototype.bind.apply(RealDate, [null].concat([].slice.call(a))))();
    Object.setPrototypeOf(d, TestDate.prototype);
    return d;
  }
  TestDate.prototype = Object.create(RealDate.prototype, { constructor: { value: TestDate } });
  Object.setPrototypeOf(TestDate, RealDate);
  TestDate.now = function(){ return RealDate.now() + offset; };
  TestDate.parse = RealDate.parse; TestDate.UTC = RealDate.UTC;
  window.Date = TestDate;
})();
(function(){
  // ---- Evidence checks (same rules as supabase/functions/_shared/terms-evidence.ts; the server decides) ----
  function termsEvNorm(s){ return String(s || '').toLowerCase().normalize('NFKD').replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―]/g, '-').replace(/[^a-z0-9%$.]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function termsEvFound(docText, quote){ var q = termsEvNorm(quote); return q.length >= 12 && !!docText && termsEvNorm(docText).indexOf(q) >= 0; }
  var TERMS_EV_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, 'twenty one': 21, 'twenty eight': 28, thirty: 30, 'thirty one': 31, forty: 40, 'forty five': 45, sixty: 60, ninety: 90 };
  function termsEvNumbers(q){
    var out = [], m, re = /\d+(?:\.\d+)?/g, s = String(q || '').replace(/(\d),(\d{3})/g, '$1$2');
    while((m = re.exec(s))) out.push(Number(m[0]));
    var t = ' ' + termsEvNorm(q) + ' ';
    Object.keys(TERMS_EV_WORDS).forEach(function(w){ if(t.indexOf(' ' + w + ' ') >= 0) out.push(TERMS_EV_WORDS[w]); });
    return out;
  }
  function termsEvHasNum(q, n){ return termsEvNumbers(q).some(function(x){ return Math.abs(x - n) < 0.005; }); }
  function termsEvMonthly(q){ return /\b(per|a|each|every) (calendar )?month\b|\bmonthly\b/.test(termsEvNorm(q)); }
  function termsBaseline(R){
    R = R || {}; var I = R.interest || {};
    var start = I.start === 'after_days' ? (I.start_days ? 'after_grace' : 'due_date') : (I.start && I.start !== 'not_stated' ? I.start : 'due_date');
    return {
      interest: { allowed: !!I.stated, max_rate_pa: I.rate_pa_percent != null ? Math.round(I.rate_pa_percent * 100) / 10000 : null, method: I.method === 'compound_monthly' ? 'compound_monthly' : 'simple',
        start: start, grace_days: start === 'after_grace' ? Math.round(I.start_days || 0) : 0, clause: I.clause || '', quote: I.quote || '', quote_found: I.quote_found, rate_text: I.rate_text || '', start_stated: !!(I.start && I.start !== 'not_stated') },
      fees: (R.fees || []).filter(function(f){ return f.debtjet_can_charge && f.amount != null && f.amount > 0; }).map(function(f){
        return { name: String(f.name || 'Fee').slice(0, 40), type: f.type === 'percent' ? 'percent' : 'fixed', max_amount: Math.round(f.amount * 100) / 100,
          applies: f.trigger === 'per_reminder_or_statement' ? 'per_statement' : 'per_invoice', min_after_days: Math.max(1, Math.round(f.after_days || 1)), clause: f.clause || '', quote: f.quote || '', quote_found: f.quote_found };
      })
    };
  }
  var TERMS_START_ORDER = { due_date: 0, after_grace: 1, first_demand: 2, final_demand: 3 };
  function termsStartEarlier(s, g, bs, bg){
    var a = TERMS_START_ORDER[s] || 0, b = TERMS_START_ORDER[bs] || 0;
    return a !== b ? a < b : (s === 'after_grace' && g < bg);
  }
  function termsEvNeeds(base, lim){
    var out = [], I = lim.interest || {}, B = base.interest || {};
    if(I.allowed){
      if(!B.allowed) out.push({ key: 'interest', label: 'Interest on overdue amounts', keyword: 'interest' });
      if(B.max_rate_pa == null || Number(I.max_rate_pa) > Number(B.max_rate_pa) + 1e-9){ var pct = Math.round(Number(I.max_rate_pa) * 10000) / 100; out.push({ key: 'rate', label: 'Interest rate of ' + pct + '% a year', numbers: [pct], monthlyOk: true }); }
      if(I.method === 'compound_monthly' && B.method !== 'compound_monthly') out.push({ key: 'method', label: 'Compounding interest', keyword: 'compound' });
      if(termsStartEarlier(I.start, Number(I.grace_days) || 0, B.allowed ? B.start : 'final_demand', Number(B.grace_days) || 0))
        out.push(I.start === 'after_grace' ? { key: 'start', label: 'Interest from ' + I.grace_days + ' days overdue', numbers: [Number(I.grace_days) || 0] }
          : I.start === 'due_date' ? { key: 'start', label: 'Interest from the due date', keyword: 'due' } : { key: 'start', label: 'When interest starts', keyword: 'demand' });
    }
    (lim.fees || []).forEach(function(f){
      var b = (base.fees || []).filter(function(x){ return String(x.name).toLowerCase() === String(f.name).toLowerCase(); })[0];
      var nums = [], kw = '';
      if(!b || Number(f.max_amount) > Number(b.max_amount) + 1e-9 || f.type !== b.type) nums.push(Number(f.max_amount));
      if(b && Number(f.min_after_days) < Number(b.min_after_days)) nums.push(Number(f.min_after_days));
      if(b && f.applies !== b.applies) kw = f.applies === 'per_statement' ? 'statement' : 'invoice';
      if(nums.length || kw) out.push({ key: 'fee:' + String(f.name).toLowerCase(), label: f.name + ' (' + (f.type === 'percent' ? f.max_amount + '%' : '$' + f.max_amount) + ')', numbers: nums, keyword: kw || null });
    });
    return out;
  }
  // One need checked against its quote: '' if supported, else the reason.
  function termsEvProblem(docText, n, ev){
    var q = ev && typeof ev.quote === 'string' ? ev.quote : '';
    if(!q.trim()) return 'This goes beyond DebtJet AI’s reading, so quote the wording from the document that says it.';
    if(!docText) return 'DebtJet can’t read the text of this file, so the wording can’t be checked.';
    if(!termsEvFound(docText, q)) return 'That wording wasn’t found in the document. Copy it exactly.';
    var nums = n.numbers || [];
    for(var i = 0; i < nums.length; i++){
      var num = nums[i];
      if(!(termsEvHasNum(q, num) || (n.monthlyOk && termsEvMonthly(q) && termsEvHasNum(q, Math.round(num / 12 * 10000) / 10000)))) return 'The quote doesn’t contain ' + num + (n.monthlyOk ? ' (or the monthly equivalent)' : '') + '.';
    }
    if(n.keyword && termsEvNorm(q).indexOf(n.keyword) < 0) return 'The quote doesn’t mention “' + n.keyword + '”.';
    return '';
  }

window.termsBaseline=termsBaseline; window.termsEvNeeds=termsEvNeeds; window.termsEvProblem=termsEvProblem;
})();
(function(){
  var BL='cc99e913', BW='661abdd2';
  var deb={}; deb[BL]={id:BL,name:'Bluestone Legal',abn:'53 004 085 616',contact_name:'Catherine Wu',email:'x@example.com',phone:null};
  deb[BW]={id:BW,name:'Blue Wren Cafe',abn:null,contact_name:null,email:'x@example.com',phone:null};
  function inv(id,d,n,desc,amt,iss,due){ return {id:id,debtor_id:d,case_id:'c-'+d,invoice_number:n,description:desc,amount:amt,issued_date:iss,due_date:due,status:'open',source:'xero',external_id:'x-'+id,pay_url:null,debtors:deb[d]}; }
  var invoices=[inv('i3112',BL,'INV-3112','Job 664',715.62,'2026-06-09','2026-06-23'),inv('i3109',BL,'INV-3109','PO 55977',4781.01,'2026-08-05','2026-08-12'),
    inv('i3111',BL,'INV-3111','Site works',3240.92,'2026-07-22','2026-08-21'),inv('i3110',BL,'INV-3110','PO 27328',6536.31,'2026-08-31','2026-09-14'),
    inv('i3107',BL,'INV-3107','Job 357',4386.35,'2026-10-22','2026-11-05'),inv('i3108',BL,'INV-3108','Site works',6515.82,'2026-10-24','2026-11-07'),
    inv('i3150',BL,'INV-3150','Retainer',1200,'2026-11-01','2026-12-01'),
    inv('i3029',BW,'INV-3029','PO 69501',2055.97,'2026-08-21','2026-08-28')];
  var DB={
    org_members:[{org_id:'org1',role:(window.__ROLE||'owner'),organizations:{name:'DebtJet Software Development'}}],
    invoices:invoices, payments:[{invoice_id:'i3111',amount:1000,paid_at:'2026-09-01'}],
    case_notes:[{debtor_id:BL,source:'gmail',email_subject:'Re: INV-3107',invoice_id:'i3107',category:'payment_made',summary:'Says INV-3107 paid 12 Nov ref EFT388626.',occurred_at:'2026-11-15T03:52:00Z'},
      {invoice_id:'i3108',category:'hardship',summary:'Hospital for a month; asked for patience.',occurred_at:'2026-11-15T01:03:00Z'},
      {invoice_id:'i3110',category:'dispute',summary:'Disputes amount vs quote.',occurred_at:'2026-10-09T03:28:00Z'},
      {invoice_id:'i3111',category:'promise_to_pay',summary:'Promised full payment 23 Sep.',occurred_at:'2026-09-18T08:34:00Z'}],
    cases:[{id:'c-'+BL,debtor_id:BL,status:'new',interest_rate:0.1,opened_at:'2026-07-01',tribunal_body:null,debtors:deb[BL],invoices:invoices.filter(function(i){return i.debtor_id===BL;}),payments:[]}],
    letters:[{case_id:'c-'+BL,type:'first_demand',sent_at:'2026-11-01T00:00:00Z',status:'sent'}],
    letter_templates:[], statements:[], invoice_charge_decisions:[], debtor_contacts:[], debtors:[deb[BL]], charge_postings:[], charge_posting_settings:[], organizations:[{id:'org1',name:'DebtJet Software Development',abn:null,billing_email:'accounts@example.com.au',logo:'data:image/png;base64,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',address:null,phone:null,website:null}], correspondence_log:[{id:'cl1',debtor_id:BL,direction:'in',channel:'phone',occurred_at:'2026-11-14T03:00:00Z',subject:null,summary:'Catherine called: will pay INV-3109 on Friday.',counts_as_contact:false,created_by:'u1'},{id:'cl2',debtor_id:BL,direction:'out',channel:'email',occurred_at:'2026-11-13T01:00:00Z',subject:'Overdue reminder',summary:'Sent friendly reminder email.',counts_as_contact:true,created_by:'u1'}], case_events:[{id:'e1',case_id:'c-'+BL,event_type:'portal_viewed',title:'Debtor opened the portal',body:null,occurred_at:'2026-11-12T22:00:00Z'}], statement_templates:[], integration_connections:[], case_events:[], recovery_matters:[], recovery_disputes:[],
    org_payment_details:[{org_id:'org1',account_name:'DebtJet Software Development Pty Ltd',bsb:'064-000',account_number:'12345678',bank_name:'Commonwealth Bank',payid:'accounts@example.com.au',payid_type:'email',bpay_biller_code:null,reference_format:'invoice',show_bank:true,show_payid:true,show_bpay:false,online_provider:'xero',instructions:'Please email remittance advice to accounts@example.com.au',bank_changed_at:'2026-11-01T00:00:00Z'}],
    org_charge_settings:[{org_id:'org1',terms_allow_charges:true,interest_enabled:true,rate_pa:0.10,method:'simple',grace_days:7,min_balance:0,cap_pct:null,apply_mode:'auto',interest_start:'after_grace',fees:[{name:'Admin fee',type:'fixed',amount:25,applies:'per_statement',after_days:30},{name:'Late payment fee',type:'fixed',amount:15,applies:'per_invoice',after_days:14}]}],
    payment_detail_changes:[{changed_at:'2026-11-01T00:00:00Z',summary:'Payment details set up: BSB 064-000, account ••••678',changed_by:'u1'}]
  };
  DB.contact_groups=DB.contact_groups||[]; DB.contact_group_members=DB.contact_group_members||[]; DB.clause_library=DB.clause_library||[]; DB.org_terms_documents=DB.org_terms_documents||[]; DB.terms_acceptances=DB.terms_acceptances||[]; DB.terms_evidence=DB.terms_evidence||[]; if(window.__SEED_GROUP){ var gids=[]; DB.invoices.forEach(function(i){ if(i.debtor_id && gids.indexOf(i.debtor_id)<0) gids.push(i.debtor_id); }); DB.contact_groups=[{id:'g1',org_id:'org1',name:'Blue Group',xero_group_id:null}]; DB.contact_group_members=gids.map(function(d){ return {group_id:'g1',debtor_id:d,org_id:'org1'}; }); }
  if(!window.__NO_TERMS){
    DB.org_terms_documents.push({id:'seed-terms',org_id:'org1',title:'Seed terms of trade',kind:'terms_of_trade',source:'text',body_text:'seed',is_current:true,archived:false,created_at:'2026-01-01T00:00:00Z',reviewed_at:'2026-01-01T00:00:00Z',
      review:{is_terms:true,summary_points:['Seed terms.'],key_points:[],fees:[],interest:{stated:true,rate_pa_percent:12}},
      limits:{interest:{allowed:true,max_rate_pa:0.12,method:'simple',start:'due_date',grace_days:0,clause:'5.1'},fees:[{name:'Admin fee',type:'fixed',max_amount:25,applies:'per_statement',min_after_days:30,clause:'5.3'},{name:'Late payment fee',type:'fixed',max_amount:20,applies:'per_invoice',min_after_days:14,clause:'5.2'}],manual:[]},
      rules:{interest_enabled:true,rate_pa:0.10,method:'simple',interest_start:'after_grace',grace_days:7,min_balance:0,cap_pct:null,fees:[{name:'Admin fee',type:'fixed',amount:25,applies:'per_statement',after_days:30},{name:'Late payment fee',type:'fixed',amount:15,applies:'per_invoice',after_days:14}]},
      rules_confirmed_at:'2026-01-01T00:00:00Z',rules_confirmed_by:'u1'});
    DB.terms_evidence=DB.terms_evidence||[];
    var seedIds={}; (DB.debtors||[]).forEach(function(x){seedIds[x.id]=1;}); (DB.invoices||[]).forEach(function(x){ if(x.debtor_id) seedIds[x.debtor_id]=1; if(x.debtor&&x.debtor.id) seedIds[x.debtor.id]=1; });
    Object.keys(seedIds).map(function(id){return {id:id};}).forEach(function(dd,ix){ DB.terms_acceptances.push({id:'acc-'+ix,org_id:'org1',document_id:'seed-terms',debtor_id:dd.id,group_id:null,accepted_on:'2026-01-01',accepted_how:'signed_credit_application',note:null,evidence_grade:'evidence'});
      DB.terms_evidence.push({id:'ev-'+ix,org_id:'org1',acceptance_id:'acc-'+ix,source:'upload',grade:'evidence',storage_path:'org1/evidence/seed.pdf',file_name:'Signed credit application.pdf'}); });
  }
  window.__DB=DB; window.__writes=[];
  function builder(table){
    var st={single:false,op:'select',payload:null,f:[]};
    var b={};
    ['select','neq','in','order','limit','gte','lte','gt','lt','is','not','or','ilike','overlaps'].forEach(function(m){ b[m]=function(){ return b; }; });
    b.eq=function(k,v){ st.f.push([k,v]); return b; };
    b.maybeSingle=function(){st.single=true;return b;}; b.single=function(){st.single=true;return b;};
    ['insert','update','upsert','delete'].forEach(function(m){ b[m]=function(p){ st.op=m; st.payload=p; window.__writes.push({table:table,op:m,payload:p}); return b; }; });
    b.then=function(res,rej){
      var rows=DB[table]||[];
      if(st.op==='insert'||st.op==='upsert'){ var arr=(Array.isArray(st.payload)?st.payload:[st.payload]).map(function(x){return Object.assign({id:'new-'+Math.random().toString(36).slice(2),decided_at:new Date().toISOString(),decided_by:'u1'},x);}); if(table==='statements') arr.forEach(function(x){ if(!x.generated_at) x.generated_at=new Date().toISOString(); if(!x.status) x.status='draft'; }); if(table==='invoice_charge_decisions'){ arr.forEach(function(x){ DB[table]=DB[table].filter(function(y){return y.invoice_id!==x.invoice_id;}); DB[table].push(x); }); } else if(st.op==='insert') arr.forEach(function(x){rows.push(x);}); else DB[table]=[arr[0]]; rows=arr; }
      var match=function(r){ return st.f.every(function(f){ return r[f[0]]===undefined || r[f[0]]===f[1]; }); };
      if(st.op==='update'){ rows=rows.filter(function(r){ return st.f.length && st.f.every(function(f){ return r[f[0]]===f[1]; }); }); rows.forEach(function(r){ Object.assign(r, st.payload); if(table==='recovery_disputes' && 'approved_at' in st.payload) r.approved_at = st.payload.approved_at; }); }
      if(st.op==='delete'){ if(DB[table]) DB[table]=DB[table].filter(function(r){ return !(st.f.length && st.f.every(function(f){ return r[f[0]]===f[1]; })); }); rows=[]; }
      // Emulate the evidence triggers: grade from evidence, cascade deletes.
      if(table==='terms_acceptances'||table==='terms_evidence'){
        DB.terms_evidence=(DB.terms_evidence||[]).filter(function(e){ return DB.terms_acceptances.some(function(x){ return x.id===e.acceptance_id; }); });
        DB.terms_acceptances.forEach(function(x){ var ev=DB.terms_evidence.filter(function(e){ return e.acceptance_id===x.id; }); x.evidence_grade = ev.some(function(e){return e.grade==='verified';}) ? 'verified' : ev.length ? 'evidence' : 'declared'; });
      }
      var data = st.single ? (rows[0]||null) : rows;
      return Promise.resolve({data:data,error:null}).then(res,rej);
    };
    return b;
  }
  var client={ from:builder,
    auth:{ getSession:function(){return Promise.resolve({data:{session:{user:{id:'u1',email:'tester@example.com'}}}});}, onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};}, signOut:function(){return Promise.resolve({});} },
    rpc:function(){ return Promise.resolve({data:null,error:null}); },
    storage:{ from:function(bucket){ return {
      upload:function(path,file,o){ window.__writes.push({storage:'upload',path:path,type:o&&o.contentType}); return Promise.resolve({data:{path:path},error:null}); },
      createSignedUrl:function(path){ return Promise.resolve({data:{signedUrl:'about:blank#'+path},error:null}); },
      remove:function(paths){ window.__writes.push({storage:'remove',paths:paths}); return Promise.resolve({data:[],error:null}); } }; } },
    functions:{ invoke:function(name,o){ window.__writes.push({fn:name,body:o.body});
      if(name==='xero-groups'){ var xb=o.body, xg=(DB.contact_groups||[]).filter(function(g){return g.id===xb.group_id;})[0];
        if(!xg) return Promise.resolve({data:{ok:false,error:'Group not found.'},error:null});
        var deb0=function(id){ return (DB.debtors||[]).filter(function(d){return d.id===id;})[0] || {}; };
        if(xb.action==='push'){ var mem=DB.contact_group_members.filter(function(m){return m.group_id===xg.id;}); var inX=mem.filter(function(m){return deb0(m.debtor_id).xero_contact_id;});
          if(!inX.length) return Promise.resolve({data:{ok:false,error:"None of this group's contacts came from Xero, so there is nothing to put in a Xero group."},error:null});
          xg.xero_group_id='xg-'+xg.id; return Promise.resolve({data:{ok:true,xero_group_id:xg.xero_group_id,added:inX.length,not_in_xero:mem.filter(function(m){return !deb0(m.debtor_id).xero_contact_id;}).map(function(m){return deb0(m.debtor_id).name||'?';})},error:null}); }
        if(xb.action==='add'){ if(!DB.contact_group_members.some(function(m){return m.group_id===xg.id&&m.debtor_id===xb.debtor_id;})) DB.contact_group_members.push({group_id:xg.id,debtor_id:xb.debtor_id,org_id:'org1'}); return Promise.resolve({data:{ok:true,in_xero:!!xg.xero_group_id},error:null}); }
        if(xb.action==='remove'){ DB.contact_group_members=DB.contact_group_members.filter(function(m){return !(m.group_id===xg.id&&m.debtor_id===xb.debtor_id);}); return Promise.resolve({data:{ok:true,in_xero:!!xg.xero_group_id},error:null}); }
      }
      if(name==='abn-lookup'){ var b=o.body;
        if(b.name) return Promise.resolve({data:{ok:true,results:[{abn:'53004085616',name:'BLUESTONE LEGAL PTY LTD',name_type:'Entity Name',status:'Active',state:'QLD',postcode:'4000'},{abn:'51824753556',name:'Bluestone Lawyers',name_type:'Business Name',status:'Active',state:'NSW',postcode:'2000'}]},error:null});
        if(b.save){ Object.assign(deb[BL],{abn:b.abn,legal_name:'BLUESTONE LEGAL PTY LTD',acn:'004085616',entity_type:'Australian Private Company',abn_status:'Active',abn_status_from:'2001-04-12',gst_from:'2001-07-01',abr_state:'QLD',abr_postcode:'4000',business_names:['Bluestone Legal'],abr_checked_at:new Date().toISOString(),name_check:'similar'}); }
        return Promise.resolve({data:{ok:true,name_check:'similar',details:{abn:b.abn}},error:null}); }
      if(name==='dispute-response'){ var ev=[{key:'INV:INV-3110',type:'invoice',date:'2026-08-31',text:'Invoice INV-3110 issued 2026-08-31, due 2026-09-14, amount $6536.31. Description: PO 27328'},{key:'LTR:1',type:'letter',date:'2026-11-01',text:'Letter sent (first demand) on 2026-11-01'},{key:'NOTE:3',type:'note',date:'2026-10-09',text:'Summary of an email from the debtor: Disputes amount vs quote.'}];
        if(o.body.list_only) return Promise.resolve({data:{ok:true,all_evidence_keys:ev},error:null});
        return Promise.resolve({data:{ok:true,draft:{response:'We issued invoice INV-3110 on 31 August 2026 for $6,536.31 against purchase order PO 27328 [INV:INV-3110]. We wrote to Bluestone Legal about the unpaid amount on 1 November 2026 [LTR:1]. Bluestone Legal told us it disputes the amount compared with the quote [NOTE:3].',gaps:['The quote itself is not in DebtJet, so the response cannot say what price was quoted.'],questions:['Do you have the signed quote or purchase order showing $6,536.31?']},evidence:ev,unknown_citations:[]},error:null}); }
      if(name==='xero-charges'){ if(o.body.action==='load') return Promise.resolve({data:{ok:true,accounts:[{code:'200',name:'Sales',type:'REVENUE'},{code:'270',name:'Interest Income',type:'OTHERINCOME'},{code:'260',name:'Other Revenue',type:'OTHERINCOME'}],tax_rates:[{tax_type:'OUTPUT',name:'GST on Income',rate:10,revenue:true},{tax_type:'EXEMPTOUTPUT',name:'GST Free Income',rate:0,revenue:true},{tax_type:'BASEXCLUDED',name:'BAS Excluded',rate:0,revenue:true},{tax_type:'INPUT',name:'GST on Expenses',rate:10,revenue:false}],refreshed:0},error:null});
        var res=(o.body.items||[]).map(function(it,k){ if(k===0 && window.__XC_REJECT) return {invoice_id:it.invoice_id,ok:false,error:window.__XC_REJECT}; var xid='xi-'+Math.random().toString(36).slice(2); DB.charge_postings.push({id:'cp'+k+xid,org_id:'org1',invoice_id:it.invoice_id,xero_invoice_id:xid,xero_invoice_number:'INV-90'+(DB.charge_postings.length+1),period_from:it.period_from,period_to:it.period_to,interest:it.interest,status:'draft',created_at:new Date().toISOString()}); return {invoice_id:it.invoice_id,ok:true,xero_invoice_id:xid}; });
        return Promise.resolve({data:{ok:true,results:res},error:null}); }
      if(name==='terms-limits'){ var td=(DB.org_terms_documents||[]).filter(function(x){return x.id===o.body.document_id;})[0];
        var L=o.body.limits, base=termsBaseline(td.review), needs=termsEvNeeds(base,L), text=td.doc_text||td.body_text||'', probs=[];
        needs.forEach(function(n){ var pr=termsEvProblem(text,n,(o.body.evidence||{})[n.key]); if(pr) probs.push(n.label+': '+pr); });
        window.__writes.push({fn:'terms-limits',body:o.body,problems:probs});
        if(probs.length) return Promise.resolve({data:{ok:false,error:probs[0],problems:probs},error:null});
        var ev={}; needs.forEach(function(n){ ev[n.key]={source:'quote',quote:o.body.evidence[n.key].quote,clause:o.body.evidence[n.key].clause,found:true}; });
        if(L.interest.allowed && !ev.rate) ev.rate={source:'ai',clause:base.interest.clause,quote:base.interest.quote,found:true};
        L.fees.forEach(function(f){ var k='fee:'+f.name.toLowerCase(); if(!ev[k]){ var bf=base.fees.filter(function(x){return x.name.toLowerCase()===f.name.toLowerCase();})[0]; ev[k]={source:'ai',clause:bf?bf.clause:f.clause,quote:bf?bf.quote:'',found:true}; } });
        L.evidence=ev; td.kind=o.body.kind; td.limits=L; td.limits_log=(td.limits_log||[]).concat([{at:new Date().toISOString(),by:'u1',action:td.rules_confirmed_at?'changed':'confirmed',compared_with:'DebtJet AI reading',changes:['test change'],quotes:needs.map(function(n){return {what:n.label,clause:o.body.evidence[n.key].clause,quote:o.body.evidence[n.key].quote};})}]);
        if(!td.rules) td.rules={interest_enabled:!!L.interest.allowed,rate_pa:L.interest.max_rate_pa||0,method:L.interest.method,interest_start:L.interest.start,grace_days:L.interest.grace_days,min_balance:0,cap_pct:null,fees:L.fees.map(function(f){return {name:f.name,type:f.type,amount:f.max_amount,applies:f.applies,after_days:f.min_after_days};})};
        td.rules_confirmed_at=new Date().toISOString(); td.rules_confirmed_by='u1';
        return Promise.resolve({data:{ok:true,document:JSON.parse(JSON.stringify(td))},error:null}); }
      if(name==='review-terms'){ var d=(DB.org_terms_documents||[]).filter(function(x){return x.id===o.body.document_id;})[0];
        if(!d) return Promise.resolve({data:null,error:{message:'404',context:{json:function(){return Promise.resolve({error:'Document not found.'});}}}});
        d.review={is_terms:true,document_kind:'terms_of_trade',summary_points:['Standard terms of trade for building services.','Invoices are due 14 days after the invoice date.','Overdue amounts attract 12% simple interest from the due date.','A $20 late fee applies, plus reasonable recovery costs.'],
          acceptance:'By signing the credit application or accepting a quote.',governing_law:'Queensland',
          payment_terms:{days:14,basis:'invoice_date',text:'14 days from the invoice date',clause:'5.1'},
          interest:{stated:true,rate_pa_percent:12,rate_text:'12% per annum',method:'simple',start:'due_date',start_days:null,clause:'8.2',quote:'Interest accrues on overdue amounts at 12% per annum calculated daily from the due date until paid.'},
          fees:[{name:'Late payment fee',type:'fixed',amount:20,trigger:'overdue_invoice',after_days:7,clause:'8.3',quote:'A late payment fee of $20 applies to each invoice unpaid 7 days after the due date.',debtjet_can_charge:true,note:''},
                {name:'Dishonour fee',type:'fixed',amount:35,trigger:'dishonoured_payment',after_days:null,clause:'8.4',quote:'A $35 fee applies to any dishonoured payment.',debtjet_can_charge:false,note:'Only applies when a payment bounces, so add it by hand when it happens.'}],
          recovery_costs:{stated:true,scope:'Reasonable costs of recovery, including collection and legal costs',clause:'9.1'},
          key_points:[{topic:'Payment terms',finding:'Payment is due 14 days after the invoice date.',clause:'5.1',effect:'neutral'},{topic:'Interest',finding:'12% a year, simple, from the due date.',clause:'8.2',effect:'supports_charges'},{topic:'Late fee',finding:'$20 per invoice once 7 days overdue.',clause:'8.3',effect:'supports_charges'},{topic:'Recovery costs',finding:'Customer pays reasonable recovery costs.',clause:'9.1',effect:'supports_charges'},{topic:'Disputes',finding:'No process for raising a dispute about an invoice.',clause:'',effect:'missing'},{topic:'Suspending supply',finding:'Supply can be suspended while any amount is overdue.',clause:'10.2',effect:'neutral'}],
          _x:0};
        d.doc_text='5.1 Invoices are due 14 days after the invoice date. 8.2 Interest accrues on overdue amounts at 12% per annum calculated daily from the due date until paid. 8.3 A late payment fee of $20 applies to each invoice unpaid 7 days after the due date. 8.4 A $35 fee applies to any dishonoured payment. 8.5 An account administration fee of $15 may be charged once for each overdue account statement we send. 9.1 Reasonable costs of recovery.';
        d.review.interest.quote_found=true; d.review.fees.forEach(function(f){ f.quote_found=true; }); d.review.text_readable=true;
        if(o.body.focus) d.review.reread_focus=o.body.focus;
        d.reviewed_at=new Date().toISOString(); d.review_model='test'; d.kind='terms_of_trade';
        return Promise.resolve({data:{ok:true,document:d,model:'test'},error:null}); }
      if(name==='pay-links') return Promise.resolve({data:{ok:true,links:{i3109:'https://in.xero.com/abc123',i3108:'https://in.xero.com/def456'}},error:null});
      if(name==='xero-disconnect'){ window.__xeroDisconnected=true; return Promise.resolve({data:{ok:true,revoked:true},error:null}); }
      if(name==='draft-correspondence' && o && o.body && o.body.kind==='paragraph'){ return Promise.resolve({data:{ok:true,kind:'paragraph',draft:{text:'We are happy to agree a plan:\n- {{total_owing}} over three months\n- first payment by {{pay_by_date}}', note:'Check the dates suit you.'}},error:null}); }
      if(name==='draft-correspondence') return Promise.resolve({data:{ok:true,flags:[],draft:{line_notes:[{invoice_number:'INV-3110',note:'Disputed and under review; no payment is requested for it while we look into it.'},{invoice_number:'INV-3107',note:'Thanks for letting us know this was paid; please send the remittance so we can match it.'},{invoice_number:'INV-3108',note:'As discussed, we are happy to talk about a payment arrangement.'},{invoice_number:'INV-3109',note:''}],message:'Here is your account as at today.',internal_summary:'test'}},error:null});
      return Promise.resolve({data:{},error:null}); } }
  };
  window.supabase={createClient:function(){return client;}};
})();
