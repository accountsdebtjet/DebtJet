/**
 * DebtJet Gmail add-on — screens and actions.
 * Flow: open an email → Summarise with Gemini → check/edit → Save to DebtJet.
 * Only the reviewed summary and key facts are saved to DebtJet; the email stays in Gmail.
 */

// ---------- helpers ----------
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function form_(e, name) {
  var f = (e && e.commonEventObject && e.commonEventObject.formInputs) || {};
  var v = f[name];
  if (!v) return null;
  if (v.stringInputs) return v.stringInputs.value;           // array of strings
  if (v.dateInput) return v.dateInput.msSinceEpoch;
  return null;
}
function form1_(e, name) { var v = form_(e, name); return Array.isArray(v) ? (v[0] || '') : (v || ''); }
function param_(e, name) {
  return (e && e.commonEventObject && e.commonEventObject.parameters && e.commonEventObject.parameters[name]) ||
         (e && e.parameters && e.parameters[name]) || '';
}
function messageIdOf_(e) { return (e && e.gmail && e.gmail.messageId) || param_(e, 'messageId'); }
function action_(fn, params) { return CardService.newAction().setFunctionName(fn).setParameters(params || {}); }
function button_(text, fn, params, filled) {
  var b = CardService.newTextButton().setText(text).setOnClickAction(action_(fn, params));
  if (filled) b.setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  return b;
}
function notify_(text) {
  return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(text)).build();
}
function update_(card, note) {
  var b = CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(card));
  if (note) b.setNotification(CardService.newNotification().setText(note));
  return b.build();
}
function errorCard_(msg, messageId) {
  var s = CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('<font color="#C1473C">' + esc_(msg) + '</font>'));
  if (messageId) s.addWidget(button_('Back', 'onBackToMessage', { messageId: messageId }));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('DebtJet')).addSection(s).build();
}
function handle_(e, fn) {
  try { return fn(); }
  catch (err) {
    var mid = messageIdOf_(e);
    if (err.isAuth) return update_(connectCard_(mid), err.message);
    return update_(errorCard_(err.message || String(err), mid));
  }
}

// ---------- cache of the current review (per user, per email) ----------
function stateKey_(messageId) { return 'dj_' + messageId; }
function saveState_(messageId, state) { CacheService.getUserCache().put(stateKey_(messageId), JSON.stringify(state), 3600); }
function loadState_(messageId) { var r = CacheService.getUserCache().get(stateKey_(messageId)); return r ? JSON.parse(r) : null; }

// ---------- reading the open email ----------
function readMessage_(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  var msg = GmailApp.getMessageById(e.gmail.messageId);
  var from = msg.getFrom() || '';
  var m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  var date = msg.getDate();
  return {
    message_id: e.gmail.messageId,
    subject: msg.getSubject() || '',
    from_name: m ? m[1].trim() : '',
    from_email: (m ? m[2] : from).trim(),
    date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEE d MMM yyyy, h:mm a'),
    date_iso: date.toISOString(),
    body: String(msg.getPlainBody() || '').slice(0, CONFIG.MAX_BODY_CHARS)
  };
}

// ---------- triggers ----------
function onHomepage(e) {
  var s = getSession_();
  if (!s) return connectCard_('');
  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('Connected as <b>' + esc_(s.user && s.user.email) + '</b>' + (s.org ? ' · ' + esc_(s.org.name) : '') + '.'))
    .addWidget(CardService.newTextParagraph().setText('Open a debtor\'s email to summarise it with Gemini and file the key points in DebtJet.'))
    .addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton().setText('Open DebtJet').setOpenLink(CardService.newOpenLink().setUrl(CONFIG.APP_URL)))
      .addButton(button_('Disconnect', 'onDisconnect', {})));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('DebtJet')).addSection(sec).build();
}

function onGmailMessage(e) {
  if (!getSession_()) return connectCard_(e.gmail.messageId);
  try { return messageCard_(e); }
  catch (err) { return err.isAuth ? connectCard_(e.gmail.messageId) : errorCard_(err.message || String(err), ''); }
}

// ---------- screens ----------
function connectCard_(messageId) {
  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      '<b>Connect to DebtJet</b><br>1. In DebtJet, go to <b>Integrations → Gmail add-on → Get connection code</b>.<br>2. Type the code below.'))
    .addWidget(CardService.newTextInput().setFieldName('code').setTitle('Connection code (e.g. ABCDE-FGH23)'))
    .addWidget(button_('Connect', 'onConnect', { messageId: messageId || '' }, true))
    .addWidget(CardService.newTextButton().setText('Open DebtJet').setOpenLink(CardService.newOpenLink().setUrl(CONFIG.APP_URL)));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('DebtJet')).addSection(sec).build();
}

function messageCard_(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  var msg = GmailApp.getMessageById(e.gmail.messageId);
  var mid = e.gmail.messageId;
  var sec = CardService.newCardSection()
    .addWidget(CardService.newDecoratedText().setTopLabel('From').setText(esc_(msg.getFrom())).setWrapText(true))
    .addWidget(CardService.newDecoratedText().setTopLabel('Subject').setText(esc_(msg.getSubject() || '(no subject)')).setWrapText(true))
    .addWidget(button_('Summarise with Gemini', 'onSummarise', { messageId: mid }, true))
    .addWidget(button_('Write a note without AI', 'onManual', { messageId: mid }))
    .addWidget(CardService.newTextParagraph().setText(
      '<font color="#7284A3">Gemini runs in DebtJet\'s Google Cloud. The email stays with Google; only the summary you approve is saved to DebtJet.</font>'));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('DebtJet').setSubtitle('Debtor email')).addSection(sec).build();
}

function reviewCard_(state, overrides) {
  overrides = overrides || {};
  var r = state.result || {};
  var mid = state.email.message_id;
  var debtorId = overrides.debtor != null ? overrides.debtor : state.selectedDebtorId || '';
  var cand = state.candidates.filter(function (c) { return c.id === debtorId; })[0] || null;
  var card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('Check before saving')
    .setSubtitle(state.usedAi ? 'Suggested by ' + (r.model || 'Gemini') : 'Manual note'));

  if (state.notice) card.addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('<font color="#B4790A">' + esc_(state.notice) + '</font>')));

  // Debtor
  var debtorSel = CardService.newSelectionInput().setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('debtor').setTitle('Debtor').setOnChangeAction(action_('onDebtorChange', { messageId: mid }));
  debtorSel.addItem('— Choose a debtor —', '', !debtorId);
  state.candidates.forEach(function (c) { debtorSel.addItem((c.name || 'Unnamed') + (c.email ? ' · ' + c.email : ''), c.id, c.id === debtorId); });
  var s1 = CardService.newCardSection().setHeader('Who it\'s about').addWidget(debtorSel);
  if (cand && cand.reasons && cand.reasons.length) s1.addWidget(CardService.newTextParagraph().setText('<font color="#7284A3">Matched: ' + esc_(cand.reasons.join(', ')) + '</font>'));
  s1.addWidget(CardService.newTextInput().setFieldName('debtor_search').setTitle('Search other debtors'))
    .addWidget(button_('Search', 'onDebtorSearch', { messageId: mid }));
  card.addSection(s1);

  // Invoices + disputed
  var s2 = CardService.newCardSection().setHeader('Invoices');
  if (cand && cand.invoices.length) {
    var wanted = (overrides.invoices || (r.invoice_numbers || []).concat(r.disputed_invoice_numbers || []).map(String)).map(function (x) { return String(x).trim().toLowerCase(); });
    var disputedWanted = (overrides.disputed || (r.disputed_invoice_numbers || [])).map(function (x) { return String(x).trim().toLowerCase(); });
    var invSel = CardService.newSelectionInput().setType(CardService.SelectionInputType.CHECK_BOX).setFieldName('invoices').setTitle('This email is about');
    var dispSel = CardService.newSelectionInput().setType(CardService.SelectionInputType.CHECK_BOX).setFieldName('disputed').setTitle('Debtor disputes');
    cand.invoices.forEach(function (i) {
      var label = (i.invoice_number || '—') + ' · $' + Number(i.amount).toFixed(2) + ' · due ' + (i.due_date || '—');
      var key = String(i.invoice_number).trim().toLowerCase();
      var keyId = String(i.id).toLowerCase();
      var on = wanted.indexOf(key) >= 0 || wanted.indexOf(keyId) >= 0 || (!wanted.length && i.mentioned);
      var disp = disputedWanted.indexOf(key) >= 0 || disputedWanted.indexOf(keyId) >= 0;
      invSel.addItem(label, i.id, on || disp);
      dispSel.addItem(i.invoice_number || '—', i.id, disp);
    });
    s2.addWidget(invSel).addWidget(dispSel);
  } else {
    s2.addWidget(CardService.newTextParagraph().setText(cand ? 'No open invoices for this debtor; the note will be filed against the debtor.' : 'Choose a debtor first.'));
  }
  card.addSection(s2);

  // Details
  var cat = overrides.category || r.category || 'other';
  var catSel = CardService.newSelectionInput().setType(CardService.SelectionInputType.DROPDOWN).setFieldName('category').setTitle('Type');
  Object.keys(CATEGORY_LABEL).forEach(function (k) { catSel.addItem(CATEGORY_LABEL[k], k, k === cat); });
  var s3 = CardService.newCardSection().setHeader('What they said')
    .addWidget(catSel)
    .addWidget(CardService.newTextInput().setFieldName('summary').setTitle('Summary for the case file').setMultiline(true)
      .setValue(overrides.summary != null ? overrides.summary : (r.summary || '')))
    .addWidget(CardService.newTextInput().setFieldName('key_points').setTitle('Key points (one per line)').setMultiline(true)
      .setValue(overrides.key_points != null ? overrides.key_points : (r.key_points || []).join('\n')));
  var pd = CardService.newDatePicker().setFieldName('promised_date').setTitle('Promised by');
  var pdMs = overrides.promised_date != null ? overrides.promised_date : (r.promised_date ? Date.parse(r.promised_date + 'T00:00:00Z') : null);
  if (pdMs) pd.setValueInMsSinceEpoch(Number(pdMs));
  s3.addWidget(pd)
    .addWidget(CardService.newTextInput().setFieldName('promised_amount').setTitle('Promised amount (AUD)')
      .setValue(overrides.promised_amount != null ? overrides.promised_amount : (r.promised_amount ? String(r.promised_amount) : '')))
    .addWidget(CardService.newTextInput().setFieldName('dispute_reason').setTitle('Dispute reason').setMultiline(true)
      .setValue(overrides.dispute_reason != null ? overrides.dispute_reason : (r.dispute_reason || '')))
    .addWidget(CardService.newTextInput().setFieldName('suggested_action').setTitle('Suggested next step').setMultiline(true)
      .setValue(overrides.suggested_action != null ? overrides.suggested_action : (r.suggested_action || '')));
  card.addSection(s3);

  card.setFixedFooter(CardService.newFixedFooter()
    .setPrimaryButton(button_('Save to DebtJet', 'onSave', { messageId: mid }, true))
    .setSecondaryButton(button_('Back', 'onBackToMessage', { messageId: mid })));
  return card.build();
}

function savedCard_(text) {
  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('<b>Saved ✓</b><br>' + esc_(text)))
    .addWidget(CardService.newTextButton().setText('Open DebtJet').setOpenLink(CardService.newOpenLink().setUrl(CONFIG.APP_URL))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('DebtJet')).addSection(sec).build();
}

// ---------- actions ----------
function onConnect(e) {
  return handle_(e, function () {
    var code = form1_(e, 'code');
    if (!code) return notify_('Type the connection code first.');
    var s = exchangeCode_(code);
    var note = 'Connected as ' + (s.user && s.user.email) + '.';
    if (e.gmail && e.gmail.messageId) return update_(messageCard_(e), note);
    return update_(onHomepage(e), note);
  });
}

function onDisconnect(e) {
  clearSession_();
  return update_(connectCard_(''), 'Disconnected from DebtJet.');
}

function onBackToMessage(e) {
  return handle_(e, function () { return update_(messageCard_(e)); });
}

function prepareState_(e, useAi) {
  var email = readMessage_(e);
  var s = getSession_();
  if (!s.org) { s.org = loadOrg_(); saveSession_(s); }
  var data = loadDebtJetData_(s.org.id);
  var candidates = matchDebtors_(email, data);
  var state = {
    email: { message_id: email.message_id, subject: email.subject, from_email: email.from_email, date_iso: email.date_iso },
    candidates: candidates, selectedDebtorId: candidates[0] && candidates[0].score >= 50 ? candidates[0].id : '',
    org_id: s.org.id, result: {}, usedAi: false, notice: ''
  };
  if (useAi) {
    var top = candidates[0] || null;
    var hints = top ? { debtor_name: top.name, invoices: top.invoices.map(function (i) { return { invoice_number: i.invoice_number, amount: i.amount, due_date: i.due_date }; }) } : null;
    try {
      state.result = callSummarise_({ subject: email.subject, from_name: email.from_name, from_email: email.from_email, date: email.date, body: email.body }, hints);
      state.usedAi = true;
      state.notice = 'AI suggestion — check every field before saving.';
    } catch (err) {
      if (err.isAuth) throw err;
      state.notice = 'Gemini couldn\'t summarise this email (' + err.message + '). Fill in the note yourself.';
    }
  }
  saveState_(email.message_id, state);
  return state;
}

function onSummarise(e) {
  return handle_(e, function () {
    var state = prepareState_(e, true);
    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(reviewCard_(state))).build();
  });
}

function onManual(e) {
  return handle_(e, function () {
    var state = prepareState_(e, false);
    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(reviewCard_(state))).build();
  });
}

/** Keeps what the user has typed when the card is rebuilt. */
function currentEdits_(e) {
  return {
    category: form1_(e, 'category') || null,
    summary: form1_(e, 'summary'),
    key_points: form1_(e, 'key_points'),
    promised_date: form_(e, 'promised_date'),
    promised_amount: form1_(e, 'promised_amount'),
    dispute_reason: form1_(e, 'dispute_reason'),
    suggested_action: form1_(e, 'suggested_action')
  };
}

function onDebtorChange(e) {
  return handle_(e, function () {
    var mid = messageIdOf_(e);
    var state = loadState_(mid);
    if (!state) return update_(messageCard_(e), 'That review timed out — please start again.');
    state.selectedDebtorId = form1_(e, 'debtor');
    saveState_(mid, state);
    var o = currentEdits_(e); o.debtor = state.selectedDebtorId;
    return update_(reviewCard_(state, o));
  });
}

function onDebtorSearch(e) {
  return handle_(e, function () {
    var mid = messageIdOf_(e);
    var state = loadState_(mid);
    if (!state) return update_(messageCard_(e), 'That review timed out — please start again.');
    var term = String(form1_(e, 'debtor_search') || '').trim().toLowerCase();
    if (!term) return notify_('Type part of a name, email or ABN to search.');
    var data = loadDebtJetData_(state.org_id);
    var found = data.debtors.filter(function (d) {
      return String(d.name || '').toLowerCase().indexOf(term) >= 0 || String(d.email || '').toLowerCase().indexOf(term) >= 0 ||
             String(d.abn || '').replace(/\s/g, '').indexOf(term.replace(/\s/g, '')) >= 0;
    }).slice(0, 10);
    if (!found.length) return notify_('No debtors match "' + term + '".');
    found.forEach(function (d) {
      if (!state.candidates.some(function (c) { return c.id === d.id; })) state.candidates.push(buildCandidate_(d.id, 0, ['Found by search'], null, data));
    });
    state.selectedDebtorId = found[0].id;
    saveState_(mid, state);
    var o = currentEdits_(e); o.debtor = state.selectedDebtorId;
    return update_(reviewCard_(state, o), found.length + ' debtor(s) found.');
  });
}

function onSave(e) {
  return handle_(e, function () {
    var mid = messageIdOf_(e);
    var state = loadState_(mid);
    if (!state) return update_(messageCard_(e), 'That review timed out — please start again.');
    var debtorId = form1_(e, 'debtor');
    var cand = state.candidates.filter(function (c) { return c.id === debtorId; })[0];
    if (!cand) return notify_('Choose which debtor this email is about.');
    var summary = String(form1_(e, 'summary') || '').trim();
    if (!summary) return notify_('Add a short summary first.');
    var invoiceIds = form_(e, 'invoices') || [];
    var disputedIds = form_(e, 'disputed') || [];
    var disputeReason = String(form1_(e, 'dispute_reason') || '').trim();
    if (disputedIds.length && !disputeReason) return notify_('Add the dispute reason for the disputed invoices.');
    disputedIds.forEach(function (id) { if (invoiceIds.indexOf(id) < 0) invoiceIds.push(id); });

    var category = form1_(e, 'category') || 'other';
    var amt = parseFloat(form1_(e, 'promised_amount'));
    var pdMs = form_(e, 'promised_date');
    var keyPoints = String(form1_(e, 'key_points') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12).map(function (s) { return s.slice(0, 300); });
    var base = {
      org_id: state.org_id, debtor_id: cand.id, summary: summary.slice(0, 2000), key_points: keyPoints,
      promised_date: pdMs ? new Date(Number(pdMs)).toISOString().slice(0, 10) : null,
      promised_amount: isNaN(amt) || amt <= 0 ? null : Math.round(amt * 100) / 100,
      dispute_reason: disputeReason.slice(0, 1000) || null,
      suggested_action: String(form1_(e, 'suggested_action') || '').trim().slice(0, 1000) || null,
      email_subject: (state.email.subject || '').slice(0, 500) || null,
      email_from: (state.email.from_email || '').slice(0, 320) || null,
      email_message_id: state.email.message_id, email_date: state.email.date_iso, occurred_at: state.email.date_iso,
      source: 'gmail', ai_model: state.usedAi ? (state.result.model || 'Gemini (Vertex AI)') : null
    };
    var rows = (invoiceIds.length ? invoiceIds : [null]).map(function (invId) {
      var inv = invId ? cand.invoices.filter(function (i) { return i.id === invId; })[0] : null;
      var row = JSON.parse(JSON.stringify(base));
      row.category = invId && disputedIds.indexOf(invId) >= 0 ? 'dispute' : category;
      row.invoice_id = invId; row.case_id = (inv && inv.case_id) || cand.case_id || null;
      return row;
    });

    var res = api_('case_notes', { method: 'post', headers: { Prefer: 'return=minimal' }, body: rows });
    if (res.status === 409) return notify_('This email is already saved in DebtJet for these invoices.');
    if (res.status >= 300) throw new Error((res.json && res.json.message) || ('Save failed (' + res.status + ')'));

    var caseIds = rows.map(function (r) { return r.case_id; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    if (caseIds.length) {
      api_('case_events', { method: 'post', headers: { Prefer: 'return=minimal' }, body: caseIds.map(function (cid) {
        return { org_id: state.org_id, case_id: cid, event_type: 'note_added', title: 'Email note: ' + (CATEGORY_LABEL[category] || 'Note'), body: summary.slice(0, 500) };
      }) });
    }
    CacheService.getUserCache().remove(stateKey_(mid));
    var text = (CATEGORY_LABEL[category] || 'Note') + ' note saved to ' + (cand.name || 'the debtor') +
      (invoiceIds.length ? ' for ' + invoiceIds.length + ' invoice' + (invoiceIds.length === 1 ? '' : 's') : '') + '.';
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(savedCard_(text)))
      .setNotification(CardService.newNotification().setText('Saved to DebtJet')).build();
  });
}
