/* DebtJet: charges.js
 * Charges engine: interest and fees per invoice, under accepted terms only, and the evidence checks.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* =====================================================================
     ACCOUNT STATEMENTS v2: templates, per-invoice notes, interest & fees,
     payment details. Everything the debtor reads is built by
     renderStatementDoc(model, template) and every value is escaped.
     ===================================================================== */
  function r2(n){ return Math.round((Number(n)||0) * 100) / 100; }
  // ---------- Charges engine: one place decides interest + fees for an invoice ----------
  // cfg: saved Interest & Fees rules (or the unsaved form, for previews).
  // Starts: due_date | after_grace | grace_backdated | first_demand | final_demand.
  // Mode: auto (charged unless waived) | manual (charged only once someone approves).
  var chargeDecisions = {}, demandDates = {}, disputedInvoices = {}, postingsByInv = {}, chargeInvoiceIds = {}, syncedPosted = {};
  function isoAddDays(iso, n){ var p = String(iso).slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2]) + n * 864e5).toISOString().slice(0, 10); }
  function isoDiff(a, b){ var x = String(a).slice(0, 10).split('-'), y = String(b).slice(0, 10).split('-'); return Math.round((Date.UTC(+x[0], +x[1]-1, +x[2]) - Date.UTC(+y[0], +y[1]-1, +y[2])) / 864e5); }
  function localTodayISO(){ var t = new Date(); return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10); }
  // ---------- Terms: no accepted terms on file, no interest or fees ----------
  // A customer's terms: their own acceptance record, else their contact group's, else the record for all customers.
  // The document must be a usable kind with its limits confirmed by a person. Rules are always clamped to the limits.
  var termsDocs = [], termsAccepts = [];
  var TERMS_CHARGE_KINDS = { terms_of_trade: 1, terms_of_service: 1, credit_application: 1, quote_or_contract: 1 };
  function termsUsable(d){ return !!(d && !d.archived && TERMS_CHARGE_KINDS[d.kind] && d.limits && d.rules && d.rules_confirmed_at); }
  function termsDocById(id){ return termsDocs.filter(function(d){ return d.id === id; })[0] || null; }
  // Evidence grades: only 'evidence' (a file or email the user attached) or 'verified' (from a connected app) allow charges.
  var EVIDENCE_OK = { evidence: 1, verified: 1 };
  function hasEvidence(a){ return !!(a && EVIDENCE_OK[a.evidence_grade]); }
  // The customer's own record, else their contact group's (latest). An "all customers" record never counts on its own.
  function acceptanceFor(debtorId, anyGrade){
    var ok = function(a){ return anyGrade || hasEvidence(a); };
    var own = termsAccepts.filter(function(a){ return a.debtor_id && a.debtor_id === debtorId && ok(a); })[0];
    if(own) return own;
    var groups = (typeof stmtGroupsOf !== 'undefined' && stmtGroupsOf[debtorId]) || [];
    return termsAccepts.filter(function(a){ return a.group_id && groups.indexOf(a.group_id) >= 0 && ok(a); })
      .sort(function(a, b){ return String(b.accepted_on).localeCompare(String(a.accepted_on)); })[0] || null;
  }
  // Which start rules charge no earlier than the terms allow.
  function startWithin(lim, basis, grace){
    var L = lim.start || 'due_date', G = Number(lim.grace_days) || 0;
    if(L === 'due_date') return true;
    if(L === 'after_grace') return basis === 'after_grace' && (Number(grace) || 0) >= G;
    if(L === 'first_demand') return basis === 'first_demand' || basis === 'final_demand';
    if(L === 'final_demand') return basis === 'final_demand';
    return false;
  }
  function limitFeeFor(lim, f){ return (lim.fees || []).filter(function(x){ return String(x.name).toLowerCase() === String(f.name).toLowerCase(); })[0] || null; }
  // Rules held at or below the document's limits. Returns { cfg, issues } (issues explain anything that was held back).
  function clampToLimits(rules, lim){
    var cfg = JSON.parse(JSON.stringify(rules || {})), issues = [], L = (lim && lim.interest) || {};
    if(cfg.interest_enabled){
      if(!L.allowed){ cfg.interest_enabled = false; issues.push('Interest is switched on, but these terms don’t provide for interest.'); }
      else {
        if(L.max_rate_pa != null && Number(cfg.rate_pa) > Number(L.max_rate_pa) + 1e-9){ issues.push('Interest rate ' + r2(cfg.rate_pa * 100) + '% is above the ' + r2(L.max_rate_pa * 100) + '% in the terms.'); cfg.rate_pa = Number(L.max_rate_pa); }
        if(cfg.method === 'compound_monthly' && L.method !== 'compound_monthly'){ issues.push('The terms provide for simple interest, not compounding.'); cfg.method = 'simple'; }
        if(!startWithin(L, cfg.interest_start, cfg.grace_days)){ issues.push('Interest would start earlier than the terms allow.'); cfg.interest_start = L.start || 'due_date'; cfg.grace_days = Number(L.grace_days) || 0; }
      }
    }
    cfg.fees = (cfg.fees || []).filter(function(f){
      var m = limitFeeFor(lim || {}, f);
      if(!m){ issues.push('“' + f.name + '” isn’t a fee in these terms.'); return false; }
      if(m.type !== f.type){ issues.push('“' + f.name + '” must be a ' + (m.type === 'percent' ? '% fee' : '$ fee') + ', as in the terms.'); return false; }
      if(m.applies !== f.applies){ issues.push('“' + f.name + '” is charged ' + (m.applies === 'per_statement' ? 'once per statement' : 'per invoice') + ' under the terms.'); f.applies = m.applies; }
      if(Number(f.amount) > Number(m.max_amount) + 1e-9){ issues.push('“' + f.name + '” is above the ' + (m.type === 'percent' ? r2(m.max_amount) + '%' : money(m.max_amount)) + ' in the terms.'); f.amount = Number(m.max_amount); }
      if((Number(f.after_days) || 1) < (Number(m.min_after_days) || 1)){ issues.push('“' + f.name + '” can only be charged from ' + m.min_after_days + ' days overdue.'); f.after_days = Number(m.min_after_days) || 1; }
      return true;
    });
    return { cfg: cfg, issues: issues };
  }
  // The terms behind one customer's invoice. ok:false explains why nothing can be charged.
  function resolveTerms(debtorId, issuedISO){
    var a = debtorId ? acceptanceFor(debtorId) : null;
    if(!a){
      var dec = debtorId ? acceptanceFor(debtorId, true) : null;
      if(dec) return { ok: false, code: 'no_evidence', label: 'No evidence on file', acc: dec, doc: termsDocById(dec.document_id), note: 'This customer is recorded as accepting terms, but no evidence is attached (a signed document, an email, or a record from a connected app), so no interest or fees are added.' };
      return { ok: false, code: 'no_terms', label: 'No terms on file', note: 'No accepted terms are recorded for this customer, so no interest or fees are added. Record them, with evidence, on the Terms & rules tab.' };
    }
    var d = termsDocById(a.document_id);
    if(!d) return { ok: false, code: 'no_terms', label: 'No terms on file', note: 'The terms this customer accepted are no longer in DebtJet.' };
    if(!termsUsable(d)) return { ok: false, code: 'unconfirmed', label: 'Terms not confirmed', doc: d, acc: a, note: 'What “' + d.title + '” allows hasn’t been confirmed yet, so no interest or fees are added.' };
    if(issuedISO && String(issuedISO).slice(0, 10) < String(a.accepted_on)) return { ok: false, code: 'before_acceptance', label: 'Issued before terms accepted', doc: d, acc: a, note: 'This invoice was issued before the customer accepted “' + d.title + '” (' + fmt(a.accepted_on) + '), so no interest or fees are added.' };
    var cl = clampToLimits(d.rules, d.limits);
    return { ok: true, doc: d, acc: a, cfg: Object.assign(cl.cfg, { terms_allow_charges: true, apply_mode: (orgCharges && orgCharges.apply_mode) || 'auto' }) };
  }
  function invDebtorId(i){ return i.debtor_id || (i.debtor && i.debtor.id) || null; }
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

  function chargesOn(){ return termsDocs.some(termsUsable) && termsAccepts.some(hasEvidence); }
  // Display rate for a customer (cases list, letters): 0 when nothing can be charged.
  function rateForDebtor(debtorId){ var t = resolveTerms(debtorId, null); return t.ok && t.cfg.interest_enabled ? Number(t.cfg.rate_pa) || 0 : 0; }
  var START_LABEL = { due_date: 'From the due date', after_grace: 'After the grace period', grace_backdated: 'After the grace period, backdated to the due date', first_demand: 'From the first letter of demand', final_demand: 'From the final letter of demand' };

  function invoiceCharges(inv, cfg, opts){
    opts = opts || {};
    var tb = null;
    if(cfg === undefined){
      tb = resolveTerms(invDebtorId(inv), inv.issued_date || null);
      cfg = tb.ok ? (opts.override && opts.override.docId === tb.doc.id ? Object.assign(clampToLimits(opts.override.cfg, tb.doc.limits).cfg, { terms_allow_charges: true, apply_mode: (orgCharges && orgCharges.apply_mode) || 'auto' }) : tb.cfg) : null;
    }
    var asAt = opts.asAt || localTodayISO();
    var balance = r2(Math.max(0, Number(inv.balance) || 0));
    var od = inv.due_date ? isoDiff(asAt, inv.due_date) : 0;
    var out = { state: 'nothing', label: 'No charges', daysOverdue: od, startDate: null, chargeDays: 0, interest: 0, perDay: 0, fees: [], feeTotal: 0, applied: false, decision: null, note: '', terms: tb, rate: cfg && cfg.interest_enabled ? Number(cfg.rate_pa) || 0 : 0 };
    if(inv.fullyPaid || balance <= 0){ out.state = 'paid'; out.label = 'Paid'; return out; }
    if(chargeInvoiceIds[inv.id]){ out.state = 'nothing'; out.label = 'Interest invoice'; out.note = 'This is an interest invoice posted to Xero, so no interest or fees are added to it.'; return out; }
    if(od <= 0){ out.state = 'not_due'; out.label = od === 0 ? 'Due today' : 'Not due yet'; return out; }
    if(tb && !tb.ok){ out.state = 'off'; out.label = tb.label; out.note = tb.note; return out; }
    if(!cfg || cfg.terms_allow_charges === false){ out.state = 'off'; out.label = 'Charges off'; out.note = 'No accepted terms allow charges.'; return out; }
    var rate = Number(cfg.rate_pa) || 0, grace = Number(cfg.grace_days) || 0, basis = cfg.interest_start || 'after_grace';
    // When does interest start counting?
    var start = null, waitingFor = '';
    if(basis === 'due_date') start = inv.due_date;
    else if(basis === 'after_grace'){ if(od > grace) start = isoAddDays(inv.due_date, grace); else waitingFor = 'Starts ' + fmt(isoAddDays(inv.due_date, grace + 1)); }
    else if(basis === 'grace_backdated'){ if(od >= Math.max(1, grace)) start = inv.due_date; else waitingFor = 'Starts ' + fmt(isoAddDays(inv.due_date, grace)) + ', backdated'; }
    else {
      var dd = opts.demandDate !== undefined ? opts.demandDate : ((demandDates[inv.case_id] || {})[basis === 'final_demand' ? 'final' : 'first'] || null);
      if(dd){ start = String(dd).slice(0, 10) > String(inv.due_date).slice(0, 10) ? String(dd).slice(0, 10) : String(inv.due_date).slice(0, 10); }
      else waitingFor = basis === 'final_demand' ? 'After the final letter of demand' : 'After a letter of demand';
    }
    if(cfg.interest_enabled && rate > 0 && start){
      var d = Math.max(0, isoDiff(asAt, start));
      if(balance < (Number(cfg.min_balance) || 0)){ out.note = 'Balance is under the ' + money(cfg.min_balance) + ' minimum for interest.'; }
      else if(d > 0){
        var i = cfg.method === 'compound_monthly' ? balance * (Math.pow(1 + rate / 12, d / (365 / 12)) - 1) : balance * rate * d / 365;
        var capped = cfg.cap_pct && i > balance * Number(cfg.cap_pct);
        if(capped){ i = balance * Number(cfg.cap_pct); out.note = 'Capped at ' + r2(cfg.cap_pct * 100) + '% of the balance.'; }
        out.startDate = start; out.chargeDays = d; out.interest = r2(i); out.perDay = capped ? 0 : r2(balance * rate / 365);
        if(!opts.ignorePosted && syncedPosted[inv.id]){ out.postedOff = syncedPosted[inv.id]; out.interest = r2(Math.max(0, out.interest - syncedPosted[inv.id])); out.note = (out.note ? out.note + ' ' : '') + money(syncedPosted[inv.id]) + ' of interest is on a separate Xero invoice.'; }
      }
    }
    (cfg.fees || []).forEach(function(f){
      if(f.applies !== 'per_invoice' || od < (Number(f.after_days) || 1)) return;
      var a = f.type === 'percent' ? balance * Number(f.amount) / 100 : Number(f.amount);
      if(f.max && a > Number(f.max)) a = Number(f.max);
      a = r2(a); if(a > 0){ out.fees.push({ name: f.name || 'Fee', amount: a }); out.feeTotal = r2(out.feeTotal + a); }
    });
    var potential = out.interest + out.feeTotal;
    var dec = opts.decision !== undefined ? opts.decision : (chargeDecisions[inv.id] || null);
    out.decision = dec;
    var disputed = opts.disputed !== undefined ? opts.disputed : (inv.disputed || !!disputedInvoices[inv.id]);
    if(disputed){ out.state = 'disputed'; out.label = 'Disputed, no charges'; return out; }
    if(dec && dec.decision === 'waive'){ out.state = 'waived'; out.label = 'Waived'; return out; }
    if(potential <= 0){
      if(waitingFor){ out.state = 'waiting'; out.label = waitingFor; }
      else if(!cfg.interest_enabled && !(cfg.fees || []).length){ out.state = 'off'; out.label = 'Nothing switched on'; }
      return out;
    }
    if(dec && dec.decision === 'apply'){ out.state = 'applied'; out.label = 'Charging'; out.applied = true; }
    else if((cfg.apply_mode || 'auto') === 'manual'){ out.state = 'pending'; out.label = 'Awaiting approval'; }
    else { out.state = 'applied'; out.label = 'Charging'; out.applied = true; }
    if(waitingFor && !out.interest) out.note = (out.note ? out.note + ' ' : '') + 'Interest: ' + waitingFor.toLowerCase() + '.';
    return out;
  }
  // Once-per-statement fees: only when at least one invoice on the statement is being charged.
  function calcStatementFees(items, cfg){
    var live = items.filter(function(i){ return !i.disputed && !i.fullyPaid && i.balance > 0 && i.chargesApplied !== false; });
    if(cfg === undefined){
      // Use the terms of the first charged invoice; only invoices under the same terms count towards the fee.
      var first = null;
      live.forEach(function(i){ if(first) return; var t = resolveTerms(invDebtorId(i), i.issued_date || null); if(t.ok) first = t; });
      if(!first) return [];
      cfg = first.cfg;
      live = live.filter(function(i){ var t = resolveTerms(invDebtorId(i), i.issued_date || null); return t.ok && t.doc.id === first.doc.id; });
    }
    if(!cfg || cfg.terms_allow_charges === false) return [];
    if(!live.length) return [];
    var maxOd = live.reduce(function(m, i){ return Math.max(m, i.daysOverdue); }, 0);
    var base = live.reduce(function(s, i){ return s + i.balance; }, 0);
    var out = [];
    (cfg.fees || []).forEach(function(f){
      if(f.applies !== 'per_statement' || maxOd < (Number(f.after_days) || 1)) return;
      var a = f.type === 'percent' ? base * Number(f.amount) / 100 : Number(f.amount);
      if(f.max && a > Number(f.max)) a = Number(f.max);
      a = r2(a); if(a > 0) out.push({ name: f.name || 'Fee', amount: a });
    });
    return out;
  }
  async function loadChargeContext(){
    var res = await Promise.all([
      sb.from('invoice_charge_decisions').select('invoice_id, decision, reason, decided_by, decided_at').eq('org_id', currentOrg.id),
      sb.from('letters').select('case_id, type, sent_at').eq('org_id', currentOrg.id).eq('status', 'sent').order('sent_at', { ascending: true }),
      sb.from('case_notes').select('invoice_id, category, occurred_at').eq('org_id', currentOrg.id).not('invoice_id', 'is', null).order('occurred_at', { ascending: false })
    ]);
    chargeDecisions = {}; (res[0].data || []).forEach(function(d){ chargeDecisions[d.invoice_id] = d; });
    demandDates = {};
    (res[1].data || []).forEach(function(l){
      var d = demandDates[l.case_id] = demandDates[l.case_id] || {};
      if((l.type === 'first_demand' || l.type === 'final_demand' || l.type === 'pre_legal') && !d.first) d.first = l.sent_at;
      if((l.type === 'final_demand' || l.type === 'pre_legal') && !d.final) d.final = l.sent_at;
    });
    disputedInvoices = {}; var seen = {};
    (res[2].data || []).forEach(function(n){ if(seen[n.invoice_id]) return; seen[n.invoice_id] = true; if(n.category === 'dispute') disputedInvoices[n.invoice_id] = true; });
    // Interest posted to Xero: a draft keeps the interest on the original invoice; once the
    // interest invoice is approved and synced, that interest moves to its own invoice.
    var pr = await Promise.all([
      sb.from('charge_postings').select('id, invoice_id, xero_invoice_id, xero_invoice_number, period_from, period_to, interest, status, created_at').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(1000),
      sb.from('charge_posting_settings').select('*').eq('org_id', currentOrg.id).maybeSingle()
    ]);
    xpSettingsRow = pr[1].data || null;
    postingsByInv = {}; chargeInvoiceIds = {}; syncedPosted = {};
    var postings = pr[0].data || [];
    postings.forEach(function(p){ (postingsByInv[p.invoice_id] = postingsByInv[p.invoice_id] || []).push(p); });
    var xids = postings.filter(function(p){ return p.xero_invoice_id && p.status !== 'voided' && p.status !== 'deleted'; }).map(function(p){ return p.xero_invoice_id; });
    if(xids.length){
      var syn = await sb.from('invoices').select('id, external_id').eq('org_id', currentOrg.id).eq('source', 'xero').in('external_id', xids.slice(0, 500));
      var xset = {}; xids.forEach(function(x){ xset[x] = true; });
      var byExt = {}; (syn.data || []).forEach(function(i){ if(!xset[i.external_id]) return; byExt[i.external_id] = i.id; chargeInvoiceIds[i.id] = true; });
      postings.forEach(function(p){ if(p.xero_invoice_id && byExt[p.xero_invoice_id] && p.status !== 'voided' && p.status !== 'deleted') syncedPosted[p.invoice_id] = r2((syncedPosted[p.invoice_id] || 0) + Number(p.interest)); });
    }
  }

  async function loadOrgSettings(){
    var res = await Promise.all([
      sb.from('org_payment_details').select('*').eq('org_id', currentOrg.id).maybeSingle(),
      sb.from('org_charge_settings').select('*').eq('org_id', currentOrg.id).maybeSingle(),
      sb.from('payment_detail_changes').select('changed_at, summary, changed_by').eq('org_id', currentOrg.id).order('changed_at', { ascending: false }).limit(15),
      sb.from('statement_templates').select('*').eq('org_id', currentOrg.id).order('name')
    ]);
    orgPayment = res[0].data || null;
    orgCharges = res[1].data || null;
    if(orgCharges && !Array.isArray(orgCharges.fees)) orgCharges.fees = [];
    paymentChanges = res[2].data || [];
    stmtTemplates = res[3].data || [];
    if(orgCharges){ orgCharges.apply_mode = orgCharges.apply_mode || 'auto'; orgCharges.interest_start = orgCharges.interest_start || 'after_grace'; }
    await loadChargeContext();
    await loadTermsDocs();
    if(!stmtTplKey || (stmtTplKey.indexOf('preset:') !== 0 && !stmtTemplates.some(function(t){ return t.id === stmtTplKey; }))){
      var def = stmtTemplates.filter(function(t){ return t.is_default; })[0];
      selectStatementTemplate(def ? def.id : 'preset:classic', true);
    }
  }
  function bankChangedRecently(){
    return !!(orgPayment && orgPayment.bank_changed_at && Date.now() - new Date(orgPayment.bank_changed_at).getTime() < 86400000);
  }

