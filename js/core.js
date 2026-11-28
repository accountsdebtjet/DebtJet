/* DebtJet: core.js
 * Settings, app state, screens, sign-in, start-up and data loading.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  var SUPABASE_URL = 'https://tuvfdqnuqglldpesweye.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1dmZkcW51cWdsbGRwZXN3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMTE2OTAsImV4cCI6MjEwOTg4NzY5MH0.3MU_ai1ig_DFLB-CdQD4q6RfAVyLy-Y-N7sYdgnuaio';
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var session = null, currentOrg = null, cases = [], letterTemplates = [];
  var stmtInvoices = [], stmtDebtors = [], stmtSelectedDebtors = {}, stmtInvoiceOverride = {}, savedStatements = [], integrationRows = [], xeroConnected = false, stmtShowAll = false, stmtShowMode = 'none', stmtGroups = [], stmtGroupsOf = {}, stmtNotesByInvoice = {}, stmtFilter = 'open', stmtSearch = '';
  var orgPayment = null, orgCharges = null, paymentChanges = [], stmtTemplates = [], stmtTplKey = null, stmtTplSettings = null, stmtTplDirty = false, stmtLineNotes = {}, stmtPayLinks = {}, stmtPayLinksAsked = {}, lastLineNoteKey = '';
  var STATUS_LABEL = {new:'New',letter_sent:'Letter sent',awaiting_response:'Awaiting response',payment_plan:'Payment plan',escalated:'Escalated',debt_recovery:'Debt recovery',tribunal:'Tribunal',resolved:'Resolved'};
  var NOTE_CATEGORY_LABEL = {promise_to_pay:'Promise to pay',dispute:'Dispute raised',payment_plan_request:'Payment plan request',payment_made:'Says payment made',hardship:'Hardship',reminder_ack:'Acknowledged reminder',contact_change:'Contact details changed',other:'Note'};
  var NOTE_TONE = {dispute:'crit',hardship:'warn',payment_made:'warn',promise_to_pay:'ok',payment_plan_request:'ok'};
  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var PIPELINE_STAGES = [{key:'statement',label:'Account Statement'},{key:'letter',label:'Letter of Demand'},{key:'debt_recovery',label:'Debt Recovery'},{key:'tribunal',label:'Tribunal'},{key:'resolved',label:'Resolved'}];
  var TRIBUNAL_OPTIONS = ['VCAT (Victoria)','QCAT (Queensland)','NCAT (New South Wales)','SAT (Western Australia)','SACAT (South Australia)','TASCAT (Tasmania)','ACAT (ACT)','NTCAT (Northern Territory)','Magistrates/Local Court','Other'];
  var currentCaseFilter = 'all';
  function pipelineIndex(status){
    if(status==='new') return 0;
    if(status==='letter_sent'||status==='awaiting_response'||status==='payment_plan') return 1;
    if(status==='debt_recovery'||status==='escalated') return 2;
    if(status==='tribunal') return 3;
    if(status==='resolved') return 4;
    return 0;
  }

  function money(n){ n = Number(n)||0; return '$'+n.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fmt(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}); }
  function fmtDateTime(d){ if(!d) return '—'; return new Date(d).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }
  function pill(status){ return '<span class="pill '+status+'">'+(STATUS_LABEL[status]||status)+'</span>'; }

  var toastEl = document.getElementById('toast'), toastTimer;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function(){toastEl.classList.remove('show');},3200); }

  /* ---------- screen switching ---------- */
  function showTopLevel(which){
    document.getElementById('authScreen').hidden = which !== 'auth';
    document.getElementById('onboardingScreen').hidden = which !== 'onboarding';
    document.getElementById('mainApp').hidden = which !== 'app';
  }

  /* ---------- auth ---------- */
  var authMode = 'signin';
  function updateAuthModeUI(){
    document.getElementById('authTitle').textContent = authMode === 'signin' ? 'Sign in to DebtJet' : 'Create your account';
    document.getElementById('authSubmitBtn').textContent = authMode === 'signin' ? 'Sign in' : 'Sign up';
    document.getElementById('authToggleBtn').textContent = authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in';
  }
  document.getElementById('authToggleBtn').addEventListener('click', function(){
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    updateAuthModeUI();
  });
  function setAuthMessage(msg, isError){
    var el = document.getElementById('authMessage');
    if(!msg){ el.hidden = true; return; }
    el.hidden = false; el.textContent = msg; el.className = 'auth-message' + (isError ? ' error' : '');
  }
  document.getElementById('authForm').addEventListener('submit', async function(e){
    e.preventDefault();
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;
    setAuthMessage(null);
    var btn = document.getElementById('authSubmitBtn'); btn.disabled = true;
    try{
      if(authMode === 'signup'){
        var r = await sb.auth.signUp({ email: email, password: password });
        if(r.error){ setAuthMessage(r.error.message, true); return; }
        if(!r.data.session){
          setAuthMessage('Account created. If email confirmation is required, check your inbox, then sign in.', false);
          authMode = 'signin'; updateAuthModeUI();
          return;
        }
        session = r.data.session;
      } else {
        var r2 = await sb.auth.signInWithPassword({ email: email, password: password });
        if(r2.error){ setAuthMessage(r2.error.message, true); return; }
        session = r2.data.session;
      }
      await boot();
    } finally { btn.disabled = false; }
  });

  document.getElementById('createOrgForm').addEventListener('submit', async function(e){
    e.preventDefault();
    var name = document.getElementById('orgNameInput').value.trim();
    if(!name) return;
    var r = await sb.rpc('create_organization', { org_name: name, org_abn: null });
    if(r.error){ toast('Could not create organization: ' + r.error.message); return; }
    await boot();
  });

  var XERO_CLIENT_ID = '8531C25BD29F406E840BA5BDD3524D27';
  var XERO_REDIRECT_URI = 'https://tuvfdqnuqglldpesweye.supabase.co/functions/v1/xero-oauth-callback';
  async function signOut(){ await sb.auth.signOut(); session = null; currentOrg = null; toast('Signed out.'); showTopLevel('auth'); }
  document.getElementById('onboardingSignOutBtn').addEventListener('click', signOut);
  document.getElementById('signOutBtn').addEventListener('click', signOut);

  /* ---------- boot / org resolution ---------- */
  async function boot(){
    var r = await sb.from('org_members').select('org_id, role, organizations(name)').eq('user_id', session.user.id).limit(1).maybeSingle();
    if(r.error || !r.data){
      document.getElementById('onboardingEmail').textContent = session.user.email;
      showTopLevel('onboarding');
      return;
    }
    currentOrg = { id: r.data.org_id, role: r.data.role, name: r.data.organizations ? r.data.organizations.name : 'Your organization' };
    document.getElementById('sidebarEmail').textContent = session.user.email;
    document.getElementById('sidebarOrg').textContent = currentOrg.name + ' · ' + currentOrg.role;
    document.getElementById('sidebarAvatar').textContent = (session.user.email || '?').slice(0,2).toUpperCase();
    await loadOrgDetails();
    showTopLevel('app');
    await refreshAll();
  }

  async function refreshAll(){
    await loadOrgSettings();
    await loadCases();
    await loadLetterTemplates();
    renderDashboard();
    renderCasesTable('all');
    renderLetterCaseOptions();
    renderPortalCaseOptions();
    await renderIntegrations();
    renderSourceStates();
    await loadStatementsData();
    renderStatementContacts();
    await loadSavedStatements();
    renderStatementTemplateOptions();
    renderPaymentsView();
    await loadRecoveryMatters();
    renderRecoveryCaseOptions();
    if(!document.querySelector('.view[data-view="recovery"]').hidden) selectRecoveryCase(recState.caseId);
  }
  document.getElementById('refreshBtn').addEventListener('click', function(){ refreshAll(); toast('Refreshed.'); });

  /* ---------- data loading ---------- */
  async function loadCases(){
    var r = await sb.from('cases')
      .select('id, status, interest_rate, opened_at, tribunal_body, debtors(*), invoices(id,invoice_number,description,amount,due_date,issued_date,status), payments(invoice_id,amount)')
      .eq('org_id', currentOrg.id)
      .order('opened_at', { ascending: true });
    if(r.error){ toast('Could not load cases: ' + r.error.message); cases = []; return; }
    var now = Date.now();
    cases = (r.data || []).map(function(c){
      // Payments reduce each invoice's balance; interest accrues per invoice on its own
      // outstanding balance and its own days overdue (same rules as the AI drafting function).
      var paidBy = {};
      (c.payments||[]).forEach(function(p){ if(p.invoice_id) paidBy[p.invoice_id] = (paidBy[p.invoice_id]||0) + Number(p.amount); });
      var open = (c.invoices||[]).filter(function(i){ return i.status !== 'paid' && i.status !== 'written_off'; }).map(function(i){
        var outstanding = Math.max(0, Math.round((Number(i.amount) - (paidBy[i.id]||0)) * 100) / 100);
        var days = i.due_date ? Math.max(0, daysPastDue(i.due_date)) : 0;
        // Interest only under the customer's accepted terms (Interest & Fees → Terms & rules).
        var ch = invoiceCharges({ id: i.id, case_id: c.id, debtor_id: c.debtor_id, issued_date: i.issued_date, due_date: i.due_date, balance: outstanding });
        var interest = ch.applied ? ch.interest : 0;
        return Object.assign({}, i, { paid: paidBy[i.id]||0, outstanding: outstanding, daysOverdue: days, interest: interest });
      }).filter(function(i){ return i.outstanding > 0.009; });
      var principal = Math.round(open.reduce(function(s,i){ return s + i.outstanding; }, 0) * 100) / 100;
      var daysOverdue = open.reduce(function(mx,i){ return Math.max(mx, i.daysOverdue); }, 0);
      var interest = Math.round(open.reduce(function(s,i){ return s + i.interest; }, 0) * 100) / 100;
      return {
        id: c.id, status: c.status, interestRate: rateForDebtor(c.debtor_id), tribunalBody: c.tribunal_body,
        debtor: c.debtors || {}, invoices: open,
        invoiceNumber: open[0] ? open[0].invoice_number : '—',
        dueDate: open[0] ? open[0].due_date : null,
        amount: principal, daysOverdue: daysOverdue, interest: interest, total: principal + interest
      };
    });
  }

  async function loadLetterTemplates(){
    var r = await sb.from('letter_templates').select('*').eq('org_id', currentOrg.id);
    letterTemplates = r.data || [];
  }

