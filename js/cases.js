/* DebtJet: cases.js
 * Dashboard, Debtors & Cases list, contact cards (ABN check) and case detail.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- dashboard ---------- */
  function renderDashboard(){
    var totalOutstanding = cases.reduce(function(s,c){ return s + c.amount; }, 0);
    var totalInterest = cases.reduce(function(s,c){ return s + c.interest; }, 0);
    document.getElementById('kpiRow').innerHTML =
      '<div class="kpi"><div class="label">Total outstanding</div><div class="value">'+money(totalOutstanding)+'</div><div class="delta">Across '+cases.length+' open cases</div></div>'+
      '<div class="kpi"><div class="label">Accrued interest</div><div class="value">'+money(totalInterest)+'</div><div class="delta">Charged under your Interest &amp; Fees rules</div></div>'+
      '<div class="kpi"><div class="label">Letter templates</div><div class="value">'+letterTemplates.length+'</div><div class="delta">reminder / first / final</div></div>'+
      '<div class="kpi"><div class="label">In recovery / tribunal</div><div class="value">'+cases.filter(function(c){return c.status==='debt_recovery'||c.status==='tribunal'||c.status==='escalated';}).length+'</div><div class="delta">'+cases.filter(function(c){return c.status==='tribunal';}).length+' at tribunal</div></div>';

    var buckets = [
      {label:'0–30 days', cls:'b1', min:0, max:30},
      {label:'31–60 days', cls:'b2', min:31, max:60},
      {label:'61–90 days', cls:'b3', min:61, max:90},
      {label:'90+ days', cls:'b4', min:91, max:999999}
    ];
    var sums = buckets.map(function(b){ return cases.filter(function(c){ return c.daysOverdue>=b.min && c.daysOverdue<=b.max; }).reduce(function(s,c){return s+c.amount;},0); });
    var maxSum = Math.max.apply(null, sums.concat([1]));
    document.getElementById('agingChart').innerHTML = buckets.map(function(b,i){
      var h = Math.max(4, Math.round(sums[i]/maxSum*100));
      return '<div class="aging-bar '+b.cls+'"><div class="amt">'+money(sums[i]).replace('.00','')+'</div><div class="bar" style="height:'+h+'%"></div><div class="lbl">'+b.label+'</div></div>';
    }).join('');

    var top = cases.slice().sort(function(a,b){return b.daysOverdue-a.daysOverdue;}).slice(0,4);
    document.getElementById('attentionBody').innerHTML = top.length ? top.map(function(c){
      return '<tr class="clickable" data-case="'+c.id+'"><td class="name-cell">'+escapeHtml(c.debtor.name)+'</td><td>'+pill(c.status)+'</td><td class="num">'+money(c.total)+'</td><td>'+c.daysOverdue+'</td><td><button class="btn sm ghost">Open →</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-note">No cases yet.</td></tr>';
    Array.prototype.forEach.call(document.getElementById('attentionBody').querySelectorAll('[data-case]'), function(el){ el.addEventListener('click', function(){ openCase(this.getAttribute('data-case')); }); });

    document.getElementById('activityFeed').innerHTML = cases.length ? '<div class="empty-note">Open a case to see its full timeline.</div>' : '<div class="empty-note">Nothing yet.</div>';
  }

  /* ---------- cases list ---------- */
  document.getElementById('caseFilters').innerHTML = ['all','new','letter_sent','awaiting_response','payment_plan','debt_recovery','tribunal'].map(function(f,i){
    return '<button class="chip'+(i===0?' active':'')+'" data-filter="'+f+'">'+(f==='all'?'All':STATUS_LABEL[f])+'</button>';
  }).join('');
  document.getElementById('caseFilters').addEventListener('click', function(e){
    var btn = e.target.closest('.chip'); if(!btn) return;
    Array.prototype.forEach.call(document.querySelectorAll('#caseFilters .chip'), function(c){c.classList.remove('active');});
    btn.classList.add('active');
    currentCaseFilter = btn.getAttribute('data-filter');
    renderCasesTable(currentCaseFilter);
  });

  function renderCasesTable(filter){
    var rows = cases.filter(function(c){ return filter==='all' || c.status===filter; });
    document.getElementById('casesBody').innerHTML = rows.length ? rows.map(function(c){
      return '<tr class="clickable" data-case="'+c.id+'"><td class="name-cell">'+escapeHtml(c.debtor.name)+' '+nameCheckBadge(c.debtor, true)+'<div class="sub">'+escapeHtml(c.invoiceNumber)+' · ABN '+escapeHtml(c.debtor.abn ? fmtAbn(c.debtor.abn) : '—')+(c.debtor.legal_name && c.debtor.name_check !== 'match' ? ' · '+escapeHtml(c.debtor.legal_name) : '')+'</div></td>'+
        '<td class="num">'+money(c.total)+'</td><td>'+c.daysOverdue+' days</td><td>'+pill(c.status)+'</td><td><button class="btn sm ghost">Open →</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-note">No cases match this filter.</td></tr>';
    Array.prototype.forEach.call(document.getElementById('casesBody').querySelectorAll('[data-case]'), function(el){ el.addEventListener('click', function(){ openCase(this.getAttribute('data-case')); }); });
  }

  /* ---------- Debtor contact cards + ABN register check ---------- */
  // True when the legal name on file came from an ABN register check (not typed in by hand).
  function legalFromRegister(d){ return !!(d && d.legal_name && d.abr_checked_at && /^(match|similar|different|cancelled)$/.test(d.name_check || '')); }
  var NAME_CHECK = {
    match:       { label: 'Matches ABN register', cls: 'ok',   icon: '✓' },
    similar:     { label: 'Similar to register name', cls: 'warn', icon: '!' },
    different:   { label: 'Differs from register name', cls: 'crit', icon: '!' },
    not_found:   { label: 'ABN not found', cls: 'crit', icon: '✕' },
    invalid_abn: { label: 'ABN invalid', cls: 'crit', icon: '✕' },
    cancelled:   { label: 'ABN cancelled', cls: 'crit', icon: '✕' }
  };
  var AU_STATES = ['', 'ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
  // Debtor type: a business entity (ABN) or a person who owes money in their own name (no ABN).
  var DEBTOR_KINDS = [
    ['company', 'Company (Pty Ltd or Ltd)'], ['sole_trader', 'Sole trader'], ['partnership', 'Partnership'], ['trust', 'Trust'],
    ['association', 'Incorporated association or co-op'], ['government', 'Government body'], ['individual', 'Individual (no ABN, owes in their own name)']
  ];
  var DEBTOR_KIND_LABEL = {}; DEBTOR_KINDS.forEach(function(k){ DEBTOR_KIND_LABEL[k[0]] = k[1]; });
  function isPerson(d){ return !!d && d.debtor_kind === 'individual'; }
  // Map the ABN register's entity type to a debtor type.
  function kindFromAbr(t){
    t = String(t || '');
    if(/sole trader|individual/i.test(t)) return 'sole_trader';
    if(/partnership/i.test(t)) return 'partnership';
    if(/trust/i.test(t)) return 'trust';
    if(/government|council|commonwealth|state entity/i.test(t)) return 'government';
    if(/company/i.test(t)) return 'company';
    if(/association|incorporated|co-operative|cooperative/i.test(t)) return 'association';
    return null;
  }
  function kindFromCsv(v){
    v = String(v || '').trim().toLowerCase(); if(!v) return null;
    if(/^(individual|person|personal|consumer)/.test(v)) return 'individual';
    if(/sole/.test(v)) return 'sole_trader';
    if(/partner/.test(v)) return 'partnership';
    if(/trust/.test(v)) return 'trust';
    if(/assoc|co-?op|incorporated/.test(v)) return 'association';
    if(/gov|council/.test(v)) return 'government';
    if(/company|pty|ltd|limited/.test(v)) return 'company';
    return null;
  }
  function fmtAbn(a){ a = String(a || '').replace(/\D/g, ''); return a.length === 11 ? a.slice(0,2)+' '+a.slice(2,5)+' '+a.slice(5,8)+' '+a.slice(8) : (a || '—'); }
  function fmtAcn(a){ a = String(a || '').replace(/\D/g, ''); return a.length === 9 ? a.slice(0,3)+' '+a.slice(3,6)+' '+a.slice(6) : (a || '—'); }
  function validAbnClient(abn){ abn = String(abn || '').replace(/\D/g, ''); if(!/^\d{11}$/.test(abn)) return false; var w = [10,1,3,5,7,9,11,13,15,17,19], d = abn.split('').map(Number); d[0] -= 1; return d.reduce(function(s, x, i){ return s + x * w.at(i); }, 0) % 89 === 0; }
  function nameCheckBadge(d, small){
    if(!d || !d.abr_checked_at) return small ? '' : '<span class="nc-badge none">Not checked</span>';
    var n = NAME_CHECK[d.name_check] || { label: 'Checked', cls: 'none', icon: '·' };
    return small ? '<span class="nc-dot '+n.cls+'" title="'+escapeHtml(n.label)+'">'+n.icon+'</span>' : '<span class="nc-badge '+n.cls+'">'+n.icon+' '+escapeHtml(n.label)+'</span>';
  }
  // The name a letter of demand should use: the legal entity, with the trading name when different.
  function letterAddresseeName(d){
    if(!d) return '';
    if(d.legal_name && d.name && d.legal_name.trim().toLowerCase() !== String(d.name).trim().toLowerCase()) return d.legal_name + ' (trading as ' + d.name + ')';
    return d.legal_name || d.name || '';
  }
  function postalLines(d){
    return [d.address_line1, d.address_line2, [d.suburb, d.state, d.postcode].filter(Boolean).join(' '), d.country && d.country !== 'Australia' ? d.country : ''].filter(function(x){ return x && String(x).trim(); });
  }
  var ccContacts = {}, ccEditing = false, ccSearch = null;
  async function loadDebtorContacts(debtorId){
    var r = await sb.from('debtor_contacts').select('*').eq('debtor_id', debtorId).order('is_primary', { ascending: false }).order('created_at');
    ccContacts[debtorId] = r.data || [];
  }
  function renderContactCard(c){
    var d = c.debtor, box = document.getElementById('contactCard'); if(!box) return;
    if(ccEditing){ box.innerHTML = renderContactEdit(d); return; }
    var dl = function(rows){ return '<dl class="cc-dl">'+rows.filter(function(r){ return r[1]; }).map(function(r){ return '<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>'; }).join('')+'</dl>'; };
    var abnLink = d.abn ? '<a href="https://abr.business.gov.au/ABN/View?abn='+escapeHtml(String(d.abn).replace(/\D/g, ''))+'" target="_blank" rel="noopener">'+escapeHtml(fmtAbn(d.abn))+'</a>' : '';
    var warn = '';
    if(d.abr_checked_at && (d.name_check === 'different' || d.name_check === 'similar'))
      warn = '<div class="ai-flag '+(d.name_check === 'different' ? 'stop' : 'caution')+'">The name on file, “'+escapeHtml(d.name)+'”, '+(d.name_check === 'different' ? "doesn't match" : 'is close to but not the same as')+' the registered entity “'+escapeHtml(d.legal_name || '')+'”. A letter of demand should name the legal entity: <b>'+escapeHtml(letterAddresseeName(d))+'</b>. Confirm the ABN is the right business before sending.</div>';
    else if(d.name_check === 'cancelled') warn = '<div class="ai-flag stop">This ABN is <b>'+escapeHtml(d.abn_status || 'not active')+'</b>'+(d.abn_status_from ? ' since '+escapeHtml(fmt(d.abn_status_from)) : '')+'. The business may have closed or been deregistered. Check ASIC before taking recovery action.</div>';
    else if(d.name_check === 'invalid_abn' || d.name_check === 'not_found') warn = '<div class="ai-flag stop">The ABN on file '+(d.name_check === 'invalid_abn' ? "isn't a valid ABN" : "wasn't found on the register")+'. Edit it or use “Find ABN”.</div>';
    else if(isPerson(d)) warn = '<div class="ai-flag info">An individual who owes money in their own name: no ABN is needed. Use their full legal name (first and last name) and home address on letters and claims.</div>';
    else if(!d.debtor_kind) warn = '<div class="ai-flag info">Set the debtor type (business or individual) with “Edit details”, so DebtJet knows whether an ABN is needed.' + (d.abn ? '' : ' If this is a business, use “Find ABN”.') + '</div>';
    else if(!d.abn) warn = '<div class="ai-flag info">No ABN on file. Use “Find ABN” to search the register by name, then confirm it is the right business.</div>';
    if(d.debtor_kind === 'sole_trader' && !isPerson(d)) warn += '<div class="ai-flag info">A sole trader’s debts are the person’s own. Name them as “Full Name trading as Business Name” on letters and claims.</div>';
    var contacts = ccContacts[d.id] || [];
    var people = (d.contact_name || d.email || d.phone ? [{ name: d.contact_name || 'Main contact', role: 'From '+(d.xero_contact_id ? 'Xero' : 'import'), email: d.email, phone: d.phone, primary: true, fixed: true }] : [])
      .concat(contacts.map(function(x){ return { id: x.id, name: x.name, role: x.role, email: x.email, phone: x.phone, primary: x.is_primary, notes: x.notes }; }));
    var postal = postalLines(d);
    box.innerHTML = '<div class="card cc-card"><div class="card-head"><div><h3>Contact card</h3><div class="cc-sub">'+(isPerson(d) ? '' : nameCheckBadge(d))+(d.abr_checked_at ? ' <span class="hint-r">Register checked '+escapeHtml(fmtDateTime(d.abr_checked_at))+'</span>' : '')+'</div></div>'
      + '<div class="action-row"><button class="btn sm" type="button" data-cc="edit">Edit details</button>'
      + (isPerson(d) ? '' : d.abn ? '<button class="btn sm" type="button" data-cc="check">Re-check ABN</button>' : '<button class="btn sm primary" type="button" data-cc="find">Find ABN</button>')
      + (isPerson(d) ? '' : '<a class="btn sm ghost" href="https://connectonline.asic.gov.au/" target="_blank" rel="noopener" title="Free ASIC search: company status and registered office suburb. Paid extracts show the full address and directors.">ASIC search ↗</a>')+'</div></div>'
      + '<div class="card-body">' + warn
      + (ccSearch ? renderAbnSearch() : '')
      + '<div class="cc-grid">'
      +   '<div><h4>' + (isPerson(d) ? 'Person' : 'Business') + '</h4>' + dl([
            ['Debtor type', d.debtor_kind ? escapeHtml(DEBTOR_KIND_LABEL[d.debtor_kind] || d.debtor_kind) : '<span class="hint-r">Not set</span>'],
            [isPerson(d) ? 'Full name' : 'Name on file', escapeHtml(d.name)],
            ['Legal name', escapeHtml(d.legal_name || '')],
            ['Business names', escapeHtml((d.business_names || []).join(', '))],
            ['ABN', abnLink + (d.abn_status ? ' <span class="hint-r">'+escapeHtml(d.abn_status)+(d.abn_status_from ? ' from '+escapeHtml(fmt(d.abn_status_from)) : '')+'</span>' : '')],
            ['ACN', d.acn ? escapeHtml(fmtAcn(d.acn)) : ''],
            ['Register entity type', escapeHtml(d.entity_type || '')],
            ['GST', d.abr_checked_at ? (d.gst_from ? 'Registered from '+escapeHtml(fmt(d.gst_from)) : 'Not registered') : ''],
            ['Register location', escapeHtml([d.abr_state, d.abr_postcode].filter(Boolean).join(' '))]
          ]) + '</div>'
      +   '<div><h4>People</h4>' + (people.length ? people.map(function(p){
            return '<div class="cc-person"><div><b>'+escapeHtml(p.name)+'</b>'+(p.primary ? ' <span class="cc-tag">Primary</span>' : '')+(p.role ? '<div class="hint-r">'+escapeHtml(p.role)+'</div>' : '')
              + (p.email ? '<div><a href="mailto:'+escapeHtml(p.email)+'">'+escapeHtml(p.email)+'</a></div>' : '') + (p.phone ? '<div><a href="tel:'+escapeHtml(String(p.phone).replace(/[^\d+]/g, ''))+'">'+escapeHtml(p.phone)+'</a></div>' : '')
              + (p.notes ? '<div class="hint-r">'+escapeHtml(p.notes)+'</div>' : '') + '</div>'
              + (p.id ? '<button class="linkbtn" type="button" data-cc-del="'+escapeHtml(p.id)+'">Remove</button>' : '') + '</div>';
          }).join('') : '<div class="empty-note">No contacts yet.</div>')
      +     '<button class="linkbtn" type="button" data-cc="addperson">+ Add a contact</button><div id="ccPersonForm"></div></div>'
      +   '<div><h4>Postal address</h4>' + (postal.length ? '<div class="cc-addr">'+postal.map(escapeHtml).join('<br>')+'</div>' : '<div class="empty-note">No postal address. Letters of demand need one.</div>')
      +     (d.website ? '<h4>Website</h4><div><a href="'+escapeHtml(/^https?:/i.test(d.website) ? d.website : 'https://'+d.website)+'" target="_blank" rel="noopener">'+escapeHtml(d.website)+'</a></div>' : '')
      +     (d.notes ? '<h4>Notes</h4><div class="cc-notes">'+escapeHtml(d.notes)+'</div>' : '')
      +     '<h4>On letters of demand</h4><div class="cc-addr">'+escapeHtml(letterAddresseeName(d))+(d.abn && !isPerson(d) ? '<br>ABN '+escapeHtml(fmtAbn(d.abn)) : '')+(postal.length ? '<br>'+postal.map(escapeHtml).join('<br>') : '')+'</div>'
      +   '</div>'
      + '</div></div></div>';
  }
  function renderContactEdit(d){
    var f = function(k, label, extra){ return '<label'+(extra && extra.wide ? ' class="span2"' : '')+'>'+label+'<input data-ce="'+k+'" value="'+escapeHtml(d[k] || '')+'"'+(extra && extra.attrs ? ' '+extra.attrs : '')+' /></label>'; };
    return '<div class="card cc-card"><div class="card-head"><h3>Edit contact card</h3></div><div class="card-body"><div class="form-grid cc-form">'
      + '<label class="span2">Debtor type<select data-ce="debtor_kind"><option value="">Choose…</option>' + DEBTOR_KINDS.map(function(k){ return '<option value="'+k[0]+'"'+(d.debtor_kind === k[0] ? ' selected' : '')+'>'+escapeHtml(k[1])+'</option>'; }).join('') + '</select>'
      +   '<span class="fine">Businesses need an ABN. An individual owes money in their own name and has no ABN.</span></label>'
      + f('name', isPerson(d) ? 'Full name (as in Xero)' : 'Name on file (as in Xero)', { wide: true })
      + '<label class="cc-abn"'+(isPerson(d) ? ' hidden' : '')+'>ABN<input data-ce="abn" value="'+escapeHtml(d.abn || '')+'" inputmode="numeric" maxlength="14" /></label>' + f('website', 'Website')
      + '<label class="cc-abn span2"'+(isPerson(d) ? ' hidden' : '')+'>Legal name<input data-ce="legal_name" value="'+escapeHtml(d.legal_name || '')+'" maxlength="200" placeholder="e.g. Jacaranda Early Learning Pty Ltd" />'
      +   '<span class="fine">The registered entity name, used on claims. Re-check ABN fills it from the ABN register, or copy it from ABN Lookup or an ASIC search.</span></label>'
      + '<label class="cc-abn"'+(isPerson(d) ? ' hidden' : '')+'>ACN (companies)<input data-ce="acn" value="'+escapeHtml(d.acn || '')+'" inputmode="numeric" maxlength="11" /></label><span class="cc-abn"'+(isPerson(d) ? ' hidden' : '')+'></span>'
      + f('contact_name', isPerson(d) ? 'Preferred name' : 'Main contact') + f('email', 'Email', { attrs: 'type="email"' })
      + f('phone', 'Phone') + '<span></span>'
      + f('address_line1', 'Address line 1', { wide: true }) + f('address_line2', 'Address line 2', { wide: true })
      + f('suburb', 'Suburb') + '<label>State<select data-ce="state">'+AU_STATES.map(function(s){ return '<option'+(s === (d.state || '') ? ' selected' : '')+'>'+s+'</option>'; }).join('')+'</select></label>'
      + f('postcode', 'Postcode', { attrs: 'inputmode="numeric" maxlength="4"' }) + f('country', 'Country')
      + '<label class="span2">Notes<textarea data-ce="notes" rows="3" maxlength="2000">'+escapeHtml(d.notes || '')+'</textarea></label>'
      + '</div><div class="fine">If this debtor syncs from Xero, Xero will overwrite the name, ABN, email and phone on the next sync. Change those in Xero instead. Address, website and notes are kept.</div>'
      + '<div class="send-row"><button class="btn primary" type="button" data-cc="save">Save</button><button class="btn ghost" type="button" data-cc="cancel">Cancel</button></div></div></div>';
  }
  function renderAbnSearch(){
    var s = ccSearch;
    return '<div class="cc-search"><div class="cc-search-bar"><input id="ccSearchName" value="'+escapeHtml(s.q)+'" placeholder="Business name or ABN" /><button class="btn sm primary" type="button" data-cc="dosearch">Search register</button><button class="btn sm ghost" type="button" data-cc="closesearch">Close</button></div>'
      + (s.loading ? '<div class="empty-note">Searching the ABN register…</div>'
        : s.error ? '<div class="ai-flag caution">'+escapeHtml(s.error)+'</div>'
        : s.results ? (s.results.length ? '<table class="cc-results"><thead><tr><th>Name</th><th>ABN</th><th>Status</th><th>Location</th><th></th></tr></thead><tbody>'+s.results.map(function(r){
            return '<tr><td>'+escapeHtml(r.name)+'<div class="hint-r">'+escapeHtml(r.name_type || '')+'</div></td><td style="white-space:nowrap;">'+escapeHtml(fmtAbn(r.abn))+'</td><td>'+escapeHtml(r.status || '')+'</td><td>'+escapeHtml([r.state, r.postcode].filter(Boolean).join(' '))+'</td><td><button class="btn sm" type="button" data-cc-pick="'+escapeHtml(r.abn)+'">This one</button></td></tr>';
          }).join('')+'</tbody></table><div class="fine">Pick only when you are sure it is the same business: check the location, and the legal name on an invoice or contract.</div>' : '<div class="empty-note">No matches. Try a shorter name, or ask the debtor for their ABN.</div>') : '')
      + '</div>';
  }
  async function abnCheck(c, abn){
    var d = await invokeFn('abn-lookup', { abn: abn || c.debtor.abn, debtor_id: c.debtor.id, save: true });
    if(!d.ok){ toast(d.error || 'ABN check failed.'); }
    else {
      toast('ABN checked: ' + ((NAME_CHECK[d.name_check] || {}).label || 'done') + '.');
      var k = kindFromAbr((d.details && d.details.entity_type) || d.entity_type);
      if(k && !c.debtor.debtor_kind) await sb.from('debtors').update({ debtor_kind: k }).eq('id', c.debtor.id);
    }
    await refreshDebtorOnCase(c);
    return d;
  }
  async function refreshDebtorOnCase(c){
    var r = await sb.from('debtors').select('*').eq('id', c.debtor.id).maybeSingle();
    if(r.data){ cases.forEach(function(x){ if(x.debtor.id === r.data.id) x.debtor = r.data; }); c.debtor = r.data; }
    renderContactCard(c); renderCasesTable(currentCaseFilter || 'all');
  }
  function wireContactCard(c){
    var box = document.getElementById('contactCard'); if(!box) return;
    box.addEventListener('click', async function(e){
      var t = e.target, act = t.getAttribute('data-cc');
      if(t.getAttribute('data-cc-pick')){ ccSearch = null; t.disabled = true; await abnCheck(c, t.getAttribute('data-cc-pick')); return; }
      if(t.getAttribute('data-cc-del')){
        if(!await djAsk('Remove this contact?')) return;
        var del = await sb.from('debtor_contacts').delete().eq('id', t.getAttribute('data-cc-del'));
        if(del.error){ toast(del.error.message); return; }
        await loadDebtorContacts(c.debtor.id); renderContactCard(c); return;
      }
      if(!act) return;
      if(act === 'edit'){ ccEditing = true; renderContactCard(c); return; }
      if(act === 'cancel'){ ccEditing = false; renderContactCard(c); return; }
      if(act === 'check'){ t.disabled = true; t.textContent = 'Checking…'; await abnCheck(c); return; }
      if(act === 'find'){ ccSearch = { q: c.debtor.name || '' }; renderContactCard(c); runAbnSearch(c); return; }
      if(act === 'closesearch'){ ccSearch = null; renderContactCard(c); return; }
      if(act === 'dosearch'){ ccSearch.q = document.getElementById('ccSearchName').value.trim(); runAbnSearch(c); return; }
      if(act === 'addperson'){
        document.getElementById('ccPersonForm').innerHTML = '<div class="form-grid cc-person-form"><label>Name<input data-cp="name" maxlength="120" /></label><label>Role<input data-cp="role" maxlength="80" placeholder="e.g. Accounts payable" /></label>'
          + '<label>Email<input data-cp="email" type="email" maxlength="320" /></label><label>Phone<input data-cp="phone" maxlength="40" /></label>'
          + '<label class="span2 inline-check"><input type="checkbox" data-cp="primary" /> Primary contact for collections</label></div>'
          + '<div class="send-row"><button class="btn sm primary" type="button" data-cc="saveperson">Add contact</button></div>';
        return;
      }
      if(act === 'saveperson'){
        var g = function(k){ var el = box.querySelector('[data-cp="'+k+'"]'); return el.type === 'checkbox' ? el.checked : el.value.trim(); };
        if(!g('name')){ toast('Add a name.'); return; }
        if(g('primary')) await sb.from('debtor_contacts').update({ is_primary: false }).eq('debtor_id', c.debtor.id);
        var ins = await sb.from('debtor_contacts').insert({ org_id: currentOrg.id, debtor_id: c.debtor.id, name: g('name'), role: g('role') || null, email: g('email') || null, phone: g('phone') || null, is_primary: !!g('primary') });
        if(ins.error){ toast(ins.error.message); return; }
        await loadDebtorContacts(c.debtor.id); renderContactCard(c); toast('Contact added.'); return;
      }
      if(act === 'save'){
        var v = function(k){ var el = box.querySelector('[data-ce="'+k+'"]'); var x = el.value.trim(); return x === '' ? null : x; };
        var kind = v('debtor_kind');
        var abn = kind === 'individual' ? null : ((v('abn') || '').replace(/\D/g, '') || null);
        if(abn && !validAbnClient(abn)){ toast("That ABN isn't valid. Check it for typos."); return; }
        if(kind === 'individual' && c.debtor.abn && !await djAsk('Individuals have no ABN. Remove the ABN on file for ' + c.debtor.name + '?')) return;
        if(v('postcode') && !/^\d{4}$/.test(v('postcode'))){ toast('Postcode should be 4 digits.'); return; }
        var legal = kind === 'individual' ? null : v('legal_name');
        var acn = kind === 'individual' ? null : ((v('acn') || '').replace(/\D/g, '') || null);
        if(acn && acn.length !== 9){ toast('An ACN has 9 digits.'); return; }
        var legalByHand = legal !== (c.debtor.legal_name || null);
        if(legalByHand && legal && legalFromRegister(c.debtor) && !await djAsk('This replaces the legal name from the ABN register (' + c.debtor.legal_name + '). Continue?')) return;
        var row = { name: v('name') || c.debtor.name, abn: abn, debtor_kind: kind, website: v('website'), contact_name: v('contact_name'), email: v('email'), phone: v('phone'),
          address_line1: v('address_line1'), address_line2: v('address_line2'), suburb: v('suburb'), state: v('state'), postcode: v('postcode'), country: v('country'), notes: v('notes'), legal_name: legal, acn: acn };
        var abnChanged = abn !== (c.debtor.abn || null) || row.name !== c.debtor.name;
        if(abnChanged) Object.assign(row, { name_check: null, abr_checked_at: null });
        else if(legalByHand && legalFromRegister(c.debtor)) Object.assign(row, { name_check: null, abr_checked_at: null });
        if(kind === 'individual' && c.debtor.abn) Object.assign(row, { name_check: null, abr_checked_at: null, legal_name: null, acn: null, abn_status: null, entity_type: null });
        var up = await sb.from('debtors').update(row).eq('id', c.debtor.id);
        if(up.error){ toast('Could not save: ' + up.error.message); return; }
        ccEditing = false;
        if(abn && abnChanged) await abnCheck(c, abn); else await refreshDebtorOnCase(c);
        toast('Contact card saved.');
      }
    });
    box.addEventListener('change', function(e){
      if(e.target.getAttribute('data-ce') !== 'debtor_kind') return;
      box.querySelectorAll('.cc-abn').forEach(function(el){ el.hidden = e.target.value === 'individual'; });
    });
    box.addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target.id === 'ccSearchName'){ e.preventDefault(); box.querySelector('[data-cc="dosearch"]').click(); } });
  }
  async function runAbnSearch(c){
    var q = (ccSearch.q || '').trim(); if(!q) return;
    ccSearch.loading = true; ccSearch.error = null; ccSearch.results = null; renderContactCard(c);
    var digitsOnly = q.replace(/\D/g, '');
    var d = /^\d{11}$/.test(digitsOnly) ? await invokeFn('abn-lookup', { abn: digitsOnly }) : await invokeFn('abn-lookup', { name: q });
    if(!ccSearch) return;
    ccSearch.loading = false;
    if(!d.ok) ccSearch.error = d.error || 'Search failed.';
    else ccSearch.results = d.results || (d.details ? [{ abn: d.details.abn, name: d.details.legal_name, name_type: d.details.entity_type, status: d.details.abn_status, state: d.details.abr_state, postcode: d.details.abr_postcode }] : []);
    renderContactCard(c);
  }
  // Check every debtor that has an ABN (Debtors & Cases toolbar).
  async function checkAllAbns(btn){
    var seen = {}, list = cases.map(function(c){ return c.debtor; }).filter(function(d){ if(!d.abn || seen[d.id]) return false; seen[d.id] = true; return true; });
    if(!list.length){ toast('No debtors have an ABN yet. Open a case and use “Find ABN”.'); return; }
    btn.disabled = true; var done = 0, issues = 0;
    for(var i = 0; i < list.length; i++){
      btn.textContent = 'Checking ' + (i + 1) + ' of ' + list.length + '…';
      var d = await invokeFn('abn-lookup', { abn: list.at(i).abn, debtor_id: list.at(i).id, save: true });
      if(d && d.error && /isn't set up/.test(d.error)){ toast(d.error); break; }
      done++; if(!d.ok || (d.name_check && d.name_check !== 'match')) issues++;
    }
    await loadCases(); renderCasesTable(currentCaseFilter || 'all');
    btn.disabled = false; btn.textContent = 'Check all ABNs';
    toast('Checked ' + done + ' debtor' + (done === 1 ? '' : 's') + (issues ? ', ' + issues + ' need a look.' : ', all match.'));
  }

  /* ---------- case detail ---------- */
  var EVENT_TONE = { escalated:'crit', no_response:'warn', letter_sent:'warn', payment_plan_accepted:'ok', invoice_issued:'ok', invoice_due:'ok', reminder_sent:'ok', portal_viewed:'ok', note_added:'ok', payment_logged:'ok', debt_recovery_started:'warn', tribunal_referred:'crit', resolved:'ok' };

  // Case summary, ledger style: what's owed, how it's made up, and each invoice's due date.
  function caseSummaryHtml(c){
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var lateTxt = function(due){ if(!due) return '—'; var d = Math.round((today - new Date(due + 'T00:00:00')) / 86400000); return d > 0 ? '<span class="hl">' + d + ' day' + (d === 1 ? '' : 's') + ' late</span>' : (d === 0 ? 'Due today' : 'Due in ' + (-d) + ' day' + (d === -1 ? '' : 's')); };
    var invs = (c.invoices || []).slice().sort(function(a, b){ return String(a.due_date || '').localeCompare(String(b.due_date || '')); });
    return '<section class="case-sum">'
      + '<div class="cs-top"><div><div class="cs-k">Owing</div><div class="cs-big"><span class="hl">' + money(c.total) + '</span></div>'
      + '<div class="cs-break">' + money(c.amount) + ' in invoices' + (c.interest ? ' + ' + money(c.interest) + ' interest (' + (c.interestRate * 100).toFixed(0) + '% a year, per invoice)' : '') + '</div></div>'
      + '<div class="cs-status"><div class="cs-k">Status</div>' + pill(c.status) + '</div></div>'
      + '<table class="cs-t"><thead><tr><th scope="col">Invoice</th><th scope="col">Due</th><th scope="col">Late</th><th scope="col" class="num">Amount</th></tr></thead><tbody>'
      + invs.map(function(i){ return '<tr><td>' + escapeHtml(i.invoice_number || '—') + '</td><td>' + (i.due_date ? fmt(i.due_date) : '—') + '</td><td>' + lateTxt(i.due_date) + '</td><td class="num">' + money(i.amount) + '</td></tr>'; }).join('')
      + '<tr class="tot"><td colspan="3">Total owing</td><td class="num">' + money(c.total) + '</td></tr></tbody></table></section>';
  }
  function renderPipeline(c){
    var idx = pipelineIndex(c.status);
    return '<div class="pipeline">'+PIPELINE_STAGES.map(function(s,i){
      var cls = i<idx ? 'done' : (i===idx ? 'current' : '');
      return '<div class="pipeline-step '+cls+'">'+s.label+'</div>';
    }).join('')+'</div>';
  }
  function renderPipelineActions(c){
    if(c.status === 'resolved') return '<div class="empty-note" style="margin-top:10px;">This case is resolved.</div>';
    var html = '<div class="action-row" style="margin-top:10px;align-items:center;">';
    if(c.status === 'tribunal'){
      html += '<div class="info-box" style="margin:0;"><div class="k">Referred to</div><div class="v small">'+escapeHtml(c.tribunalBody||'—')+'</div></div>'
        + '<button class="btn primary" id="openRecoveryBtn">Open in Debt Recovery</button>';
    } else if(c.status === 'debt_recovery' || c.status === 'escalated'){
      html += '<button class="btn primary" id="openRecoveryBtn">Open in Debt Recovery</button><select id="tribunalSelect">'+TRIBUNAL_OPTIONS.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('')+'</select>'
        + '<button class="btn primary" id="toTribunalBtn">Refer to tribunal</button>';
    } else {
      html += '<button class="btn primary" id="toDebtRecoveryBtn">Move to Debt Recovery</button>';
    }
    html += '<button class="btn" id="markResolvedBtn">Mark resolved</button></div>';
    return html;
  }

  async function openCase(id){
    var c = cases.filter(function(x){return x.id===id;})[0];
    if(!c) return;
    var ev = await sb.from('case_events').select('*').eq('case_id', id).order('occurred_at', { ascending: true });
    var events = ev.data || [];
    var nt = await sb.from('case_notes').select('*, invoice:invoices(invoice_number)').or('case_id.eq.'+id+(c.debtor.id ? ',debtor_id.eq.'+c.debtor.id : '')).order('occurred_at', { ascending: false });
    var notes = nt.data || [];
    var html = ''
      +'<button class="back-link" id="backToCases">← Back to Debtors &amp; Cases</button>'
      +'<div class="detail-head"><div><h2>'+escapeHtml(c.debtor.name)+' '+nameCheckBadge(c.debtor, true)+'</h2><div class="meta">'+(c.debtor.legal_name ? escapeHtml(c.debtor.legal_name)+' · ' : '')+'ABN '+escapeHtml(c.debtor.abn ? fmtAbn(c.debtor.abn) : '—')+'</div></div>'
        +'<div class="action-row"><button class="btn primary" data-goto="letters" data-preselect="'+c.id+'">Send letter of demand</button></div></div>'
      +'<div id="contactCard" style="margin-bottom:16px;"></div>'
      + caseSummaryHtml(c)
      +'<div class="card" style="margin-bottom:16px;"><div class="card-head"><h3>Escalation pipeline</h3></div><div class="card-body">'
        +renderPipeline(c) + renderPipelineActions(c)
      +'</div></div>'
      +'<div class="card"><div class="card-head"><h3>Log a payment</h3></div><div class="card-body">'
        +'<div class="inline-form"><label>Amount (AUD)<input type="number" step="0.01" min="0" id="paymentAmount"/></label><label>Date<input type="date" id="paymentDate" value="'+new Date().toISOString().slice(0,10)+'"/></label><button class="btn primary" id="logPaymentBtn">Log payment</button></div>'
      +'</div></div>'
      +'<div class="card" style="margin-top:16px;"><div class="card-head"><h3>Notes from email</h3></div><div class="card-body">'
        +(notes.length ? notes.map(function(n){
          var tag = n.invoice && n.invoice.invoice_number ? n.invoice.invoice_number : 'General';
          var facts = [];
          if(n.promised_date) facts.push('Promised by '+fmt(n.promised_date)+(n.promised_amount ? ' · '+money(n.promised_amount) : ''));
          if(n.dispute_reason) facts.push('Dispute: '+n.dispute_reason);
          if(n.suggested_action) facts.push('Next step: '+n.suggested_action);
          return '<div class="tl-item"><div class="tl-dot '+(NOTE_TONE[n.category]||'ok')+'"></div><div class="tl-body"><b>'+escapeHtml(NOTE_CATEGORY_LABEL[n.category]||'Note')+'</b> <span class="pill new" style="margin-left:6px;">'+escapeHtml(tag)+'</span>'
            +(n.ai_model ? ' <span class="pill not_connected" style="margin-left:4px;">AI: '+escapeHtml(n.ai_model)+'</span>' : '')
            +'<p>'+escapeHtml(n.summary)+'</p>'
            +((n.key_points||[]).length ? '<ul class="key-points">'+n.key_points.map(function(k){ return '<li>'+escapeHtml(k)+'</li>'; }).join('')+'</ul>' : '')
            +(facts.length ? '<div class="note-facts">'+facts.map(function(f){ return '<div>'+escapeHtml(f)+'</div>'; }).join('')+'</div>' : '')
            +(n.email_subject||n.email_from ? '<div class="tl-date">'+(n.email_subject?escapeHtml(n.email_subject):'')+(n.email_from?' · '+escapeHtml(n.email_from):'')+'</div>' : '')
            +'<div class="tl-date">'+fmt(n.occurred_at)+'</div></div></div>';
        }).join('') : '<div class="empty-note">No email notes yet — open a debtor email in Gmail and use the DebtJet Chrome extension to add one.</div>')
      +'</div></div>'
      +'<div class="card" style="margin-top:16px;"><div class="card-head"><h3>Case timeline</h3></div><div class="card-body">'
        +'<div class="timeline">'+(events.length ? events.map(function(t){
          return '<div class="tl-item"><div class="tl-dot '+(EVENT_TONE[t.event_type]||'ok')+'"></div><div class="tl-body"><b>'+escapeHtml(t.title)+'</b><p>'+escapeHtml(t.body||'')+'</p><div class="tl-date">'+fmt(t.occurred_at)+'</div></div></div>';
        }).join('') : '<div class="empty-note">No events yet.</div>')+'</div>'
      +'</div></div>';
    document.getElementById('detailView').innerHTML = html;
    showView('detail');
    ccEditing = false; ccSearch = null;
    await loadDebtorContacts(c.debtor.id);
    renderContactCard(c); wireContactCard(c);
    document.getElementById('backToCases').addEventListener('click', function(){ showView('cases'); setActiveNav('cases'); });
    var gotoBtn = document.getElementById('detailView').querySelector('[data-goto]');
    if(gotoBtn) gotoBtn.addEventListener('click', function(){ selectLetterCase(c.id); showView('letters'); setActiveNav('letters'); });
    document.getElementById('logPaymentBtn').addEventListener('click', async function(){
      var amt = parseFloat(document.getElementById('paymentAmount').value);
      var d = document.getElementById('paymentDate').value;
      if(!amt || amt<=0){ toast('Enter an amount first.'); return; }
      var oldest = c.invoices.slice().sort(function(a,b){ return String(a.due_date).localeCompare(String(b.due_date)); })[0];
      var invId = oldest ? oldest.id : null; // applied to the oldest unpaid invoice
      var r = await sb.from('payments').insert({ org_id: currentOrg.id, case_id: c.id, invoice_id: invId, amount: amt, paid_at: d, method: 'manual', source: 'manual', created_by: session.user.id });
      if(r.error){ toast('Could not log payment: ' + r.error.message); return; }
      await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: 'payment_logged', title: 'Payment logged', body: money(amt) + ' recorded manually', created_by: session.user.id });
      toast('Payment logged.');
      await loadCases(); openCase(c.id); renderDashboard(); renderCasesTable(currentCaseFilter);
    });
    var toDR = document.getElementById('toDebtRecoveryBtn');
    if(toDR) toDR.addEventListener('click', async function(){
      var r = await sb.from('cases').update({ status: 'debt_recovery' }).eq('id', c.id);
      if(r.error){ toast('Could not update case: ' + r.error.message); return; }
      await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: 'debt_recovery_started', title: 'Moved to Debt Recovery', body: 'Escalated beyond letters of demand.', created_by: session.user.id });
      toast('Case moved to Debt Recovery.');
      await loadCases(); openCase(c.id); renderDashboard(); renderCasesTable(currentCaseFilter);
    });
    var openRec = document.getElementById('openRecoveryBtn');
    if(openRec) openRec.addEventListener('click', function(){ recState.caseId = c.id; showView('recovery'); setActiveNav('recovery'); });
    var toTrib = document.getElementById('toTribunalBtn');
    if(toTrib) toTrib.addEventListener('click', async function(){
      var body = document.getElementById('tribunalSelect').value;
      var r = await sb.from('cases').update({ status: 'tribunal', tribunal_body: body }).eq('id', c.id);
      if(r.error){ toast('Could not update case: ' + r.error.message); return; }
      await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: 'tribunal_referred', title: 'Referred to ' + body, body: 'Case escalated to ' + body + ' for formal hearing.', created_by: session.user.id });
      toast('Referred to ' + body + '.');
      await loadCases(); openCase(c.id); renderDashboard(); renderCasesTable(currentCaseFilter);
    });
    var markRes = document.getElementById('markResolvedBtn');
    if(markRes) markRes.addEventListener('click', async function(){
      var r = await sb.from('cases').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', c.id);
      if(r.error){ toast('Could not update case: ' + r.error.message); return; }
      await sb.from('case_events').insert({ org_id: currentOrg.id, case_id: c.id, event_type: 'resolved', title: 'Case resolved', body: 'Marked resolved.', created_by: session.user.id });
      toast('Case marked resolved.');
      await loadCases(); openCase(c.id); renderDashboard(); renderCasesTable(currentCaseFilter);
    });
  }

  var TITLES = {
    dashboard:['Dashboard','Overview of outstanding debt across all clients'],
    settings:['Settings','Your business details and logo, used on statements and letters'],
    cases:['Debtors & Cases','Every open and resolved recovery case'],
    detail:['Case detail','Full history for this debtor'],
    letters:['Letters of Demand','Draft, preview and send recovery correspondence'],
    recovery:['Debt Recovery','Take an unpaid debt to your state’s tribunal or court, step by step'],
    statements:['Account Statements','Compile multi-invoice statements for one or more contacts'],
    payments:['Payment Portal','Where and how debtors pay you'],
    interest:['Interest & Fees','Rules, overdue invoices and what each will be charged'],
    portal:['Debtor Portal','Live preview of the self-service page your debtors see'],
    integrations:['Integrations','Connected accounting, email and calendar tools']
  };
  function showView(name){
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function(v){ v.hidden = v.getAttribute('data-view') !== name; });
    document.getElementById('pageTitle').textContent = TITLES[name][0];
    document.getElementById('pageSub').textContent = TITLES[name][1];
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0,0);
    if(name === 'recovery'){ renderRecoveryCaseOptions(); selectRecoveryCase(recState.caseId); }
    if(name === 'settings') renderSettings();
    curView = name; shellRefresh();
  }
  function setActiveNav(name){ Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function(b){ b.classList.toggle('active', b.getAttribute('data-view')===name); }); }
  Array.prototype.forEach.call(document.querySelectorAll('.nav-btn[data-view]'), function(btn){ btn.addEventListener('click', function(){ var v=this.getAttribute('data-view'); showView(v); setActiveNav(v); }); });
  document.addEventListener('click', function(e){ var t = e.target.closest && e.target.closest('[data-goto-settings]'); if(!t) return; e.preventDefault(); showView('settings'); setActiveNav('settings'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-goto="cases"]'), function(btn){ btn.addEventListener('click', function(){ showView('cases'); setActiveNav('cases'); }); });

  /* ---------- letters ---------- */
  function textToParagraphs(t){ return escapeHtml(t||'').split(/\n{2,}/).map(function(p){ return '<p>'+p.replace(/\n/g,'<br>')+'</p>'; }).join(''); }
  async function loadNoteFlags(c){
    if(!c || !c.debtor || !c.debtor.id) return [];
    var r = await sb.from('case_notes').select('invoice_id, category, summary, promised_date, promised_amount, dispute_reason, occurred_at')
      .eq('debtor_id', c.debtor.id).order('occurred_at', { ascending: false }).limit(40);
    var notes = r.data || [], flags = [], today = new Date().toISOString().slice(0,10), recentCut = Date.now() - 45*86400000;
    var latestByInv = {}; notes.forEach(function(n){ if(n.invoice_id && !latestByInv[n.invoice_id]) latestByInv[n.invoice_id] = n; });
    var disputed = c.invoices.filter(function(i){ return latestByInv[i.id] && latestByInv[i.id].category === 'dispute'; });
    if(disputed.length) flags.push({ level:'stop', message:'Disputed by the debtor: ' + disputed.map(function(i){ var n = latestByInv[i.id]; return i.invoice_number + (n.dispute_reason ? ' ('+n.dispute_reason+')' : ''); }).join('; ') + '. Respond to the dispute before demanding payment of these invoices.' });
    var recent = notes.filter(function(n){ return new Date(n.occurred_at).getTime() > recentCut; });
    var promise = recent.filter(function(n){ return n.category === 'promise_to_pay' && n.promised_date; })[0];
    if(promise && promise.promised_date >= today) flags.push({ level:'caution', message:'Debtor promised to pay' + (promise.promised_amount ? ' '+money(promise.promised_amount) : '') + ' by ' + fmt(promise.promised_date) + '. Consider waiting until then.' });
    else if(promise) flags.push({ level:'info', message:'Debtor promised to pay by ' + fmt(promise.promised_date) + ' and has not paid.' });
    if(recent.some(function(n){ return n.category === 'payment_made'; })) flags.push({ level:'caution', message:'Debtor says they have already paid. Check bank records before sending a demand.' });
    if(recent.some(function(n){ return n.category === 'hardship'; })) flags.push({ level:'caution', message:'Debtor has raised financial hardship. Offer a payment arrangement and avoid pressure.' });
    if(recent.some(function(n){ return n.category === 'payment_plan_request'; })) flags.push({ level:'info', message:'Debtor has asked for a payment plan.' });
    return flags;
  }
  // Notices can be closed. Warnings that stop a send ('stop') come back next session; the rest stay closed
  // until their wording changes (a new bank change, a different dispute), so new situations still show.
  function flagKey(f){ var s = String(f.level) + '|' + String(f.message), h = 0; for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; } return 'f' + (h >>> 0).toString(36); }
  function flagClosed(f){ var k = flagKey(f); try { return (f.level === 'stop' ? sessionStorage : localStorage).getItem('dj.flag.' + k) === '1'; } catch(e){ return false; } }
  function renderFlags(el, flags){
    var list = (flags || []).filter(function(f){ return !flagClosed(f); });
    el.innerHTML = list.map(function(f){ return '<div class="ai-flag '+escapeHtml(f.level)+' dj-dismissable" data-flag="'+flagKey(f)+'" data-flag-level="'+escapeHtml(f.level)+'"><span>'+escapeHtml(f.message)+'</span><button type="button" class="flag-x" aria-label="Close this notice" title="'+(f.level === 'stop' ? 'Hide until you next sign in' : 'Hide this notice')+'">×</button></div>'; }).join('');
  }
  document.addEventListener('click', function(e){
    var x = e.target.closest && e.target.closest('.flag-x'); if(!x) return;
    var box = x.closest('[data-flag]'), k = box.getAttribute('data-flag');
    try { (box.getAttribute('data-flag-level') === 'stop' ? sessionStorage : localStorage).setItem('dj.flag.' + k, '1'); } catch(err){}
    box.remove();
  });
  // Calls a server function and returns its JSON even when it answers with an error status.
  async function invokeFn(name, body){
    var res = await sb.functions.invoke(name, { body: body });
    if(!res.error) return res.data || {};
    var out = { error: res.error.message };
    if(res.error.context && typeof res.error.context.json === 'function'){
      try{ var j = await res.error.context.json(); if(j) out = Object.assign(out, j); }catch(e){}
    }
    return out;
  }
