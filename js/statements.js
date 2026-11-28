/* DebtJet: statements.js
 * Account Statements: data, filters and the contact list.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- account statements ---------- */
  async function loadStatementsData(){
    var r = await sb.from('invoices')
      .select('id, debtor_id, case_id, invoice_number, description, amount, issued_date, due_date, status, source, external_id, pay_url, debtors(id,name,abn,contact_name,email,phone,legal_name,debtor_kind,address_line1,address_line2,suburb,state,postcode)')
      .eq('org_id', currentOrg.id).neq('status', 'written_off').order('due_date', { ascending: true });
    var invs = r.data || [];
    var invIds = invs.map(function(i){ return i.id; });
    var pay = invIds.length ? await sb.from('payments').select('invoice_id, amount, paid_at').eq('org_id', currentOrg.id).in('invoice_id', invIds) : { data: [] };
    var paysByInv = {};
    (pay.data || []).forEach(function(p){ (paysByInv[p.invoice_id] = paysByInv[p.invoice_id] || []).push(p); });
    var nt = invIds.length ? await sb.from('case_notes').select('invoice_id, category, summary, occurred_at').eq('org_id', currentOrg.id).in('invoice_id', invIds).order('occurred_at', { ascending: false }) : { data: [] };
    stmtNotesByInvoice = {};
    (nt.data || []).forEach(function(n){ if(!stmtNotesByInvoice[n.invoice_id]) stmtNotesByInvoice[n.invoice_id] = n; });
    var today = new Date();
    stmtInvoices = invs.map(function(i){
      var paidRows = paysByInv[i.id] || [];
      var paidSum = paidRows.reduce(function(s,p){ return s + Number(p.amount); }, 0);
      var fullyPaid = i.status === 'paid' || paidSum >= Number(i.amount) - 0.01;
      var lastPaidAt = paidRows.length ? paidRows.reduce(function(mx,p){ return p.paid_at > mx ? p.paid_at : mx; }, paidRows[0].paid_at) : null;
      var daysOverdue = daysPastDue(i.due_date);
      var isLate = fullyPaid ? (lastPaidAt ? String(lastPaidAt).slice(0,10) > String(i.due_date).slice(0,10) : false) : daysOverdue > 0;
      return {
        id: i.id, debtor_id: i.debtor_id, case_id: i.case_id, debtor: i.debtors || {},
        invoice_number: i.invoice_number, description: i.description, amount: Number(i.amount),
        issued_date: i.issued_date, due_date: i.due_date, status: i.status,
        fullyPaid: fullyPaid, isLate: isLate, daysOverdue: daysOverdue,
        paid: Math.round(paidSum * 100) / 100, source: i.source, external_id: i.external_id || null, pay_url: i.pay_url || null
      };
    });
    var dmap = {};
    stmtInvoices.forEach(function(i){
      if(!i.debtor_id) return;
      if(!dmap[i.debtor_id]) dmap[i.debtor_id] = { id: i.debtor_id, name: i.debtor.name, abn: i.debtor.abn, contact_name: i.debtor.contact_name, email: i.debtor.email, legal_name: i.debtor.legal_name, debtor_kind: i.debtor.debtor_kind,
        address: [i.debtor.address_line1, i.debtor.address_line2, [i.debtor.suburb, i.debtor.state, i.debtor.postcode].filter(Boolean).join(' ')].filter(function(x){ return x && String(x).trim(); }), invoices: [] };
      dmap[i.debtor_id].invoices.push(i);
    });
    // Collection stage per debtor: furthest letter sent on an open case, plus case status.
    var cs = await sb.from('cases').select('id, debtor_id, status').eq('org_id', currentOrg.id);
    var caseById = {};
    (cs.data || []).forEach(function(c){ caseById[c.id] = c; });
    var lt = await sb.from('letters').select('case_id, type, sent_at').eq('org_id', currentOrg.id).eq('status', 'sent');
    var LETTER_RANK = { reminder: 1, second_reminder: 1.5, first_demand: 2, final_demand: 3, pre_legal: 4 };
    Object.keys(dmap).forEach(function(k){ dmap[k].stage = null; dmap[k].stageAt = null; dmap[k].caseStatus = null; });
    (cs.data || []).forEach(function(c){
      var d = dmap[c.debtor_id]; if(!d || c.status === 'resolved') return;
      if(['debt_recovery','tribunal','payment_plan'].indexOf(c.status) >= 0) d.caseStatus = c.status;
    });
    (lt.data || []).forEach(function(l){
      var c = caseById[l.case_id]; if(!c || c.status === 'resolved') return;
      var d = dmap[c.debtor_id]; if(!d || !LETTER_RANK[l.type]) return;
      if(!d.stage || LETTER_RANK[l.type] > LETTER_RANK[d.stage] || (l.type === d.stage && l.sent_at > d.stageAt)){ d.stage = l.type; d.stageAt = l.sent_at; }
    });
    qfPeople = null;
    stmtDebtors = Object.keys(dmap).map(function(k){ return dmap[k]; }).sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    await loadContactGroups();
  }

  // Whole days an ISO date (YYYY-MM-DD) is past due, by the local calendar date. Negative = days until due.
  function daysPastDue(iso){
    if(!iso) return 0;
    var t = new Date(), p = String(iso).slice(0,10).split('-');
    return Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(+p[0], +p[1]-1, +p[2])) / 864e5);
  }

  var STMT_FILTERS = [
    { group: 'Balance', items: [
      ['open', 'All with a balance owing'],
      ['all', 'All contacts (including fully paid)'] ] },
    { group: 'Due date', items: [
      ['upcoming', 'Upcoming (not yet due)'],
      ['due_today', 'Due today'],
      ['due_tomorrow', 'Due tomorrow'],
      ['due_7', 'Due in the next 7 days'],
      ['overdue', 'Overdue (any)'],
      ['od_1_9', 'Overdue 1–9 days'],
      ['od_10', 'Overdue 10+ days'],
      ['od_30', 'Overdue 30+ days'],
      ['od_60', 'Overdue 60+ days'],
      ['od_90', 'Overdue 90+ days'] ] },
    { group: 'Collection stage', items: [
      ['stage_none', 'Overdue, no letter sent yet'],
      ['stage_reminder', 'Friendly reminder sent'],
      ['stage_second', 'Second reminder sent'],
      ['stage_first', 'First letter of demand sent'],
      ['stage_final', 'Final letter of demand sent'],
      ['stage_prelegal', 'Notice before legal action sent'],
      ['stage_recovery', 'Debt recovery / tribunal'],
      ['stage_plan', 'On a payment plan'] ] },
    { group: 'Debtor notes', items: [
      ['note_dispute', 'Dispute raised'],
      ['note_promise', 'Promise to pay'],
      ['note_plan', 'Asked for a payment plan'],
      ['note_hardship', 'Hardship'],
      ['note_paid', 'Says already paid'] ] }
  ];
  var NOTE_FILTER_CAT = { note_dispute: 'dispute', note_promise: 'promise_to_pay', note_plan: 'payment_plan_request', note_hardship: 'hardship', note_paid: 'payment_made' };
  var STAGE_FILTER = { stage_reminder: 'reminder', stage_second: 'second_reminder', stage_first: 'first_demand', stage_final: 'final_demand', stage_prelegal: 'pre_legal' };
  var STAGE_LABEL = { reminder: 'Reminder sent', second_reminder: 'Second reminder sent', first_demand: 'First demand sent', final_demand: 'Final demand sent', pre_legal: 'Pre-legal notice sent' };

  // Does this invoice match the filter? Contact-level filters (stage) match every open invoice of a matching contact.
  function invoiceMatchesFilter(inv, d, f){
    if(f === 'all') return true;
    if(inv.fullyPaid) return false;
    var od = inv.daysOverdue;
    switch(f){
      case 'open': return true;
      case 'upcoming': return od < 0;
      case 'due_today': return od === 0;
      case 'due_tomorrow': return od === -1;
      case 'due_7': return od <= 0 && od >= -7;
      case 'overdue': return od > 0;
      case 'od_1_9': return od >= 1 && od <= 9;
      case 'od_10': return od >= 10;
      case 'od_30': return od >= 30;
      case 'od_60': return od >= 60;
      case 'od_90': return od >= 90;
      case 'stage_none': return od > 0 && !d.stage && !d.caseStatus;
      case 'stage_recovery': return d.caseStatus === 'debt_recovery' || d.caseStatus === 'tribunal';
      case 'stage_plan': return d.caseStatus === 'payment_plan';
    }
    if(STAGE_FILTER[f]) return d.stage === STAGE_FILTER[f];
    if(NOTE_FILTER_CAT[f]){ var n = stmtNotesByInvoice[inv.id]; return !!n && n.category === NOTE_FILTER_CAT[f]; }
    return true;
  }
  function filterIsInvoiceLevel(f){ return f !== 'all' && f !== 'open' && !STAGE_FILTER[f] && f !== 'stage_recovery' && f !== 'stage_plan'; }

  // Same matching as Quick find: every word must appear in the name, legal name, contact, email,
  // contact people, group, or an invoice number; digits also match the ABN.
  function debtorMatchesSearch(d, q){
    if(!q || !q.trim()) return true;
    var digits = q.replace(/\D/g, '');
    if(digits.length >= 3 && /^[\d\s]+$/.test(q.trim()) && (d.abn || '').replace(/\D/g, '').indexOf(digits) >= 0) return true;
    var tokens = qfNorm(q).split(/\s+/).filter(Boolean);
    var hay = qfNorm([d.name, d.legal_name, d.contact_name, d.email].concat(
      (stmtGroupsOf[d.id] || []).map(function(gid){ var g = stmtGroups.filter(function(x){ return x.id === gid; })[0]; return g ? g.name : ''; }),
      (qfPeople || []).filter(function(p){ return p.debtor_id === d.id; }).map(function(p){ return [p.name, p.email].join(' '); }),
      d.invoices.map(function(i){ return i.invoice_number || ''; })).join(' '));
    return tokens.every(function(t){ return hay.indexOf(t) >= 0; });
  }

  function visibleStatementDebtors(){
    return stmtDebtors.filter(function(d){
      return debtorMatchesSearch(d, stmtSearch) && d.invoices.some(function(i){ return invoiceMatchesFilter(i, d, stmtFilter); });
    });
  }

  function renderStatementFilter(){
    var sel = document.getElementById('stmtFilter');
    sel.innerHTML = STMT_FILTERS.map(function(g){
      return '<optgroup label="'+escapeHtml(g.group)+'">'+g.items.map(function(it){
        var n = stmtDebtors.filter(function(d){ return d.invoices.some(function(i){ return invoiceMatchesFilter(i, d, it[0]); }); }).length;
        return '<option value="'+it[0]+'"'+(it[0]===stmtFilter?' selected':'')+'>'+escapeHtml(it[1])+' ('+n+')</option>';
      }).join('')+'</optgroup>';
    }).join('');
  }

  function invoiceDefaultChecked(inv){
    if(inv.fullyPaid) return false;
    if(!filterIsInvoiceLevel(stmtFilter)) return true;
    var d = stmtDebtors.filter(function(x){ return x.id === inv.debtor_id; })[0];
    return d ? invoiceMatchesFilter(inv, d, stmtFilter) : true;
  }
  function isInvoiceChecked(inv){ return stmtInvoiceOverride.hasOwnProperty(inv.id) ? stmtInvoiceOverride[inv.id] : invoiceDefaultChecked(inv); }

  function renderStatementContacts(){
    var list = document.getElementById('stmtContactList');
    renderStatementFilter();
    var shown = visibleStatementDebtors();
    var invLevel = filterIsInvoiceLevel(stmtFilter);
    var selCount = Object.keys(stmtSelectedDebtors).filter(function(k){ return stmtSelectedDebtors[k]; }).length;
    document.getElementById('stmtFilterCount').textContent = (stmtShowMode === 'none' && !stmtSearch ? stmtDebtors.length+' contacts · search to list them' : 'Showing '+shown.length+' of '+stmtDebtors.length+' contacts')+(selCount ? ' · '+selCount+' ticked' : '');
    document.getElementById('stmtClearSel').disabled = !selCount;
    if(stmtShowMode === 'ticked') shown = shown.filter(function(d){ return stmtSelectedDebtors[d.id]; });
    if(stmtShowMode === 'none' && !stmtSearch) shown = shown.filter(function(d){ return stmtSelectedDebtors[d.id] || (acctFocus && acctFocus.type === 'debtor' && acctFocus.id === d.id); });
    // Long lists start short: the first 12 plus anything ticked, with a button for the rest.
    var allCount = shown.length, cut = stmtShowMode === 'all' && !stmtShowAll && !stmtSearch && shown.length > 12;
    if(cut){ var first = shown.slice(0, 12); shown = first.concat(shown.slice(12).filter(function(d){ return stmtSelectedDebtors[d.id]; })); }
    var contactHtml = function(d, inGrp){
      var totalOwing = d.invoices.filter(function(i){ return !i.fullyPaid; }).reduce(function(s,i){ return s+i.amount; }, 0);
      var matchTotal = invLevel ? d.invoices.filter(function(i){ return invoiceMatchesFilter(i, d, stmtFilter); }).reduce(function(s,i){ return s+i.amount; }, 0) : null;
      var stageTag = (d.caseStatus === 'debt_recovery' || d.caseStatus === 'tribunal') ? '<span class="stage-tag recovery">'+escapeHtml(STATUS_LABEL[d.caseStatus])+'</span>'
        : d.caseStatus === 'payment_plan' ? '<span class="stage-tag plan">Payment plan</span>'
        : d.stage ? '<span class="stage-tag '+d.stage+'" title="Sent '+escapeHtml(fmt(d.stageAt))+'">'+STAGE_LABEL[d.stage]+' · '+Math.max(0, daysPastDue(String(d.stageAt).slice(0,10)))+'d ago</span>' : '';
      var checked = !!stmtSelectedDebtors[d.id];
      var rows = d.invoices.map(function(inv){
        var chk = isInvoiceChecked(inv);
        var note = stmtNotesByInvoice[inv.id];
        var noteHtml = note ? '<span class="debt-note" title="'+escapeHtml(note.summary)+'"><b>'+(NOTE_CATEGORY_LABEL[note.category]||'Note')+':</b> '+escapeHtml(note.summary)+'</span>' : '';
        var dim = invLevel && !invoiceMatchesFilter(inv, d, stmtFilter);
        var od = inv.daysOverdue;
        var when = inv.fullyPaid ? '' : od > 0 ? ' · <span class="od">'+od+' day'+(od===1?'':'s')+' overdue</span>' : od === 0 ? ' · <span class="od">Due today</span>' : od === -1 ? ' · Due tomorrow' : ' · due in '+(-od)+' days';
        return '<label class="debt-row'+(dim?' outside':'')+'"><input type="checkbox" class="inv-check" data-inv="'+inv.id+'" '+(chk?'checked':'')+' />'
          +'<span class="debt-main"><span class="debt-top"><b>'+escapeHtml(inv.invoice_number||'—')+'</b><span class="debt-desc">'+escapeHtml(inv.description||'')+'</span></span>'
          +'<span class="debt-due">Due '+fmt(inv.due_date)+when+(dim && !inv.fullyPaid ? ' · <span class="out-tag">outside this filter</span>' : '')+'</span>'+noteHtml+'</span>'
          +'<span class="debt-right"><span class="debt-amt">'+money(inv.amount)+'</span>'
          +'<span class="pill '+(inv.fullyPaid?'resolved':(inv.isLate?'escalated':'new'))+'">'+(inv.fullyPaid?'Paid':(inv.isLate?'Overdue':'Open'))+'</span></span></label>';
      }).join('');
      return '<div class="contact-group'+(checked?' sel':'')+(acctFocus && acctFocus.type === 'debtor' && acctFocus.id === d.id ? ' focus' : '')+'" data-cg="'+d.id+'">'
        +'<div class="contact-head" data-acct-head="'+d.id+'" tabindex="0" title="'+escapeHtml(d.name+' · '+d.invoices.length+' invoice'+(d.invoices.length===1?'':'s')+(acctLastSent()[d.id] ? ' · last statement sent '+fmt(acctLastSent()[d.id].sent_at) : ' · no statement sent yet')+'. Click to open the account.')+'">'
        +'<label class="ch-tick" title="Tick to put on the next statement"><input type="checkbox" class="contact-check" data-debtor="'+d.id+'" '+(checked?'checked':'')+' aria-label="Put '+escapeHtml(d.name)+' on the next statement" /></label>'
        +'<span class="contact-name"><span class="cn">'+escapeHtml(d.name)+'</span>'+stageTag+(acctLastSent()[d.id] ? '<span class="cn-sent" title="Last statement sent">✓ '+escapeHtml(fmtShort(acctLastSent()[d.id].sent_at))+'</span>' : '')+'</span>'
        +'<span class="contact-total"'+(matchTotal !== null ? ' title="'+escapeHtml(money(matchTotal)+' in this filter, of '+money(totalOwing)+' owing')+'"' : '')+'>'+money(matchTotal !== null ? matchTotal : totalOwing)+'</span>'
        +(inGrp ? '<button type="button" class="grp-rm" data-grp-rm="'+inGrp+'" data-did="'+d.id+'" title="Take out of this group" aria-label="Take '+escapeHtml(d.name)+' out of this group">✕</button>' : '')
        +'<button type="button" class="chev" data-toggle="'+d.id+'" aria-label="Show invoices" title="Show invoices">'+(checked?'▴':'▾')+'</button></div>'
        +'<div class="contact-invoices" id="inv-'+d.id+'" '+(checked?'':'hidden')+'><div class="ci-tools"><button type="button" class="linkbtn" data-inv-all="'+d.id+'">Tick all</button><button type="button" class="linkbtn" data-inv-none="'+d.id+'">Untick all</button></div>'+rows+'</div>'
        +'</div>';
    };
    var body;
    if(stmtShowMode === 'groups'){
      var used = {};
      body = stmtGroups.map(function(g){
        var mem = shown.filter(function(d){ return (stmtGroupsOf[d.id] || []).indexOf(g.id) >= 0; }); if(!mem.length) return '';
        mem.forEach(function(d){ used[d.id] = true; });
        return '<div class="grp-block'+(acctFocus && acctFocus.type === 'group' && acctFocus.id === g.id ? ' focus' : '')+'"><div class="grp-head"><b>'+escapeHtml(g.name)+'</b>'+(g.xero_group_id ? '<span class="grp-x" title="Contact group in Xero">Xero</span>' : '')+'<span class="grp-n">'+mem.length+' contact'+(mem.length === 1 ? '' : 's')+'</span>'
          +'<button type="button" class="linkbtn" data-acct-grp="'+g.id+'">Open account</button><button type="button" class="linkbtn" data-grp-tick="'+g.id+'">Tick group</button>'+(g.xero_group_id ? '' : (xeroConnected ? '<button type="button" class="linkbtn" data-grp-push="'+g.id+'" title="Create this group in Xero with its contacts">Add to Xero</button>' : '') + '<button type="button" class="linkbtn" data-grp-rename="'+g.id+'">Rename</button><button type="button" class="linkbtn" data-grp-del="'+g.id+'">Delete</button>')+'</div>'
          + mem.map(function(d){ return contactHtml(d, g.id); }).join('') + '</div>';
      }).join('');
      var rest = shown.filter(function(d){ return !used[d.id]; });
      if(rest.length) body += '<div class="grp-block"><div class="grp-head"><b>Not in a group</b><span class="grp-n">'+rest.length+'</span></div>' + rest.map(contactHtml).join('') + '</div>';
    } else body = shown.map(contactHtml).join('');
    list.innerHTML = (shown.length ? body + (cut ? '<button type="button" class="btn sm stmt-more" id="stmtShowAllBtn">Show all '+allCount+' contacts</button>' : (stmtShowAll && allCount > 12 && !stmtSearch ? '<button type="button" class="btn sm ghost stmt-more" id="stmtShowAllBtn" data-less="1">Show fewer</button>' : '')) : (stmtDebtors.length ? '<div class="empty-note">No contacts match this filter.</div>' : '<div class="empty-note">No debtors with invoices yet. Import data above, or add debtors under Debtors &amp; Cases, to get started.</div>'));
    if(!shown.length && stmtShowMode === 'none' && !stmtSearch && stmtDebtors.length) list.innerHTML = '<div class="empty-note">Search for a contact above, or pick one from All accounts. Click a contact to open its account; tick it to put it on a statement.</div>';
    var moreBtn = document.getElementById('stmtShowAllBtn');
    if(moreBtn) moreBtn.addEventListener('click', function(){ stmtShowAll = !this.hasAttribute('data-less'); renderStatementContacts(); });
    Array.prototype.forEach.call(list.querySelectorAll('.contact-check'), function(cb){
      cb.addEventListener('change', async function(){
        var id = this.getAttribute('data-debtor'), on = this.checked;
        if(on){
          var others = Object.keys(stmtSelectedDebtors).filter(function(k){ return stmtSelectedDebtors[k] && k !== id; });
          var unrelated = others.filter(function(o){ return !contactsRelated(o, id); });
          if(others.length && unrelated.length){
            var nm = function(x){ var d = stmtDebtors.filter(function(y){ return y.id === x; })[0]; return d ? d.name : 'this contact'; };
            var pick = await djAsk(nm(id) + ' isn’t grouped with ' + nm(unrelated[0]) + (unrelated.length > 1 ? ' and ' + (unrelated.length - 1) + ' other' + (unrelated.length > 2 ? 's' : '') : '') + '.\n\nOne statement should only combine contacts from the same business. Put them in a contact group to merge them, or start a new statement with ' + nm(id) + '.',
              { choices: [{ label: 'Start a new statement', value: 'new' }, { label: 'Group them', value: 'group' }] });
            if(!pick){ this.checked = false; return; }
            if(pick === 'new'){ stmtSelectedDebtors = {}; stmtInvoiceOverride = {}; }
            if(pick === 'group'){ var ok = await groupContacts(others.concat([id])); if(!ok){ this.checked = false; return; } }
          }
        }
        stmtSelectedDebtors[id] = on;
        renderStatementContacts();
      });
    });
    Array.prototype.forEach.call(list.querySelectorAll('.inv-check'), function(cb){
      cb.addEventListener('change', function(){
        stmtInvoiceOverride[this.getAttribute('data-inv')] = this.checked;
        renderStatementPreview();
      });
    });
    list.onclick = async function(e){
      var t = e.target.closest('button'); if(!t) return;
      var setAll = function(did, val){ var d = stmtDebtors.filter(function(x){ return x.id === did; })[0]; if(!d) return; d.invoices.forEach(function(i){ if(!i.fullyPaid) stmtInvoiceOverride[i.id] = val; }); };
      if(t.hasAttribute('data-inv-all')){ e.preventDefault(); setAll(t.getAttribute('data-inv-all'), true); renderStatementContacts(); return; }
      if(t.hasAttribute('data-inv-none')){ e.preventDefault(); setAll(t.getAttribute('data-inv-none'), false); renderStatementContacts(); return; }
      if(t.hasAttribute('data-grp-tick')){
        var gid = t.getAttribute('data-grp-tick'), mem = stmtDebtors.filter(function(d){ return (stmtGroupsOf[d.id] || []).indexOf(gid) >= 0; });
        var others = Object.keys(stmtSelectedDebtors).filter(function(k){ return stmtSelectedDebtors[k] && !mem.some(function(d){ return d.id === k; }); });
        if(others.length){ stmtSelectedDebtors = {}; stmtInvoiceOverride = {}; }
        mem.forEach(function(d){ stmtSelectedDebtors[d.id] = true; }); renderStatementContacts(); return;
      }
      if(t.hasAttribute('data-grp-rm')){
        e.preventDefault(); e.stopPropagation();
        var rg = stmtGroups.filter(function(x){ return x.id === t.getAttribute('data-grp-rm'); })[0], rd = stmtDebtors.filter(function(x){ return x.id === t.getAttribute('data-did'); })[0];
        if(!rg || !rd) return;
        if(!await djAsk('Take ' + rd.name + ' out of “' + rg.name + '”?' + (rg.xero_group_id ? '\n\nThis group comes from Xero, so it changes in Xero too.' : ''), { ok: 'Take out' })) return;
        if(await groupMemberChange('remove', rg.id, rd.id)) renderStatementContacts();
        return;
      }
      if(t.hasAttribute('data-grp-push')){ if(await groupPushToXero(t.getAttribute('data-grp-push'))) renderStatementContacts(); return; }
      if(t.hasAttribute('data-grp-rename')){
        var g = stmtGroups.filter(function(x){ return x.id === t.getAttribute('data-grp-rename'); })[0]; if(!g) return;
        var nn = await djAsk('Rename this contact group', { input: g.name, inputLabel: 'Group name', ok: 'Rename' }); if(!nn) return;
        var r = await sb.from('contact_groups').update({ name: nn.slice(0, 80), updated_at: new Date().toISOString() }).eq('id', g.id); if(r.error){ toast(r.error.message); return; }
        g.name = nn.slice(0, 80); renderStatementContacts(); return;
      }
      if(t.hasAttribute('data-grp-del')){
        var g2 = stmtGroups.filter(function(x){ return x.id === t.getAttribute('data-grp-del'); })[0]; if(!g2) return;
        if(!await djAsk('Delete the group “' + g2.name + '”?\n\nThe contacts stay; they just aren’t grouped any more.', { ok: 'Delete' })) return;
        var r2 = await sb.from('contact_groups').delete().eq('id', g2.id); if(r2.error){ toast(r2.error.message); return; }
        await loadContactGroups(); renderStatementContacts(); toast('Group deleted.'); return;
      }
    };
    Array.prototype.forEach.call(list.querySelectorAll('[data-toggle]'), function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var panel = document.getElementById('inv-'+this.getAttribute('data-toggle'));
        panel.hidden = !panel.hidden;
        this.textContent = panel.hidden ? '▾' : '▴';
      });
    });
    renderStatementPreview();
  }

  // Contact groups: contacts that belong to the same business. Statements only merge related contacts.
  async function loadContactGroups(){
    var g = await sb.from('contact_groups').select('id, name, xero_group_id').eq('org_id', currentOrg.id).order('name');
    var m = await sb.from('contact_group_members').select('group_id, debtor_id').eq('org_id', currentOrg.id);
    stmtGroups = g.error ? [] : (g.data || []); stmtGroupsOf = {};
    (m.data || []).forEach(function(x){ (stmtGroupsOf[x.debtor_id] = stmtGroupsOf[x.debtor_id] || []).push(x.group_id); });
  }
  function contactsRelated(a, b){
    var ga = stmtGroupsOf[a] || [], gb = stmtGroupsOf[b] || [];
    if(ga.some(function(x){ return gb.indexOf(x) >= 0; })) return true;
    var da = stmtDebtors.filter(function(x){ return x.id === a; })[0], db = stmtDebtors.filter(function(x){ return x.id === b; })[0];
    return !!(da && db && da.abn && da.abn === db.abn);
  }
  async function groupContacts(ids){
    var first = stmtDebtors.filter(function(x){ return x.id === ids[0]; })[0];
    var name = await djAsk('Name the new contact group', { input: first ? first.name : '', inputLabel: 'Group name (for example the business that owns these accounts)', ok: 'Create group' });
    if(!name) return false;
    var g = await sb.from('contact_groups').insert({ org_id: currentOrg.id, name: name.slice(0, 80) }).select('id').maybeSingle();
    if(g.error || !g.data){ toast('Could not create the group: ' + ((g.error && g.error.message) || 'unknown error')); return false; }
    var r = await sb.from('contact_group_members').insert(ids.map(function(id){ return { group_id: g.data.id, debtor_id: id, org_id: currentOrg.id }; }));
    if(r.error){ toast('Could not add contacts to the group: ' + r.error.message); return false; }
    await loadContactGroups(); toast('Group “' + name.slice(0, 80) + '” created.');
    return true;
  }
  // Add or take a contact out of a group. Groups linked to Xero change in Xero first (xero-groups), since sync follows Xero.
  async function groupMemberChange(action, gid, did){
    var g = stmtGroups.filter(function(x){ return x.id === gid; })[0]; if(!g) return false;
    if(g.xero_group_id){
      var r = await sb.functions.invoke('xero-groups', { body: { org_id: currentOrg.id, action: action, group_id: gid, debtor_id: did } });
      var d = r.data || {};
      if(r.error || !d.ok){ toast(d.error || 'Could not change the group in Xero. Please try again.'); return false; }
    } else if(action === 'add'){
      var a = await sb.from('contact_group_members').upsert({ group_id: gid, debtor_id: did, org_id: currentOrg.id }, { onConflict: 'group_id,debtor_id' });
      if(a.error){ toast('Could not add to the group: ' + a.error.message); return false; }
    } else {
      var x = await sb.from('contact_group_members').delete().eq('group_id', gid).eq('debtor_id', did);
      if(x.error){ toast('Could not take it out of the group: ' + x.error.message); return false; }
    }
    await loadContactGroups();
    var who = (stmtDebtors.filter(function(y){ return y.id === did; })[0] || {}).name || 'The contact';
    toast(who + (action === 'add' ? ' added to “' : ' taken out of “') + g.name + '”' + (g.xero_group_id ? ', in Xero too.' : '.'));
    return true;
  }
  // Create a DebtJet-made group in Xero, with its Xero contacts, and link it.
  async function groupPushToXero(gid){
    var g = stmtGroups.filter(function(x){ return x.id === gid; })[0]; if(!g || g.xero_group_id) return false;
    if(!await djAsk('Add “' + g.name + '” to Xero as a contact group?\n\nIts contacts from Xero are added to the group in Xero. After that, the group follows Xero: change its members here or in Xero.', { ok: 'Add to Xero' })) return false;
    var r = await sb.functions.invoke('xero-groups', { body: { org_id: currentOrg.id, action: 'push', group_id: gid } });
    var d = r.data || {};
    if(r.error || !d.ok){ toast(d.error || 'Could not add the group to Xero. Please try again.'); return false; }
    await loadContactGroups();
    if((d.not_in_xero || []).length) await djAsk('“' + g.name + '” is now in Xero with ' + d.added + ' contact' + (d.added === 1 ? '' : 's') + '.\n\nNot in Xero, so not in the Xero group: ' + d.not_in_xero.join(', ') + '. They’ll drop out of this group at the next Xero sync.', { cancel: false, ok: 'OK' });
    else toast('“' + g.name + '” is now a contact group in Xero.');
    return true;
  }
  function selectedStatementItems(){
    var debtorIds = Object.keys(stmtSelectedDebtors).filter(function(id){ return stmtSelectedDebtors[id]; });
    var items = [];
    debtorIds.forEach(function(id){
      var d = stmtDebtors.filter(function(x){ return x.id===id; })[0]; if(!d) return;
      d.invoices.forEach(function(inv){ if(isInvoiceChecked(inv)) items.push(Object.assign({ debtor_name: d.name }, inv)); });
    });
    items.sort(function(a,b){ return new Date(a.due_date) - new Date(b.due_date); });
    return { debtorIds: debtorIds, items: items };
  }

  function lateMetrics(debtorIds){
    var cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-3);
    var pool = [];
    debtorIds.forEach(function(id){
      var d = stmtDebtors.filter(function(x){ return x.id===id; })[0]; if(!d) return;
      d.invoices.forEach(function(inv){ if(new Date(inv.due_date) >= cutoff) pool.push(inv); });
    });
    return {
      total: pool.length,
      lateCount: pool.filter(function(i){ return i.isLate; }).length,
      lateValue: pool.filter(function(i){ return i.isLate; }).reduce(function(s,i){ return s+i.amount; }, 0),
      totalValue: pool.reduce(function(s,i){ return s+i.amount; }, 0)
    };
  }

