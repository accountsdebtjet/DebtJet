/* DebtJet: portal-integrations.js
 * Debtor portal preview and the Integrations page.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- debtor portal preview ---------- */
  function renderPortalCaseOptions(){
    var sel = document.getElementById('portalCaseSelect');
    sel.innerHTML = cases.map(function(c){ return '<option value="'+c.id+'">'+escapeHtml(c.debtor.name)+' — '+escapeHtml(c.invoiceNumber)+'</option>'; }).join('');
    sel.onchange = function(){ loadPortalSnapshot(sel.value); };
    if(cases.length) loadPortalSnapshot(cases[0].id);
  }
  async function ensurePortalToken(caseId){
    var existing = await sb.from('debtor_portal_tokens').select('token').eq('case_id', caseId).is('revoked_at', null).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
    if(existing.data) return existing.data.token;
    var ins = await sb.from('debtor_portal_tokens').insert({ org_id: currentOrg.id, case_id: caseId }).select('token').single();
    if(ins.error){ toast('Could not create portal link: ' + ins.error.message); return null; }
    return ins.data.token;
  }
  async function loadPortalSnapshot(caseId){
    document.getElementById('portalFrameHolder').innerHTML = '<div class="empty-note" style="text-align:center;">Loading…</div>';
    var token = await ensurePortalToken(caseId);
    if(!token) return;
    var r = await sb.rpc('get_debtor_portal_snapshot', { p_token: token });
    if(r.error || !r.data || r.data.error){
      document.getElementById('portalFrameHolder').innerHTML = '<div class="empty-note" style="text-align:center;">Could not load snapshot.</div>';
      return;
    }
    var s = r.data;
    document.getElementById('portalFrameHolder').innerHTML =
      '<div class="portal-frame"><div class="portal-bar"><svg width="24" height="19" viewBox="24 6 132 108" role="img" aria-label="DebtJet"><path d="M28 60 L152 12 L74 76 Z" fill="#FFC72C"/><path d="M74 76 L82 104 L93 91 Z" fill="#0B2A5B"/><path d="M74 76 L152 12 L106 110 Z" fill="#1E6FD9"/></svg><span class="n">DebtJet</span></div>'
      +'<div class="portal-body"><h2>'+escapeHtml(s.debtor_name)+'</h2><div class="sub">'+escapeHtml(s.invoices&&s.invoices[0]?s.invoices[0].invoice_number:'')+' · '+escapeHtml(s.org_name)+'</div>'
      +'<div class="p-amount"><div class="big">'+money(s.total_owing)+'</div><div class="lbl">Total owing, including interest to today</div></div>'
      +'<div class="p-line"><span>Principal</span><span>'+money(s.principal)+'</span></div>'
      +'<div class="p-line"><span>Interest accrued ('+s.days_overdue+' days)</span><span>'+money(s.interest_accrued)+'</span></div>'
      +'<div class="p-line"><span>Case status</span><span>'+escapeHtml(STATUS_LABEL[s.case_status]||s.case_status)+'</span></div>'
      +'<div class="p-actions">'
        +'<button class="btn primary" id="portalPayBtn">Pay in full — '+money(s.total_owing)+'</button>'
        +'<button class="btn" id="portalPlanBtn">Propose a payment plan</button>'
      +'</div></div></div>';
    document.getElementById('portalPayBtn').addEventListener('click', function(){ toast('Payment processing is a preview here — the click was logged as a real case event.'); sb.rpc('log_debtor_portal_action', { p_token: token, p_action: 'portal_pay_clicked', p_note: 'Debtor clicked Pay in full in preview' }); });
    document.getElementById('portalPlanBtn').addEventListener('click', function(){ toast('Payment-plan form is a preview here — the click was logged as a real case event.'); sb.rpc('log_debtor_portal_action', { p_token: token, p_action: 'portal_plan_clicked', p_note: 'Debtor clicked Propose a payment plan in preview' }); });
  }

  /* ---------- integrations ---------- */
  var PROVIDER_META = {
    xero: { label:'Xero', color:'#13B5EA', letter:'X', logo:['assets/logos/xero-midnight.svg','assets/logos/xero-white.svg'], desc:'Syncs invoices, contacts and payment status. New overdue invoices create a case automatically.' },
    quickbooks: { label:'QuickBooks', color:'#2CA01C', letter:'Q', logo:['assets/logos/quickbooks-dark-text.webp','assets/logos/quickbooks-white-text.webp'], desc:'Syncs invoices and customer records for businesses using QuickBooks Online instead of Xero.' },
    outlook: { label:'Outlook', color:'#2E8FC4', letter:'O', desc:'Sends letters of demand and reminders, and logs replies against the matching case automatically.' },
    google_workspace: { label:'Google Workspace', color:'#D9B310', letter:'G', desc:'Alternative send channel for letters and reminders, plus calendar holds for follow-up call reminders.' }
  };
  async function renderIntegrations(){
    var r = await sb.from('integration_connections').select('*').eq('org_id', currentOrg.id);
    var rows = r.data || [];
    integrationRows = rows;
    var xr = await sb.from('xero_connections').select('tenant_name, last_synced_at').eq('org_id', currentOrg.id).maybeSingle();
    var xeroConn = xr.data || null;
    xeroConnected = !!xeroConn;
    renderSourceStates();
    var providers = ['xero','quickbooks','outlook','google_workspace'];
    document.getElementById('integrationsGrid').innerHTML = providers.map(function(p){
      var meta = PROVIDER_META[p];
      var row = rows.filter(function(x){return x.provider===p;})[0];
      var connected = p === 'xero' ? !!xeroConn : (row && row.status === 'connected');
      var metaLine;
      if(p === 'xero'){
        metaLine = connected
          ? ('Connected to ' + (xeroConn.tenant_name || 'Xero') + ' · ' + (xeroConn.last_synced_at ? ('last synced ' + fmtDateTime(xeroConn.last_synced_at)) : 'never synced yet'))
          : 'Not yet connected';
      } else {
        metaLine = connected ? 'Connected — status only, OAuth flow not built yet' : 'Not yet connected';
      }
      var syncBtn = (p === 'xero' && connected) ? '<button class="btn sm primary" data-xero-sync="1">Sync now</button>' : '';
      var actionBtn = '<button class="btn sm '+(connected?'':'primary')+'" data-provider="'+p+'" data-connected="'+connected+'">'+(connected?'Disconnect':(p==='xero'?'Connect with Xero':'Connect (demo status)'))+'</button>';
      return '<div class="int-card"><div class="int-top">'+(meta.logo
          ? '<div class="int-wordmark"><img class="lg-light" src="'+meta.logo[0]+'" alt="'+escapeHtml(meta.label)+'" /><img class="lg-dark" src="'+meta.logo[1]+'" alt="'+escapeHtml(meta.label)+'" /></div>'
          : '<div class="int-logo" style="background:'+meta.color+';">'+meta.letter+'</div>')
        +'<span class="pill '+(connected?'connected':'not_connected')+'">'+(connected?'Connected':'Not connected')+'</span></div>'
        +'<b>'+meta.label+'</b><p>'+meta.desc+'</p>'
        +'<div class="int-meta">'+escapeHtml(metaLine)+'</div>'
        +'<div class="int-actions">'+syncBtn+actionBtn+'</div></div>';
    }).join('')
      + '<div class="int-card"><div class="int-top"><div class="int-logo" style="background:#EA4335;">M</div>'
      + '<span class="pill not_connected">Add-on</span></div>'
      + '<b>Gmail add-on</b><p>Summarise debtor emails with Google\'s Gemini inside Gmail and file the key points against the right case. Emails stay with Google; only the summary you approve comes to DebtJet.</p>'
      + '<div class="int-meta" id="addonCodeMeta">Install the DebtJet add-on in Gmail, then get a one-time code here to connect it to your login.</div>'
      + '<div class="int-actions"><button class="btn sm primary" id="addonCodeBtn">Get connection code</button></div></div>';
    document.getElementById('addonCodeBtn').addEventListener('click', async function(){
      var btn = this; btn.disabled = true; btn.textContent = 'Creating…';
      try{
        var d = await invokeFn('addon-link', {});
        if(!d.ok || !d.code){ toast(d.error || 'Could not create a code.'); return; }
        document.getElementById('addonCodeMeta').innerHTML = 'Your code (valid for 10 minutes, works once): <b style="font-size:16px;letter-spacing:0.08em;color:var(--text);">'+escapeHtml(d.code)+'</b><br>Type it into the DebtJet panel in Gmail.';
      } finally { btn.disabled = false; btn.textContent = 'Get a new code'; }
    });
    var syncBtnEl = document.querySelector('[data-xero-sync]');
    if(syncBtnEl){
      syncBtnEl.addEventListener('click', async function(){
        var btn = this;
        btn.disabled = true; btn.textContent = 'Syncing…';
        try{
          var res = await sb.functions.invoke('xero-sync', { body: { org_id: currentOrg.id } });
          var errMsg = null;
          if(res.error){
            errMsg = res.error.message;
            if(res.error.context && typeof res.error.context.json === 'function'){
              try{ var body = await res.error.context.json(); if(body && body.error) errMsg = body.error; }catch(parseErr){}
            }
          } else if(res.data && res.data.error){ errMsg = res.data.error; }
          if(errMsg){ toast('Xero sync failed: ' + errMsg); }
          else {
            var d = res.data || {};
            toast('Synced ' + (d.contactsSynced||0) + ' contact(s) and ' + (d.invoicesSynced||0) + ' invoice(s) from Xero.');
            await loadCases(); await loadStatementsData();
            renderDashboard(); renderCasesTable(currentCaseFilter); renderStatementContacts();
          }
        } catch(err){ toast('Xero sync failed: ' + err.message); }
        await renderIntegrations();
      });
    }
    Array.prototype.forEach.call(document.getElementById('integrationsGrid').querySelectorAll('[data-provider]'), function(btn){
      btn.addEventListener('click', async function(){
        var p = this.getAttribute('data-provider');
        var wasConnected = this.getAttribute('data-connected') === 'true';
        if(p === 'xero' && !wasConnected){
          // Single-use, 10-minute state issued by the database for this signed-in member.
          var st = await sb.rpc('create_xero_oauth_state', { p_org_id: currentOrg.id });
          if(st.error || !st.data){ toast('Could not start Xero connection: ' + (st.error ? st.error.message : 'no state returned')); return; }
          var state = st.data;
          var authUrl = 'https://login.xero.com/identity/connect/authorize'
            + '?response_type=code'
            + '&client_id=' + encodeURIComponent(XERO_CLIENT_ID)
            + '&redirect_uri=' + encodeURIComponent(XERO_REDIRECT_URI)
            + '&scope=' + encodeURIComponent('offline_access accounting.invoices accounting.payments accounting.contacts accounting.settings.read')
            + '&state=' + encodeURIComponent(state);
          window.location.href = authUrl;
          return;
        }
        if(p === 'xero' && wasConnected){
          if(!await djAsk('Disconnect Xero?\n\nDebtJet will stop syncing and won’t be able to post interest invoices. Contacts and invoices already in DebtJet stay here. You can reconnect at any time.')) return;
          btn.disabled = true; btn.textContent = 'Disconnecting…';
          var res = await invokeFn('xero-disconnect', { org_id: currentOrg.id });
          btn.disabled = false;
          if(!res || !res.ok){ toast((res && res.error) || 'Could not disconnect Xero. Please try again.'); renderIntegrations(); return; }
          toast(res.revoked ? 'Xero disconnected.' : 'Xero disconnected here. To be sure, also remove DebtJet under Connected apps in Xero.');
          renderIntegrations(); if(typeof loadSourceStates === 'function') loadSourceStates();
          return;
        }
        var r2 = await sb.from('integration_connections').upsert({ org_id: currentOrg.id, provider: p, status: wasConnected ? 'not_connected' : 'connected', display_name: wasConnected ? null : (PROVIDER_META[p].label + ' (demo connection)'), connected_by: session.user.id }, { onConflict: 'org_id,provider' });
        if(r2.error){ toast(r2.error.message); return; }
        toast(wasConnected ? (PROVIDER_META[p].label + ' disconnected.') : (PROVIDER_META[p].label + ' marked as connected (no real OAuth yet).'));
        renderIntegrations();
      });
    });
  }

