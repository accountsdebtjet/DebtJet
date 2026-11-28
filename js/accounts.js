/* DebtJet: accounts.js
 * Accounts tab (what is owing and what has been sent) and Quick find.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- Accounts: what is owing, what has been sent ---------- */
  var acctFocus = null, stmtViewingSavedId = null, stmtLastSave = null, acctSentFormId = null, acctShowAll = false, acctCache = null;
  function fmtShort(d){ if(!d) return ''; var x = new Date(d), y = new Date().getFullYear(); return x.toLocaleDateString('en-AU', x.getFullYear() === y ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: '2-digit' }); }
  var SENT_VIA = { email: 'Email', post: 'Post', pdf: 'PDF', hand: 'By hand', portal: 'Portal', other: 'Other' };
  async function loadSavedStatements(){
    var r = await sb.from('statements').select('*').eq('org_id', currentOrg.id).order('generated_at', { ascending: false }).limit(500);
    savedStatements = r.data || [];
    renderSavedStatements();
  }
  function renderSavedStatements(){ acctCache = null; if(stmtDebtors.length) renderStatementContacts(); renderAccount(); }
  // Latest statement marked sent, per contact.
  function acctLastSent(){
    if(acctCache) return acctCache;
    var m = {};
    savedStatements.forEach(function(s){ if(s.status !== 'sent' || !s.sent_at) return; (s.debtor_ids || []).forEach(function(id){ if(!m[id] || s.sent_at > m[id].sent_at) m[id] = s; }); });
    return (acctCache = m);
  }
  function acctDebtor(id){ return stmtDebtors.filter(function(x){ return x.id === id; })[0]; }
  function acctIds(){
    if(!acctFocus) return [];
    if(acctFocus.type === 'debtor') return [acctFocus.id];
    return stmtDebtors.filter(function(d){ return (stmtGroupsOf[d.id] || []).indexOf(acctFocus.id) >= 0; }).map(function(d){ return d.id; });
  }
  function invBalance(i){ return Math.max(0, Math.round((Number(i.amount) - (Number(i.paid) || 0)) * 100) / 100); }
  function acctStatementsFor(ids){ return savedStatements.filter(function(s){ return (s.debtor_ids || []).some(function(x){ return ids.indexOf(x) >= 0; }); }); }
  function acctSummary(d){
    var open = d.invoices.filter(function(i){ return !i.fullyPaid; });
    var out = open.reduce(function(t, i){ return t + invBalance(i); }, 0);
    var od = open.filter(function(i){ return i.daysOverdue > 0; }).reduce(function(t, i){ return t + invBalance(i); }, 0);
    return { d: d, open: open, outstanding: out, overdue: od, notDue: out - od, odCount: open.filter(function(i){ return i.daysOverdue > 0; }).length, last: acctLastSent()[d.id] || null };
  }
  function stChip(s){
    return s.status === 'sent'
      ? '<span class="st-chip sent" title="' + escapeHtml(s.sent_to ? 'Sent to ' + s.sent_to : 'Sent') + '">Sent ' + escapeHtml(fmt(s.sent_at)) + (s.sent_via ? ' · ' + escapeHtml(SENT_VIA[s.sent_via] || s.sent_via) : '') + '</span>'
      : '<span class="st-chip draft">Draft · not sent</span>';
  }
  function lastSentLine(s){ return s ? fmt(s.sent_at) + (s.sent_via ? ' · ' + (SENT_VIA[s.sent_via] || s.sent_via) : '') : ''; }
  function focusAccount(f){
    acctFocus = f; acctSentFormId = null;
    renderStatementContacts(); renderAccount();
    var c = document.getElementById('acctCard');
    if(c && c.scrollIntoView && window.innerWidth < 980) c.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function renderAccount(){
    var body = document.getElementById('acctBody'); if(!body) return;
    var title = document.getElementById('acctTitle'), acts = document.getElementById('acctHeadActs');
    if(acctFocus && acctFocus.type === 'debtor' && !acctDebtor(acctFocus.id)) acctFocus = null;
    if(acctFocus && acctFocus.type === 'group' && !stmtGroups.some(function(g){ return g.id === acctFocus.id; })) acctFocus = null;
    if(!acctFocus){
      title.textContent = 'All accounts'; acts.innerHTML = '';
      var rows = stmtDebtors.map(function(d){
        var a = acctSummary(d);
        a.drafts = savedStatements.filter(function(s){ return s.status !== 'sent' && (s.debtor_ids || []).indexOf(d.id) >= 0; }).length;
        return a;
      }).filter(function(a){ return a.outstanding > 0.005 || a.last || a.drafts; })
        .sort(function(a, b){ return b.overdue - a.overdue || b.outstanding - a.outstanding; });
      var totOut = rows.reduce(function(t, a){ return t + a.outstanding; }, 0), totOd = rows.reduce(function(t, a){ return t + a.overdue; }, 0);
      var since = new Date(Date.now() - 30 * 864e5).toISOString();
      var sent30 = savedStatements.filter(function(s){ return s.status === 'sent' && s.sent_at >= since; }).length;
      var drafts = savedStatements.filter(function(s){ return s.status !== 'sent'; }).length;
      var notSent = rows.filter(function(a){ return a.overdue > 0 && (!a.last || a.last.sent_at < since); }).length;
      var shown = acctShowAll ? rows : rows.slice(0, 15);
      body.innerHTML = '<p class="acct-sub">Click a contact, or a row below, to see what is owing, which statements have gone out and the history.</p>'
        + '<div class="acct-tiles">'
        + '<div class="acct-tile"><div class="l">Outstanding</div><div class="v">' + money(totOut) + '</div><div class="s">' + rows.filter(function(a){ return a.outstanding > 0.005; }).length + ' accounts</div></div>'
        + '<div class="acct-tile"><div class="l">Overdue</div><div class="v' + (totOd ? ' od' : '') + '">' + money(totOd) + '</div><div class="s">' + notSent + ' with no statement in 30 days</div></div>'
        + '<div class="acct-tile"><div class="l">Sent, last 30 days</div><div class="v">' + sent30 + '</div><div class="s">statement' + (sent30 === 1 ? '' : 's') + '</div></div>'
        + '<div class="acct-tile"><div class="l">Drafts not sent</div><div class="v">' + drafts + '</div><div class="s">saved, not marked sent</div></div>'
        + '</div>'
        + (rows.length ? '<table class="acct-tbl"><thead><tr><th>Contact</th><th class="num">Outstanding</th><th class="num">Overdue</th><th>Last statement sent</th></tr></thead><tbody>'
          + shown.map(function(a){
            return '<tr class="acct-row" data-acct-row="' + a.d.id + '" tabindex="0"><td><b>' + escapeHtml(a.d.name) + '</b>' + (a.drafts ? ' <span class="st-chip draft">' + a.drafts + ' draft' + (a.drafts === 1 ? '' : 's') + '</span>' : '') + '</td>'
              + '<td class="num">' + money(a.outstanding) + '</td><td class="num' + (a.overdue ? ' od' : '') + '">' + (a.overdue ? money(a.overdue) : '—') + '</td>'
              + '<td>' + (a.last ? escapeHtml(lastSentLine(a.last)) : '<span class="st-chip none">None yet</span>') + '</td></tr>';
          }).join('') + '</tbody></table>'
          + (rows.length > 15 ? '<button type="button" class="btn sm ghost stmt-more" data-acct-more>' + (acctShowAll ? 'Show fewer' : 'Show all ' + rows.length + ' accounts') + '</button>' : '')
          : '<div class="acct-empty">No accounts with a balance or a statement yet.</div>');
      setHistoryDebtors('stmt', Object.keys(stmtSelectedDebtors).filter(function(k){ return stmtSelectedDebtors[k]; }));
      return;
    }
    var ids = acctIds(), ds = ids.map(acctDebtor).filter(Boolean), isGrp = acctFocus.type === 'group';
    var g = isGrp ? stmtGroups.filter(function(x){ return x.id === acctFocus.id; })[0] : null;
    var d0 = ds[0];
    title.textContent = isGrp ? g.name : d0.name;
    acts.innerHTML = '<button type="button" class="btn sm ghost" data-acct-back>← All accounts</button>';
    var sums = ds.map(acctSummary);
    var out = sums.reduce(function(t, a){ return t + a.outstanding; }, 0), od = sums.reduce(function(t, a){ return t + a.overdue; }, 0), odN = sums.reduce(function(t, a){ return t + a.odCount; }, 0);
    var stmts = acctStatementsFor(ids);
    var lastSent = stmts.filter(function(s){ return s.status === 'sent' && s.sent_at; }).sort(function(a, b){ return String(b.sent_at).localeCompare(String(a.sent_at)); })[0] || null;
    var sub;
    if(isGrp) sub = 'Contact group · ' + ds.length + ' contact' + (ds.length === 1 ? '' : 's') + (g.xero_group_id ? ' · from Xero' : '') + ' · totals combine the contacts, split by contact below';
    else sub = [d0.abn ? 'ABN ' + d0.abn : '', d0.contact_name || '', d0.email || ''].filter(Boolean).map(escapeHtml).join(' · ');
    var chips = isGrp ? ds.map(function(d){ return '<button type="button" class="chip" data-acct="' + d.id + '">' + escapeHtml(d.name) + '</button>'; }).join('')
      : (stmtGroupsOf[d0.id] || []).map(function(gid){ var gg = stmtGroups.filter(function(x){ return x.id === gid; })[0]; return gg ? '<button type="button" class="chip" data-acct-grp="' + gid + '" title="Open the group account">Group: ' + escapeHtml(gg.name) + '</button>' : ''; }).join('');
    var h = (sub ? '<p class="acct-sub">' + (isGrp ? escapeHtml(sub) : sub) + '</p>' : '') + (chips ? '<div class="acct-members">' + chips + '</div>' : '')
      + '<div class="acct-tiles">'
      + '<div class="acct-tile"><div class="l">Outstanding</div><div class="v">' + money(out) + '</div><div class="s">' + sums.reduce(function(t, a){ return t + a.open.length; }, 0) + ' unpaid invoice' + (sums.reduce(function(t, a){ return t + a.open.length; }, 0) === 1 ? '' : 's') + '</div></div>'
      + '<div class="acct-tile"><div class="l">Overdue</div><div class="v' + (od ? ' od' : '') + '">' + money(od) + '</div><div class="s">' + odN + ' invoice' + (odN === 1 ? '' : 's') + '</div></div>'
      + '<div class="acct-tile"><div class="l">Not yet due</div><div class="v">' + money(out - od) + '</div><div class="s">&nbsp;</div></div>'
      + '<div class="acct-tile"><div class="l">Last statement sent</div><div class="v" style="font-size:14px;">' + (lastSent ? escapeHtml(fmt(lastSent.sent_at)) : 'None yet') + '</div><div class="s">' + (lastSent ? escapeHtml((SENT_VIA[lastSent.sent_via] || 'Sent') + (lastSent.sent_to ? ' · ' + lastSent.sent_to : '')) : stmts.length ? stmts.length + ' draft' + (stmts.length === 1 ? '' : 's') + ' saved' : '&nbsp;') + '</div></div>'
      + '</div>'
      + '<div class="acct-head-acts"><button type="button" class="btn sm primary" data-acct-new' + (out > 0 ? '' : ' disabled') + '>New statement for this account</button></div>';
    if(isGrp){
      h += '<div class="acct-sec"><h4>By contact</h4><table class="acct-tbl"><thead><tr><th>Contact</th><th class="num">Outstanding</th><th class="num">Overdue</th><th>Last statement sent</th></tr></thead><tbody>'
        + sums.map(function(a){ return '<tr class="acct-row" data-acct-row="' + a.d.id + '" tabindex="0"><td><b>' + escapeHtml(a.d.name) + '</b></td><td class="num">' + money(a.outstanding) + '</td><td class="num' + (a.overdue ? ' od' : '') + '">' + (a.overdue ? money(a.overdue) : '—') + '</td><td>' + (a.last ? escapeHtml(lastSentLine(a.last)) : '<span class="st-chip none">None yet</span>') + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    }
    // When each invoice last went out on a sent statement.
    var invSent = {};
    stmts.forEach(function(s){ if(s.status !== 'sent') return; (s.items || []).forEach(function(it){ var k = (it.debtor_name || '') + '|' + (it.invoice_number || ''); if(!invSent[k] || s.sent_at > invSent[k]) invSent[k] = s.sent_at; }); });
    var invRows = '';
    sums.forEach(function(a){
      if(!a.open.length) return;
      if(isGrp) invRows += '<tr class="acct-sub-h"><td colspan="5">' + escapeHtml(a.d.name) + ' · ' + money(a.outstanding) + '</td></tr>';
      a.open.slice().sort(function(x, y){ return y.daysOverdue - x.daysOverdue; }).forEach(function(i){
        var sentAt = invSent[a.d.name + '|' + (i.invoice_number || '')];
        invRows += '<tr><td><b>' + escapeHtml(i.invoice_number || '—') + '</b></td><td>' + escapeHtml(fmt(i.due_date)) + '</td>'
          + '<td class="' + (i.daysOverdue > 0 ? 'od' : '') + '">' + (i.daysOverdue > 0 ? i.daysOverdue + ' day' + (i.daysOverdue === 1 ? '' : 's') + ' overdue' : i.daysOverdue === 0 ? 'Due today' : 'Due in ' + (-i.daysOverdue) + ' day' + (i.daysOverdue === -1 ? '' : 's')) + '</td>'
          + '<td class="num">' + money(invBalance(i)) + '</td><td>' + (sentAt ? '<span class="st-chip sent">Sent ' + escapeHtml(fmt(sentAt)) + '</span>' : '<span class="st-chip none">Not sent yet</span>') + '</td></tr>';
      });
    });
    h += '<div class="acct-sec"><h4>Outstanding invoices <span class="n">what is owing now, and whether it has been on a sent statement</span></h4>'
      + (invRows ? '<table class="acct-tbl"><thead><tr><th>Invoice</th><th>Due</th><th>Status</th><th class="num">Balance</th><th>On a statement</th></tr></thead><tbody>' + invRows + '</tbody></table>' : '<div class="acct-empty">Nothing owing on this account.</div>')
      + '</div>';
    var stRows = stmts.map(function(s){
      var names = (s.debtor_ids || []).map(function(id){ var d = acctDebtor(id); return d ? d.name : ''; }).filter(Boolean);
      var num = s.totals && s.totals.number ? s.totals.number : 'Statement';
      var row = '<tr><td>' + escapeHtml(fmt(s.generated_at)) + '</td><td><b style="white-space:nowrap;">' + escapeHtml(num) + '</b>' + (names.length > 1 || isGrp ? '<div class="muted small">' + escapeHtml(names.join(' + ') || s.recipient_name) + '</div>' : '') + '</td>'
        + '<td class="num">' + money(s.total_amount) + '</td><td>' + (s.items || []).length + '</td><td>' + stChip(s) + '</td>'
        + '<td class="num" style="white-space:nowrap;"><button type="button" class="btn sm ghost" data-st-view="' + s.id + '">View</button>'
        + (s.status === 'sent' ? '<button type="button" class="btn sm ghost" data-st-undo="' + s.id + '" title="Set back to draft if it was marked sent by mistake">Undo sent</button>'
           : '<button type="button" class="btn sm" data-st-mark="' + s.id + '">Mark as sent</button><button type="button" class="btn sm ghost" data-st-del="' + s.id + '" title="Delete this draft">Delete</button>')
        + '</td></tr>';
      if(acctSentFormId === s.id){
        var d1 = acctDebtor((s.debtor_ids || [])[0]) || {};
        row += '<tr><td colspan="6"><div class="acct-sent-form" data-st-form="' + s.id + '">'
          + '<label>Sent on<input type="date" data-sf="date" value="' + new Date().toISOString().slice(0, 10) + '" max="' + new Date().toISOString().slice(0, 10) + '" /></label>'
          + '<label>How<select data-sf="via">' + Object.keys(SENT_VIA).map(function(k){ return '<option value="' + k + '">' + SENT_VIA[k] + '</option>'; }).join('') + '</select></label>'
          + '<label>Sent to (optional)<input type="text" data-sf="to" maxlength="200" value="' + escapeHtml(d1.email || '') + '" placeholder="Email or address" /></label>'
          + '<span style="display:flex;gap:6px;"><button type="button" class="btn sm" data-st-cancel>Cancel</button><button type="button" class="btn sm primary" data-st-save="' + s.id + '">Save</button></span>'
          + '</div></td></tr>';
      }
      return row;
    }).join('');
    h += '<div class="acct-sec"><h4>Statements <span class="n">' + stmts.filter(function(s){ return s.status === 'sent'; }).length + ' sent · ' + stmts.filter(function(s){ return s.status !== 'sent'; }).length + ' draft</span></h4>'
      + (stRows ? '<table class="acct-tbl"><thead><tr><th>Saved</th><th>Statement</th><th class="num">Amount due</th><th>Invoices</th><th>Status</th><th></th></tr></thead><tbody>' + stRows + '</tbody></table>'
        : '<div class="acct-empty">No statements saved for this account yet. Use <b>New statement for this account</b>, then Save or Print.</div>')
      + '<p class="muted small" style="margin-top:6px;">A sent statement is locked, so the record shows exactly what went out. When you print or export, DebtJet asks whether you sent it.</p></div>';
    body.innerHTML = h;
    setHistoryDebtors('stmt', ids);
  }
  async function markStatementSent(id, f){
    var r = await sb.from('statements').update({ status: 'sent', sent_at: f.sent_at, sent_via: f.sent_via, sent_to: f.sent_to || null }).eq('id', id);
    if(r.error){ toast('Could not mark it sent: ' + r.error.message); return false; }
    acctSentFormId = null;
    toast('Marked as sent' + (f.sent_via ? ' (' + (SENT_VIA[f.sent_via] || f.sent_via).toLowerCase() + ')' : '') + '.');
    if(histState.stmt){ histState.stmt.key = null; histState.stmt.loadedKey = null; }
    await loadSavedStatements();
    return true;
  }
  document.addEventListener('click', async function(e){
    var t = e.target; if(!t.closest || !t.closest('[data-view="statements"]')) return;
    var b;
    if((b = t.closest('[data-acct]'))){ e.preventDefault(); e.stopPropagation(); focusAccount({ type: 'debtor', id: b.getAttribute('data-acct') }); return; }
    if((b = t.closest('[data-acct-head]')) && !t.closest('.ch-tick, .chev, .grp-rm')){ focusAccount({ type: 'debtor', id: b.getAttribute('data-acct-head') }); return; }
    if((b = t.closest('[data-acct-grp]'))){ e.preventDefault(); e.stopPropagation(); focusAccount({ type: 'group', id: b.getAttribute('data-acct-grp') }); return; }
    if((b = t.closest('[data-acct-row]'))){ focusAccount({ type: 'debtor', id: b.getAttribute('data-acct-row') }); return; }
    if(t.closest('[data-acct-back]')){ focusAccount(null); return; }
    if(t.closest('[data-acct-more]')){ acctShowAll = !acctShowAll; renderAccount(); return; }
    if(t.closest('[data-acct-new]')){
      stmtSelectedDebtors = {}; stmtInvoiceOverride = {};
      acctIds().forEach(function(id){ var d = acctDebtor(id); if(!d) return; stmtSelectedDebtors[id] = true; d.invoices.forEach(function(i){ stmtInvoiceOverride[i.id] = !i.fullyPaid; }); });
      renderStatementContacts(); setStmtTab('statement'); window.scrollTo(0, 0); return;
    }
    if((b = t.closest('[data-st-view]'))){ viewSavedStatement(b.getAttribute('data-st-view')); return; }
    if((b = t.closest('[data-st-mark]'))){ acctSentFormId = b.getAttribute('data-st-mark'); renderAccount(); var f = document.querySelector('[data-st-form] [data-sf="via"]'); if(f) f.focus(); return; }
    if(t.closest('[data-st-cancel]')){ acctSentFormId = null; renderAccount(); return; }
    if((b = t.closest('[data-st-save]'))){
      var form = b.closest('[data-st-form]'), day = form.querySelector('[data-sf="date"]').value, today = new Date().toISOString().slice(0, 10);
      if(!day){ toast('Choose the date it was sent.'); return; }
      if(day > today){ toast('The sent date can’t be in the future.'); return; }
      await markStatementSent(b.getAttribute('data-st-save'), { sent_at: day === today ? new Date().toISOString() : new Date(day + 'T12:00:00').toISOString(), sent_via: form.querySelector('[data-sf="via"]').value, sent_to: form.querySelector('[data-sf="to"]').value.trim() });
      return;
    }
    if((b = t.closest('[data-st-undo]'))){
      var id = b.getAttribute('data-st-undo');
      if(!await djAsk('Set this statement back to draft?\n\nUse this only if it was marked sent by mistake. The sent date and method are cleared.', { ok: 'Set to draft' })) return;
      var r = await sb.from('statements').update({ status: 'draft', sent_at: null, sent_via: null, sent_to: null }).eq('id', id);
      if(r.error){ toast('Could not change it: ' + r.error.message); return; }
      if(histState.stmt){ histState.stmt.key = null; histState.stmt.loadedKey = null; }
      toast('Set back to draft.'); await loadSavedStatements(); return;
    }
    if((b = t.closest('[data-st-del]'))){
      var did = b.getAttribute('data-st-del');
      if(!await djAsk('Delete this draft statement?\n\nIt was never marked sent. Sent statements can’t be deleted.')) return;
      var rd = await sb.from('statements').delete().eq('id', did);
      if(rd.error){ toast('Could not delete it: ' + rd.error.message); return; }
      if(stmtLastSave && stmtLastSave.id === did) stmtLastSave = null;
      toast('Draft deleted.'); await loadSavedStatements(); return;
    }
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' || !e.target.closest) return;
    var r = e.target.closest('[data-acct-row]'); if(r){ e.preventDefault(); focusAccount({ type: 'debtor', id: r.getAttribute('data-acct-row') }); return; }
    var h = e.target.closest('[data-acct-head]'); if(h && e.target === h){ e.preventDefault(); focusAccount({ type: 'debtor', id: h.getAttribute('data-acct-head') }); }
  });

  /* ---------- Quick find: contacts, people, groups, invoices, ABNs, emails, from anywhere ---------- */
  var qfPeople = null, qfSel = 0, qfResults = [];
  function qfNorm(x){ return String(x || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
  async function qfLoadPeople(){
    if(qfPeople || !currentOrg) return;
    qfPeople = [];
    var r = await sb.from('debtor_contacts').select('debtor_id, name, email, phone, role').eq('org_id', currentOrg.id).limit(3000);
    qfPeople = r.data || [];
  }
  function qfDebtors(){
    var m = {};
    stmtDebtors.forEach(function(d){ m[d.id] = { id: d.id, name: d.name, abn: d.abn, email: d.email, contact_name: d.contact_name, legal_name: d.legal_name, acct: d }; });
    cases.forEach(function(c){ var d = c.debtor || {}; if(!d.id) return; if(!m[d.id]) m[d.id] = { id: d.id, name: d.name, abn: d.abn, email: d.email, contact_name: d.contact_name, legal_name: d.legal_name, acct: null }; m[d.id].caseId = m[d.id].caseId || c.id; });
    return m;
  }
  function qfSearch(q){
    var raw = q.trim(); if(!raw) return [];
    var tokens = qfNorm(raw).split(/\s+/).filter(Boolean), digits = raw.replace(/\D/g, '');
    var hit = function(hay){ hay = qfNorm(hay); return tokens.every(function(t){ return hay.indexOf(t) >= 0; }); };
    var out = [], dm = qfDebtors(), ids = Object.keys(dm);
    ids.forEach(function(id){
      var d = dm[id];
      var abnHit = digits.length >= 3 && String(d.abn || '').replace(/\D/g, '').indexOf(digits) >= 0;
      if(abnHit || hit([d.name, d.legal_name, d.contact_name, d.email].join(' '))){
        var a = d.acct ? acctSummary(d.acct) : null;
        out.push({ kind: 'Contacts', type: 'debtor', id: id, caseId: d.caseId, title: d.name || 'Contact',
          sub: [d.abn ? 'ABN ' + d.abn : '', d.contact_name, d.email].filter(Boolean).join(' · ') || (d.legal_name || ''),
          amt: a ? a.outstanding : null, od: a ? a.overdue > 0 : false, score: qfNorm(d.name).indexOf(tokens[0]) === 0 ? 0 : 1 });
      }
    });
    stmtGroups.forEach(function(g){
      if(!hit(g.name)) return;
      var n = stmtDebtors.filter(function(d){ return (stmtGroupsOf[d.id] || []).indexOf(g.id) >= 0; }).length;
      out.push({ kind: 'Contact groups', type: 'group', id: g.id, title: g.name, sub: 'Contact group · ' + n + ' contact' + (n === 1 ? '' : 's'), score: 0 });
    });
    (qfPeople || []).forEach(function(p){
      if(!hit([p.name, p.email, p.role, p.phone].join(' '))) return;
      var d = dm[p.debtor_id]; if(!d) return;
      out.push({ kind: 'People', type: 'debtor', id: d.id, caseId: d.caseId, title: p.name || p.email, sub: [p.role, p.email, 'at ' + d.name].filter(Boolean).join(' · '), score: 1 });
    });
    stmtInvoices.forEach(function(i){
      if(!i.debtor_id) return;
      if(!hit([i.invoice_number, i.description].join(' '))) return;
      var d = dm[i.debtor_id] || {};
      out.push({ kind: 'Invoices', type: 'debtor', id: i.debtor_id, caseId: d.caseId, title: (i.invoice_number || 'Invoice') + ' · ' + (d.name || ''),
        sub: (i.fullyPaid ? 'Paid' : i.daysOverdue > 0 ? i.daysOverdue + ' days overdue' : 'Due ' + fmt(i.due_date)) + (i.description ? ' · ' + i.description : ''),
        amt: i.fullyPaid ? null : invBalance(i), od: !i.fullyPaid && i.daysOverdue > 0, score: qfNorm(i.invoice_number).indexOf(tokens[0]) === 0 ? 0 : 1 });
    });
    var order = ['Contacts', 'Contact groups', 'People', 'Invoices'], per = { Contacts: 6, 'Contact groups': 3, People: 4, Invoices: 6 };
    var res = [];
    order.forEach(function(k){ res = res.concat(out.filter(function(r){ return r.kind === k; }).sort(function(a, b){ return a.score - b.score || String(a.title).localeCompare(String(b.title)); }).slice(0, per[k])); });
    return res;
  }
  function qfRender(){
    var panel = document.getElementById('qfPanel'), inp = document.getElementById('qfInput'), q = inp.value;
    if(!q.trim()){ panel.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    qfResults = qfSearch(q); if(qfSel >= qfResults.length) qfSel = 0;
    var last = '';
    panel.innerHTML = (qfResults.length ? qfResults.map(function(r, i){
      var head = r.kind !== last ? '<div class="qf-grp">' + escapeHtml(r.kind) + '</div>' : ''; last = r.kind;
      return head + '<div class="qf-item' + (i === qfSel ? ' on' : '') + '" role="option" id="qf-o' + i + '" aria-selected="' + (i === qfSel) + '" data-qf="' + i + '">'
        + '<span class="qf-t"><b>' + escapeHtml(r.title) + '</b><span>' + escapeHtml(r.sub || '') + '</span></span>'
        + (r.amt != null ? '<span class="qf-amt' + (r.od ? ' od' : '') + '">' + money(r.amt) + '</span>' : '')
        + (r.caseId ? '<button type="button" class="qf-case" data-qf-case="' + r.caseId + '" title="Open the case in Debtors &amp; Cases">Case</button>' : '')
        + '</div>';
    }).join('') : '<div class="qf-empty">No contacts, groups or invoices match “' + escapeHtml(q.trim()) + '”.</div>')
      + '<div class="qf-foot">↑ ↓ to move · Enter opens the account · Esc to close</div>';
    panel.hidden = false; inp.setAttribute('aria-expanded', 'true');
    if(qfResults.length) inp.setAttribute('aria-activedescendant', 'qf-o' + qfSel); else inp.removeAttribute('aria-activedescendant');
  }
  function qfClose(clear){ var p = document.getElementById('qfPanel'); p.hidden = true; var inp = document.getElementById('qfInput'); inp.setAttribute('aria-expanded', 'false'); if(clear) inp.value = ''; }
  function qfOpen(r){
    if(!r) return;
    qfClose(true); document.getElementById('qfInput').blur();
    var isAcct = r.type === 'group' || stmtDebtors.some(function(d){ return d.id === r.id; });
    if(!isAcct){ if(r.caseId) openCase(r.caseId); else toast('This contact has no invoices yet.'); return; }
    showView('statements'); setActiveNav('statements'); setStmtTab('contacts');
    focusAccount({ type: r.type, id: r.id });
    var card = document.getElementById('acctCard'); if(card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
  }
  (function(){
    var inp = document.getElementById('qfInput'), panel = document.getElementById('qfPanel');
    inp.addEventListener('focus', function(){ qfLoadPeople().then(function(){ if(document.activeElement === inp) qfRender(); }); if(inp.value.trim()) qfRender(); });
    inp.addEventListener('input', function(){ qfSel = 0; qfRender(); });
    inp.addEventListener('keydown', function(e){
      if(e.key === 'ArrowDown'){ e.preventDefault(); if(qfResults.length){ qfSel = (qfSel + 1) % qfResults.length; qfRender(); } }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); if(qfResults.length){ qfSel = (qfSel - 1 + qfResults.length) % qfResults.length; qfRender(); } }
      else if(e.key === 'Enter'){ e.preventDefault(); qfOpen(qfResults[qfSel]); }
      else if(e.key === 'Escape'){ e.preventDefault(); if(!panel.hidden) qfClose(false); else { inp.value = ''; inp.blur(); } }
    });
    panel.addEventListener('mousedown', function(e){ e.preventDefault(); });   // keep focus in the box
    panel.addEventListener('click', function(e){
      var c = e.target.closest('[data-qf-case]'); if(c){ e.stopPropagation(); qfClose(true); inp.blur(); openCase(c.getAttribute('data-qf-case')); return; }
      var it = e.target.closest('[data-qf]'); if(it) qfOpen(qfResults[Number(it.getAttribute('data-qf'))]);
    });
    inp.addEventListener('blur', function(){ setTimeout(function(){ if(document.activeElement !== inp) qfClose(false); }, 120); });
    document.addEventListener('keydown', function(e){
      var tag = (e.target && e.target.tagName) || '', typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if(((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)){
        if(document.querySelector('.dj-ask-wrap, .dj-modal-backdrop:not([hidden])')) return;
        e.preventDefault(); inp.focus(); inp.select();
      }
    });
  })();
  function viewLegacyStatement(s){
    var recipEl = document.getElementById('stmtRecipientName');
    recipEl.value = s.recipient_name; recipEl.dataset.manual = '1';
    var paperEl = document.getElementById('statementPaper'); paperEl.className = 'statement-paper legacy'; paperEl.innerHTML =
      '<div class="lh-brand"><div><div class="n">DebtJet</div><div style="color:var(--text-muted);font-size:11px;">Account Statement — on behalf of '+escapeHtml(currentOrg.name)+'</div></div>'
      +'<div class="addr">Statement @ '+fmt(s.generated_at)+'<br>Attn: '+escapeHtml(s.recipient_name)+'</div></div>'
      +'<table><thead><tr><th>Invoice</th><th>Description</th><th>Due</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>'
      +(s.items||[]).map(function(i){
        return '<tr><td>'+escapeHtml(i.invoice_number||'—')+'<div style="font-size:10.5px;color:var(--text-muted);">'+escapeHtml(i.debtor_name||'')+'</div></td><td>'+escapeHtml(i.description||'')+'</td><td>'+fmt(i.due_date)+'</td><td class="num">'+money(i.amount)+'</td><td>'+(i.status==='paid'?'Paid':(i.status==='late'?'Overdue':'Open'))+'</td></tr>';
      }).join('')
      +'</tbody><tr><th colspan="3" style="text-align:right;">Total</th><th class="num">'+money(s.total_amount)+'</th><th></th></tr></table>'
      +'<div style="margin-top:14px;font-size:12px;color:var(--text-muted);">Saved statement — '+fmt(s.generated_at)+'</div>'
      +(s.notes ? '<div style="margin-top:14px;"><b>Account notes</b>'+textToParagraphs(s.notes)+'</div>' : '')
      +'<div class="sign">Regards,<br><b>Accounts team</b><br>'+escapeHtml(currentOrg.name)+'<br>via DebtJet</div>';
    document.getElementById('stmtPrintBtn').disabled = false;
    toast('Showing saved statement for ' + s.recipient_name + '.');
  }

