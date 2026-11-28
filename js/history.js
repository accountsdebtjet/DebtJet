/* DebtJet: history.js
 * History & correspondence panel, and the Account Statements tabs.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- History & correspondence panel (Account Statements + Letters of Demand) ---------- */
  var HIST_CHANNEL = { email:'Email', phone:'Phone call', sms:'SMS', letter:'Letter', meeting:'Meeting', portal:'Debtor portal', other:'Other' };
  var HIST_ICON = { email:'✉', phone:'☎', sms:'💬', letter:'📄', meeting:'👥', portal:'🌐', other:'•', note:'📝', charge:'%', statement:'🧾', event:'•' };
  var histState = {};   // per panel: { debtorIds, items, filter, limit, loading, key }
  var corrLogMissing = false;
  function histPrefOpen(panel){ try { var v = localStorage.getItem('dj.hist.' + panel); return v === null ? true : v === '1'; } catch(e){ return true; } }
  function histSavePref(panel, open){ try { localStorage.setItem('dj.hist.' + panel, open ? '1' : '0'); } catch(e){} }
  function initHistoryPanel(panel){
    var el = document.getElementById('hist-' + panel);
    el.open = histPrefOpen(panel);
    el.addEventListener('toggle', function(){ histSavePref(panel, el.open); if(el.open) loadHistory(panel, (histState[panel] || {}).debtorIds || [], true); });
    el.addEventListener('click', function(e){
      var f = e.target.getAttribute('data-hfilter');
      if(f){ histState[panel].filter = f; renderHistory(panel); return; }
      if(e.target.getAttribute('data-hmore')){ histState[panel].limit += 40; renderHistory(panel); return; }
      if(e.target.getAttribute('data-hlog')){ toggleLogForm(panel, true); return; }
      if(e.target.getAttribute('data-hcancel')){ toggleLogForm(panel, false); return; }
      if(e.target.getAttribute('data-hsave')){ saveLogEntry(panel); return; }
      var del = e.target.getAttribute('data-hdel'); if(del){ deleteLogEntry(panel, del); }
    });
    el.addEventListener('change', function(e){
      if(e.target.getAttribute('data-hf') === 'direction'){
        var c = el.querySelector('[data-hf="counts"]'); if(c) c.checked = e.target.value === 'out';
      }
    });
  }
  function setHistoryDebtors(panel, debtorIds){
    var st = histState[panel] = histState[panel] || { filter: 'all', limit: 40, items: [], debtorIds: [] };
    var key = debtorIds.slice().sort().join(',');
    if(st.key === key) return;
    st.key = key; st.debtorIds = debtorIds.slice(); st.limit = 40;
    var names = debtorIds.map(function(id){ var d = stmtDebtors.filter(function(x){ return x.id === id; })[0] || (cases.filter(function(c){ return c.debtor.id === id; })[0] || {}).debtor; return d ? d.name : ''; }).filter(Boolean);
    document.querySelector('#hist-' + panel + ' .hist-who').textContent = names.length ? '· ' + names.join(' + ') : '';
    if(document.getElementById('hist-' + panel).open) loadHistory(panel, debtorIds); else { st.items = []; renderHistory(panel); }
  }
  async function loadHistory(panel, debtorIds, force){
    var st = histState[panel] = histState[panel] || { filter: 'all', limit: 40, items: [], debtorIds: debtorIds };
    if(!debtorIds.length){ st.items = []; renderHistory(panel); return; }
    if(st.loadedKey === st.key && !force && st.items.length) { renderHistory(panel); return; }
    var myKey = st.key; st.loading = true; renderHistory(panel);
    var cs = await sb.from('cases').select('id, debtor_id').in('debtor_id', debtorIds);
    var caseIds = (cs.data || []).map(function(c){ return c.id; });
    var caseDebtor = {}; (cs.data || []).forEach(function(c){ caseDebtor[c.id] = c.debtor_id; });
    var none = Promise.resolve({ data: [] });
    var res = await Promise.all([
      sb.from('case_notes').select('id, debtor_id, case_id, invoice_id, category, summary, source, email_subject, email_from, occurred_at').in('debtor_id', debtorIds).order('occurred_at', { ascending: false }).limit(200),
      caseIds.length ? sb.from('letters').select('id, case_id, type, subject, send_via, status, sent_at, created_at').in('case_id', caseIds).limit(200) : none,
      caseIds.length ? sb.from('case_events').select('id, case_id, event_type, title, body, occurred_at').in('case_id', caseIds).limit(200) : none,
      sb.from('statements').select('id, title, recipient_name, total_amount, generated_at, debtor_ids, totals, status, sent_at, sent_via, sent_to').overlaps('debtor_ids', debtorIds).limit(100),
      sb.from('correspondence_log').select('*').in('debtor_id', debtorIds).order('occurred_at', { ascending: false }).limit(200)
    ]);
    if(st.key !== myKey) return;   // selection changed while loading
    corrLogMissing = !!(res[4].error && /correspondence_log/.test(res[4].error.message || ''));
    var invNo = {}; stmtInvoices.forEach(function(i){ invNo[i.id] = i.invoice_number; });
    var items = [];
    (res[0].data || []).forEach(function(n){
      var viaEmail = n.source !== 'manual';
      items.push({ at: n.occurred_at, dir: viaEmail ? 'in' : 'internal', kind: viaEmail ? 'email' : 'note', debtor: n.debtor_id,
        title: (viaEmail ? 'Email received' : 'Note') + ' · ' + (NOTE_CATEGORY_LABEL[n.category] || 'Note'),
        body: n.summary, sub: n.email_subject ? 'Subject: ' + n.email_subject : '', inv: n.invoice_id ? invNo[n.invoice_id] : null, tone: NOTE_TONE[n.category] || '' });
    });
    (res[1].data || []).forEach(function(l){
      items.push({ at: l.sent_at || l.created_at, dir: 'out', kind: 'letter', debtor: caseDebtor[l.case_id], contact: l.status === 'sent',
        title: (TPL_LABEL[l.type] || 'Letter') + (l.status === 'sent' ? ' sent' : ' (' + l.status + ')'), body: l.subject || '', sub: l.send_via ? 'Sent via ' + l.send_via : '' });
    });
    (res[2].data || []).forEach(function(e){
      if(e.event_type === 'letter_sent') return;  // already shown from letters
      var portal = /^portal_/.test(e.event_type);
      items.push({ at: e.occurred_at, dir: portal ? 'in' : 'internal', kind: portal ? 'portal' : 'event', debtor: caseDebtor[e.case_id], title: e.title, body: e.body || '' });
    });
    (res[3].data || []).forEach(function(s){
      items.push({ at: s.generated_at, dir: 'internal', kind: 'statement', title: 'Statement prepared' + (s.totals && s.totals.number ? ' · ' + s.totals.number : ''), body: s.recipient_name + ' · amount due ' + money(s.total_amount) });
      if(s.status === 'sent' && s.sent_at) items.push({ at: s.sent_at, dir: 'out', kind: 'statement', title: 'Statement sent' + (s.totals && s.totals.number ? ' · ' + s.totals.number : '') + (s.sent_via ? ' · ' + (SENT_VIA[s.sent_via] || s.sent_via) : ''), body: s.recipient_name + (s.sent_to ? ' · to ' + s.sent_to : '') + ' · amount due ' + money(s.total_amount) });
    });
    (res[4].data || []).forEach(function(c){
      items.push({ id: c.id, at: c.occurred_at, dir: c.direction, kind: c.channel, debtor: c.debtor_id, contact: c.direction === 'out' && c.counts_as_contact, logged: true,
        title: (c.direction === 'in' ? 'Received' : c.direction === 'out' ? 'Sent' : 'Internal') + ' · ' + (HIST_CHANNEL[c.channel] || c.channel) + (c.subject ? ' · ' + c.subject : ''), body: c.summary, inv: c.invoice_id ? invNo[c.invoice_id] : null, mine: c.created_by === session.user.id });
    });
    Object.keys(chargeDecisions).forEach(function(invId){
      var inv = stmtInvoices.filter(function(i){ return i.id === invId; })[0]; if(!inv || debtorIds.indexOf(inv.debtor_id) < 0) return;
      var d = chargeDecisions[invId];
      items.push({ at: d.decided_at, dir: 'internal', kind: 'charge', debtor: inv.debtor_id, title: d.decision === 'waive' ? 'Interest & fees waived' : 'Interest & fees approved', body: d.reason || '', inv: inv.invoice_number });
    });
    items.sort(function(a, b){ return String(b.at).localeCompare(String(a.at)); });
    st.items = items; st.loading = false; st.loadedKey = myKey;
    renderHistory(panel);
  }
  function contactCounts(items){
    var now = Date.now(), wk = 0, mo = 0;
    items.forEach(function(i){ if(!i.contact) return; var age = now - new Date(i.at).getTime(); if(age < 7 * 864e5) wk++; if(age < 30 * 864e5) mo++; });
    return { wk: wk, mo: mo };
  }
  function renderHistory(panel){
    var st = histState[panel] || { items: [], filter: 'all', limit: 40, debtorIds: [] };
    var el = document.getElementById('hist-' + panel);
    var body = el.querySelector('.hist-body');
    if(!st.debtorIds || !st.debtorIds.length){ body.innerHTML = '<div class="empty-note">' + (panel === 'stmt' ? 'Select a contact to see its history.' : 'Choose a case to see its history.') + '</div>'; el.querySelector('.hist-count').textContent = ''; return; }
    if(st.loading){ body.innerHTML = '<div class="empty-note">Loading history…</div>'; return; }
    var cc = contactCounts(st.items);
    var over = cc.wk >= 3 || cc.mo >= 10;
    el.querySelector('.hist-count').innerHTML = '<span class="hist-contacts'+(over ? ' over' : '')+'" title="ACCC/ASIC Debt collection guideline: no more than 3 contacts a week or 10 a month">Contacts: '+cc.wk+' in 7 days · '+cc.mo+' in 30 days</span>';
    var f = st.filter;
    var shown = st.items.filter(function(i){ return f === 'all' || (f === 'in' && i.dir === 'in') || (f === 'out' && i.dir === 'out') || (f === 'internal' && i.dir === 'internal'); });
    var multi = st.debtorIds.length > 1;
    var dname = function(id){ var d = stmtDebtors.filter(function(x){ return x.id === id; })[0]; return d ? d.name : ''; };
    var chips = [['all','All'],['in','Received'],['out','Sent'],['internal','Internal']].map(function(c){
      var n = c[0] === 'all' ? st.items.length : st.items.filter(function(i){ return i.dir === c[0]; }).length;
      return '<button type="button" class="chip'+(f === c[0] ? ' on' : '')+'" data-hfilter="'+c[0]+'">'+c[1]+' ('+n+')</button>';
    }).join('');
    var lastDay = '';
    var list = shown.slice(0, st.limit).map(function(i){
      var day = new Date(i.at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      var head = day !== lastDay ? '<div class="hist-day">'+escapeHtml(day)+'</div>' : ''; lastDay = day;
      return head + '<div class="hist-item '+i.dir+(i.tone ? ' tone-' + i.tone : '')+'">'
        + '<span class="hist-ico" aria-hidden="true">'+(HIST_ICON[i.kind] || '•')+'</span>'
        + '<div class="hist-main"><div class="hist-title">'+escapeHtml(i.title)
        +   (i.inv ? ' <span class="hist-inv">'+escapeHtml(i.inv)+'</span>' : '')
        +   (multi && i.debtor ? ' <span class="hist-sub">· '+escapeHtml(dname(i.debtor))+'</span>' : '')
        +   (i.contact ? ' <span class="hist-tag">counts as contact</span>' : '') + '</div>'
        +   (i.body ? '<div class="hist-text">'+escapeHtml(i.body)+'</div>' : '')
        +   (i.sub ? '<div class="hist-sub">'+escapeHtml(i.sub)+'</div>' : '') + '</div>'
        + '<span class="hist-time">'+escapeHtml(new Date(i.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }))
        +   (i.logged && i.mine ? '<button type="button" class="linkbtn" data-hdel="'+escapeHtml(i.id)+'" title="Delete this entry">Delete</button>' : '') + '</span></div>';
    }).join('');
    body.innerHTML = '<div class="hist-tools"><div class="hist-chips">'+chips+'</div>'
      + '<button type="button" class="btn sm" data-hlog="1"'+(corrLogMissing ? ' disabled title="Needs the correspondence_log database update"' : '')+'>+ Log correspondence</button></div>'
      + '<div class="hist-form" hidden></div>'
      + (corrLogMissing ? '<div class="fine">Logging calls and letters by hand switches on once the correspondence_log database update is approved.</div>' : '')
      + (shown.length ? '<div class="hist-list">'+list+'</div>' : '<div class="empty-note">Nothing here yet.</div>')
      + (shown.length > st.limit ? '<button type="button" class="linkbtn" data-hmore="1">Show more ('+(shown.length - st.limit)+')</button>' : '');
  }
  function toggleLogForm(panel, open){
    var el = document.getElementById('hist-' + panel), form = el.querySelector('.hist-form');
    if(!open){ form.hidden = true; form.innerHTML = ''; return; }
    var st = histState[panel];
    var invs = stmtInvoices.filter(function(i){ return st.debtorIds.indexOf(i.debtor_id) >= 0 && !i.fullyPaid; });
    var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    form.innerHTML = '<div class="form-grid">'
      + (st.debtorIds.length > 1 ? '<label>Contact<select data-hf="debtor">'+st.debtorIds.map(function(id){ var d = stmtDebtors.filter(function(x){ return x.id === id; })[0]; return '<option value="'+escapeHtml(id)+'">'+escapeHtml(d ? d.name : id)+'</option>'; }).join('')+'</select></label>' : '')
      + '<label>Direction<select data-hf="direction"><option value="in">Received from the debtor</option><option value="out">Sent to the debtor</option><option value="internal">Internal note</option></select></label>'
      + '<label>Channel<select data-hf="channel">'+Object.keys(HIST_CHANNEL).map(function(k){ return '<option value="'+k+'">'+HIST_CHANNEL[k]+'</option>'; }).join('')+'</select></label>'
      + '<label>When<input type="datetime-local" data-hf="at" value="'+now.toISOString().slice(0, 16)+'" /></label>'
      + '<label>Invoice (optional)<select data-hf="invoice"><option value="">—</option>'+invs.map(function(i){ return '<option value="'+escapeHtml(i.id)+'">'+escapeHtml(i.invoice_number || '—')+' · '+money(i.amount)+'</option>'; }).join('')+'</select></label>'
      + '<label class="span2">Subject (optional)<input data-hf="subject" maxlength="200" /></label>'
      + '<label class="span2">What was said<textarea data-hf="summary" rows="3" maxlength="2000" placeholder="e.g. Spoke to Catherine; she will pay INV-3109 on Friday."></textarea></label>'
      + '<label class="span2 inline-check"><input type="checkbox" data-hf="counts" /> Counts as a contact for the ACCC/ASIC limits (3 a week, 10 a month)</label>'
      + '</div><div class="send-row"><button type="button" class="btn sm primary" data-hsave="1">Save to history</button><button type="button" class="btn sm ghost" data-hcancel="1">Cancel</button></div>';
    form.hidden = false;
    form.querySelector('[data-hf="summary"]').focus();
  }
  async function saveLogEntry(panel){
    var el = document.getElementById('hist-' + panel), st = histState[panel];
    var v = function(k){ var x = el.querySelector('[data-hf="'+k+'"]'); return x ? (x.type === 'checkbox' ? x.checked : x.value.trim()) : null; };
    if(!v('summary')){ toast('Add a short summary of what was said.'); return; }
    var debtorId = v('debtor') || st.debtorIds[0];
    var invId = v('invoice') || null;
    var inv = invId ? stmtInvoices.filter(function(i){ return i.id === invId; })[0] : null;
    var caseRow = inv ? { id: inv.case_id } : cases.filter(function(c){ return c.debtor.id === debtorId; })[0];
    var row = { org_id: currentOrg.id, debtor_id: debtorId, case_id: caseRow ? caseRow.id : null, invoice_id: invId,
      direction: v('direction'), channel: v('channel'), occurred_at: v('at') ? new Date(v('at')).toISOString() : new Date().toISOString(),
      subject: v('subject') || null, summary: v('summary'), counts_as_contact: !!v('counts') };
    var r = await sb.from('correspondence_log').insert(row);
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    toggleLogForm(panel, false);
    toast('Added to history.');
    Object.keys(histState).forEach(function(p){ histState[p].loadedKey = null; });
    loadHistory(panel, st.debtorIds, true);
  }
  async function deleteLogEntry(panel, id){
    if(!await djAsk('Delete this history entry?')) return;
    var r = await sb.from('correspondence_log').delete().eq('id', id);
    if(r.error){ toast('Could not delete: ' + r.error.message); return; }
    loadHistory(panel, histState[panel].debtorIds, true);
  }
  /* ---------- Account Statements tabs ---------- */
  var stmtTab = 'contacts';
  function setStmtTab(t, keepPaper){
    stmtTab = t; if(curView === 'statements') setTimeout(shellRefresh, 0);
    Array.prototype.forEach.call(document.querySelectorAll('[data-stab]'), function(b){ var on = b.getAttribute('data-stab') === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-stab-panel]'), function(p){ p.hidden = p.getAttribute('data-stab-panel') !== t; });
    var slot = document.querySelector('.stmt-paper-slot[data-slot="' + (t === 'templates' ? 'templates' : 'statement') + '"]');
    if(slot){ slot.appendChild(document.getElementById('stmtWarn')); slot.appendChild(document.getElementById('statementPaper')); }
    if(!keepPaper && (t === 'statement' || t === 'templates')) renderStatementPreview();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-stab]'), function(b){ b.addEventListener('click', function(){ setStmtTab(this.getAttribute('data-stab')); }); });

  function sampleStatementModel(){
    function iso(days){ return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); }
    var items = [
      { debtor_name: 'Sample Customer Pty Ltd', invoice_number: 'INV-1001', description: 'Website build, stage 2: design of the home, about and services pages, CMS set-up, two rounds of revisions and launch support', issued_date: iso(-75), due_date: iso(-45), amount: 1650, paid: 0, balance: 1650, daysOverdue: 45, interest: 0, fees: 0, feeLines: [], disputed: false, fullyPaid: false, note: '', pay_url: null },
      { debtor_name: 'Sample Customer Pty Ltd', invoice_number: 'INV-1002', description: 'Monthly support', issued_date: iso(-40), due_date: iso(-10), amount: 440, paid: 200, balance: 240, daysOverdue: 10, interest: 0, fees: 0, feeLines: [], disputed: false, fullyPaid: false, note: '', pay_url: null },
      { debtor_name: 'Sample Customer Pty Ltd', invoice_number: 'INV-1003', description: 'Hosting renewal', issued_date: iso(-5), due_date: iso(25), amount: 330, paid: 0, balance: 330, daysOverdue: -25, interest: 0, fees: 0, feeLines: [], disputed: false, fullyPaid: false, note: '', pay_url: null }
    ];
    items.forEach(function(i){ i.status = statusLabel(i); });
    var m = {
      items: items, totals: { balance: 2220, interest: 0, fees: 0, statement_fees: [], overdue: 1890, disputed: 0, due: 2220 },
      ageing: { current: 330, d1_30: 240, d31_60: 1650, d61_90: 0, d90: 0 }, debtorIds: [], multi: false,
      recipient: 'Sample Customer Pty Ltd', date: new Date().toISOString(), number: 'ST-SAMPLE', cover: '', late: null,
      payment: orgPayment ? { account_name: orgPayment.account_name, bsb: orgPayment.bsb, account_number: orgPayment.account_number, bank_name: orgPayment.bank_name,
        payid: orgPayment.payid, payid_type: orgPayment.payid_type, bpay_biller_code: orgPayment.bpay_biller_code,
        show_bank: orgPayment.show_bank, show_payid: orgPayment.show_payid, show_bpay: orgPayment.show_bpay,
        online_provider: orgPayment.online_provider, instructions: orgPayment.instructions } : null,
      charges: null
    };
    try { m.reference = paymentReference(m); } catch(e){ m.reference = m.number; }
    return m;
  }
  function renderStmtSelection(sel, m){
    var badge = document.getElementById('stabCount');
    badge.hidden = !sel.debtorIds.length; badge.textContent = sel.debtorIds.length;
    var box = document.getElementById('stmtSelCard');
    if(!sel.items.length){ box.innerHTML = '<p class="muted small">Tick one or more contacts, then the invoices to include. Ticking several contacts merges them into one statement.</p>'; return; }
    var names = sel.debtorIds.map(function(id){ var d = stmtDebtors.filter(function(x){ return x.id === id; })[0]; return d ? d.name : ''; }).filter(Boolean);
    box.innerHTML = '<ul class="sel-names">' + names.map(function(n){ return '<li>' + escapeHtml(n) + '</li>'; }).join('') + '</ul>'
      + '<div class="sel-total"><span>Amount due</span><b>' + money(m.totals.due) + '</b></div>'
      + '<p class="muted small">' + sel.items.length + ' invoice' + (sel.items.length === 1 ? '' : 's') + ' selected' + (m.totals.overdue ? ' · ' + money(m.totals.overdue) + ' overdue' : '') + '</p>'
      + '<button class="btn primary" type="button" data-stab-go="statement">Build statement →</button>';
  }

