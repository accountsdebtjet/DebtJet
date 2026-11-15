/**
 * Works out which DebtJet debtor and invoices an email is about, in code (not AI):
 * sender email, same company domain, invoice numbers, ABN and business name.
 */
var FREE_DOMAINS_ = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'live.com.au', 'msn.com',
  'yahoo.com', 'yahoo.com.au', 'icloud.com', 'me.com', 'bigpond.com', 'bigpond.net.au', 'optusnet.com.au',
  'tpg.com.au', 'iinet.net.au', 'proton.me', 'protonmail.com'];

function escapeRegex_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function matchDebtors_(email, data) {
  var scores = {}, order = [];
  function bump(id, pts, why) {
    if (!scores[id]) { scores[id] = { score: 0, reasons: [] }; order.push(id); }
    scores[id].score += pts;
    if (scores[id].reasons.indexOf(why) < 0) scores[id].reasons.push(why);
  }
  var fromEmail = String(email.from_email || '').toLowerCase().trim();
  var domain = fromEmail.indexOf('@') > 0 ? fromEmail.split('@')[1] : '';
  var hay = (String(email.subject || '') + '\n' + String(email.body || '')).toLowerCase();
  var hayDigits = hay.replace(/\s/g, '');

  data.debtors.forEach(function (d) {
    var de = String(d.email || '').toLowerCase().trim();
    if (de && fromEmail && de === fromEmail) bump(d.id, 100, 'Sender email matches');
    else if (de && domain && FREE_DOMAINS_.indexOf(domain) < 0 && de.slice(-(domain.length + 1)) === '@' + domain) bump(d.id, 50, 'Same email domain');
    if (d.name && d.name.length >= 4 && hay.indexOf(String(d.name).toLowerCase()) >= 0) bump(d.id, 25, 'Business name mentioned');
    var abn = String(d.abn || '').replace(/\D/g, '');
    if (abn.length === 11 && hayDigits.indexOf(abn) >= 0) bump(d.id, 60, 'ABN mentioned');
  });

  var mentioned = {};
  data.invoices.forEach(function (inv) {
    var num = String(inv.invoice_number || '').trim();
    if (num.length < 3) return;
    var re = new RegExp('(^|[^a-z0-9])' + escapeRegex_(num.toLowerCase()) + '([^a-z0-9]|$)');
    if (re.test(hay)) { mentioned[inv.id] = true; if (inv.debtor_id) bump(inv.debtor_id, 80, 'Invoice ' + num + ' mentioned'); }
  });

  return order.sort(function (a, b) { return scores[b].score - scores[a].score; }).slice(0, 5).map(function (id) {
    return buildCandidate_(id, scores[id].score, scores[id].reasons, mentioned, data);
  });
}

function buildCandidate_(id, score, reasons, mentioned, data) {
  var d = data.debtors.filter(function (x) { return x.id === id; })[0] || {};
  var openCase = data.cases.filter(function (c) { return c.debtor_id === id; })[0] || null;
  var invoices = data.invoices.filter(function (i) { return i.debtor_id === id; }).slice(0, 40).map(function (i) {
    return { id: i.id, case_id: i.case_id, invoice_number: i.invoice_number, amount: Number(i.amount), due_date: i.due_date, mentioned: !!(mentioned && mentioned[i.id]) };
  });
  return { id: id, name: d.name, email: d.email, score: score, reasons: reasons, case_id: openCase ? openCase.id : null, invoices: invoices };
}
