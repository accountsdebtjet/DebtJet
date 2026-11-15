"""Builds out/DemoEmails.gs: an Apps Script that inserts the 150 demo emails into Gmail."""
import json, os
OUT = os.path.join(os.path.dirname(__file__), "out")
emails = json.load(open(os.path.join(OUT, "demo_emails_150.json"), encoding="utf-8"))
slim = [{k: e[k] for k in ("id", "from_name", "from_email", "subject", "body", "date")} for e in emails]

GS = r"""/**
 * DebtJet demo emails loader.
 *
 * Inserts 150 fictional debtor emails into THIS Gmail inbox (nothing is sent anywhere),
 * dated and addressed as if each debtor had written in, and labels them "DebtJet Demo 2".
 *
 * Setup: Services (+) → Gmail API → Add.  Then run loadDemoEmails.
 * If it stops after ~5 minutes, just run loadDemoEmails again — it carries on where it left off.
 * To remove them all later, run removeDemoEmails.
 */
var LABEL_NAME = 'DebtJet Demo 2';

function loadDemoEmails() {
  var labelId = ensureLabel_(LABEL_NAME);
  var props = PropertiesService.getScriptProperties();
  var start = Number(props.getProperty('demo_next') || 0);
  var t0 = Date.now();
  for (var i = start; i < DEMO_EMAILS.length; i++) {
    if (Date.now() - t0 > 300000) {
      props.setProperty('demo_next', String(i));
      Logger.log('Paused at ' + i + ' of ' + DEMO_EMAILS.length + '. Run loadDemoEmails again to continue.');
      return;
    }
    var e = DEMO_EMAILS[i];
    Gmail.Users.Messages.insert(
      { raw: buildRaw_(e), labelIds: ['INBOX', 'UNREAD', labelId] }, 'me', null, { internalDateSource: 'dateHeader' });
  }
  props.deleteProperty('demo_next');
  Logger.log('Done: ' + DEMO_EMAILS.length + ' demo emails are in your inbox under the label "' + LABEL_NAME + '".');
}

function removeDemoEmails() {
  var threads, n = 0;
  do {
    threads = GmailApp.search('label:"' + LABEL_NAME + '"', 0, 100);
    if (threads.length) { GmailApp.moveThreadsToTrash(threads); n += threads.length; }
  } while (threads.length === 100);
  PropertiesService.getScriptProperties().deleteProperty('demo_next');
  Logger.log('Moved ' + n + ' demo threads to Trash.');
}

function ensureLabel_(name) {
  var labels = (Gmail.Users.Labels.list('me').labels || []);
  for (var i = 0; i < labels.length; i++) if (labels[i].name === name) return labels[i].id;
  return Gmail.Users.Labels.create({ name: name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }, 'me').id;
}

function encodeHeader_(s) {
  return /^[\x20-\x7E]*$/.test(s) ? s : '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?=';
}

function buildRaw_(e) {
  var date = Utilities.formatDate(new Date(e.date), 'Australia/Brisbane', 'EEE, d MMM yyyy HH:mm:ss Z');
  var headers = [
    'From: "' + encodeHeader_(e.from_name).replace(/"/g, '') + '" <' + e.from_email + '>',
    'To: ' + Session.getActiveUser().getEmail(),
    'Subject: ' + encodeHeader_(e.subject),
    'Date: ' + date,
    'Message-ID: <debtjet-demo-' + e.id + '-' + Utilities.getUuid() + '@debtjet.com.au>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64'
  ];
  var body = Utilities.base64Encode(e.body, Utilities.Charset.UTF_8).replace(/(.{76})/g, '$1\r\n');
  var raw = headers.join('\r\n') + '\r\n\r\n' + body;
  return Utilities.base64EncodeWebSafe(raw, Utilities.Charset.UTF_8);
}

var DEMO_EMAILS = """ + json.dumps(slim, ensure_ascii=False, indent=0) + ";\n"

open(os.path.join(OUT, "DemoEmails.gs"), "w", encoding="utf-8").write(GS)
print("DemoEmails.gs", round(len(GS) / 1024), "KB")
