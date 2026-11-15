/**
 * DebtJet login (stored per Google user in User Properties) and data access.
 * All DebtJet reads/writes use the user's own session, so row-level security applies.
 */

function getSession_() {
  var raw = PropertiesService.getUserProperties().getProperty('debtjet_session');
  return raw ? JSON.parse(raw) : null;
}
function saveSession_(s) {
  PropertiesService.getUserProperties().setProperty('debtjet_session', JSON.stringify({
    access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at,
    user: s.user, org: s.org || null
  }));
}
function clearSession_() {
  PropertiesService.getUserProperties().deleteProperty('debtjet_session');
}

function AuthError_(msg) { var e = new Error(msg); e.isAuth = true; return e; }

/** Returns a valid access token, refreshing it when it's about to expire. */
function accessToken_() {
  var s = getSession_();
  if (!s) throw AuthError_('Not connected to DebtJet.');
  if (s.expires_at && s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  var res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: CONFIG.SUPABASE_ANON_KEY },
    payload: JSON.stringify({ refresh_token: s.refresh_token })
  });
  if (res.getResponseCode() !== 200) { clearSession_(); throw AuthError_('Your DebtJet connection has expired. Please connect again.'); }
  var j = JSON.parse(res.getContentText());
  s.access_token = j.access_token; s.refresh_token = j.refresh_token; s.expires_at = j.expires_at;
  saveSession_(s);
  return s.access_token;
}

/** Swap a one-time code from DebtJet → Integrations for an add-on session. */
function exchangeCode_(code) {
  var res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/functions/v1/addon-exchange', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: CONFIG.SUPABASE_ANON_KEY },
    payload: JSON.stringify({ code: code })
  });
  var j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !j.ok) throw new Error(j.error || ('Could not connect (' + res.getResponseCode() + ').'));
  saveSession_(j);
  var org = loadOrg_();
  var s = getSession_(); s.org = org; saveSession_(s);
  return s;
}

/** Calls the DebtJet (Supabase) REST API as the signed-in user. */
function api_(path, opts) {
  opts = opts || {};
  var headers = { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + accessToken_() };
  for (var k in (opts.headers || {})) headers[k] = opts.headers[k];
  var res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/' + path, {
    method: opts.method || 'get', contentType: 'application/json', muteHttpExceptions: true,
    headers: headers, payload: opts.body ? JSON.stringify(opts.body) : undefined
  });
  var code = res.getResponseCode(), text = res.getContentText(), json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  if (code === 401) { clearSession_(); throw AuthError_('Your DebtJet connection has expired. Please connect again.'); }
  return { status: code, json: json };
}

function fetchAll_(path) {
  var out = [], size = 1000;
  for (var page = 0; page < 20; page++) {
    var r = api_(path, { headers: { Range: (page * size) + '-' + (page * size + size - 1), 'Range-Unit': 'items' } });
    if (r.status >= 300) throw new Error((r.json && r.json.message) || ('DebtJet request failed (' + r.status + ')'));
    out = out.concat(r.json || []);
    if (!r.json || r.json.length < size) break;
  }
  return out;
}

function loadOrg_() {
  var s = getSession_();
  var r = api_('org_members?select=org_id,organizations(name)&user_id=eq.' + encodeURIComponent(s.user.id) + '&limit=1');
  if (r.status >= 300 || !r.json || !r.json.length) throw new Error("This DebtJet login isn't attached to an organisation.");
  return { id: r.json[0].org_id, name: (r.json[0].organizations && r.json[0].organizations.name) || 'Your organisation' };
}

function loadDebtJetData_(orgId) {
  var q = '&org_id=eq.' + orgId;
  return {
    debtors: fetchAll_('debtors?select=id,name,email,abn,contact_name' + q + '&order=name'),
    invoices: fetchAll_('invoices?select=id,debtor_id,case_id,invoice_number,amount,due_date,status' + q + '&status=not.in.(paid,written_off)&order=due_date'),
    cases: fetchAll_('cases?select=id,debtor_id,status,opened_at' + q + '&status=neq.resolved&order=opened_at.desc')
  };
}

/** Sends the email to DebtJet's summariser on Google Cloud (Gemini on Vertex AI). */
function callSummarise_(email, hints) {
  if (!CONFIG.SUMMARISE_URL || CONFIG.SUMMARISE_URL.indexOf('http') !== 0) {
    throw new Error('The add-on is not set up yet: SUMMARISE_URL is missing in Config.gs.');
  }
  var res = UrlFetchApp.fetch(CONFIG.SUMMARISE_URL.replace(/\/$/, '') + '/summarise', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + accessToken_() },
    payload: JSON.stringify({ email: email, hints: hints })
  });
  var j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !j.ok) throw new Error(j.error || ('Summariser error (' + res.getResponseCode() + ').'));
  return j.result;
}
