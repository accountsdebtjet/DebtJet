/* DebtJet: interest-fees.js
 * Payment Portal and Interest & Fees: overdue invoices, Post to Xero, Terms & rules, acceptance evidence.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- Payment Portal + Interest & Fees pages ---------- */
  function canEditPayments(){ return currentOrg && (currentOrg.role === 'owner' || currentOrg.role === 'admin'); }
  var chgFeesDraft = [];
  function renderPaymentsView(){
    var p = orgPayment || {}, c = orgCharges || {};
    var set = function(id, v){ document.getElementById(id).value = v == null ? '' : v; };
    set('payAccountName', p.account_name); set('payBsb', p.bsb); set('payAccountNumber', p.account_number); set('payBankName', p.bank_name);
    set('payPayidType', p.payid_type || ''); set('payPayid', p.payid); set('payBpay', p.bpay_biller_code);
    set('payRefFormat', p.reference_format || 'invoice'); set('payOnline', p.online_provider || 'none'); set('payInstructions', p.instructions);
    document.getElementById('payShowBank').checked = orgPayment ? !!p.show_bank : true;
    document.getElementById('payShowPayid').checked = !!p.show_payid;
    document.getElementById('payShowBpay').checked = !!p.show_bpay;
    var edit = canEditPayments();
    Array.prototype.forEach.call(document.querySelectorAll('[data-view="payments"] input, [data-view="payments"] select, [data-view="payments"] textarea, #chgRules input, #chgRules select, #chgRules [data-start], #paySaveBtn, #chgSaveBtn, [data-addfee]'), function(el){
      el.disabled = !edit;
    });
    document.getElementById('payRoleNote').textContent = edit ? '' : 'View only: ask an owner or admin to change these';
    document.getElementById('chgRoleNote').textContent = edit ? '' : 'View only: ask an owner or admin to change the rules';
    renderFlags(document.getElementById('payBanner'), bankChangedRecently() ? [{ level: 'stop', message: 'Bank details changed ' + fmtDateTime(p.bank_changed_at) + '. If this wasn\'t you, change your password and fix the details now.' }] : []);
    document.getElementById('payChangeLog').innerHTML = paymentChanges.length
      ? '<table class="change-log"><tbody>' + paymentChanges.map(function(x){
          return '<tr><td style="white-space:nowrap;">'+escapeHtml(fmtDateTime(x.changed_at))+'</td><td>'+escapeHtml(x.summary)+(x.changed_by === session.user.id ? ' <span class="hint-r">(you)</span>' : '')+'</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-note">No changes yet.</div>';

    loadRulesForm(termsSel());
    var invSel = document.getElementById('calcInvoice');
    invSel.innerHTML = '<option value="">—</option>' + stmtInvoices.filter(function(i){ return !i.fullyPaid; }).slice(0, 300).map(function(i){
      return '<option value="'+escapeHtml(i.id)+'">'+escapeHtml((i.invoice_number || '—') + ' · ' + (i.debtor.name || '') + ' · ' + money(i.amount - (i.paid || 0)))+'</option>';
    }).join('');
    if(!document.getElementById('calcDue').value){
      var d = new Date(); d.setDate(d.getDate() - 45); document.getElementById('calcDue').value = d.toISOString().slice(0, 10);
    }
    if(!document.getElementById('calcAsAt').value) document.getElementById('calcAsAt').value = new Date().toISOString().slice(0, 10);
    renderCalculator();
    if(!chgTab) showChargeTab(chargesOn() ? 'invoices' : 'terms');
    renderTermsTab();
    renderChargesPortal();
  }
  var FEE_PRESETS = {
    admin:    { name: 'Admin fee', type: 'fixed', amount: 25, applies: 'per_statement', after_days: 30 },
    late:     { name: 'Late payment fee', type: 'fixed', amount: 15, applies: 'per_invoice', after_days: 14 },
    reminder: { name: 'Reminder fee', type: 'fixed', amount: 10, applies: 'per_statement', after_days: 7 },
    custom:   { name: '', type: 'fixed', amount: 0, applies: 'per_invoice', after_days: 1 }
  };
  function renderFeeRows(){
    var edit = canEditPayments();
    document.getElementById('chgFees').innerHTML = chgFeesDraft.length ? chgFeesDraft.map(function(f, i){
      var dis = edit ? '' : ' disabled';
      return '<div class="fee-row" data-fee="'+i+'">'
        + '<label>Name'+termsTag((termsSources().fees || {})[String(f.name || '').toLowerCase()])+'<input data-f="name" maxlength="40" value="'+escapeHtml(f.name || '')+'" readonly title="Fees come from your terms" /></label>'
        + '<label>Type<select data-f="type" disabled><option value="fixed"'+(f.type==='fixed'?' selected':'')+'>$ fixed</option><option value="percent"'+(f.type==='percent'?' selected':'')+'>% of balance</option></select></label>'
        + '<label>'+(f.type === 'percent' ? '%' : '$')+'<input data-f="amount" type="number" min="0" step="0.01" value="'+escapeHtml(f.amount)+'"'+dis+' /></label>'
        + '<button type="button" class="btn sm ghost" data-fee-remove="'+i+'"'+dis+' title="Remove">✕</button>'
        + '<label class="fee-wide">Charged<select data-f="applies" disabled><option value="per_invoice"'+(f.applies==='per_invoice'?' selected':'')+'>On each invoice</option><option value="per_statement"'+(f.applies==='per_statement'?' selected':'')+'>Once per statement</option></select></label>'
        + '<label>Once overdue (days)<input data-f="after_days" type="number" min="1" max="365" value="'+escapeHtml(f.after_days || 1)+'"'+dis+' /></label></div>';
    }).join('') : '<div class="empty-note">No fees. Add one below.</div>';
  }
  document.getElementById('chgFees').addEventListener('input', function(e){
    var row = e.target.closest('[data-fee]'), k = e.target.getAttribute('data-f'); if(!row || !k) return;
    var f = chgFeesDraft[Number(row.getAttribute('data-fee'))];
    f[k] = (k === 'amount' || k === 'after_days') ? Number(e.target.value) : e.target.value;
    if(k === 'type') renderFeeRows();
    renderCalculator(); renderChargesPortal();
  });
  document.getElementById('chgFees').addEventListener('change', function(e){ if(e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  document.getElementById('chgFees').addEventListener('click', function(e){
    var i = e.target.getAttribute('data-fee-remove'); if(i == null) return;
    chgFeesDraft.splice(Number(i), 1); renderFeeRows(); renderCalculator(); renderChargesPortal();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-addfee]'), function(b){
    b.addEventListener('click', function(){
      if(chgFeesDraft.length >= 12){ toast('Up to 12 fees.'); return; }
      chgFeesDraft.push(Object.assign({}, FEE_PRESETS[this.getAttribute('data-addfee')])); renderFeeRows(); renderCalculator(); renderChargesPortal();
    });
  });
  function readChargesForm(){
    var pct = function(id){ var v = document.getElementById(id).value; return v === '' ? null : Number(v) / 100; };
    var modeEl = document.querySelector('input[name="chgMode"]:checked');
    return {
      apply_mode: modeEl ? modeEl.value : 'auto',
      interest_start: startBasisFromForm(),
      terms_allow_charges: document.getElementById('chgTerms').checked,
      interest_enabled: document.getElementById('chgInterestOn').checked,
      rate_pa: Math.min(1, Math.max(0, pct('chgRate') || 0)),
      method: document.getElementById('chgMethod').value,
      grace_days: Math.min(365, Math.max(0, parseInt(document.getElementById('chgGrace').value, 10) || 0)),
      min_balance: Math.max(0, Number(document.getElementById('chgMinBal').value) || 0),
      cap_pct: pct('chgCap') ? Math.min(5, pct('chgCap')) : null,
      fees: chgFeesDraft.filter(function(f){ return (f.name || '').trim() && Number(f.amount) > 0; }).map(function(f){
        return { name: String(f.name).trim().slice(0, 40), type: f.type === 'percent' ? 'percent' : 'fixed', amount: r2(f.amount),
          applies: f.applies === 'per_statement' ? 'per_statement' : 'per_invoice', after_days: Math.min(365, Math.max(1, parseInt(f.after_days, 10) || 1)) };
      })
    };
  }
  function renderCalculator(){
    var cd = termsSel(), cfg = readChargesForm();
    if(cd && termsUsable(cd)) cfg = Object.assign(clampToLimits(cfg, cd.limits).cfg, { terms_allow_charges: true });
    else cfg.terms_allow_charges = false;
    var amt = Math.max(0, Number(document.getElementById('calcAmount').value) || 0);
    var due = document.getElementById('calcDue').value, asAt = document.getElementById('calcAsAt').value, dem = document.getElementById('calcDemand').value || null;
    document.getElementById('calcDemand').closest('label').hidden = !/demand/.test(cfg.interest_start);
    var out = document.getElementById('calcOut');
    if(!due || !asAt){ out.innerHTML = ''; return; }
    var ch = invoiceCharges({ id: 'calc', case_id: 'calc', due_date: due, balance: amt }, cfg, { asAt: asAt, demandDate: dem, decision: null, disputed: false });
    var sf = ch.applied || ch.state === 'pending' ? calcStatementFees([{ balance: amt, daysOverdue: ch.daysOverdue, disputed: false, fullyPaid: false }], cfg) : [];
    var total = r2(amt + ch.interest + ch.feeTotal + sf.reduce(function(s, f){ return s + f.amount; }, 0));
    var rate = r2(cfg.rate_pa * 100);
    var why = !cfg.terms_allow_charges ? 'No charges: choose a set of terms on the Terms & rules tab and confirm what it allows.'
      : ch.daysOverdue <= 0 ? 'Not overdue on that date.'
      : !cfg.interest_enabled ? 'Interest is switched off.'
      : !ch.interest ? (ch.note || ch.label)
      : (cfg.method === 'compound_monthly' ? money(amt) + ' × ((1 + ' + rate + '% ÷ 12) ^ (' + ch.chargeDays + ' ÷ 30.42) − 1)' : money(amt) + ' × ' + rate + '% × ' + ch.chargeDays + ' ÷ 365') + (ch.note ? ' · ' + ch.note : '');
    out.innerHTML = '<table class="calc-table"><tbody>'
      + '<tr><td>Days overdue</td><td class="num">'+Math.max(0, ch.daysOverdue)+'</td></tr>'
      + '<tr><td>Interest counts from</td><td class="num">'+(ch.startDate ? escapeHtml(fmt(ch.startDate)) : '—')+'</td></tr>'
      + '<tr><td>Days interest is charged</td><td class="num">'+ch.chargeDays+'</td></tr>'
      + '<tr><td>Amount owing</td><td class="num">'+money(amt)+'</td></tr>'
      + '<tr><td>Interest<div class="hint-r">'+escapeHtml(why)+'</div></td><td class="num">'+money(ch.interest)+'</td></tr>'
      + ch.fees.concat(sf).map(function(f){ return '<tr><td>'+escapeHtml(f.name)+'</td><td class="num">'+money(f.amount)+'</td></tr>'; }).join('')
      + '<tr class="tot"><td>Total payable</td><td class="num">'+money(total)+'</td></tr>'
      + (ch.perDay ? '<tr><td class="hint-r">Interest grows by</td><td class="num hint-r">'+money(ch.perDay)+' a day</td></tr>' : '')
      + (cfg.apply_mode === 'manual' ? '<tr><td colspan="2" class="hint-r">Manual mode: on a real invoice these charges wait for approval in Overdue invoices.</td></tr>' : '')
      + '</tbody></table>';
  }
  ['calcAmount','calcDue','calcAsAt','calcDemand'].forEach(function(id){
    document.getElementById(id).addEventListener('input', renderCalculator);
    document.getElementById(id).addEventListener('change', renderCalculator);
  });
  document.getElementById('calcInvoice').addEventListener('change', function(){
    var inv = stmtInvoices.filter(function(x){ return x.id === this.value; }, this)[0]; if(!inv) return;
    document.getElementById('calcAmount').value = r2(inv.amount - (inv.paid || 0));
    document.getElementById('calcDue').value = String(inv.due_date).slice(0, 10);
    var dd = demandDates[inv.case_id] || {};
    document.getElementById('calcDemand').value = (dd.first || '').slice(0, 10);
    document.getElementById('calcAsAt').value = new Date().toISOString().slice(0, 10);
    renderCalculator();
  });
  document.getElementById('payBsb').addEventListener('input', function(){
    var d = this.value.replace(/\D/g, '').slice(0, 6);
    this.value = d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
  });
  document.getElementById('payAccountNumber').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); });
  document.getElementById('payBpay').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); });
  document.getElementById('paySaveBtn').addEventListener('click', async function(){
    if(!canEditPayments()) return;
    var v = function(id){ var x = document.getElementById(id).value.trim(); return x === '' ? null : x; };
    var row = {
      org_id: currentOrg.id, account_name: v('payAccountName'), bsb: v('payBsb'), account_number: v('payAccountNumber'), bank_name: v('payBankName'),
      payid_type: v('payPayidType'), payid: v('payPayid'), bpay_biller_code: v('payBpay'),
      reference_format: document.getElementById('payRefFormat').value, online_provider: document.getElementById('payOnline').value,
      instructions: v('payInstructions'),
      show_bank: document.getElementById('payShowBank').checked, show_payid: document.getElementById('payShowPayid').checked, show_bpay: document.getElementById('payShowBpay').checked
    };
    var bad = [];
    document.getElementById('payBsb').classList.toggle('bad', !!row.bsb && !/^\d{3}-\d{3}$/.test(row.bsb));
    document.getElementById('payAccountNumber').classList.toggle('bad', !!row.account_number && !/^\d{5,10}$/.test(row.account_number));
    if(row.bsb && !/^\d{3}-\d{3}$/.test(row.bsb)) bad.push('BSB must be 6 digits (000-000).');
    if(row.account_number && !/^\d{5,10}$/.test(row.account_number)) bad.push('Account number must be 5 to 10 digits.');
    if(!!row.bsb !== !!row.account_number) bad.push('Enter both BSB and account number, or neither.');
    if(row.bsb && !row.account_name) bad.push('Add the account name (as the bank has it) so payers can check it.');
    if(row.payid && !row.payid_type) bad.push('Choose the PayID type.');
    if(row.payid_type === 'email' && row.payid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.payid)) bad.push('PayID email looks wrong.');
    if(row.payid_type === 'phone' && row.payid && !/^(\+?61|0)4\d{8}$/.test(row.payid.replace(/\s/g, ''))) bad.push('PayID mobile should be an Australian mobile, e.g. 0412 345 678.');
    if(row.payid_type === 'abn' && row.payid && row.payid.replace(/\s/g, '').length !== 11) bad.push('PayID ABN should be 11 digits.');
    if(row.bpay_biller_code && !/^\d{4,10}$/.test(row.bpay_biller_code)) bad.push('BPAY biller code must be digits.');
    if(bad.length){ toast(bad[0]); return; }
    var old = orgPayment || {};
    var bankChanged = old.bsb !== row.bsb || old.account_number !== row.account_number || old.account_name !== row.account_name || old.payid !== row.payid || old.bpay_biller_code !== row.bpay_biller_code;
    if(bankChanged && (old.bsb || old.payid) && !await djAsk('You are changing where debtors send money.\n\nNew details:\nAccount name: ' + (row.account_name || '—') + '\nBSB: ' + (row.bsb || '—') + '\nAccount: ' + (row.account_number || '—') + (row.payid ? '\nPayID: ' + row.payid : '') + '\n\nThis is logged, and staff will be warned for 24 hours. Continue?')) return;
    var r = await sb.from('org_payment_details').upsert(row, { onConflict: 'org_id' }).select('*').single();
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    orgPayment = r.data;
    var lg = await sb.from('payment_detail_changes').select('changed_at, summary, changed_by').eq('org_id', currentOrg.id).order('changed_at', { ascending: false }).limit(15);
    paymentChanges = lg.data || [];
    renderPaymentsView(); renderStatementPreview();
    toast('Payment details saved.');
  });
  document.getElementById('chgSaveBtn').addEventListener('click', async function(){
    if(!canEditPayments()) return;
    var d = termsSel(); if(!d || !termsConfirmed(d) || !TERMS_CHARGE_KINDS[d.kind]){ toast('Confirm what these terms allow first.'); return; }
    var cfg = readChargesForm(), chk = clampToLimits(cfg, d.limits);
    if(chk.issues.length){ await djAsk('These rules go beyond what “' + d.title + '” allows:\n\n• ' + chk.issues.join('\n• ') + '\n\nLower them to the terms, or switch them off, then save again.', { ok: 'OK', cancel: false }); return; }
    var rules = { interest_enabled: cfg.interest_enabled, rate_pa: cfg.rate_pa, method: cfg.method, interest_start: cfg.interest_start, grace_days: cfg.grace_days, min_balance: cfg.min_balance, cap_pct: cfg.cap_pct, fees: cfg.fees };
    var ru = await sb.from('org_terms_documents').update({ rules: rules }).eq('id', d.id).select('*').single();
    if(ru.error){ toast('Could not save: ' + ru.error.message); return; }
    termsDocs = termsDocs.map(function(x){ return x.id === d.id ? ru.data : x; });
    cfg = { apply_mode: cfg.apply_mode };
    var r = await sb.from('org_charge_settings').upsert(Object.assign({ org_id: currentOrg.id, updated_by: session.user.id, updated_at: new Date().toISOString() }, cfg), { onConflict: 'org_id' }).select('*').single();
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    orgCharges = r.data; if(!Array.isArray(orgCharges.fees)) orgCharges.fees = [];
    renderTermsTab();
    await loadCases(); renderDashboard(); renderCasesTable(currentCaseFilter || 'all');
    renderPaymentsView(); renderStatementPreview();
    toast('Rules saved for customers on “' + d.title + '”.');
  });
  /* ---------- Interest & Fees portal ---------- */
  function savedChargeKey(c){
    if(!c) return '';
    return JSON.stringify([!!c.terms_allow_charges, c.apply_mode || 'auto', !!c.interest_enabled, r2(Number(c.rate_pa) * 10000), c.method || 'simple',
      c.interest_start || 'after_grace', Number(c.grace_days) || 0, r2(c.min_balance), c.cap_pct ? r2(Number(c.cap_pct) * 10000) : null,
      (c.fees || []).map(function(f){ return [f.name, f.type, r2(f.amount), f.applies, Number(f.after_days)]; })]);
  }
  // preview: { docId, cfg } to show unsaved rules for one set of terms, or null for the saved rules.
  function chargeRowsFor(preview){
    var today = localTodayISO();
    return stmtInvoices.filter(function(i){ return !i.fullyPaid && i.due_date && isoDiff(today, i.due_date) > 0; }).map(function(i){
      var bal = r2(Math.max(0, i.amount - (i.paid || 0)));
      var ch = invoiceCharges({ id: i.id, case_id: i.case_id, debtor_id: invDebtorId(i), issued_date: i.issued_date, due_date: i.due_date, balance: bal }, undefined, preview ? { override: preview } : {});
      return { inv: i, balance: bal, ch: ch };
    }).filter(function(r){ return r.balance > 0; }).sort(function(a, b){ return b.ch.daysOverdue - a.ch.daysOverdue; });
  }
  var chgSelected = {}, chgOpen = {}, chgTab = null;
  function chargeFilterMatch(r){
    var f = document.getElementById('chgFilter').value, age = Number(document.getElementById('chgAge').value) || 0;
    var q = document.getElementById('chgSearch').value.trim().toLowerCase();
    if(r.ch.daysOverdue < age) return false;
    if(q && ((r.inv.debtor.name || '') + ' ' + (r.inv.invoice_number || '')).toLowerCase().indexOf(q) < 0) return false;
    if(f === 'all') return true;
    if(f === 'noterms') return !!(r.ch.terms && !r.ch.terms.ok);
    if(f === 'none') return r.ch.state === 'nothing' || r.ch.state === 'off';
    return r.ch.state === f;
  }
  function renderChargesPortal(){
    if(!document.getElementById('chgTable')) return;
    if(chgTab === 'invoices') setTimeout(renderXeroPosting, 0);
    if(chgTab === 'terms') setTimeout(renderTermsTab, 0);
    var preview = chargePreview(), dirty = !!preview;
    var rows = chargeRowsFor(preview);
    // KPI tiles
    var sum = function(arr, f){ return r2(arr.reduce(function(s, r){ return s + f(r); }, 0)); };
    var by = function(st){ return rows.filter(function(r){ return r.ch.state === st; }); };
    var applied = by('applied'), pending = by('pending'), waived = by('waived');
    var pot = function(r){ return r.ch.interest + r.ch.feeTotal; };
    document.getElementById('chgKpis').innerHTML =
      '<div class="kpi"><div class="label">Overdue invoices</div><div class="value">'+rows.length+'</div><div class="delta">'+money(sum(rows, function(r){ return r.balance; }))+' owing</div></div>'
      + '<div class="kpi"><div class="label">Being charged</div><div class="value">'+money(sum(applied, pot))+'</div><div class="delta">'+applied.length+' invoices</div></div>'
      + '<div class="kpi"><div class="label">Awaiting approval</div><div class="value">'+money(sum(pending, pot))+'</div><div class="delta">'+pending.length+' invoices</div></div>'
      + '<div class="kpi"><div class="label">Waived</div><div class="value">'+money(sum(waived, pot))+'</div><div class="delta">'+waived.length+' invoices</div></div>'
      + '<div class="kpi"><div class="label">Interest per day</div><div class="value">'+money(sum(applied, function(r){ return r.ch.perDay; }))+'</div><div class="delta">on invoices being charged</div></div>';
    var banner = [];
    var noTerms = rows.filter(function(r){ return r.ch.terms && !r.ch.terms.ok; });
    if(!termsDocs.some(termsUsable)) banner.push({ level: 'info', message: 'No interest or fees can be added yet. Start on the Terms & rules tab: add your terms of trade, confirm what they allow, and record which customers accepted them.' });
    else if(noTerms.length) banner.push({ level: 'info', message: noTerms.length + ' overdue invoice' + (noTerms.length === 1 ? ' has' : 's have') + ' no interest or fees because no accepted terms are on file for that customer' + (noTerms.some(function(r){ return r.ch.terms.code === 'before_acceptance'; }) ? ' (or the invoice was issued before they accepted)' : '') + '. Statements, letters and Debt Recovery still work for the amounts owing.' });
    if(dirty) banner.push({ level: 'caution', message: 'Previewing unsaved rules for “' + (termsSel() || {}).title + '”. Save them on the Terms & rules tab to use them on statements and letters.' });
    renderFlags(document.getElementById('chgBanner'), banner);
    // table
    var shown = rows.filter(chargeFilterMatch);
    Object.keys(chgSelected).forEach(function(k){ if(!shown.some(function(r){ return r.inv.id === k; })) delete chgSelected[k]; });
    var allOn = shown.length && shown.every(function(r){ return chgSelected[r.inv.id]; });
    var head = '<thead><tr><th><input type="checkbox" id="chgAll"'+(allOn ? ' checked' : '')+' aria-label="Select all" /></th><th>Invoice</th><th>Due</th><th class="num">Days overdue</th><th class="num">Balance</th><th>Interest from</th><th class="num">Interest</th><th class="num">Fees</th><th class="num">Per day</th><th>Status</th><th></th></tr></thead>';
    var body = shown.length ? shown.map(function(r){
      var c = r.ch, i = r.inv, id = escapeHtml(i.id);
      var dim = c.state === 'waived' || c.state === 'disputed' || c.state === 'off' || c.state === 'nothing';
      var canApply = c.state === 'pending' || c.state === 'waived';
      var canWaive = c.state === 'applied' || c.state === 'pending';
      var dec = c.decision;
      var tr = '<tr class="'+(dim ? 'dim' : '')+'" data-row="'+id+'"><td><input type="checkbox" data-sel="'+id+'"'+(chgSelected[i.id] ? ' checked' : '')+' /></td>'
        + '<td><b style="white-space:nowrap;">'+escapeHtml(i.invoice_number || '—')+'</b><span class="sub">'+escapeHtml(i.debtor.name || '')+'</span></td>'
        + '<td style="white-space:nowrap;">'+escapeHtml(fmt(i.due_date))+'</td>'
        + '<td class="num"><b>'+c.daysOverdue+'</b></td>'
        + '<td class="num">'+money(r.balance)+'</td>'
        + '<td style="white-space:nowrap;">'+(c.startDate ? escapeHtml(fmt(c.startDate))+'<span class="sub">'+c.chargeDays+' day'+(c.chargeDays === 1 ? '' : 's')+' charged</span>' : '—')+'</td>'
        + '<td class="num">'+(c.interest ? money(c.interest) : '—')+'</td>'
        + '<td class="num">'+(c.feeTotal ? money(c.feeTotal) : '—')+'</td>'
        + '<td class="num">'+(c.perDay ? money(c.perDay) : '—')+'</td>'
        + '<td><span class="chg-pill '+c.state+'">'+escapeHtml(c.label)+'</span>'+(dec ? '<span class="sub">'+(dec.decision === 'waive' ? 'Waived' : 'Approved')+' '+escapeHtml(new Date(dec.decided_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'}))+(dec.decided_by === session.user.id ? ', you' : '')+'</span>' : '')+'</td>'
        + '<td><div class="chg-acts">'
        +   (canApply ? '<button type="button" class="go" data-act="apply" data-id="'+id+'">Apply</button>' : '')
        +   (canWaive ? '<button type="button" data-act="waive" data-id="'+id+'">Waive</button>' : '')
        +   (dec ? '<button type="button" data-act="reset" data-id="'+id+'" title="Back to the rule">↺</button>' : '')
        +   '<button type="button" data-act="more" data-id="'+id+'" title="Show the working">'+(chgOpen[i.id] ? '▴' : '▾')+'</button>'
        + '</div></td></tr>';
      if(chgOpen[i.id]) tr += '<tr class="chg-detail"><td></td><td colspan="10">'+chargeWorking(r, null)+'</td></tr>';
      return tr;
    }).join('') : '<tr><td colspan="11" class="empty-note">No overdue invoices match.</td></tr>';
    var chg = shown.filter(function(r){ return r.ch.applied; });
    var foot = shown.length ? '<tfoot><tr><td></td><td colspan="3">'+shown.length+' shown · totals of charges being made</td><td class="num">'+money(sum(shown, function(r){ return r.balance; }))+'</td><td></td>'
      + '<td class="num">'+money(sum(chg, function(r){ return r.ch.interest; }))+'</td><td class="num">'+money(sum(chg, function(r){ return r.ch.feeTotal; }))+'</td>'
      + '<td class="num">'+money(sum(chg, function(r){ return r.ch.perDay; }))+'</td><td colspan="2"></td></tr></tfoot>' : '';
    document.getElementById('chgTable').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
    var n = Object.keys(chgSelected).length;
    document.getElementById('chgBulk').hidden = !n;
    document.getElementById('chgBulkCount').textContent = n + ' selected';
    renderChargeRuleHelp();
    if(chgTab === 'terms') renderRulesHints();
  }
  function chargeWorking(r, cfg){
    var c = r.ch, parts = [];
    if(c.terms && c.terms.ok){ var pv = chargePreview(); cfg = pv && pv.docId === c.terms.doc.id ? clampToLimits(pv.cfg, c.terms.doc.limits).cfg : c.terms.cfg; parts.push('Terms: “' + c.terms.doc.title + '”, accepted ' + fmt(c.terms.acc.accepted_on) + ' (' + (ACCEPT_HOW[c.terms.acc.accepted_how] || '').toLowerCase() + ').'); }
    else if(c.terms) parts.push(c.terms.note);
    if(!cfg) return '<div class="chg-working">' + parts.map(escapeHtml).join('<br>') + '</div>';
    var rate = cfg ? r2(Number(cfg.rate_pa) * 100) : 0;
    if(c.interest){
      parts.push(cfg.method === 'compound_monthly'
        ? 'Interest: ' + money(r.balance) + ' × ((1 + ' + rate + '% ÷ 12) ^ (' + c.chargeDays + ' ÷ 30.42) − 1) = ' + money(c.interest)
        : 'Interest: ' + money(r.balance) + ' × ' + rate + '% × ' + c.chargeDays + ' days ÷ 365 = ' + money(c.interest));
      parts.push('Counting from ' + fmt(c.startDate) + ' (' + (START_LABEL[cfg.interest_start] || '').toLowerCase() + (cfg.grace_days && /grace/.test(cfg.interest_start) ? ', ' + cfg.grace_days + ' days' : '') + ').');
    }
    c.fees.forEach(function(f){ parts.push(f.name + ': ' + money(f.amount)); });
    if(c.note) parts.push(c.note);
    if(c.state === 'disputed') parts.push('This invoice has a dispute note from the debtor, so no interest or fees are added while it is reviewed.');
    if(c.state === 'pending') parts.push('Manual mode: nothing is added to statements or letters until someone clicks Apply.');
    if(c.decision && c.decision.reason) parts.push('Reason: ' + c.decision.reason);
    var notes = stmtNotesByInvoice[r.inv.id];
    if(notes) parts.push('Latest email note: ' + (NOTE_CATEGORY_LABEL[notes.category] || 'Note') + ' — ' + notes.summary);
    return parts.length ? parts.map(function(p){ return '<div>' + escapeHtml(p) + '</div>'; }).join('') : 'No charges on this invoice under the current rules.';
  }
  async function decideCharges(ids, decision){
    if(!ids.length) return;
    var reason = null;
    if(decision === 'waive'){
      reason = prompt('Reason for waiving charges on ' + ids.length + ' invoice' + (ids.length === 1 ? '' : 's') + ' (kept in the log):', '');
      if(reason === null) return;
      reason = reason.trim().slice(0, 300) || null;
    }
    var r;
    if(decision === 'reset') r = await sb.from('invoice_charge_decisions').delete().in('invoice_id', ids);
    else r = await sb.from('invoice_charge_decisions').upsert(ids.map(function(id){ return { invoice_id: id, org_id: currentOrg.id, decision: decision, reason: reason }; }), { onConflict: 'invoice_id' }).select('*');
    if(r.error){ toast('Could not save: ' + r.error.message); return; }
    if(decision === 'reset') ids.forEach(function(id){ delete chargeDecisions[id]; });
    else (r.data || []).forEach(function(d){ chargeDecisions[d.invoice_id] = d; });
    chgSelected = {};
    await loadCases(); renderDashboard(); renderCasesTable(currentCaseFilter || 'all');
    renderChargesPortal(); renderStatementPreview();
    toast((decision === 'apply' ? 'Charges applied to ' : decision === 'waive' ? 'Charges waived on ' : 'Back to the rule for ') + ids.length + ' invoice' + (ids.length === 1 ? '' : 's') + '.');
  }
  document.getElementById('chgTable').addEventListener('click', function(e){
    var b = e.target.closest('[data-act]');
    if(b){
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
      if(act === 'more'){ chgOpen[id] = !chgOpen[id]; renderChargesPortal(); return; }
      decideCharges([id], act); return;
    }
  });
  document.getElementById('chgTable').addEventListener('change', function(e){
    if(e.target.id === 'chgAll'){
      var on = e.target.checked;
      chargeRowsFor(chargePreview()).filter(chargeFilterMatch).forEach(function(r){ if(on) chgSelected[r.inv.id] = true; else delete chgSelected[r.inv.id]; });
      renderChargesPortal(); return;
    }
    var id = e.target.getAttribute('data-sel'); if(!id) return;
    if(e.target.checked) chgSelected[id] = true; else delete chgSelected[id];
    var n = Object.keys(chgSelected).length;
    document.getElementById('chgBulk').hidden = !n; document.getElementById('chgBulkCount').textContent = n + ' selected';
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-bulk]'), function(b){
    b.addEventListener('click', function(){ decideCharges(Object.keys(chgSelected), this.getAttribute('data-bulk')); });
  });
  ['chgFilter','chgAge'].forEach(function(id){ document.getElementById(id).addEventListener('change', renderChargesPortal); });
  document.getElementById('chgSearch').addEventListener('input', renderChargesPortal);
  document.getElementById('chgExport').addEventListener('click', function(){
    var cfg = chargePreview();
    var q = function(v){ v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Invoice','Debtor','Due date','Days overdue','Balance','Terms','Interest from','Days charged','Interest','Fees','Per day','Status','Decision','Decided at','Reason'].join(',')];
    chargeRowsFor(cfg).filter(chargeFilterMatch).forEach(function(r){
      var c = r.ch, d = c.decision || {};
      lines.push([r.inv.invoice_number, r.inv.debtor.name, r.inv.due_date, c.daysOverdue, r.balance.toFixed(2), c.terms && c.terms.ok ? c.terms.doc.title : (c.terms ? c.terms.label : ''), c.startDate || '', c.chargeDays, c.interest.toFixed(2), c.feeTotal.toFixed(2), c.perDay.toFixed(2), c.label, d.decision || '', d.decided_at || '', d.reason || ''].map(q).join(','));
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'debtjet-interest-' + localTodayISO() + '.csv'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  function showChargeTab(t){
    chgTab = t;
    if(t === 'invoices'){ renderXeroPosting(); if(xeroConnected && Date.now() - xpLoadedAt > 60000){ xpLoadedAt = Date.now(); loadXeroPostingOptions(); } }
    if(t === 'terms') renderTermsTab();
    if(curView === 'interest') setTimeout(shellRefresh, 0);
    Array.prototype.forEach.call(document.querySelectorAll('[data-chgtab]'), function(b){ b.classList.toggle('active', b.getAttribute('data-chgtab') === t); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-chgpane]'), function(p){ p.hidden = p.getAttribute('data-chgpane') !== t; });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-chgtab]'), function(b){ b.addEventListener('click', function(){ showChargeTab(this.getAttribute('data-chgtab')); }); });

  // Start-rule controls
  /* ---------- Post interest to Xero (draft invoices) ---------- */
  var xpSettingsRow = null, xpAccounts = [], xpTaxRates = [], xpLoaded = false, xpSel = {}, xpBusy = false, xpLoadedAt = 0;
  function xpLiveStatus(s){ return s !== 'voided' && s !== 'deleted'; }
  function xpRows(){
    var today = localTodayISO(), min = xpSettingsRow ? Number(xpSettingsRow.min_amount) : 1;
    var rows = [], skipped = { notXero: 0, notCharging: 0, small: 0 };
    stmtInvoices.forEach(function(i){
      if(i.fullyPaid || !i.due_date || isoDiff(today, i.due_date) <= 0 || chargeInvoiceIds[i.id]) return;
      var bal = r2(Math.max(0, i.amount - (i.paid || 0))); if(bal <= 0) return;
      var ch = invoiceCharges({ id: i.id, case_id: i.case_id, debtor_id: invDebtorId(i), issued_date: i.issued_date, due_date: i.due_date, balance: bal }, undefined, { ignorePosted: true });
      if(!ch.interest){ if(ch.state !== 'paid' && ch.state !== 'not_due') skipped.notCharging++; return; }
      if(ch.state !== 'applied'){ skipped.notCharging++; return; }
      if(i.source !== 'xero' || !i.external_id){ skipped.notXero++; return; }
      var posts = (postingsByInv[i.id] || []).filter(function(p){ return xpLiveStatus(p.status); });
      var posted = r2(posts.reduce(function(s, p){ return s + Number(p.interest); }, 0));
      var lastTo = posts.reduce(function(m, p){ return p.period_to > m ? p.period_to : m; }, '');
      var amount = r2(ch.interest - posted);
      if(lastTo && lastTo >= today) return;
      if(amount < Math.max(0.01, min)){ if(amount > 0) skipped.small++; return; }
      rows.push({ inv: i, balance: bal, ch: ch, posted: posted, from: lastTo || ch.startDate, to: today, amount: amount });
    });
    rows.sort(function(a, b){ return b.amount - a.amount; });
    return { rows: rows, skipped: skipped };
  }
  function xpCanEdit(){ return canEditOrg(); }
  function renderXeroPosting(){
    var pane = document.getElementById('chgXero'); if(!pane) return;
    var notice = document.getElementById('xpNotice');
    pane.classList.toggle('xp-off', !xeroConnected);
    if(!xeroConnected){
      notice.innerHTML = '<div class="ai-flag info">Connect Xero to post interest as draft invoices. <button type="button" class="linkbtn" data-src-open>Connect or import</button></div>';
    } else if(!chargesOn()){
      notice.innerHTML = '<div class="ai-flag caution">No interest can be posted yet: no customer has accepted terms that are on file. Set this up on the Terms &amp; rules tab.</div>';
    } else notice.innerHTML = '';
    // Settings
    var s = xpSettingsRow || {};
    var acc = document.getElementById('xpAccount'), tax = document.getElementById('xpTax');
    if(xpLoaded){
      var accOpts = xpAccounts.map(function(a){ return '<option value="'+escapeHtml(a.code)+'"'+(a.code === s.account_code ? ' selected' : '')+'>'+escapeHtml(a.code + ' · ' + a.name)+(a.type === 'OTHERINCOME' ? ' (Other Income)' : a.type === 'SALES' ? ' (Sales)' : ' (Revenue)')+'</option>'; }).join('');
      if(s.account_code && !xpAccounts.some(function(a){ return a.code === s.account_code; })) accOpts = '<option value="'+escapeHtml(s.account_code)+'" selected>'+escapeHtml(s.account_code + ' · ' + (s.account_name || ''))+' (not found in Xero)</option>' + accOpts;
      acc.innerHTML = '<option value="">Choose an account…</option>' + accOpts;
      var rev = xpTaxRates.filter(function(r){ return r.revenue; }), other = xpTaxRates.filter(function(r){ return !r.revenue; });
      var topt = function(r){ return '<option value="'+escapeHtml(r.tax_type)+'"'+(r.tax_type === s.tax_type ? ' selected' : '')+'>'+escapeHtml(r.name + ' (' + r2(r.rate) + '%)')+'</option>'; };
      tax.innerHTML = '<option value="">Choose a tax rate…</option>' + (rev.length ? '<optgroup label="Used on sales">' + rev.map(topt).join('') + '</optgroup>' : '') + (other.length ? '<optgroup label="Other tax rates">' + other.map(topt).join('') + '</optgroup>' : '');
    }
    document.getElementById('xpLat').value = s.line_amount_types || 'Exclusive';
    document.getElementById('xpDueDays').value = s.due_days != null ? s.due_days : 7;
    document.getElementById('xpMin').value = s.min_amount != null ? s.min_amount : 1;
    tax.disabled = document.getElementById('xpLat').value === 'NoTax';
    var ro = !xpCanEdit();
    ['xpAccount','xpTax','xpLat','xpDueDays','xpMin','xpSaveSettings'].forEach(function(id){ document.getElementById(id).disabled = ro || (id === 'xpTax' && document.getElementById('xpLat').value === 'NoTax'); });
    document.getElementById('xpSettingsNote').textContent = ro ? 'Only owners and admins can change these.' : '';
    var ready = !!(s.account_code && (s.line_amount_types === 'NoTax' || s.tax_type));
    document.getElementById('xpSettingsSummary').textContent = ready
      ? (s.account_code + ' · ' + (s.account_name || '') + ' · ' + (s.line_amount_types === 'NoTax' ? 'No tax' : (s.tax_name || s.tax_type) + ', tax ' + (s.line_amount_types === 'Inclusive' ? 'inclusive' : 'exclusive')) + ' · due in ' + s.due_days + ' days')
      : 'Not set up yet';
    if(!ready) document.getElementById('xpSettings').open = true;
    // Ready to post
    var res = xpRows(), rows = res.rows;
    Object.keys(xpSel).forEach(function(k){ if(!rows.some(function(r){ return r.inv.id === k; })) delete xpSel[k]; });
    document.getElementById('xpReadyCount').textContent = rows.length ? rows.length + ' invoice' + (rows.length === 1 ? '' : 's') + ' · ' + money(rows.reduce(function(t, r){ return t + r.amount; }, 0)) : '';
    var allOn = rows.length && rows.every(function(r){ return xpSel[r.inv.id]; });
    document.getElementById('xpReady').innerHTML = rows.length
      ? '<thead><tr><th><input type="checkbox" id="xpAll"'+(allOn ? ' checked' : '')+' aria-label="Select all" /></th><th>Debtor</th><th>Invoice</th><th class="num">Balance</th><th>Interest period</th><th class="num">Already posted</th><th class="num">Interest to post</th></tr></thead><tbody>'
        + rows.map(function(r){
            var days = isoDiff(r.to, r.from);
            return '<tr><td><input type="checkbox" data-xpsel="'+escapeHtml(r.inv.id)+'"'+(xpSel[r.inv.id] ? ' checked' : '')+' aria-label="Select '+escapeHtml(r.inv.invoice_number || '')+'" /></td>'
              + '<td>'+escapeHtml(r.inv.debtor.name || '')+'</td><td>'+escapeHtml(r.inv.invoice_number || '')+'<span class="sub">'+r.ch.daysOverdue+' days overdue</span></td>'
              + '<td class="num">'+money(r.balance)+'</td><td>'+fmt(r.from)+' – '+fmt(r.to)+'<span class="sub">'+days+' day'+(days === 1 ? '' : 's')+' at '+r2(r.ch.rate * 100)+'% p.a.</span></td>'
              + '<td class="num">'+(r.posted ? money(r.posted) : '—')+'</td><td class="num"><b>'+money(r.amount)+'</b></td></tr>';
          }).join('') + '</tbody>'
      : '<tbody><tr><td class="empty-note">Nothing to post right now.</td></tr></tbody>';
    var sk = res.skipped, bits = [];
    if(sk.notXero) bits.push(sk.notXero + ' charging invoice' + (sk.notXero === 1 ? ' isn’t' : 's aren’t') + ' from Xero');
    if(sk.notCharging) bits.push(sk.notCharging + ' with interest waiting, awaiting approval, waived or disputed');
    if(sk.small) bits.push(sk.small + ' under the minimum');
    document.getElementById('xpSkipped').textContent = bits.length ? 'Not listed: ' + bits.join('; ') + '.' : '';
    renderXpSelInfo(rows);
    // Posted
    var posted = [];
    Object.keys(postingsByInv).forEach(function(k){ posted = posted.concat(postingsByInv[k]); });
    posted.sort(function(a, b){ return String(b.created_at).localeCompare(String(a.created_at)); });
    var invById = {}; stmtInvoices.forEach(function(i){ invById[i.id] = i; });
    document.getElementById('xpPosted').innerHTML = posted.length
      ? '<thead><tr><th>Created</th><th>Debtor</th><th>For invoice</th><th>Period</th><th class="num">Interest</th><th>Xero invoice</th><th>Status</th></tr></thead><tbody>'
        + posted.slice(0, 200).map(function(p){
            var i = invById[p.invoice_id] || {};
            var st = { draft: ['pending', 'Draft in Xero'], authorised: ['applied', 'Approved'], paid: ['resolved', 'Paid'], voided: ['dim', 'Voided'], deleted: ['dim', 'Deleted'] }[p.status] || ['', p.status];
            var link = p.xero_invoice_id ? '<a href="https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID='+encodeURIComponent(p.xero_invoice_id)+'" target="_blank" rel="noopener">'+escapeHtml(p.xero_invoice_number || 'Open in Xero')+'</a>' : '—';
            return '<tr'+(xpLiveStatus(p.status) ? '' : ' class="dim"')+'><td>'+fmt(p.created_at)+'</td><td>'+escapeHtml((i.debtor || {}).name || '')+'</td><td>'+escapeHtml(i.invoice_number || '')+'</td>'
              + '<td>'+fmt(p.period_from)+' – '+fmt(p.period_to)+'</td><td class="num">'+money(p.interest)+'</td><td>'+link+'</td><td><span class="pill '+st[0]+'">'+escapeHtml(st[1])+'</span></td></tr>';
          }).join('') + '</tbody>'
      : '<tbody><tr><td class="empty-note">No interest has been posted to Xero yet.</td></tr></tbody>';
  }
  function renderXpSelInfo(rows){
    rows = rows || xpRows().rows;
    var sel = rows.filter(function(r){ return xpSel[r.inv.id]; });
    var s = xpSettingsRow || {}, ready = !!(s.account_code && (s.line_amount_types === 'NoTax' || s.tax_type));
    document.getElementById('xpSelInfo').textContent = sel.length ? sel.length + ' selected · ' + money(sel.reduce(function(t, r){ return t + r.amount; }, 0)) + (s.line_amount_types === 'Exclusive' && s.tax_type ? ' plus any tax' : '') : (ready ? 'Tick the invoices to post' : 'Choose the Xero account and tax rate first');
    document.getElementById('xpPostBtn').disabled = !sel.length || !ready || !xeroConnected || xpBusy;
    document.getElementById('xpPostBtn').textContent = xpBusy ? 'Creating drafts…' : sel.length ? 'Create ' + sel.length + ' draft invoice' + (sel.length === 1 ? '' : 's') + ' in Xero' : 'Create draft invoices in Xero';
    document.getElementById('xpBulk').hidden = !rows.length;
  }
  async function loadXeroPostingOptions(){
    if(!xeroConnected){ renderXeroPosting(); return; }
    var d = await invokeFn('xero-charges', { org_id: currentOrg.id, action: 'load' });
    if(d && d.ok){
      xpAccounts = d.accounts || []; xpTaxRates = d.tax_rates || []; xpLoaded = true;
      if(d.refreshed) await loadChargeContext();
    } else {
      xpLoaded = false;
      document.getElementById('xpAccount').innerHTML = '<option value="">'+escapeHtml((d && d.error) || 'Couldn’t load accounts from Xero.')+'</option>';
      document.getElementById('xpTax').innerHTML = '<option value="">—</option>';
      if(d && d.needs_reconnect) document.getElementById('xpNotice').innerHTML = '<div class="ai-flag caution">'+escapeHtml(d.error)+'</div>';
    }
    renderXeroPosting();
  }
  document.getElementById('xpLat').addEventListener('change', function(){ document.getElementById('xpTax').disabled = this.value === 'NoTax' || !xpCanEdit(); });
  document.getElementById('xpSaveSettings').addEventListener('click', async function(){
    if(!xpCanEdit()) return;
    var code = document.getElementById('xpAccount').value, lat = document.getElementById('xpLat').value, tt = document.getElementById('xpTax').value;
    if(!code){ toast('Choose the account for interest.'); return; }
    if(lat !== 'NoTax' && !tt){ toast('Choose a tax rate, or set “Amounts are” to No tax.'); return; }
    var a = xpAccounts.filter(function(x){ return x.code === code; })[0], r = xpTaxRates.filter(function(x){ return x.tax_type === tt; })[0];
    var row = { org_id: currentOrg.id, account_code: code, account_name: a ? a.name : (xpSettingsRow || {}).account_name || null,
      tax_type: lat === 'NoTax' ? null : tt, tax_name: lat === 'NoTax' ? null : (r ? r.name : null), line_amount_types: lat,
      due_days: Math.min(120, Math.max(0, Math.round(Number(document.getElementById('xpDueDays').value) || 0))),
      min_amount: Math.min(10000, Math.max(0, r2(document.getElementById('xpMin').value))), updated_at: new Date().toISOString() };
    var res = await sb.from('charge_posting_settings').upsert(row, { onConflict: 'org_id' }).select().maybeSingle();
    if(res.error){ toast('Could not save: ' + res.error.message); return; }
    xpSettingsRow = res.data || row; document.getElementById('xpSettings').open = false;
    renderXeroPosting(); toast('Xero settings saved.');
  });
  document.getElementById('chgXero').addEventListener('change', function(e){
    var t = e.target;
    if(t.id === 'xpAll'){ xpRows().rows.forEach(function(r){ if(t.checked) xpSel[r.inv.id] = true; else delete xpSel[r.inv.id]; }); renderXeroPosting(); return; }
    var id = t.getAttribute && t.getAttribute('data-xpsel'); if(!id) return;
    if(t.checked) xpSel[id] = true; else delete xpSel[id];
    renderXpSelInfo();
  });
  document.getElementById('xpPostBtn').addEventListener('click', async function(){
    var rows = xpRows().rows.filter(function(r){ return xpSel[r.inv.id]; });
    if(!rows.length || xpBusy) return;
    var total = rows.reduce(function(t, r){ return t + r.amount; }, 0);
    if(!await djAsk('Create ' + rows.length + ' draft interest invoice' + (rows.length === 1 ? '' : 's') + ' in Xero, totalling ' + money(total) + '?\n\nThey stay as drafts until you approve them in Xero.')) return;
    xpBusy = true; renderXpSelInfo();
    var ok = 0, failed = [];
    try {
      for(var k = 0; k < rows.length; k += 25){
        var batch = rows.slice(k, k + 25);
        var d = await invokeFn('xero-charges', { org_id: currentOrg.id, action: 'post', items: batch.map(function(r){
          return { invoice_id: r.inv.id, interest: r.amount, period_from: r.from, period_to: r.to, balance: r.balance, rate_pa: r.ch.rate || 0 };
        }) });
        if(!d || (d.error && !d.results)){ batch.forEach(function(r){ failed.push(r.inv.invoice_number + ': ' + ((d && d.error) || 'Failed')); }); continue; }
        (d.results || []).forEach(function(x){
          var r = batch.filter(function(b){ return b.inv.id === x.invoice_id; })[0];
          if(x.ok){ ok++; delete xpSel[x.invoice_id]; } else failed.push((r ? r.inv.invoice_number : 'Invoice') + ': ' + x.error);
        });
      }
    } finally { xpBusy = false; }
    await loadChargeContext();
    renderXeroPosting(); renderChargesPortal();
    if(failed.length) alertList((ok ? ok + ' draft' + (ok === 1 ? '' : 's') + ' created in Xero. ' : '') + failed.length + ' couldn’t be posted:', failed);
    else toast(ok + ' draft invoice' + (ok === 1 ? '' : 's') + ' created in Xero.');
  });
  function alertList(head, lines){ return djAsk(head + '\n\n• ' + lines.slice(0, 15).join('\n• ') + (lines.length > 15 ? '\n…and ' + (lines.length - 15) + ' more' : ''), { cancel: false, ok: 'OK' }); }

  function startBasisFromForm(){
    var v = document.getElementById('chgStart').value;
    if(v === 'grace') return document.getElementById('chgBackdate').checked ? 'grace_backdated' : 'after_grace';
    return v;
  }
  function renderChargeRuleHelp(){
    var basis = startBasisFromForm(), g = parseInt(document.getElementById('chgGrace').value, 10) || 0;
    var isGrace = basis === 'after_grace' || basis === 'grace_backdated';
    document.getElementById('chgGraceWrap').hidden = !isGrace;
    document.getElementById('chgBackdateWrap').hidden = !isGrace;
    var ex = { due_date: 'Interest counts from the day after the due date. An invoice 30 days overdue is charged 30 days.',
      after_grace: 'No interest for the first ' + g + ' days overdue, then interest counts from day ' + g + ' onwards. An invoice 30 days overdue is charged ' + Math.max(0, 30 - g) + ' days.',
      grace_backdated: 'No interest for the first ' + g + ' days overdue. On day ' + g + ' interest switches on and is backdated to the due date. An invoice 30 days overdue is charged ' + (30 >= g ? 30 : 0) + ' days.',
      first_demand: 'Interest counts from the date the first letter of demand was sent (or the due date, if later). No letter yet, no interest.',
      final_demand: 'Interest counts from the date the final letter of demand was sent. Until then, no interest.' }[basis];
    document.getElementById('chgStartExplain').textContent = ex;
    Array.prototype.forEach.call(document.querySelectorAll('[data-start]'), function(c){
      var k = c.getAttribute('data-start');
      c.classList.toggle('on', (k === 'due' && basis === 'due_date') || (k === 'demand' && basis === 'first_demand') || (isGrace && String(g) === k));
    });
  }
  document.getElementById('chgStartQuick').addEventListener('click', function(e){
    var k = e.target.getAttribute('data-start'); if(!k || !canEditPayments()) return;
    var sel = document.getElementById('chgStart');
    if(k === 'due') sel.value = 'due_date';
    else if(k === 'demand') sel.value = 'first_demand';
    else { sel.value = 'grace'; document.getElementById('chgGrace').value = k; }
    onChargeRulesChanged();
  });
  function onChargeRulesChanged(){ renderChargeRuleHelp(); renderCalculator(); renderChargesPortal(); }
  /* ---------- Terms & rules: sets of terms, what each allows, what you charge, who accepted them ---------- */
  var termsSelId = null, termsBusy = {}, termsEditId = null, limitsDraft = null, acceptDraft = null, limitsEditing = null;
  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var TERMS_KIND = { terms_of_trade: 'Terms of trade', terms_of_service: 'Terms of service', credit_application: 'Credit application', quote_or_contract: 'Signed quote or contract', other: 'Other document' };
  var ACCEPT_HOW = { signed_credit_application: 'Signed credit application', signed_terms: 'Signed the terms', signed_quote_or_contract: 'Signed quote or contract', accepted_in_writing: 'Accepted in writing (for example by email)', other: 'Other' };
  var TR_EFF = { supports_charges: 'Supports charges', limits_charges: 'Limits charges', neutral: 'For reference', missing: 'Not covered' };
  async function loadTermsDocs(){
    var r = await Promise.all([
      sb.from('org_terms_documents').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(50),
      sb.from('terms_acceptances').select('*').eq('org_id', currentOrg.id)
    ]);
    termsDocs = (r[0].data || []).slice(); termsAccepts = (r[1].data || []).slice();
    await loadTermsEvidence();
    await loadContactGroups();
    if(!termsDocs.some(function(d){ return d.id === termsSelId; })){
      var cur = termsDocs.filter(function(d){ return !d.archived && termsUsable(d); })[0] || termsDocs.filter(function(d){ return !d.archived; })[0] || termsDocs[0];
      termsSelId = cur ? cur.id : null;
    }
  }
  function termsSel(){ return termsDocById(termsSelId); }
  function termsConfirmed(d){ return !!(d && d.limits && d.rules_confirmed_at); }
  function clauseLabel(c){ c = String(c || '').trim(); return /^\d/.test(c) ? 'cl ' + c : c; }
  function termsTag(clause){ return clause ? '<span class="src-tag" title="From your terms">Terms '+escapeHtml(clauseLabel(clause))+'</span>' : ''; }
  function termsSources(){
    var d = termsSel(), L = d && d.limits; if(!L) return {};
    var out = { fees: {} }, ic = (L.interest || {}).clause;
    if(L.interest && L.interest.allowed){ out.rate = ic; out.method = ic; out.start = ic; }
    (L.fees || []).forEach(function(f){ out.fees[String(f.name).toLowerCase()] = f.clause || ' '; });
    return out;
  }
  function startText(basis, grace){
    return basis === 'due_date' ? 'from the due date'
      : basis === 'after_grace' ? 'after ' + grace + ' days overdue'
      : basis === 'grace_backdated' ? 'after ' + grace + ' days, backdated to the due date'
      : basis === 'first_demand' ? 'from the first letter of demand'
      : basis === 'final_demand' ? 'from the final letter of demand' : '';
  }
  function limFeeText(f){ return 'up to ' + (f.type === 'percent' ? r2(f.max_amount) + '% of the balance' : money(f.max_amount)) + (f.applies === 'per_statement' ? ' once per statement' : ' per invoice') + ', from ' + (f.min_after_days || 1) + ' days overdue'; }
  function accWho(a){
    if(a.debtor_id){ var d = stmtDebtors.filter(function(x){ return x.id === a.debtor_id; })[0]; return d ? d.name : 'A customer'; }
    if(a.group_id){ var g = stmtGroups.filter(function(x){ return x.id === a.group_id; })[0]; return 'Group: ' + (g ? g.name : 'contact group'); }
    return 'All customers';
  }
  function termsCoverage(d){
    var n = 0; stmtDebtors.forEach(function(x){ var a = acceptanceFor(x.id); if(a && a.document_id === d.id) n++; });
    return n;
  }
  // First reading of the limits from DebtJet AI's review; a person checks and confirms them.
  function limitsFromReview(d){
    var R = d.review || {}, B = termsBaseline(R);
    return {
      kind: TERMS_CHARGE_KINDS[R.document_kind] ? R.document_kind : (TERMS_CHARGE_KINDS[d.kind] ? d.kind : 'other'),
      interest: { allowed: B.interest.allowed, max_rate_pa: B.interest.max_rate_pa, method: B.interest.method, start: B.interest.start, grace_days: B.interest.grace_days,
        clause: B.interest.clause, rate_text: B.interest.rate_text },
      fees: B.fees.map(function(f){ return { name: f.name, type: f.type, max_amount: f.max_amount, applies: f.applies, min_after_days: f.min_after_days, clause: f.clause }; }),
      manual: (R.fees || []).filter(function(f){ return !(f.debtjet_can_charge && f.amount != null && f.amount > 0); }).map(function(f){ return { name: f.name, text: f.note || '', clause: f.clause || '' }; })
        .concat(R.recovery_costs && R.recovery_costs.stated ? [{ name: 'Recovery costs', text: R.recovery_costs.scope || '', clause: R.recovery_costs.clause || '' }] : [])
    };
  }
  function termsDocText(d){ return (d && (d.doc_text || (d.source === 'text' ? d.body_text : ''))) || ''; }
  function limitsNormalized(D){
    var I = D.interest || {};
    return { interest: { allowed: !!I.allowed, max_rate_pa: I.rate_pct != null && I.rate_pct !== '' ? Math.round(Number(I.rate_pct) * 100) / 10000 : null, method: I.method === 'compound_monthly' ? 'compound_monthly' : 'simple',
        start: I.start || 'due_date', grace_days: I.start === 'after_grace' ? Math.max(0, Math.round(Number(I.grace_days) || 0)) : 0, clause: String(I.clause || '').slice(0, 30), rate_text: I.rate_text || '' },
      fees: (D.fees || []).filter(function(f){ return String(f.name || '').trim(); }).map(function(f){ return { name: String(f.name).trim().slice(0, 40), type: f.type === 'percent' ? 'percent' : 'fixed', max_amount: r2(Number(f.max_amount) || 0),
        applies: f.applies === 'per_statement' ? 'per_statement' : 'per_invoice', min_after_days: Math.max(1, Math.min(365, Math.round(Number(f.min_after_days) || 1))), clause: String(f.clause || '').slice(0, 30) }; }),
      manual: D.manual || [] };
  }
  function rulesFromLimits(L){
    var I = L.interest || {};
    return { interest_enabled: !!I.allowed && I.max_rate_pa > 0, rate_pa: I.max_rate_pa || 0, method: I.method === 'compound_monthly' ? 'compound_monthly' : 'simple',
      interest_start: I.start || 'due_date', grace_days: I.grace_days || 0, min_balance: 0, cap_pct: null,
      fees: (L.fees || []).map(function(f){ return { name: f.name, type: f.type, amount: f.max_amount, applies: f.applies, after_days: f.min_after_days || 1 }; }) };
  }
  // ---- Render ----
  function renderTermsTab(){
    var list = document.getElementById('termsList'); if(!list) return;
    var admin = canEditPayments();
    list.innerHTML = termsDocs.map(function(d){
      var on = d.id === termsSelId, busy = !!termsBusy[d.id], n = termsCoverage(d);
      var chip = !TERMS_CHARGE_KINDS[d.kind] && d.reviewed_at ? '<span class="tchip no">Can’t be used for charges</span>'
        : termsConfirmed(d) ? '<span class="tchip ok">Confirmed</span>' : d.reviewed_at ? '<span class="tchip todo">Confirm what it allows</span>' : '';
      var who = termsAccepts.filter(function(a){ return a.document_id === d.id; });
      var whoTxt = who.some(function(a){ return !a.debtor_id && !a.group_id; }) ? 'all customers' : n ? n + ' customer' + (n === 1 ? '' : 's') : 'no customers yet';
      return '<div class="terms-doc'+(on ? ' sel' : '')+'" data-tdoc="'+escapeHtml(d.id)+'">'
        + '<div class="meta"><b>'+escapeHtml(d.title)+chip+'</b>'
        + '<span>'+escapeHtml(TERMS_KIND[d.kind] || 'Document')+' · '+(d.source === 'upload' ? escapeHtml(d.file_name || 'File') : 'Written in DebtJet')+' · '+(busy ? 'DebtJet AI is reading it…' : d.reviewed_at ? 'reviewed ' + escapeHtml(fmt(d.reviewed_at)) : 'not reviewed yet')+' · accepted by '+whoTxt+'</span></div>'
        + '<div class="chg-acts">'
        +   '<button type="button" data-tact="open">'+(d.source === 'upload' ? 'Open' : 'Edit')+'</button>'
        +   '<button type="button" class="go" data-tact="review"'+(busy ? ' disabled' : '')+'>'+AI_MARK+(d.reviewed_at ? 'Review again' : 'Review')+'</button>'
        +   (admin ? '<button type="button" data-tact="remove" title="Remove this document" aria-label="Remove">✕</button>' : '')
        + '</div></div>';
    }).join('');
    document.getElementById('termsDropTitle').textContent = termsDocs.length ? 'Add another set of terms' : 'Upload your terms';
    document.getElementById('termsAdd').hidden = !document.getElementById('termsEditor').hidden;
    renderTermsReview(); renderLimits(); renderRulesHints(); renderWho();
  }
  function renderTermsReview(){
    var d = termsSel(), out = document.getElementById('termsReview'), meta = document.getElementById('termsReviewMeta');
    meta.textContent = d && d.reviewed_at ? 'DebtJet AI · ' + d.title + ' · ' + fmt(d.reviewed_at) : '';
    if(!d){ out.innerHTML = '<div class="empty-note">Add your terms above. DebtJet AI lists what they say about payment, interest and fees. You then confirm what they allow, and record which customers accepted them. Without accepted terms on file, DebtJet adds no interest or fees.</div>'; return; }
    if(termsBusy[d.id]){ out.innerHTML = '<div class="tr-busy">'+AI_MARK+'<span>DebtJet AI is reading “'+escapeHtml(d.title)+'”. This usually takes under a minute.</span></div>'; return; }
    var R = d.review;
    if(!R){ out.innerHTML = '<div class="tr-actions"><button type="button" class="btn ai-btn" data-tr="review">'+AI_MARK+'Review with DebtJet AI</button><span class="hint-r">Lists the key points about payment, interest and fees.</span></div>'; return; }
    var pts = Array.isArray(R.summary_points) ? R.summary_points : String(R.summary || '').split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
    var html = R.is_terms === false ? '<div class="ai-flag caution">This doesn’t look like terms of trade or service.</div>' : '';
    html += '<ul class="tr-sum">' + pts.map(function(t){ return '<li>'+escapeHtml(t)+'</li>'; }).join('') + '</ul>';
    html += '<h4 class="sub-h">Key points</h4><table class="tr-table"><thead><tr><th>Topic</th><th>What your terms say</th><th></th></tr></thead><tbody>'
      + (R.key_points || []).map(function(k){ return '<tr><td class="k">'+escapeHtml(k.topic)+'</td><td>'+escapeHtml(k.finding)+(k.clause ? ' <span class="src-tag">'+escapeHtml(clauseLabel(k.clause))+'</span>' : '')+'</td><td><span class="eff '+escapeHtml(k.effect)+'">'+(TR_EFF[k.effect] || '')+'</span></td></tr>'; }).join('')
      + '</tbody></table>';
    var extra = [];
    if(R.acceptance) extra.push(['How customers agree', R.acceptance]);
    if(R.governing_law) extra.push(['Governing law', R.governing_law]);
    if(extra.length) html += '<details class="tr-details"><summary>Acceptance and governing law</summary><table class="tr-table"><tbody>'
      + extra.map(function(x){ return '<tr><td class="k">'+escapeHtml(x[0])+'</td><td>'+escapeHtml(x[1])+'</td></tr>'; }).join('') + '</tbody></table></details>';
    html += '<div class="fine">DebtJet AI describes what your document says. It doesn’t assess whether any term is valid or enforceable, and isn’t legal advice. Always check figures against the document itself.</div>';
    out.innerHTML = html;
  }
  function evLine(e){
    if(!e) return '';
    var q = e.quote ? ' <q>' + escapeHtml(e.quote) + '</q>' : '';
    return '<div class="ev-line">' + (e.source === 'quote' ? 'From the wording you quoted' + (e.clause ? ' (' + escapeHtml(clauseLabel(e.clause)) + ')' : '') + ':' + q + '<span class="ev ok">✓ found in the document</span>'
      : 'From DebtJet AI’s reading' + (q ? ':' + q : '') + (e.found === true ? '<span class="ev ok">✓ found in the document</span>' : e.found === false && e.quote ? '<span class="ev bad">⚠ wording not found word for word</span>' : '')) + '</div>';
  }
  function aiRead(quote, found){
    if(!quote) return '';
    return '<div class="ev-line">DebtJet AI read: <q>' + escapeHtml(quote) + '</q>' + (found === true ? '<span class="ev ok">✓ found in the document</span>' : found === false ? '<span class="ev bad">⚠ not found word for word, check it</span>' : '') + '</div>';
  }
  function renderLimits(){
    var d = termsSel(), out = document.getElementById('termsLimits'), meta = document.getElementById('termsLimitsMeta');
    var admin = canEditPayments();
    meta.textContent = d && termsConfirmed(d) ? 'Confirmed ' + fmt(d.rules_confirmed_at) + (d.rules_confirmed_by === session.user.id ? ' by you' : '') : '';
    if(!d){ out.innerHTML = '<div class="empty-note">Nothing yet.</div>'; return; }
    if(!d.review && !d.limits){ out.innerHTML = '<div class="empty-note">Once DebtJet AI has read these terms, you confirm here the most they allow you to charge.</div>'; return; }
    if(limitsDraft && limitsDraft.docId !== d.id) limitsDraft = null;
    var reread = '<div class="lim-reread" id="limReread" hidden><input maxlength="400" data-reread placeholder="Which clause, and what did DebtJet AI get wrong? e.g. clause 8.2 says 2% per month" /><button type="button" class="btn sm" data-lim="reread-go">'+AI_MARK+'Re-read</button></div>';
    if(!limitsDraft && termsConfirmed(d) && limitsEditing !== d.id){
      var L = d.limits, I = L.interest || {}, E = L.evidence || {};
      var rows = [['Document', TERMS_KIND[d.kind] || 'Document', '', '']];
      rows.push(['Interest', I.allowed ? 'Up to ' + r2((I.max_rate_pa || 0) * 100) + '% a year, ' + (I.method === 'compound_monthly' ? 'simple or compounding monthly' : 'simple') + ', ' + startText(I.start, I.grace_days) : 'Not provided for: no interest', I.clause, I.allowed ? evLine(E.rate) : '']);
      (L.fees || []).forEach(function(f){ rows.push([f.name, limFeeText(f), f.clause, evLine(E['fee:' + String(f.name).toLowerCase()])]); });
      if(!(L.fees || []).length) rows.push(['Fees', 'None that DebtJet can add automatically', '', '']);
      var log = (d.limits_log || []).slice().reverse();
      out.innerHTML = '<table class="tr-table"><tbody>' + rows.map(function(r){ return '<tr><td class="k">'+escapeHtml(r[0])+'</td><td>'+escapeHtml(r[1])+(r[2] ? ' '+termsTag(r[2]) : '')+r[3]+'</td></tr>'; }).join('') + '</tbody></table>'
        + ((L.manual || []).length ? '<div class="lim-manual">Not added automatically (add these by hand when they apply):<ul>' + L.manual.map(function(m){ return '<li><b>'+escapeHtml(m.name)+'</b>'+(m.clause ? ' '+termsTag(m.clause) : '')+(m.text ? ' · '+escapeHtml(m.text) : '')+'</li>'; }).join('') + '</ul></div>' : '')
        + (log.length ? '<details class="lim-hist"><summary>History (' + log.length + ')</summary><ul>' + log.map(function(e){
            return '<li><b>' + escapeHtml(fmt(e.at)) + '</b> · ' + escapeHtml(e.by === session.user.id ? 'you' : (e.by_email || 'a team member')) + ' ' + escapeHtml(e.action || 'confirmed') + ' (compared with the ' + escapeHtml(e.compared_with || 'previous version') + ')'
              + ((e.changes || []).length ? '<br>' + e.changes.map(escapeHtml).join('<br>') : '<br>No changes.')
              + (e.quotes || []).map(function(q){ return '<br><span class="q">' + escapeHtml(q.what) + (q.clause ? ' (' + escapeHtml(clauseLabel(q.clause)) + ')' : '') + ': “' + escapeHtml(q.quote) + '”</span>'; }).join('') + '</li>';
          }).join('') + '</ul></details>' : '')
        + (admin ? '<div class="tr-actions"><button type="button" class="btn sm" data-lim="edit">Change what these terms allow</button><button type="button" class="btn sm ghost" data-lim="reread">'+AI_MARK+'Ask DebtJet AI to re-read a clause</button></div>' + reread : '');
      return;
    }
    if(!admin){ out.innerHTML = '<div class="empty-note">An owner or admin needs to confirm what these terms allow before they can be used for charges.</div>'; return; }
    if(!limitsDraft){
      var src = d.limits ? Object.assign({ kind: d.kind }, JSON.parse(JSON.stringify(d.limits))) : limitsFromReview(d);
      limitsDraft = Object.assign({ docId: d.id, evidence: {} }, src);
      var EV = (d.limits && d.limits.evidence) || {};
      Object.keys(EV).forEach(function(k){ if(EV[k] && EV[k].source === 'quote') limitsDraft.evidence[k] = { quote: EV[k].quote, clause: EV[k].clause }; });
      if(limitsDraft.interest && limitsDraft.interest.max_rate_pa != null) limitsDraft.interest.rate_pct = r2(limitsDraft.interest.max_rate_pa * 100);
    }
    var D = limitsDraft, I2 = D.interest, B = termsBaseline(d.review), sel = function(v, opts){ return opts.map(function(o){ return '<option value="'+o[0]+'"'+(o[0] === v ? ' selected' : '')+'>'+o[1]+'</option>'; }).join(''); };
    var unread = d.review && d.review.text_readable === false && d.source === 'upload';
    var html = '<p class="hint-r" style="margin:0 0 10px;">Filled in from DebtJet AI’s reading. You can lower anything. To go beyond DebtJet AI’s reading, quote the exact wording from the document: DebtJet checks it’s there before saving. DebtJet will never charge customers on these terms more than this.</p>'
      + (unread ? '<div class="ai-flag caution">DebtJet couldn’t read text from this file (it may be a scan), so wording can’t be checked. You can confirm DebtJet AI’s reading or lower it, but not go beyond it. Upload a text-based PDF or Word file to change more.</div>' : '')
      + '<div class="lim-grid">'
      + '<label class="span2">Document type<select data-lk="kind">' + sel(D.kind, [['terms_of_trade', 'Terms of trade'], ['terms_of_service', 'Terms of service'], ['credit_application', 'Credit application'], ['quote_or_contract', 'Signed quote or contract'], ['other', 'Other (can’t be used for charges)']]) + '</select></label>'
      + '<label class="span2 inline-check" style="flex-direction:row;align-items:center;"><input type="checkbox" data-lk="interest.allowed"'+(I2.allowed ? ' checked' : '')+' /> The terms provide for interest on overdue amounts</label>'
      + '<label>Highest rate (% a year)<input type="number" min="0" max="100" step="0.01" data-lk="interest.rate_pct" value="'+(I2.rate_pct != null ? escapeHtml(I2.rate_pct) : '')+'" /></label>'
      + '<label>Interest type<select data-lk="interest.method">' + sel(I2.method, [['simple', 'Simple only'], ['compound_monthly', 'Compounding monthly allowed']]) + '</select></label>'
      + '<label>Earliest start<select data-lk="interest.start">' + sel(I2.start, [['due_date', 'From the due date'], ['after_grace', 'After a number of days overdue'], ['first_demand', 'From the first letter of demand'], ['final_demand', 'From the final letter of demand']]) + '</select></label>'
      + '<label>Days overdue<input type="number" min="0" max="365" data-lk="interest.grace_days" value="'+escapeHtml(I2.grace_days || 0)+'"'+(I2.start === 'after_grace' ? '' : ' disabled')+' /></label>'
      + '<label class="span2">Interest clause<input maxlength="30" data-lk="interest.clause" value="'+escapeHtml(I2.clause || '')+'" placeholder="e.g. 5.1" /></label>'
      + '<div class="span4">' + (B.interest.quote ? aiRead(B.interest.quote, B.interest.quote_found) : (d.review ? '<div class="ev-line">DebtJet AI found no interest clause.</div>' : '')) + (B.interest.rate_text && B.interest.max_rate_pa == null ? '<div class="ev-line">The rate isn’t a fixed number (“' + escapeHtml(B.interest.rate_text) + '”). Enter today’s rate and quote the clause.</div>' : '') + '</div>'
      + '</div>'
      + '<h4 class="sub-h">Fees DebtJet can add</h4>'
      + (D.fees || []).map(function(f, i){
          var bf = B.fees.filter(function(x){ return x.name.toLowerCase() === String(f.name || '').toLowerCase(); })[0];
          return '<div class="lim-fee" data-lf="'+i+'">'
            + '<label>Fee<input maxlength="40" data-lf-k="name" value="'+escapeHtml(f.name)+'" /></label>'
            + '<label>Type<select data-lf-k="type">' + sel(f.type, [['fixed', '$ fixed'], ['percent', '% of balance']]) + '</select></label>'
            + '<label>Up to<input type="number" min="0" step="0.01" data-lf-k="max_amount" value="'+escapeHtml(f.max_amount == null ? '' : f.max_amount)+'" /></label>'
            + '<label>Charged<select data-lf-k="applies">' + sel(f.applies, [['per_invoice', 'Per invoice'], ['per_statement', 'Once per statement']]) + '</select></label>'
            + '<label>From days overdue<input type="number" min="1" max="365" data-lf-k="min_after_days" value="'+escapeHtml(f.min_after_days || 1)+'" /></label>'
            + '<label>Clause<input maxlength="30" data-lf-k="clause" value="'+escapeHtml(f.clause || '')+'" /></label>'
            + '<button type="button" class="btn sm ghost" data-lim="delfee" data-i="'+i+'" title="Remove" aria-label="Remove fee">✕</button></div>'
            + (bf ? aiRead(bf.quote, bf.quote_found) : '<div class="ev-line">Not in DebtJet AI’s reading: quote the wording below.</div>');
        }).join('')
      + '<div class="tr-actions"><button type="button" class="btn sm" data-lim="addfee">+ Add a fee from the terms</button><button type="button" class="btn sm ghost" data-lim="reread">'+AI_MARK+'Ask DebtJet AI to re-read a clause</button></div>' + reread
      + ((D.manual || []).length ? '<div class="lim-manual">Not added automatically (add these by hand when they apply):<ul>' + D.manual.map(function(m){ return '<li><b>'+escapeHtml(m.name)+'</b>'+(m.clause ? ' '+termsTag(m.clause) : '')+(m.text ? ' · '+escapeHtml(m.text) : '')+'</li>'; }).join('') + '</ul></div>' : '')
      + '<div id="limEvidence"></div>'
      + '<div class="lim-problems" id="limProblems"></div>'
      + '<label class="lim-confirm"><input type="checkbox" data-lk="checked"'+(D.checked ? ' checked' : '')+' /> <span>I’ve checked these against “'+escapeHtml(d.title)+'”. They are the most these terms allow, and DebtJet won’t charge more than this to customers on these terms.</span></label>'
      + '<div class="tr-actions"><button type="button" class="btn primary" data-lim="confirm">Confirm what these terms allow</button>'+(termsConfirmed(d) ? '<button type="button" class="btn ghost" data-lim="cancel">Cancel</button>' : '')+'</div>';
    out.innerHTML = html;
    renderLimEvidence();
  }
  // The "wording from the document" boxes for anything beyond DebtJet AI's reading.
  function renderLimEvidence(){
    var el = document.getElementById('limEvidence'), d = termsSel(); if(!el || !limitsDraft || !d) return;
    var needs = termsEvNeeds(termsBaseline(d.review), limitsNormalized(limitsDraft)), text = termsDocText(d);
    if(!needs.length){ el.innerHTML = '<div class="ev-all">Everything above matches DebtJet AI’s reading or is lower, so no extra wording is needed.</div>'; return; }
    el.innerHTML = '<h4 class="sub-h">Wording from the document</h4><p class="hint-r" style="margin:0;">These go beyond DebtJet AI’s reading. Paste the exact words from the document that say each one. DebtJet checks they’re in the document and contain the value.</p>'
      + needs.map(function(n){
          var e = limitsDraft.evidence[n.key] || {}, prob = termsEvProblem(text, n, e);
          return '<div class="ev-need" data-evk="'+escapeHtml(n.key)+'"><b>'+escapeHtml(n.label)+'</b>'
            + '<label>Quote from the document<textarea rows="2" data-evq>'+escapeHtml(e.quote || '')+'</textarea></label>'
            + '<label>Clause<input maxlength="30" data-evc value="'+escapeHtml(e.clause || '')+'" /></label>'
            + '<div class="ev-status '+(prob ? 'bad' : 'ok')+'">'+(prob ? escapeHtml(prob) : '✓ Found in the document')+'</div></div>';
        }).join('');
  }
  function renderRulesHints(){
    var d = termsSel(), lock = document.getElementById('chgRulesLocked'), body = document.getElementById('chgRulesBody');
    document.getElementById('chgRulesTitle').textContent = d ? 'What you charge under “' + d.title + '”' : 'What you charge';
    var msg = !d ? 'Add your terms above first.' : !TERMS_CHARGE_KINDS[d.kind] ? 'This document can’t be used for charges. Change its type above if it is terms of trade, terms of service, a credit application or a signed quote or contract.'
      : !termsConfirmed(d) ? 'Confirm what these terms allow (above) before setting what you charge.' : '';
    lock.hidden = !msg; lock.textContent = msg; body.hidden = !!msg;
    var src = document.getElementById('chgRulesSource');
    if(!msg){
      var I = (d.limits.interest || {});
      src.innerHTML = 'You can charge up to what the terms allow' + (I.allowed ? ' (interest up to ' + r2((I.max_rate_pa || 0) * 100) + '% a year)' : ' (no interest)') + ', or less, or switch charges off. Tags show the clause each setting comes from.';
      document.getElementById('chgRate').max = I.max_rate_pa ? r2(I.max_rate_pa * 100) : 0;
      document.getElementById('chgInterestOn').disabled = !I.allowed || !canEditPayments();
    }
    renderFeeQuick();
  }
  function renderFeeQuick(){
    var d = termsSel(), el = document.getElementById('chgFeeQuick'); if(!el) return;
    var have = {}; chgFeesDraft.forEach(function(f){ have[String(f.name).toLowerCase()] = true; });
    var left = d && d.limits ? (d.limits.fees || []).map(function(f, i){ return [f, i]; }).filter(function(x){ return !have[String(x[0].name).toLowerCase()]; }) : [];
    el.innerHTML = left.map(function(x){ return '<button class="btn sm" type="button" data-addlim="'+x[1]+'"'+(canEditPayments() ? '' : ' disabled')+'>+ '+escapeHtml(x[0].name)+'</button>'; }).join('')
      + (d && d.limits && !(d.limits.fees || []).length ? '<span class="hint-r">These terms have no fees DebtJet can add.</span>' : '');
  }
  function renderTermsTags(){
    var src = termsSources();
    [['chgRate', 'rate'], ['chgMethod', 'method'], ['chgStart', 'start']].forEach(function(x){
      var lab = document.getElementById(x[0]).closest('label'); if(!lab) return;
      var old = lab.querySelector('.src-tag'); if(old) old.remove();
      if(src[x[1]]){ var t = document.createElement('span'); t.innerHTML = termsTag(src[x[1]]); lab.insertBefore(t.firstChild, document.getElementById(x[0])); }
    });
    renderFeeRows(); renderFeeQuick();
  }
  function loadRulesForm(d){
    var c = (d && d.rules) || {}, set = function(id, v){ document.getElementById(id).value = v == null ? '' : v; };
    document.getElementById('chgInterestOn').checked = !!c.interest_enabled;
    set('chgRate', c.rate_pa != null ? r2(Number(c.rate_pa) * 100) : '');
    set('chgMethod', c.method || 'simple'); set('chgGrace', c.grace_days || 0);
    var basis = c.interest_start || 'due_date';
    set('chgStart', basis === 'after_grace' || basis === 'grace_backdated' ? 'grace' : basis);
    document.getElementById('chgBackdate').checked = basis === 'grace_backdated';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="chgMode"]'), function(r){ r.checked = r.value === ((orgCharges && orgCharges.apply_mode) || 'auto'); });
    set('chgMinBal', c.min_balance || 0); set('chgCap', c.cap_pct ? r2(Number(c.cap_pct) * 100) : '');
    chgFeesDraft = JSON.parse(JSON.stringify(c.fees || []));
    renderTermsTags(); renderChargeRuleHelp();
  }
  // Unsaved rules for the selected terms, to preview in Overdue invoices.
  function chargePreview(){
    var d = termsSel(); if(!d || !termsUsable(d)) return null;
    var form = readChargesForm(), saved = Object.assign({}, d.rules, { terms_allow_charges: true, apply_mode: form.apply_mode });
    return savedChargeKey(form) !== savedChargeKey(saved) ? { docId: d.id, cfg: form } : null;
  }
  // ---- Actions ----
  function selectTerms(id){
    if(termsSelId === id) return;
    termsSelId = id; limitsDraft = null; acceptDraft = null;
    loadRulesForm(termsSel()); renderTermsTab(); renderCalculator(); renderChargesPortal();
  }
  async function reviewTerms(id, focus){
    if(termsBusy[id]) return;
    termsBusy[id] = true; termsSelId = id; limitsDraft = null; renderTermsTab();
    var d = await invokeFn('review-terms', focus ? { document_id: id, focus: focus } : { document_id: id });
    delete termsBusy[id];
    if(d && d.ok && d.document){ termsDocs = termsDocs.map(function(x){ return x.id === id ? d.document : x; }); toast(focus ? 'DebtJet AI has re-read your terms. Check the values below.' : 'DebtJet AI has reviewed your terms.'); }
    else toast((d && d.error) || 'The review didn’t work. Please try again.');
    loadRulesForm(termsSel()); renderTermsTab();
  }
  async function addTermsDoc(row){
    var ins = await sb.from('org_terms_documents').insert(row).select('*').single();
    if(ins.error){ toast('Could not save: ' + ins.error.message); return; }
    termsDocs.unshift(ins.data); termsSelId = ins.data.id; limitsDraft = null; acceptDraft = null;
    reviewTerms(ins.data.id);
  }
  async function uploadTermsFile(file){
    if(!file) return;
    if(!/\.(pdf|docx|txt)$/i.test(file.name)){ toast('Upload a PDF, Word (.docx) or text file. For an older .doc file, save it as .docx or PDF first.'); return; }
    if(file.size > 10485760){ toast('That file is over 10 MB.'); return; }
    var mime = /\.pdf$/i.test(file.name) ? 'application/pdf' : /\.docx$/i.test(file.name) ? DOCX_MIME : 'text/plain';
    var path = currentOrg.id + '/' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '-' + file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    toast('Uploading ' + file.name + '…');
    var up = await sb.storage.from('terms-docs').upload(path, file, { contentType: mime, upsert: false });
    if(up.error){ toast('Upload failed: ' + up.error.message); return; }
    await addTermsDoc({ org_id: currentOrg.id, title: (file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ') || 'Terms of trade').slice(0, 120), source: 'upload',
      file_name: file.name.slice(0, 200), storage_path: path, mime: mime, size_bytes: file.size });
  }
  function openTermsEditor(doc){
    termsEditId = doc ? doc.id : null;
    document.getElementById('termsTitle').value = doc ? doc.title : '';
    document.getElementById('termsText').value = doc ? (doc.body_text || '') : '';
    document.getElementById('termsSaveText').textContent = doc ? 'Save and review again' : 'Save and review with DebtJet AI';
    document.getElementById('termsEditor').hidden = false; renderTermsTab();
    document.getElementById('termsText').focus();
  }
  function closeTermsEditor(){ termsEditId = null; document.getElementById('termsEditor').hidden = true; renderTermsTab(); }
  document.getElementById('termsFile').addEventListener('change', function(){ var f = this.files && this.files[0]; this.value = ''; uploadTermsFile(f); });
  (function(){
    var drop = document.getElementById('termsDrop');
    ['dragenter', 'dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; uploadTermsFile(f); });
  })();
  document.getElementById('termsWriteBtn').addEventListener('click', function(){ openTermsEditor(null); });
  document.getElementById('termsCancelText').addEventListener('click', closeTermsEditor);
  document.getElementById('termsSaveText').addEventListener('click', async function(){
    var title = document.getElementById('termsTitle').value.trim() || 'Terms of trade', text = document.getElementById('termsText').value.trim();
    if(text.length < 80){ toast('Paste or write your terms first.'); return; }
    if(text.length > 200000){ toast('That’s too long. Upload it as a file instead.'); return; }
    if(termsEditId){
      var id = termsEditId, was = termsDocById(id);
      if(was && termsConfirmed(was) && !await djAsk('Changing the wording means what these terms allow must be confirmed again. Until then, no interest or fees are added for customers on these terms. Continue?', { ok: 'Save changes' })) return;
      var u = await sb.from('org_terms_documents').update({ title: title.slice(0, 120), body_text: text }).eq('id', id).select('*').single();
      if(u.error){ toast('Could not save: ' + u.error.message); return; }
      termsDocs = termsDocs.map(function(x){ return x.id === id ? u.data : x; });
      document.getElementById('termsEditor').hidden = true; termsEditId = null;
      reviewTerms(id);
    } else {
      document.getElementById('termsEditor').hidden = true;
      await addTermsDoc({ org_id: currentOrg.id, title: title.slice(0, 120), source: 'text', body_text: text });
    }
  });
  document.getElementById('termsList').addEventListener('click', async function(e){
    var row = e.target.closest('[data-tdoc]'); if(!row) return;
    var id = row.getAttribute('data-tdoc'), d = termsDocById(id); if(!d) return;
    var act = e.target.closest('[data-tact]'); act = act ? act.getAttribute('data-tact') : null;
    if(!act){ selectTerms(id); return; }
    if(act === 'review') return reviewTerms(id);
    if(act === 'open'){
      if(d.source !== 'upload'){ selectTerms(id); openTermsEditor(d); return; }
      var w = window.open('', '_blank');
      var su = await sb.storage.from('terms-docs').createSignedUrl(d.storage_path, 300);
      if(su.error || !su.data){ if(w) w.close(); toast('Couldn’t open the file.'); return; }
      if(w) w.location = su.data.signedUrl; else window.location.href = su.data.signedUrl;
      return;
    }
    if(act === 'remove'){
      if(!canEditPayments()) return;
      var n = termsAccepts.filter(function(a){ return a.document_id === id; }).length;
      if(!await djAsk('Remove “' + d.title + '”?' + (n ? '\n\n' + n + ' acceptance record' + (n === 1 ? '' : 's') + ' point to these terms and will be removed too. Those customers will have no terms on file, so no interest or fees will be added for them.' : '') + '\n\nThis deletes the file and its review.', { ok: 'Remove' })) return;
      if(d.storage_path) await sb.storage.from('terms-docs').remove([d.storage_path]);
      var del = await sb.from('org_terms_documents').delete().eq('id', id);
      if(del.error){ toast('Could not remove: ' + del.error.message); return; }
      termsDocs = termsDocs.filter(function(x){ return x.id !== id; });
      termsAccepts = termsAccepts.filter(function(a){ return a.document_id !== id; });
      if(termsSelId === id){ var nx = termsDocs.filter(function(x){ return !x.archived; })[0]; termsSelId = nx ? nx.id : null; }
      limitsDraft = null; acceptDraft = null;
      loadRulesForm(termsSel()); renderTermsTab(); renderChargesPortal(); toast('Removed.');
      await loadCases(); renderDashboard();
    }
  });
  document.getElementById('termsReview').addEventListener('click', function(e){
    var b = e.target.closest('[data-tr]'); if(!b) return;
    if(b.getAttribute('data-tr') === 'review' && termsSelId) reviewTerms(termsSelId);
  });
  // Limits editor
  var limitsEl = document.getElementById('termsLimits');
  limitsEl.addEventListener('input', function(e){
    if(!limitsDraft) return;
    var t = e.target, box = t.closest('[data-evk]');
    if(box){
      var key = box.getAttribute('data-evk'), ev = limitsDraft.evidence[key] = limitsDraft.evidence[key] || {};
      if(t.hasAttribute('data-evq')) ev.quote = t.value; else if(t.hasAttribute('data-evc')) ev.clause = t.value;
      var d = termsSel(), n = termsEvNeeds(termsBaseline(d.review), limitsNormalized(limitsDraft)).filter(function(x){ return x.key === key; })[0];
      var st = box.querySelector('.ev-status'), prob = n ? termsEvProblem(termsDocText(d), n, ev) : '';
      st.className = 'ev-status ' + (prob ? 'bad' : 'ok'); st.textContent = prob || '✓ Found in the document';
      return;
    }
    if(t.hasAttribute('data-reread')) return;
    var k = t.getAttribute('data-lk'), v = t.type === 'checkbox' ? t.checked : t.value;
    if(k){
      if(k === 'checked'){ limitsDraft.checked = v; return; }
      var parts = k.split('.'), o = limitsDraft;
      for(var i = 0; i < parts.length - 1; i++) o = o[parts.at(i)];
      o[parts.at(-1)] = (t.type === 'number') ? (v === '' ? null : Number(v)) : v;
      if(k === 'interest.start'){ var g = limitsEl.querySelector('[data-lk="interest.grace_days"]'); if(g) g.disabled = v !== 'after_grace'; }
    } else {
      var row = t.closest('[data-lf]'), fk = t.getAttribute('data-lf-k'); if(!row || !fk) return;
      var f = limitsDraft.fees[Number(row.getAttribute('data-lf'))];
      f[fk] = t.type === 'number' ? (v === '' ? null : Number(v)) : v;
    }
    renderLimEvidence();
  });
  limitsEl.addEventListener('change', function(e){ if(e.target.tagName === 'SELECT' || e.target.type === 'checkbox') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  limitsEl.addEventListener('click', async function(e){
    var b = e.target.closest('[data-lim]'); if(!b) return;
    var act = b.getAttribute('data-lim'), d = termsSel(); if(!d || !canEditPayments()) return;
    if(act === 'edit'){ limitsDraft = null; limitsEditing = d.id; renderLimits(); return; }
    if(act === 'cancel'){ limitsDraft = null; limitsEditing = null; renderLimits(); return; }
    if(act === 'reread'){ var rr = document.getElementById('limReread'); rr.hidden = !rr.hidden; if(!rr.hidden) rr.querySelector('input').focus(); return; }
    if(act === 'reread-go'){
      var focus = (limitsEl.querySelector('[data-reread]').value || '').trim();
      if(focus.length < 5){ toast('Say which clause, and what DebtJet AI got wrong.'); return; }
      limitsDraft = null; return reviewTerms(d.id, focus);
    }
    if(act === 'addfee'){ limitsDraft.fees.push({ name: '', type: 'fixed', max_amount: null, applies: 'per_invoice', min_after_days: 1, clause: '' }); renderLimits(); return; }
    if(act === 'delfee'){ limitsDraft.fees.splice(Number(b.getAttribute('data-i')), 1); renderLimits(); return; }
    if(act === 'confirm'){
      var D = limitsDraft, N = limitsNormalized(D), probs = [], probEl = document.getElementById('limProblems');
      if(!D.checked) probs.push('Tick that you’ve checked these against the document.');
      if(N.interest.allowed && !(N.interest.max_rate_pa > 0 && N.interest.max_rate_pa <= 1)) probs.push('Enter the highest interest rate the terms allow.');
      var names = {};
      (D.fees || []).forEach(function(f){
        var nm = String(f.name || '').trim().toLowerCase();
        if(!nm) probs.push('Give every fee a name.'); else if(names[nm]) probs.push('Two fees are called “' + f.name + '”.');
        names[nm] = 1;
        if(!(Number(f.max_amount) > 0)) probs.push('Enter the amount for “' + (f.name || 'fee') + '”.');
      });
      var needs = termsEvNeeds(termsBaseline(d.review), N), text = termsDocText(d), evidence = {};
      needs.forEach(function(n){ var p = termsEvProblem(text, n, D.evidence[n.key]); if(p) probs.push(n.label + ': ' + p); evidence[n.key] = { quote: (D.evidence[n.key] || {}).quote || '', clause: (D.evidence[n.key] || {}).clause || '' }; });
      probEl.innerHTML = probs.map(escapeHtml).join('<br>');
      if(probs.length){ toast(probs[0]); return; }
      b.disabled = true;
      var r = await invokeFn('terms-limits', { document_id: d.id, kind: D.kind, limits: N, evidence: evidence });
      b.disabled = false;
      if(!r || !r.ok){ var list = (r && r.problems) || [(r && r.error) || 'Couldn’t confirm. Please try again.']; probEl.innerHTML = list.map(escapeHtml).join('<br>'); toast(list[0]); return; }
      termsDocs = termsDocs.map(function(x){ return x.id === d.id ? r.document : x; });
      limitsDraft = null; limitsEditing = null; loadRulesForm(r.document); renderTermsTab(); renderChargesPortal();
      await loadCases(); renderDashboard();
      toast(TERMS_CHARGE_KINDS[D.kind] ? 'Confirmed. Now check what you charge, and record which customers accepted these terms.' : 'Saved. This document type can’t be used for charges.');
    }
  });
  // Fees offered by the terms, added to the rules
  document.getElementById('chgFeeQuick').addEventListener('click', function(e){
    var b = e.target.closest('[data-addlim]'), d = termsSel(); if(!b || !d || !d.limits || !canEditPayments()) return;
    var f = d.limits.fees[Number(b.getAttribute('data-addlim'))]; if(!f) return;
    chgFeesDraft.push({ name: f.name, type: f.type, amount: f.max_amount, applies: f.applies, after_days: f.min_after_days || 1 });
    renderFeeRows(); renderFeeQuick(); renderCalculator(); renderChargesPortal();
  });
  // ---- Customers who accepted these terms: records, evidence, and overdue customers with nothing on file ----
  var termsEvidence = [];
  var EV_SOURCE = { upload: 'File', gmail: 'Gmail', outlook: 'Outlook', xero: 'Xero', quickbooks: 'QuickBooks', servicem8: 'ServiceM8', esign: 'E-signature' };
  var GRADE_CHIP = { verified: '<span class="tchip ok">Verified</span>', evidence: '<span class="tchip ok">Evidence attached</span>', declared: '<span class="tchip todo">No evidence: not charged</span>' };
  async function loadTermsEvidence(){
    var r = await Promise.all([
      sb.from('terms_acceptances').select('*').eq('org_id', currentOrg.id),
      sb.from('terms_evidence').select('*').eq('org_id', currentOrg.id)
    ]);
    termsAccepts = (r[0].data || []).slice(); termsEvidence = (r[1].data || []).slice();
  }
  function evFor(accId){ return termsEvidence.filter(function(e){ return e.acceptance_id === accId; }); }
  function gmailLink(msgId){ return 'https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('rfc822msgid:' + String(msgId || '').replace(/^<|>$/g, '')); }
  function emailLinkOk(u){ try { var h = new URL(u).hostname; return /^(mail\.google\.com|outlook\.office\.com|outlook\.office365\.com|outlook\.live\.com)$/.test(h) && /^https:/.test(u); } catch(e){ return false; } }
  async function sha256Hex(file){
    try { var h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return Array.prototype.map.call(new Uint8Array(h), function(b){ return ('0' + b.toString(16)).slice(-2); }).join(''); }
    catch(e){ return null; }
  }
  function evLabel(e){
    var what = e.source === 'upload' ? (e.file_name || 'File') : (e.description || (e.source === 'gmail' || e.source === 'outlook' ? 'Email' : 'Record'));
    return (EV_SOURCE[e.source] || 'Evidence') + ': ' + what + (e.party ? ' · ' + e.party : '') + (e.occurred_at ? ' · ' + fmt(e.occurred_at) : '') + (e.grade === 'verified' ? ' ✓' : '');
  }
  function overdueWithoutEvidence(){
    var today = localTodayISO(), by = {};
    stmtInvoices.forEach(function(i){
      if(i.fullyPaid || !i.due_date || i.due_date >= today) return;
      var id = invDebtorId(i); if(!id) return;
      by[id] = (by[id] || 0) + Math.max(0, i.amount - (i.paid || 0));
    });
    return Object.keys(by).filter(function(id){ return !acceptanceFor(id); }).map(function(id){
      var d = stmtDebtors.filter(function(x){ return x.id === id; })[0];
      return { id: id, name: d ? d.name : 'Customer', owing: r2(by[id]), declared: acceptanceFor(id, true) };
    }).sort(function(a, b){ return b.owing - a.owing; });
  }
  function renderWho(){
    var d = termsSel(), out = document.getElementById('termsWho'), admin = canEditPayments();
    if(!d){ out.innerHTML = '<div class="empty-note">Add your terms first.</div>'; return; }
    var recs = termsAccepts.filter(function(a){ return a.document_id === d.id; })
      .sort(function(a, b){ return accWho(a).localeCompare(accWho(b)); });
    var n = { verified: 0, evidence: 0, declared: 0 };
    recs.forEach(function(a){ if(a.debtor_id || a.group_id) n[a.evidence_grade || 'declared']++; });
    var html = '<p class="hint-r" style="margin:0 0 10px;">Interest and fees are only added for customers with evidence that they accepted these terms: a signed document or email you attach, or a record DebtJet verifies from a connected app. Invoices issued before the date they accepted are never charged.'
      + (termsUsable(d) ? '' : ' <b>These terms can’t be used for charges until you confirm what they allow.</b>') + '</p>'
      + '<div class="acc-chips"><span class="tchip ok">Verified ' + n.verified + '</span><span class="tchip ok">Evidence attached ' + n.evidence + '</span><span class="tchip todo">No evidence ' + n.declared + '</span></div>';
    html += recs.length ? '<table class="tr-table"><thead><tr><th>Customer</th><th>Accepted</th><th>How</th><th>Evidence</th><th>Status</th><th></th></tr></thead><tbody>'
      + recs.map(function(a){
          var all = !a.debtor_id && !a.group_id, evs = evFor(a.id);
          return '<tr><td class="k">'+escapeHtml(accWho(a))+'</td><td>'+escapeHtml(fmt(a.accepted_on))+'</td><td>'+escapeHtml(ACCEPT_HOW[a.accepted_how] || '')+(a.note ? '<div class="tr-note">'+escapeHtml(a.note)+'</div>' : '')+'</td>'
            + '<td>' + evs.map(function(e){ return '<div class="ev-item"><a href="#" data-ev-open="'+escapeHtml(e.id)+'">'+escapeHtml(evLabel(e))+'</a>'+(admin && e.grade !== 'verified' ? ' <button type="button" class="linkbtn" data-ev-del="'+escapeHtml(e.id)+'" title="Remove this evidence" aria-label="Remove evidence">✕</button>' : '')+'</div>'; }).join('')
            + (admin && !all ? '<button type="button" class="btn sm" data-acc-ev="'+escapeHtml(a.id)+'">+ Evidence</button>' : '') + '</td>'
            + '<td>'+(all ? '<span class="tchip no">Doesn’t count</span><div class="tr-note">Each customer or group needs its own evidence.</div>' : (GRADE_CHIP[a.evidence_grade] || GRADE_CHIP.declared))+'</td>'
            + '<td>'+(admin ? '<button type="button" class="btn sm ghost" data-acc-del="'+escapeHtml(a.id)+'" title="Remove record" aria-label="Remove record">✕</button>' : '')+'</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-note">No customers recorded yet, so nothing is charged under these terms.</div>';
    var miss = overdueWithoutEvidence();
    if(miss.length) html += '<h4 class="sub-h">Overdue customers with no evidence on file <span class="hint-r" style="font-weight:400;">(no interest or fees for them)</span></h4>'
      + '<div class="acc-miss">' + miss.slice(0, 8).map(function(m){ return '<div class="acc-miss-row"><b>'+escapeHtml(m.name)+'</b><span>'+money(m.owing)+' overdue'+(m.declared ? ' · recorded without evidence' : '')+'</span>'
          + (admin ? '<button type="button" class="btn sm" data-acc-cust="'+escapeHtml(m.id)+'"'+(m.declared ? ' data-acc-existing="'+escapeHtml(m.declared.id)+'"' : '')+'>'+(m.declared ? '+ Add evidence' : '+ Record with evidence')+'</button>' : '')+'</div>'; }).join('')
      + (miss.length > 8 ? '<div class="fine">and ' + (miss.length - 8) + ' more.</div>' : '') + '</div>';
    if(acceptDraft && acceptDraft.docId === d.id) html += renderAcceptForm(d);
    else if(admin) html += '<div class="tr-actions"><button type="button" class="btn" data-acc="new">+ Record customers who accepted these terms</button></div>';
    out.innerHTML = html;
    if(acceptDraft && acceptDraft.src === 'email') loadDraftEmails();
  }
  function draftSingleDebtor(){
    var A = acceptDraft; if(!A) return null;
    if(A.mode === 'evidence'){ var a = termsAccepts.filter(function(x){ return x.id === A.accId; })[0]; return a && a.debtor_id ? a.debtor_id : null; }
    var ids = Object.keys(A.debtors); return A.scope === 'debtors' && ids.length === 1 ? ids[0] : null;
  }
  async function loadDraftEmails(){
    var A = acceptDraft, id = draftSingleDebtor(), box = document.getElementById('accEmails'); if(!box) return;
    if(!id){ box.innerHTML = '<div class="tr-note">Choose a single customer to pick one of their emails, or use a link instead.</div>'; return; }
    if(A.emailsFor !== id){
      box.innerHTML = '<div class="tr-note">Loading emails…</div>';
      var r = await sb.from('case_notes').select('id, debtor_id, email_subject, email_from, email_message_id, email_date, occurred_at').eq('debtor_id', id).order('occurred_at', { ascending: false }).limit(40);
      A.emails = (r.data || []).filter(function(x){ return x.email_message_id; }); A.emailsFor = id;
      if(acceptDraft !== A) return;
    }
    box.innerHTML = A.emails.length ? A.emails.map(function(m){ return '<label class="acc-email"><input type="radio" name="accEmail" data-ak-email="'+escapeHtml(m.id)+'"'+(A.emailNoteId === m.id ? ' checked' : '')+' /> <span><b>'+escapeHtml(m.email_subject || '(no subject)')+'</b><br>'+escapeHtml((m.email_from || '') + ' · ' + fmt(m.email_date || m.occurred_at))+'</span></label>'; }).join('')
      + '<div class="tr-note">The email stays in your inbox. DebtJet keeps a reference to it, not a copy.</div>'
      : '<div class="tr-note">No emails from this customer are logged in DebtJet yet. Log the acceptance email with the DebtJet Gmail add-on or Chrome extension, or paste a link to it.</div>';
  }
  function renderAcceptForm(d){
    var A = acceptDraft, q = (A.q || '').toLowerCase(), isNew = A.mode !== 'evidence';
    var acc = !isNew ? termsAccepts.filter(function(x){ return x.id === A.accId; })[0] : null;
    var h = '<div class="acc-form">';
    if(isNew){
      h += '<label>Who accepted<select data-ak="scope"><option value="debtors"'+(A.scope === 'debtors' ? ' selected' : '')+'>Selected customers</option><option value="group"'+(A.scope === 'group' ? ' selected' : '')+'>A contact group</option></select></label>'
        + '<label>Accepted on<input type="date" data-ak="accepted_on" value="'+escapeHtml(A.accepted_on || '')+'" max="'+localTodayISO()+'" /></label>'
        + '<label>How<select data-ak="accepted_how">' + Object.keys(ACCEPT_HOW).map(function(k){ return '<option value="'+k+'"'+(A.accepted_how === k ? ' selected' : '')+'>'+escapeHtml(ACCEPT_HOW[k])+'</option>'; }).join('') + '</select></label>'
        + (A.scope === 'group' ? '<label class="span3">Contact group<select data-ak="group_id"><option value="">Choose…</option>' + stmtGroups.map(function(g){ return '<option value="'+escapeHtml(g.id)+'"'+(A.group_id === g.id ? ' selected' : '')+'>'+escapeHtml(g.name)+'</option>'; }).join('') + '</select></label>' : '')
        + (A.scope === 'debtors' ? '<label class="span3">Customers<input type="search" data-ak="q" placeholder="Search customers…" value="'+escapeHtml(A.q || '')+'" /><div class="acc-pick">'
            + stmtDebtors.filter(function(x){ return !q || (x.name || '').toLowerCase().indexOf(q) >= 0 || A.debtors[x.id]; }).slice(0, 300).map(function(x){ return '<label><input type="checkbox" data-ad="'+escapeHtml(x.id)+'"'+(A.debtors[x.id] ? ' checked' : '')+' /> '+escapeHtml(x.name || '')+'</label>'; }).join('')
            + '</div></label>' : '');
    } else {
      h += '<div class="span3"><b>Add evidence for '+escapeHtml(acc ? accWho(acc) : 'this record')+'</b>'+(acc ? ' · accepted '+escapeHtml(fmt(acc.accepted_on))+' · '+escapeHtml(ACCEPT_HOW[acc.accepted_how] || '') : '')+'</div>';
    }
    var src = A.src || 'upload', radio = function(v, label, dis){ return '<label class="acc-src'+(dis ? ' dis' : '')+'"><input type="radio" name="accSrc" data-ak-src="'+v+'"'+(src === v ? ' checked' : '')+(dis ? ' disabled' : '')+' /> '+label+'</label>'; };
    h += '<div class="span3"><div class="acc-src-row"><b>Evidence</b>'
      + radio('upload', 'Upload a file') + radio('email', 'An email in your inbox') + radio('link', 'A link to an email')
      + radio('app', 'From a connected app', true) + '<span class="hint-r">Xero, QuickBooks and ServiceM8: coming soon</span></div>';
    if(src === 'upload') h += '<div class="acc-src-body"><input type="file" data-ak-file accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" />'+(A.file ? ' <span class="tr-note">'+escapeHtml(A.file.name)+'</span>' : '')+'<div class="tr-note">A signed credit application, signed terms, accepted quote, or a photo or scan of one. Up to 10 MB. Kept privately for your organisation.</div></div>';
    if(src === 'email') h += '<div class="acc-src-body" id="accEmails"></div>';
    if(src === 'link') h += '<div class="acc-src-body"><input type="url" data-ak="link" placeholder="https://mail.google.com/… or https://outlook.office.com/…" value="'+escapeHtml(A.link || '')+'" /><div class="tr-note">Paste the link to the email in Gmail or Outlook where the customer accepted. The email stays in your inbox.</div></div>';
    h += '<label class="acc-desc">Describe the evidence (optional)<input maxlength="300" data-ak="ev_desc" value="'+escapeHtml(A.ev_desc || '')+'" placeholder="e.g. Credit application signed by J Smith, director" /></label></div>';
    if(isNew) h += '<label class="span3 inline-check acc-declared"><input type="checkbox" data-ak-declared'+(A.declared ? ' checked' : '')+' /> No evidence yet. Save the record anyway; no interest or fees until evidence is added.</label>';
    h += '<div class="span3 tr-actions" style="margin:0;"><button type="button" class="btn primary" data-acc="save">Save</button><button type="button" class="btn ghost" data-acc="cancel">Cancel</button>'
      + '<span class="hint-r">Only record customers who agreed to these terms before you supplied them.</span></div></div>';
    return h;
  }
  async function uploadEvidenceFile(file){
    if(!/\.(pdf|docx|txt|jpe?g|png)$/i.test(file.name)) return { error: 'Upload a PDF, Word (.docx), text, JPG or PNG file.' };
    if(file.size > 10485760) return { error: 'That file is over 10 MB.' };
    var ext = (file.name.match(/\.([a-z]+)$/i) || [])[1].toLowerCase();
    var mime = { pdf: 'application/pdf', docx: DOCX_MIME, txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext];
    var path = currentOrg.id + '/evidence/' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '-' + file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    var sha = await sha256Hex(file);
    var up = await sb.storage.from('terms-docs').upload(path, file, { contentType: mime, upsert: false });
    if(up.error) return { error: 'Upload failed: ' + up.error.message };
    return { storage_path: path, file_name: file.name.slice(0, 200), mime: mime, size_bytes: file.size, sha256: sha };
  }
  // The evidence row(s) the draft describes, without acceptance_id. Returns { rows } or { error } or { none: true }.
  async function draftEvidence(){
    var A = acceptDraft, src = A.src || 'upload', desc = (A.ev_desc || '').trim().slice(0, 300) || null;
    if(src === 'upload'){
      if(!A.file) return { none: true };
      var f = await uploadEvidenceFile(A.file); if(f.error) return f;
      return { row: Object.assign({ source: 'upload', description: desc }, f) };
    }
    if(src === 'email'){
      var m = (A.emails || []).filter(function(x){ return x.id === A.emailNoteId; })[0]; if(!m) return { none: true };
      return { row: { source: 'gmail', external_id: String(m.email_message_id).slice(0, 500), external_url: gmailLink(m.email_message_id), case_note_id: m.id,
        occurred_at: m.email_date || m.occurred_at, party: (m.email_from || '').slice(0, 200) || null, description: desc || (m.email_subject || '').slice(0, 300) || null } };
    }
    if(src === 'link'){
      var u = (A.link || '').trim(); if(!u) return { none: true };
      if(!emailLinkOk(u)) return { error: 'Paste a link to the email in Gmail (mail.google.com) or Outlook (outlook.office.com or outlook.live.com).' };
      return { row: { source: /outlook\./.test(u) ? 'outlook' : 'gmail', external_url: u.slice(0, 1000), description: desc } };
    }
    return { none: true };
  }
  async function refreshAfterAcceptance(){ await loadTermsEvidence(); renderTermsTab(); renderChargesPortal(); await loadCases(); renderDashboard(); }
  var whoEl = document.getElementById('termsWho');
  whoEl.addEventListener('input', function(e){
    if(!acceptDraft) return;
    var t = e.target, k = t.getAttribute('data-ak');
    if(t.hasAttribute('data-ak-file')){ acceptDraft.file = t.files && t.files[0] || null; return; }
    if(t.hasAttribute('data-ak-src')){ acceptDraft.src = t.getAttribute('data-ak-src'); renderWho(); return; }
    if(t.hasAttribute('data-ak-email')){ acceptDraft.emailNoteId = t.getAttribute('data-ak-email'); return; }
    if(t.hasAttribute('data-ak-declared')){ acceptDraft.declared = t.checked; return; }
    if(k){
      acceptDraft[k] = t.value;
      if(k === 'scope' || k === 'q' || k === 'group_id'){
        var pos = t.selectionStart; renderWho();
        if(k === 'q'){ var qi = whoEl.querySelector('[data-ak="q"]'); qi.focus(); try { qi.setSelectionRange(pos, pos); } catch(x){} }
      }
      return;
    }
    var id = t.getAttribute('data-ad');
    if(id){ if(t.checked) acceptDraft.debtors[id] = true; else delete acceptDraft.debtors[id]; if(acceptDraft.src === 'email') loadDraftEmails(); }
  });
  whoEl.addEventListener('change', function(e){ var t = e.target; if(t.tagName === 'SELECT' || t.type === 'radio' || t.type === 'file' || t.type === 'checkbox') t.dispatchEvent(new Event('input', { bubbles: true })); });
  whoEl.addEventListener('click', async function(e){
    var d = termsSel(); if(!d) return;
    var open = e.target.closest('[data-ev-open]');
    if(open){
      e.preventDefault();
      var ev = termsEvidence.filter(function(x){ return x.id === open.getAttribute('data-ev-open'); })[0]; if(!ev) return;
      if(ev.storage_path){
        var w = window.open('', '_blank'), su = await sb.storage.from('terms-docs').createSignedUrl(ev.storage_path, 300);
        if(su.error || !su.data){ if(w) w.close(); toast('Couldn’t open the file.'); return; }
        if(w) w.location = su.data.signedUrl; else window.location.href = su.data.signedUrl;
      } else if(ev.external_url) window.open(ev.external_url, '_blank', 'noopener');
      return;
    }
    if(!canEditPayments()) return;
    var evDel = e.target.closest('[data-ev-del]');
    if(evDel){
      var x = termsEvidence.filter(function(y){ return y.id === evDel.getAttribute('data-ev-del'); })[0]; if(!x) return;
      var last = evFor(x.acceptance_id).length === 1;
      if(!await djAsk('Remove this evidence (' + evLabel(x) + ')?' + (last ? '\n\nIt’s the only evidence on this record, so interest and fees will stop for this customer until evidence is added.' : ''), { ok: 'Remove' })) return;
      var dr = await sb.from('terms_evidence').delete().eq('id', x.id);
      if(dr.error){ toast('Could not remove: ' + dr.error.message); return; }
      if(x.storage_path && !termsEvidence.some(function(y){ return y.id !== x.id && y.storage_path === x.storage_path; })) await sb.storage.from('terms-docs').remove([x.storage_path]);
      await refreshAfterAcceptance(); toast('Evidence removed.'); return;
    }
    var del = e.target.closest('[data-acc-del]');
    if(del){
      var a = termsAccepts.filter(function(x){ return x.id === del.getAttribute('data-acc-del'); })[0]; if(!a) return;
      if(!await djAsk('Remove the record that ' + accWho(a) + ' accepted “' + d.title + '”, and its evidence?\n\nUnless another record covers them, no interest or fees will be added for them.', { ok: 'Remove' })) return;
      var paths = evFor(a.id).map(function(x){ return x.storage_path; }).filter(Boolean);
      var r = await sb.from('terms_acceptances').delete().eq('id', a.id);
      if(r.error){ toast('Could not remove: ' + r.error.message); return; }
      var keep = termsEvidence.filter(function(x){ return x.acceptance_id !== a.id; });
      paths = paths.filter(function(p){ return !keep.some(function(x){ return x.storage_path === p; }); });
      if(paths.length) await sb.storage.from('terms-docs').remove(paths);
      await refreshAfterAcceptance(); return;
    }
    var addEv = e.target.closest('[data-acc-ev]');
    if(addEv){ acceptDraft = { docId: d.id, mode: 'evidence', accId: addEv.getAttribute('data-acc-ev'), debtors: {}, src: 'upload' }; renderWho(); return; }
    var cust = e.target.closest('[data-acc-cust]');
    if(cust){
      var existing = cust.getAttribute('data-acc-existing');
      if(existing){ var ex = termsAccepts.filter(function(x){ return x.id === existing; })[0]; if(ex && ex.document_id !== d.id){ selectTerms(ex.document_id); d = termsSel(); } acceptDraft = { docId: d.id, mode: 'evidence', accId: existing, debtors: {}, src: 'upload' }; }
      else { var dd = {}; dd[cust.getAttribute('data-acc-cust')] = true; acceptDraft = { docId: d.id, mode: 'new', scope: 'debtors', debtors: dd, accepted_on: '', accepted_how: 'signed_credit_application', src: 'upload', q: '' }; }
      renderWho(); var f = whoEl.querySelector('.acc-form'); if(f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); return;
    }
    var b = e.target.closest('[data-acc]'); if(!b) return;
    var act = b.getAttribute('data-acc');
    if(act === 'new'){ acceptDraft = { docId: d.id, mode: 'new', scope: 'debtors', accepted_on: '', accepted_how: 'signed_credit_application', note: '', group_id: '', debtors: {}, q: '', src: 'upload' }; renderWho(); return; }
    if(act === 'cancel'){ acceptDraft = null; renderWho(); return; }
    if(act !== 'save') return;
    var A = acceptDraft;
    if(A.mode === 'evidence'){
      var evd = await draftEvidence();
      if(evd.error){ toast(evd.error); return; }
      if(evd.none){ toast('Add the evidence: a file, an email from your inbox, or a link to an email.'); return; }
      b.disabled = true;
      var ie = await sb.from('terms_evidence').insert(Object.assign({ org_id: currentOrg.id, acceptance_id: A.accId }, evd.row));
      b.disabled = false;
      if(ie.error){ toast('Could not save: ' + ie.error.message); return; }
      acceptDraft = null; await refreshAfterAcceptance(); toast('Evidence added. Interest and fees under “' + d.title + '” now apply to this customer' + (termsUsable(d) ? '' : ', once you confirm what the terms allow') + '.');
      return;
    }
    if(!A.accepted_on){ toast('Enter the date the terms were accepted.'); return; }
    if(A.accepted_on > localTodayISO()){ toast('The acceptance date can’t be in the future.'); return; }
    var targets = A.scope === 'group' ? (A.group_id ? [{ group_id: A.group_id }] : []) : Object.keys(A.debtors).map(function(id){ return { debtor_id: id }; });
    if(!targets.length){ toast(A.scope === 'group' ? 'Choose a contact group.' : 'Tick at least one customer.'); return; }
    var hasEv = (A.src === 'upload' && A.file) || (A.src === 'email' && A.emailNoteId) || (A.src === 'link' && (A.link || '').trim());
    if(!hasEv && !A.declared){ toast('Add the evidence, or tick “No evidence yet” to save the record without charges.'); return; }
    var existingRecs = [];
    targets.forEach(function(t){ termsAccepts.forEach(function(x){ if((t.debtor_id && x.debtor_id === t.debtor_id) || (t.group_id && x.group_id === t.group_id)) existingRecs.push(x); }); });
    if(existingRecs.length && !await djAsk(existingRecs.length + ' of these already ' + (existingRecs.length === 1 ? 'has' : 'have') + ' a record (' + existingRecs.slice(0, 3).map(function(x){ var td = termsDocById(x.document_id); return accWho(x) + ': ' + (td ? td.title : 'other terms'); }).join('; ') + (existingRecs.length > 3 ? '…' : '') + '). Replace with “' + d.title + '”? Their current evidence is removed too.', { ok: 'Replace' })) return;
    b.disabled = true;
    var evr = hasEv ? await draftEvidence() : { none: true };
    if(evr.error){ b.disabled = false; toast(evr.error); return; }
    for(var i = 0; i < existingRecs.length; i++){ var rd = await sb.from('terms_acceptances').delete().eq('id', existingRecs[i].id); if(rd.error){ b.disabled = false; toast('Could not replace: ' + rd.error.message); return; } }
    var rows = targets.map(function(t){ return Object.assign({ org_id: currentOrg.id, document_id: d.id, accepted_on: A.accepted_on, accepted_how: A.accepted_how, note: (A.note || '').trim().slice(0, 300) || null }, t); });
    var ins = await sb.from('terms_acceptances').insert(rows).select('*');
    if(ins.error){ b.disabled = false; toast('Could not save: ' + ins.error.message); return; }
    if(evr.row){
      var evRows = (ins.data || []).map(function(a){ return Object.assign({ org_id: currentOrg.id, acceptance_id: a.id }, evr.row); });
      var ei = await sb.from('terms_evidence').insert(evRows);
      if(ei.error){ b.disabled = false; toast('Saved the record, but the evidence couldn’t be attached: ' + ei.error.message); await refreshAfterAcceptance(); return; }
    }
    b.disabled = false; acceptDraft = null; await refreshAfterAcceptance();
    toast(evr.row ? 'Recorded with evidence. Interest and fees under “' + d.title + '” now apply to ' + (A.scope === 'group' ? 'that group' : targets.length + ' customer' + (targets.length === 1 ? '' : 's')) + (termsUsable(d) ? '' : ', once you confirm what the terms allow') + '.'
      : 'Recorded without evidence. No interest or fees until you add evidence.');
  });
  ['chgStart','chgBackdate','chgTerms','chgInterestOn','chgRate','chgMethod','chgGrace','chgMinBal','chgCap'].forEach(function(id){
    document.getElementById(id).addEventListener('input', onChargeRulesChanged);
    document.getElementById(id).addEventListener('change', onChargeRulesChanged);
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="chgMode"]'), function(r){ r.addEventListener('change', onChargeRulesChanged); });

