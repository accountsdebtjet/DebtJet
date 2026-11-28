/* DebtJet: settings.js
 * Modals (connect/import, PDF preview), Settings, colour picker, long invoice descriptions.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- Modals (connect/import, PDF preview) ---------- */
  function openModal(id){ var m = document.getElementById(id); m.hidden = false; document.body.classList.add('modal-open'); var x = m.querySelector('.dj-modal-x'); if(x) x.focus(); }
  function closeModal(m){ if(!m) return; m.hidden = true; if(m.id === 'pdfModal') cleanupPdf(); if(!document.querySelector('.dj-modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open'); }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(t.classList && t.classList.contains('dj-modal-backdrop')){ closeModal(t); return; }
    var c = t.closest('[data-close-modal]'); if(c){ closeModal(c.closest('.dj-modal-backdrop')); return; }
    if(t.closest('[data-src-open]')){ renderSourceStates(); openModal('srcModal'); return; }
    var act = t.closest('[data-src-act]');
    if(act){
      closeModal(document.getElementById('srcModal'));
      var p = act.getAttribute('data-p'), label = PROVIDER_META[p].label;
      showView('integrations'); setActiveNav('integrations');
      toast(act.getAttribute('data-src-act') === 'manage' ? (p === 'xero' ? 'Use Sync now to pull the latest invoices from Xero.' : label + ' is connected.') : 'Connect ' + label + ' here.');
      return;
    }
    var g = t.closest('[data-stab-go]'); if(g){ setStmtTab(g.getAttribute('data-stab-go')); window.scrollTo(0, 0); return; }
    var pv = t.closest('[data-pdf-preview]'); if(pv) openPdfPreview(pv.getAttribute('data-pdf-preview') || 'statement');
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') Array.prototype.forEach.call(document.querySelectorAll('.dj-modal-backdrop:not([hidden])'), closeModal); });

  /* Connected sources in the top bar */
  function connectedSources(){
    var out = []; if(xeroConnected) out.push('xero');
    if(integrationRows.some(function(r){ return r.provider === 'quickbooks' && r.status === 'connected'; })) out.push('quickbooks');
    return out;
  }
  function renderSourceStates(){
    var on = connectedSources();
    document.getElementById('tbSrcLogos').innerHTML = on.map(function(p){ var meta = PROVIDER_META[p];
      return '<button type="button" class="tb-src-chip" data-src-open title="' + escapeHtml(meta.label) + ' connected"><img src="' + meta.logo[0] + '" alt="' + escapeHtml(meta.label) + '" class="tb-src-' + p + '" /><span class="tb-src-dot" aria-hidden="true"></span></button>'; }).join('');
    var add = document.getElementById('tbSrcAdd');
    add.textContent = on.length ? '+ Connect or import' : '+ Connect accounting app';
    document.getElementById('srcAppGrid').innerHTML = ['xero', 'quickbooks'].map(function(p){
      var meta = PROVIDER_META[p], conn = on.indexOf(p) >= 0;
      return '<div class="src-tile' + (conn ? ' on' : '') + '"><div class="src-tile-top"><img src="' + meta.logo[0] + '" alt="' + escapeHtml(meta.label) + '" class="src-tile-logo tb-src-' + p + '" /><span class="pill ' + (conn ? 'connected' : 'not_connected') + '">' + (conn ? 'Connected' : 'Not connected') + '</span></div>'
        + '<p>' + escapeHtml(meta.desc) + '</p>'
        + '<div class="src-tile-actions"><button class="btn sm ' + (conn ? '' : 'primary') + '" type="button" data-src-act="' + (conn ? 'manage' : 'connect') + '" data-p="' + p + '">' + (conn ? (p === 'xero' ? 'Sync or manage' : 'Manage') : 'Connect ' + escapeHtml(meta.label)) + '</button></div></div>';
    }).join('');
  }

  /* PDF preview: built in the browser with html2pdf.js (loaded on first use, pinned version + integrity hash) */
  var H2P_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  var H2P_SRI = 'sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==';
  var h2pPromise = null, pdfUrl = null;
  function loadHtml2Pdf(){
    if(window.html2pdf) return Promise.resolve(window.html2pdf);
    if(h2pPromise) return h2pPromise;
    h2pPromise = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = H2P_URL; s.integrity = H2P_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function(){ window.html2pdf ? resolve(window.html2pdf) : reject(new Error('PDF tool did not start')); };
      s.onerror = function(){ h2pPromise = null; s.remove(); reject(new Error('PDF tool could not be downloaded')); };
      document.head.appendChild(s);
    });
    return h2pPromise;
  }
  function cleanupPdf(){ if(pdfUrl){ URL.revokeObjectURL(pdfUrl); pdfUrl = null; } document.getElementById('pdfStage').innerHTML = ''; }
  function statementPdfName(kind){
    var who, what = 'Statement';
    if(kind === 'letter'){ var lc = currentLetterCase(); what = 'Letter'; who = ldViewing ? 'sent letter' : (lc ? lc.debtor.name : 'Letter'); }
    else who = stmtTab === 'templates' && !selectedStatementItems().items.length ? 'Sample' : (document.getElementById('stmtRecipientName').value || 'Account');
    return (what + ' - ' + who + ' - ' + new Date().toISOString().slice(0, 10)).replace(/[^\w .+&-]+/g, '').slice(0, 120) + '.pdf';
  }
  async function openPdfPreview(kind){
    var paper = document.getElementById(kind === 'letter' ? 'letterPaper' : 'statementPaper');
    if(!paper.querySelector(kind === 'letter' ? '.ld' : '.sd, table')){ toast(kind === 'letter' ? 'Choose a case first, so there’s a letter to preview.' : 'Select contacts and invoices first, so there’s a statement to preview.'); return; }
    if(!await confirmBankSafety('preview the PDF')) return;
    var stage = document.getElementById('pdfStage'), dl = document.getElementById('pdfDownload'), ot = document.getElementById('pdfOpenTab');
    var name = statementPdfName(kind);
    cleanupPdf(); dl.hidden = true; ot.hidden = true;
    document.getElementById('pdfModalTitle').textContent = 'PDF preview · ' + name.replace(/\.pdf$/, '');
    stage.innerHTML = '<div class="pdf-loading">Building PDF…</div>';
    openModal('pdfModal');
    var src = kind === 'letter' ? letterCleanPaper() : paper.cloneNode(true); src.removeAttribute('id'); src.classList.add('pdf-src');
    // Lay the copy out at the A4 content width (210mm less 16mm margins) so nothing runs off the page.
    var holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:733px;';
    src.style.width = '733px'; src.style.maxWidth = '733px'; src.style.boxSizing = 'border-box';
    src.querySelectorAll('.sd').forEach(function(x){ x.style.zoom = ''; x.style.width = ''; });
    holder.appendChild(src); document.body.appendChild(holder);
    if(kind !== 'letter') fitStatementTable(src);
    try {
      var h2p = await loadHtml2Pdf();
      var blob = await h2p().set({
        margin: [8, 8, 10, 8], filename: name, image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.sd-box', '.sd-pay', '.sd-slip', '.sd-summary', '.sd-det', '.ld-pay', '.ld-bank', '.ld-sign'] }
      }).from(src).outputPdf('blob');
      holder.remove();
      if(document.getElementById('pdfModal').hidden) return;
      pdfUrl = URL.createObjectURL(blob);
      stage.innerHTML = '<iframe class="pdf-frame" title="PDF preview" src="' + pdfUrl + '#view=FitH"></iframe>';
      dl.href = pdfUrl; dl.download = name; dl.hidden = false; ot.href = pdfUrl; ot.hidden = false;
    } catch(e){
      stage.innerHTML = '<div class="pdf-fallback"><div class="ai-flag caution">The PDF tool couldn’t load (' + escapeHtml(e.message) + '). This is how it looks on an A4 page. Use Print / export PDF to save it.</div><div class="a4-sheet"></div></div>';
      stage.querySelector('.a4-sheet').appendChild(src);
    }
  }

  /* ---------- Settings (business details + logo) ---------- */
  var LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/;
  function orgLogo(){ return currentOrg && currentOrg.logo && LOGO_RE.test(currentOrg.logo) ? currentOrg.logo : null; }
  function effectiveLogo(t){ return t && t.hide_logo ? null : ((t && t.logo) || orgLogo()); }
  function orgFromLines(){
    var o = currentOrg || {};
    return [o.address, o.abn ? 'ABN ' + o.abn : '', [o.phone, o.billing_email].filter(Boolean).join(' · '), o.website]
      .filter(function(x){ return x && String(x).trim(); }).join('\n');
  }
  async function loadOrgDetails(){
    var r = await sb.from('organizations').select('id, name, abn, billing_email, logo, address, phone, website, entity_kind').eq('id', currentOrg.id).maybeSingle();
    if(r.data){ var keep = { id: currentOrg.id, role: currentOrg.role }; Object.assign(currentOrg, r.data, keep); }
  }
  function canEditOrg(){ return !!currentOrg && (currentOrg.role === 'owner' || currentOrg.role === 'admin'); }
  var setLogoDraft;   // undefined = unchanged, null = removed, string = new logo
  function renderSettings(){
    var o = currentOrg || {}, ro = !canEditOrg();
    [['setName','name'],['setAbn','abn'],['setEmail','billing_email'],['setPhone','phone'],['setWebsite','website'],['setAddress','address'],['setKind','entity_kind']].forEach(function(p){
      var el = document.getElementById(p[0]); el.value = o[p[1]] || ''; el.disabled = ro;
    });
    setLogoDraft = undefined;
    renderSettingsLogo();
    document.getElementById('setLogoFile').disabled = ro;
    document.getElementById('setLogoPick').classList.toggle('disabled', ro);
    document.getElementById('setSaveBtn').disabled = ro;
    document.getElementById('setRoNote').textContent = ro ? 'Only owners and admins can change these.' : '';
    document.getElementById('setStatus').textContent = '';
  }
  function renderSettingsLogo(){
    var lg = setLogoDraft === undefined ? orgLogo() : setLogoDraft;
    document.getElementById('setLogoBox').innerHTML = lg ? '<img src="' + lg + '" alt="Your logo" />' : '<div class="empty-note">No logo yet.</div>';
    document.getElementById('setLogoRemove').hidden = !lg || !canEditOrg();
  }
  function markSettingsDirty(){ document.getElementById('setStatus').textContent = 'Unsaved changes'; }
  ['setName','setAbn','setEmail','setPhone','setWebsite','setAddress','setKind'].forEach(function(id){ document.getElementById(id).addEventListener('input', markSettingsDirty); });
  document.getElementById('setLogoFile').addEventListener('change', function(){
    var file = this.files && this.files[0]; this.value = '';
    if(!file) return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){ toast('Please choose a PNG, JPG or WebP image.'); return; }
    if(file.size > 5 * 1024 * 1024){ toast('That image is over 5 MB. Please choose a smaller logo.'); return; }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var scale = Math.min(1, 720 / img.width, 240 / img.height), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var d = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
      if(d.length > 400000) d = c.toDataURL('image/jpeg', 0.85);
      if(d.length > 400000){ toast('That logo is still too large after resizing. Try a simpler image.'); return; }
      setLogoDraft = d; renderSettingsLogo(); markSettingsDirty();
    };
    img.onerror = function(){ URL.revokeObjectURL(url); toast('That file could not be read as an image.'); };
    img.src = url;
  });
  document.getElementById('setLogoRemove').addEventListener('click', function(){ setLogoDraft = null; renderSettingsLogo(); markSettingsDirty(); });
  document.getElementById('setSaveBtn').addEventListener('click', async function(){
    if(!canEditOrg()) return;
    var v = function(id){ return document.getElementById(id).value.trim(); };
    var name = v('setName'), abn = v('setAbn').replace(/\s+/g, ''), email = v('setEmail');
    if(!name){ toast('Add your business name.'); return; }
    if(abn && !/^\d{11}$/.test(abn)){ toast('An ABN has 11 digits.'); return; }
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('That email address doesn’t look right.'); return; }
    var patch = { name: name, abn: abn || null, billing_email: email || null, phone: v('setPhone') || null, website: v('setWebsite') || null, address: v('setAddress') || null, entity_kind: v('setKind') || null };
    if(setLogoDraft !== undefined) patch.logo = setLogoDraft;
    var btn = this; btn.disabled = true;
    var r = await sb.from('organizations').update(patch).eq('id', currentOrg.id);
    btn.disabled = false;
    if(r.error){ toast('Could not save settings: ' + r.error.message); return; }
    Object.assign(currentOrg, patch); setLogoDraft = undefined;
    document.getElementById('sidebarOrg').textContent = currentOrg.name + ' · ' + currentOrg.role;
    renderSettings(); document.getElementById('setStatus').textContent = 'Saved.';
    try { renderStatementPreview(); renderLetterPreview(); } catch(e){}
    toast('Settings saved.');
  });

  /* ---------- Honeycomb colour picker ---------- */
  function hslHex(h, s, l){
    s /= 100; l /= 100;
    var k = function(n){ return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
    var f = function(n){ return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))); };
    return '#' + [f(0), f(8), f(4)].map(function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  var combRows = null;
  function honeycombRows(){
    if(combRows) return combRows;
    var R = 6; combRows = [];
    for(var r = -R; r <= R; r++){
      var row = [];
      for(var q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++){
        var d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        var x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
        var hue = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
        row.push(d === 0 ? '#ffffff' : hslHex(Math.round(hue), 88, Math.round(94 - d * 7.5)));
      }
      combRows.push(row);
    }
    return combRows;
  }
  var COMB_GREYS = ['#ffffff','#e6e6e6','#cccccc','#b3b3b3','#999999','#808080','#666666','#4d4d4d','#333333','#1a1a1a','#000000'];
  var COMB_BRAND = [['#0B2A5B','Navy'],['#1E6FD9','Jet Blue'],['#FFC72C','Signal Yellow'],['#3F5170','Slate'],['#7DB6FA','Sky Blue']];
  function colourField(attrs, value){
    var v = /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : '#000000';
    return '<span class="cpick"><button type="button" class="cpick-btn" data-cpick><span class="cpick-sw" style="background:' + v + '"></span><span class="cpick-hex">' + v.toUpperCase() + '</span></button>'
      + '<input type="text" class="cpick-val" hidden ' + attrs + ' value="' + v + '" /></span>';
  }
  var cpickInput = null;
  function hexCell(c, title){ return '<button type="button" class="comb-hex" data-comb="' + c + '" style="background:' + c + '" title="' + (title ? escapeHtml(title) + ' ' : '') + c.toUpperCase() + '" aria-label="' + (title ? escapeHtml(title) + ' ' : '') + c.toUpperCase() + '"></button>'; }
  function openColourPicker(btn){
    var wrap = btn.closest('.cpick'), input = wrap.querySelector('.cpick-val');
    if(input.disabled) return;
    cpickInput = input;
    var pop = document.getElementById('cpop');
    if(!pop){ pop = document.createElement('div'); pop.id = 'cpop'; pop.className = 'cpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a colour'); document.body.appendChild(pop); }
    var cur = input.value.toLowerCase();
    pop.innerHTML = '<div class="comb">' + honeycombRows().map(function(row){ return '<div class="comb-row">' + row.map(function(c){ return hexCell(c); }).join('') + '</div>'; }).join('') + '</div>'
      + '<div class="comb-row comb-line">' + COMB_GREYS.map(function(c){ return hexCell(c); }).join('') + '</div>'
      + '<div class="comb-label">DebtJet brand</div><div class="comb-row comb-line">' + COMB_BRAND.map(function(c){ return hexCell(c[0].toLowerCase(), c[1]); }).join('') + '</div>'
      + '<div class="comb-foot"><span class="cpick-sw big" id="cpopSw" style="background:' + cur + '"></span><label>Hex<input id="cpopHex" maxlength="7" value="' + cur.toUpperCase() + '" spellcheck="false" /></label><button type="button" class="btn sm primary" data-cpop-done>Done</button></div>';
    Array.prototype.forEach.call(pop.querySelectorAll('.comb-hex'), function(h){ h.classList.toggle('sel', h.getAttribute('data-comb') === cur); });
    pop.hidden = false;
    var r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left));
    var top = r.bottom + 6 + ph > window.innerHeight ? Math.max(8, r.top - ph - 6) : r.bottom + 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function applyPickedColour(hex){
    if(!cpickInput || !/^#[0-9a-f]{6}$/i.test(hex)) return;
    hex = hex.toLowerCase();
    var wrap = cpickInput.closest('.cpick');
    cpickInput.value = hex;
    if(wrap){ wrap.querySelector('.cpick-sw').style.background = hex; wrap.querySelector('.cpick-hex').textContent = hex.toUpperCase(); }
    var pop = document.getElementById('cpop');
    if(pop){ pop.querySelector('#cpopSw').style.background = hex; var hx = pop.querySelector('#cpopHex'); if(document.activeElement !== hx) hx.value = hex.toUpperCase();
      Array.prototype.forEach.call(pop.querySelectorAll('.comb-hex'), function(h){ h.classList.toggle('sel', h.getAttribute('data-comb') === hex); }); }
    cpickInput.dispatchEvent(new Event('input', { bubbles: true }));
    cpickInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function closeColourPicker(){ var pop = document.getElementById('cpop'); if(pop) pop.hidden = true; cpickInput = null; }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-cpick]'); if(b){ e.preventDefault(); openColourPicker(b); return; }
    var pop = document.getElementById('cpop'); if(!pop || pop.hidden) return;
    var h = e.target.closest('[data-comb]'); if(h){ applyPickedColour(h.getAttribute('data-comb')); return; }
    if(e.target.closest('[data-cpop-done]')){ closeColourPicker(); return; }
    if(!e.target.closest('#cpop')) closeColourPicker();
  });
  document.addEventListener('input', function(e){
    if(e.target.id !== 'cpopHex') return;
    var v = e.target.value.trim(); if(v && v[0] !== '#') v = '#' + v;
    if(/^#[0-9a-f]{6}$/i.test(v)) applyPickedColour(v);
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeColourPicker(); });
  window.addEventListener('resize', closeColourPicker);

  /* ---------- Long invoice descriptions ---------- */
  function todayISO(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function shortDesc(s, max){
    var raw = String(s || '').trim(); max = max || 60;
    var flat = raw.replace(/\s+/g, ' ');
    if(flat.length <= max) return flat;
    var first = raw.split(/\r?\n|(?<=[.;])\s+/)[0].replace(/\s+/g, ' ').trim();
    if(first.length >= 10 && first.length <= max) return first.replace(/[.;,:]+$/, '') + '…';
    var cut = flat.slice(0, max), sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.;,:\-–—]+$/, '') + '…';
  }
  var stmtDescOverride = {};
  function itemDesc(i, t){
    var full = String(i.description || '').trim();
    var own = (i.desc_short || '').trim();
    if(own) return { text: own, full: full, shortened: own !== full && !!full };
    if(t.desc_mode === 'full') return { text: full, full: full, shortened: false };
    var s = shortDesc(full, t.desc_max);
    return { text: s, full: full, shortened: s !== full.replace(/\s+/g, ' ') };
  }
