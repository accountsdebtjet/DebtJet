/* DebtJet: letters-tabs.js
 * Letters of Demand tabs.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- Letters of Demand tabs ---------- */
  var ldPane = 'cases', ldCaseFilter = 'open', ldCaseSearch = '';
  function setLetterTab(t, keepPaper){
    ldPane = t; if(curView === 'letters') setTimeout(shellRefresh, 0);
    var sec = document.querySelector('.view[data-view="letters"]'); sec.setAttribute('data-ltab', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-ltab-btn]'), function(b){ var on = b.getAttribute('data-ltab-btn') === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    var panel = t === 'letter' || t === 'templates' ? 'work' : t;
    Array.prototype.forEach.call(document.querySelectorAll('[data-ltab-panel]'), function(p){ p.hidden = p.getAttribute('data-ltab-panel') !== panel; });
    if(t === 'letter'){ ldTab = 'content'; renderLetterEditor(); }
    if(t === 'templates'){ if(ldTab === 'content') ldTab = 'design'; renderLetterEditor(); }
    if(curView === 'letters') renderStyleDock();
    if(t === 'audit'){
      var h = document.getElementById('hist-letters'); if(!h.open) h.open = true;
      var c = currentLetterCase();
      document.getElementById('ldAuditHint').textContent = c ? 'History and correspondence for ' + c.debtor.name + '. Letters sent across all cases are listed below.' : 'Choose a case in the Cases tab to see its history. Letters sent across all cases are listed below.';
    }
    if(t === 'cases') renderLetterCaseList();
    if((t === 'letter' || t === 'templates') && !keepPaper){ ldViewing = null; renderLetterPreview(); }
  }
  function renderLetterCaseList(){
    var list = document.getElementById('ldCaseList'); if(!list) return;
    var cur = document.getElementById('letterCaseSelect').value, q = ldCaseSearch.trim().toLowerCase();
    var rows = cases.filter(function(c){
      if(ldCaseFilter === 'all') return true;
      if(c.status === 'resolved') return false;
      return ldCaseFilter === 'no_letter' ? !ldLastLetter[c.id] : true;
    }).filter(function(c){
      return !q || String(c.debtor.name || '').toLowerCase().indexOf(q) >= 0 || c.invoices.some(function(i){ return String(i.invoice_number || '').toLowerCase().indexOf(q) >= 0; });
    });
    list.innerHTML = rows.length ? rows.map(function(c){
      var n = c.invoices.length, last = ldLastLetter[c.id];
      return '<button type="button" class="ld-case' + (c.id === cur ? ' sel' : '') + '" data-ldcase="' + escapeHtml(c.id) + '">'
        + '<span class="ld-case-main"><b>' + escapeHtml(c.debtor.name || '—') + '</b><span class="sub">' + n + ' invoice' + (n === 1 ? '' : 's') + (c.daysOverdue > 0 ? ' · oldest ' + c.daysOverdue + ' days overdue' : '') + '</span>'
        + '<span class="sub">' + (last ? 'Last letter ' + escapeHtml(fmt(last)) : 'No letter sent yet') + '</span></span>'
        + '<span class="ld-case-side"><b>' + money(c.total) + '</b>' + pill(c.status) + '</span></button>';
    }).join('') : '<div class="empty-note">No cases match.</div>';
    renderLetterCaseCard();
  }
  function renderLetterCaseCard(){
    var c = currentLetterCase(), box = document.getElementById('ldCaseCard');
    document.getElementById('ldCaseNow').textContent = c ? (c.debtor.name || '—') + ' · ' + money(c.total) : 'No case selected';
    if(!box) return;
    if(!c){ box.innerHTML = '<p class="muted small">Choose a case on the left.</p>'; return; }
    var last = ldLastLetter[c.id], n = c.invoices.length;
    box.innerHTML = '<ul class="sel-names"><li>' + escapeHtml(c.debtor.name || '—') + '</li></ul>'
      + '<div class="sel-total"><span>Owing</span><b>' + money(c.total) + '</b></div>'
      + '<p class="muted small">' + n + ' open invoice' + (n === 1 ? '' : 's') + (c.daysOverdue > 0 ? ' · oldest ' + c.daysOverdue + ' days overdue' : '') + '<br>' + (last ? 'Last letter sent ' + escapeHtml(fmt(last)) : 'No letter sent yet') + '</p>'
      + '<div class="ai-flags">' + (letterFlags || []).map(function(f){ return '<div class="ai-flag ' + escapeHtml(f.level) + '">' + escapeHtml(f.message) + '</div>'; }).join('') + '</div>'
      + '<button class="btn primary" type="button" data-ltab-go="letter">Write letter →</button>';
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-ltab-btn]'), function(b){ b.addEventListener('click', function(){ setLetterTab(this.getAttribute('data-ltab-btn')); }); });
  document.getElementById('ldCaseFilter').addEventListener('change', function(){ ldCaseFilter = this.value; renderLetterCaseList(); });
  document.getElementById('ldCaseSearch').addEventListener('input', function(){ ldCaseSearch = this.value; renderLetterCaseList(); });
  document.addEventListener('click', function(e){
    var g = e.target.closest('[data-ltab-go]'); if(g){ setLetterTab(g.getAttribute('data-ltab-go')); window.scrollTo(0, 0); return; }
    var c = e.target.closest('[data-ldcase]'); if(c){ selectLetterCase(c.getAttribute('data-ldcase')); renderLetterCaseList(); }
  });

  initHistoryPanel('stmt'); initHistoryPanel('letters');
