/* DebtJet: main.js
 * Start-up: runs last, once every other file has loaded.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- init ---------- */
  (async function(){
    updateAuthModeUI();
    var s = await sb.auth.getSession();
    session = s.data.session;
    if(session){ await boot(); } else { showTopLevel('auth'); }
    var xeroParam = new URLSearchParams(window.location.search).get('xero');
    if(xeroParam){
      history.replaceState(null, '', window.location.pathname);
      if(currentOrg){
        showView('integrations'); setActiveNav('integrations');
        if(xeroParam === 'connected'){ toast('Xero connected!'); await renderIntegrations(); }
        else { toast('Could not connect to Xero — please try again.'); }
      }
    }
  })();
