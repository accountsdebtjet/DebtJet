/* DebtJet: shell.js
 * Shared UI: the DebtJet dialog (djAsk), the paragraph editor, floating toolbar, Insert panel and Style dock.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- DebtJet dialog: replaces the browser's confirm() ----------
     Centred, branded, and the page behind stays visible (no grey-out). */
  var AI_MARK = '<svg class="dj-mark" width="16" height="14" viewBox="0 0 26 22" aria-hidden="true"><path d="M1 12 25 1 15 21 12 13Z" fill="#1E6FD9"/><path d="M1 12 25 1 12 13Z" fill="#FFC72C"/><path d="M12 13 15 21 13.5 14.2Z" fill="#0B2A5B"/></svg>';
  function djAsk(message, opts){
    opts = opts || {};
    var first = String(message).split(/[\s?.,]/)[0];
    var okLabel = opts.ok || (/^(Delete|Remove|Disconnect|Discard|Create|Undo)$/.test(first) ? first : 'OK');
    var danger = /^(Delete|Remove|Disconnect|Discard)$/.test(okLabel);
    return new Promise(function(resolve){
      var prev = document.activeElement;
      var wrap = document.createElement('div'); wrap.className = 'dj-ask-wrap';
      var parts = String(message).split('\n\n');
      wrap.innerHTML = '<div class="dj-ask" role="alertdialog" aria-modal="true" aria-labelledby="djAskT" aria-describedby="djAskB">'
        + '<div class="dj-ask-brand">' + AI_MARK + '<span>DebtJet</span></div>'
        + '<div class="dj-ask-t" id="djAskT">' + escapeHtml(parts[0]) + '</div>'
        + (parts.length > 1 ? '<div class="dj-ask-b" id="djAskB">' + escapeHtml(parts.slice(1).join('\n\n')) + '</div>' : '<span id="djAskB" hidden></span>')
        + (opts.input != null ? '<label class="dj-ask-in">' + escapeHtml(opts.inputLabel || '') + '<input type="text" maxlength="' + (opts.maxlength || 80) + '" value="' + escapeHtml(opts.input) + '" /></label>' : '')
        + '<div class="dj-ask-acts">' + (opts.cancel === false ? '' : '<button type="button" class="btn" data-ask="no">' + escapeHtml(opts.cancel || 'Cancel') + '</button>')
        + (opts.choices ? opts.choices.map(function(c, i){ return '<button type="button" class="btn' + (i === opts.choices.length - 1 ? ' primary' : '') + '" data-ask="c' + i + '">' + escapeHtml(c.label) + '</button>'; }).join('')
           : '<button type="button" class="btn primary' + (danger ? ' danger' : '') + '" data-ask="yes">' + escapeHtml(okLabel) + '</button>') + '</div></div>';
      document.body.appendChild(wrap);
      var done = function(v){ document.removeEventListener('keydown', key, true); wrap.remove(); if(prev && prev.focus) try { prev.focus(); } catch(e){} resolve(v); };
      if(opts.input != null || opts.choices) var escVal = null;
      var key = function(e){ if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); done(opts.input != null || opts.choices ? null : false); } if(e.key === 'Tab'){ var b = wrap.querySelectorAll('button'); if(e.shiftKey && document.activeElement === b[0]){ e.preventDefault(); b[b.length - 1].focus(); } else if(!e.shiftKey && document.activeElement === b[b.length - 1]){ e.preventDefault(); b[0].focus(); } } };
      document.addEventListener('keydown', key, true);
      var inp = wrap.querySelector('.dj-ask-in input');
      var answer = function(a){ if(a === 'no') return opts.input != null || opts.choices ? null : false; if(opts.choices) return opts.choices[Number(a.slice(1))].value; if(opts.input != null) return inp.value.trim() || null; return true; };
      wrap.addEventListener('click', function(e){ var b = e.target.closest('[data-ask]'); if(b) done(answer(b.getAttribute('data-ask'))); });
      if(inp){ inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); done(answer('yes')); } }); inp.focus(); inp.select(); }
      else wrap.querySelector(opts.choices ? '[data-ask="c' + (opts.choices.length - 1) + '"]' : '[data-ask="' + (danger ? 'no' : 'yes') + '"]').focus();
    });
  }
  // Remove straight away, with an Undo button on the message.
  function toastUndo(msg, undo){
    var t = document.getElementById('toast');
    t.innerHTML = '<span>' + escapeHtml(msg) + '</span> <button type="button" class="toast-undo">Undo</button>';
    t.classList.add("show"); clearTimeout(toastTimer);
    t.querySelector(".toast-undo").onclick = function(){ clearTimeout(toastTimer); t.classList.remove('show'); undo(); };
    toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 6000);
  }

  /* =====================================================================
     SHARED PARAGRAPH EDITOR (letters, claim details, packs)
     Text is stored as light markup so it stays safe and portable:
       **bold**  *italic*  __underline__   lines starting "- " (bullets) or "1. " (numbered)
       {{field}} placeholders, filled from the case when the document is built.
     On screen it is edited in place (contenteditable) with a floating toolbar.
     ===================================================================== */
  function djInline(src, vars, mode){
    var s = escapeHtml(src || '');
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');
    return s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, function(m, k){
      var has = vars && Object.prototype.hasOwnProperty.call(vars, k) && !/^\{\{/.test(vars[k]);
      if(mode === 'edit'){
        var lab = (DJ_FIELD_LABEL[k] || k.replace(/_/g, ' '));
        return '<span class="dj-var'+(has ? '' : ' empty')+'" contenteditable="false" data-var="'+k+'" title="Field: '+escapeHtml(lab)+'">'+escapeHtml(has ? vars[k] : lab)+'</span>';
      }
      return has ? escapeHtml(vars[k]) : '<span class="ld-missing">' + m + '</span>';
    });
  }
  // Markup → HTML. mode 'html' = finished document, 'edit' = editable (one <div> per line, fields as chips).
  function djRich(text, vars, mode){
    var lines = String(text || '').replace(/\r/g, '').split('\n'), out = '', para = [], list = null;
    var closeList = function(){ if(list){ out += '</' + list + '>'; list = null; } };
    var closePara = function(){ if(para.length){ out += '<p>' + para.join('<br>') + '</p>'; para = []; } };
    lines.forEach(function(line){
      var b = /^\s*[-•]\s+(.*)$/.exec(line), n = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if(b || n){
        if(mode !== 'edit') closePara();
        var want = b ? 'ul' : 'ol';
        if(list !== want){ closeList(); out += '<' + want + '>'; list = want; }
        out += '<li>' + djInline((b || n)[1], vars, mode) + '</li>'; return;
      }
      closeList();
      if(mode === 'edit'){ out += '<div>' + (line.trim() ? djInline(line, vars, mode) : '<br>') + '</div>'; return; }
      if(!line.trim()){ closePara(); return; }
      para.push(djInline(line, vars, mode));
    });
    closeList(); if(mode !== 'edit') closePara();
    return out || (mode === 'edit' ? '<div><br></div>' : '');
  }
  // Markup → plain text (copying into court portals, emails): formatting removed, lists kept.
  function djPlain(text, vars){
    var s = String(text || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, '$1$2');
    return vars ? s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, function(m, k){ return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m; }) : s;
  }
  function djWrapMk(s, m){ if(!s.trim()) return s; var a = s.match(/^\s*/)[0], z = s.match(/\s*$/)[0]; return a + m + s.trim() + m + z; }
  function djInl(n){
    if(n.nodeType === 3) return n.nodeValue.replace(/ /g, ' ').replace(/\n/g, ' ');
    if(n.nodeType !== 1) return '';
    if(n.classList.contains('dj-var')) return '{{' + n.getAttribute('data-var') + '}}';
    if(n.tagName === 'BR') return '\n';
    var s = Array.prototype.map.call(n.childNodes, djInl).join(''), t = n.tagName, st = n.style || {};
    if(t === 'B' || t === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) s = djWrapMk(s, '**');
    if(t === 'I' || t === 'EM' || st.fontStyle === 'italic') s = djWrapMk(s, '*');
    if(t === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) s = djWrapMk(s, '__');
    return s;
  }
  // Editable DOM → markup.
  function djSerialize(root){
    var L = [''];
    var put = function(s){ var p = s.split('\n'); L[L.length - 1] += p[0]; for(var i = 1; i < p.length; i++) L.push(p[i]); };
    var brk = function(){ if(L[L.length - 1] !== '') L.push(''); };
    (function walk(n){
      Array.prototype.forEach.call(n.childNodes, function(c){
        if(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')){
          brk(); Array.prototype.forEach.call(c.children, function(li, i){ brk(); put((c.tagName === 'UL' ? '- ' : (i + 1) + '. ') + djInl(li).replace(/\n+/g, ' ').trim()); }); brk(); return;
        }
        if(c.nodeType === 1 && /^(DIV|P|H[1-6]|BLOCKQUOTE|LI)$/.test(c.tagName)){
          brk();
          if(!c.textContent.trim() && !c.querySelector('.dj-var')){ L.push(''); return; }
          walk(c); brk(); return;
        }
        put(djInl(c));
      });
    })(root);
    return L.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  var DJ_FIELD_LABEL = {};
  // ---- Floating toolbar: one for the whole app, shown above the text you're editing.
  var djBar = null, djActive = null;
  function djEnsureBar(){
    if(djBar) return djBar;
    djBar = document.createElement('div'); djBar.className = 'dj-bar'; djBar.hidden = true; djBar.setAttribute('role', 'toolbar'); djBar.setAttribute('aria-label', 'Formatting');
    djBar.innerHTML = '<button type="button" data-djc="bold" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-djc="italic" title="Italic (Ctrl+I)"><i>I</i></button><button type="button" data-djc="underline" title="Underline (Ctrl+U)"><u>U</u></button>'
      + '<span class="dj-sep"></span><button type="button" data-djc="insertUnorderedList" title="Bullet list">• List</button><button type="button" data-djc="insertOrderedList" title="Numbered list">1. List</button>'
      + '<span class="dj-sep dj-only-heading"></span><button type="button" data-djc="heading" class="dj-only-heading" title="Turn this into a heading, or back into a paragraph">H</button>'
      + '<span class="dj-sep dj-only-fields"></span><span class="dj-fieldwrap dj-only-fields"><button type="button" data-djc="fields" title="Insert a field that fills in from the case">{ } Field ▾</button><div class="dj-fieldmenu" hidden></div></span>'
      + '<span class="dj-sep"></span><button type="button" data-djc="removeFormat" title="Clear formatting">⌫</button>';
    document.body.appendChild(djBar);
    djBar.addEventListener('mousedown', function(e){ if(!e.target.closest('input')) e.preventDefault(); });
    djBar.addEventListener('click', function(e){
      var b = e.target.closest('[data-djc],[data-djf]'); if(!b || !djActive) return;
      if(b.hasAttribute('data-djf')){ djInsertField(djActive, b.getAttribute('data-djf')); djBar.querySelector('.dj-fieldmenu').hidden = true; return; }
      var c = b.getAttribute('data-djc');
      if(c === 'fields'){ var fm = djBar.querySelector('.dj-fieldmenu'); fm.hidden = !fm.hidden; fm.classList.toggle('up', djBar.getBoundingClientRect().bottom + 300 > window.innerHeight); return; }
      if(c === 'heading'){ if(djActive._dj && djActive._dj.onHeading) djActive._dj.onHeading(); return; }
      document.execCommand(c, false, null);
      djFire(djActive);
    });
    return djBar;
  }
  function djFire(el){ if(el && el._dj && el._dj.onChange) el._dj.onChange(djSerialize(el), el); }
  function djInsertField(el, key){
    var sel = window.getSelection();
    if(!sel.rangeCount || !el.contains(sel.anchorNode)){ el.focus(); var r0 = document.createRange(); r0.selectNodeContents(el); r0.collapse(false); sel.removeAllRanges(); sel.addRange(r0); }
    var r = sel.getRangeAt(0); r.deleteContents();
    var tmp = document.createElement('div'); tmp.innerHTML = djInline('{{' + key + '}}', (el._dj && el._dj.vars) || {}, 'edit');
    var chip = tmp.firstChild, sp = document.createTextNode(' ');
    r.insertNode(sp); r.insertNode(chip);
    r.setStartAfter(sp); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    djFire(el);
  }
  // Attach editing behaviour to an element. opts: { vars, fields:[[key,label]], heading:bool, singleLine:bool, onChange(markup, el), onHeading(), onFocus(el) }
  function djAttach(el, opts){
    el._dj = opts || {};
    el.setAttribute('contenteditable', 'true'); el.setAttribute('data-dj-edit', '');
    el.setAttribute('spellcheck', 'true');
    if(opts.singleLine) el.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); } });
  }
  function djPositionBar(){
    if(!djActive || !document.body.contains(djActive)){ if(djBar) djBar.hidden = true; djActive = null; return; }
    var bar = djEnsureBar(), o = djActive._dj || {};
    bar.querySelectorAll('.dj-only-heading').forEach(function(x){ x.hidden = !o.heading; });
    bar.querySelectorAll('.dj-only-fields').forEach(function(x){ x.hidden = !(o.fields && o.fields.length); });
    bar.querySelector('.dj-fieldmenu').innerHTML = (o.fields || []).map(function(f){ return '<button type="button" data-djf="'+f[0]+'">'+escapeHtml(f[1])+'</button>'; }).join('');
    bar.hidden = false;
    var sel = window.getSelection(), rect = null;
    if(sel.rangeCount && djActive.contains(sel.anchorNode)){ var rr = sel.getRangeAt(0).getClientRects(); rect = rr.length ? rr[0] : null; }
    var box = djActive.getBoundingClientRect();
    if(!rect || (!rect.width && !rect.height)) rect = box;
    var top = Math.max(8, rect.top - bar.offsetHeight - 8), left = Math.min(window.innerWidth - bar.offsetWidth - 8, Math.max(8, rect.left));
    if(top < box.top - bar.offsetHeight - 60) top = box.top - bar.offsetHeight - 8;
    bar.style.top = top + 'px'; bar.style.left = left + 'px';
  }
  document.addEventListener('focusin', function(e){
    var ed = e.target.closest && e.target.closest('[data-dj-edit]');
    if(ed){ djActive = ed; if(ed._dj && ed._dj.onFocus) ed._dj.onFocus(ed); djPositionBar(); }
  });
  document.addEventListener('focusout', function(e){
    setTimeout(function(){ var a = document.activeElement; if(djBar && (djBar.contains(a) || (a && a.closest && a.closest('[data-dj-edit]')))) return; if(djBar){ djBar.hidden = true; djBar.querySelector('.dj-fieldmenu').hidden = true; } var was = djActive; djActive = null; if(was && was._dj && was._dj.onBlur) was._dj.onBlur(was); }, 120);
  });
  document.addEventListener('selectionchange', function(){ if(djActive) djPositionBar(); });
  window.addEventListener('scroll', function(){ if(djActive) djPositionBar(); }, true);
  document.addEventListener('input', function(e){ var ed = e.target.closest && e.target.closest('[data-dj-edit]'); if(ed) djFire(ed); });
  // Paste as plain text, so outside formatting and scripts never come in.
  document.addEventListener('paste', function(e){
    var ed = e.target.closest && e.target.closest('[data-dj-edit]'); if(!ed) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    if(ed._dj && ed._dj.singleLine) t = t.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, t);
  });

  // ---- Assist sidebar: one box that searches the clause library and drafts with AI.
  var userClauses = { letter: null, claim: null };
  async function loadUserClauses(scope){
    if(userClauses[scope]) return userClauses[scope];
    var r = await sb.from('clause_library').select('id, scope, category, label, body').eq('org_id', currentOrg.id).eq('scope', scope).order('label');
    userClauses[scope] = r.error ? [] : (r.data || []);
    if(r.error) userClauses[scope].unavailable = true;
    return userClauses[scope];
  }
  async function saveUserClause(scope, text, suggested){
    var label = window.prompt('Name this clause, so you can find it again:', suggested || '');
    if(!label) return;
    var r = await sb.from('clause_library').insert({ org_id: currentOrg.id, scope: scope, label: label.slice(0, 80), body: String(text).slice(0, 4000) }).select('id, scope, category, label, body').maybeSingle();
    if(r.error){ toast('Could not save the clause: ' + r.error.message); return; }
    (userClauses[scope] = userClauses[scope] || []).push(r.data); toast('Saved to Your clauses.');
  }
  function djScore(c, words){
    if(!words.length) return 1;
    var hay = (c.label + ' ' + c.text + ' ' + c.cat).toLowerCase(), s = 0;
    words.forEach(function(w){ if(hay.indexOf(w) >= 0) s += (c.label.toLowerCase().indexOf(w) >= 0 ? 3 : 1); });
    return s;
  }
  // A = { scope, builtins:[{cat,key,label,text,intent}], aiPurpose, canAi(), aiPayload(), insert(text,{clause,label}), preview(text), note }
  function renderAssist(box, A){
    A.st = A.st || { q: '', cat: '', draft: null, busy: false, err: '' };
    var S = A.st, mine = userClauses[A.scope] || [];
    var all = mine.map(function(u){ return { cat: 'Your clauses', key: 'u:' + u.id, label: u.label, text: u.body, mine: u.id }; }).concat(A.builtins);
    var words = S.q.toLowerCase().split(/[^a-z0-9']+/).filter(function(w){ return w.length > 2; });
    var list = all.map(function(c){ return { c: c, s: djScore(c, words) }; }).filter(function(x){ return x.s > 0 && (!S.cat || x.c.cat === S.cat); });
    if(words.length) list.sort(function(a, b){ return b.s - a.s; });
    var cats = []; all.forEach(function(c){ if(cats.indexOf(c.cat) < 0) cats.push(c.cat); });
    var draft = S.draft;
    box.innerHTML = '<div class="as-ask"><label class="as-label" for="asQ-'+A.scope+'">What do you want to say?</label>'
      + '<textarea id="asQ-'+A.scope+'" class="as-q" rows="2" maxlength="600" placeholder="'+escapeHtml(A.placeholder || 'e.g. offer a payment plan over 3 months')+'">'+escapeHtml(S.q)+'</textarea>'
      + '<div class="as-ask-row"><span class="muted small">'+(words.length ? list.length + ' matching clause' + (list.length === 1 ? '' : 's') : 'Type to search the clause library')+'</span>'
      + (A.noAi ? '' : '<button type="button" class="btn sm as-ai ai-btn" data-as="ai"'+(S.busy || !S.q.trim() ? ' disabled' : '')+'>'+(S.busy ? 'Drafting…' : AI_MARK + 'Draft with DebtJet AI')+'</button>') + '</div>'
      + (A.noAi ? '<div class="fine">'+escapeHtml(A.noAi)+'</div>' : '')
      + (A.canAi && !A.canAi() ? '<div class="fine">Choose a case to draft with AI.</div>' : '')
      + '</div>'
      + (S.err ? '<div class="ai-flag caution">'+escapeHtml(S.err)+'</div>' : '')
      + (draft ? '<div class="as-draft"><div class="as-draft-h"><span class="as-badge">'+AI_MARK+'DebtJet AI draft</span><span class="muted small">Check it, then insert it. Nothing is added until you do.</span></div>'
          + '<div class="as-draft-body">'+(A.preview ? A.preview(draft.text) : djRich(draft.text, {}, 'html'))+'</div>'
          + (draft.note ? '<div class="fine">'+escapeHtml(draft.note)+'</div>' : '')
          + '<div class="as-acts"><button type="button" class="btn sm primary" data-as="draft-insert">Insert</button><button type="button" class="btn sm" data-as="ai">Try again</button><button type="button" class="btn sm ghost" data-as="draft-save">Save as clause</button><button type="button" class="btn sm ghost" data-as="draft-drop">Discard</button></div></div>' : '')
      + '<div class="as-cats"><button type="button" class="as-chip'+(!S.cat ? ' on' : '')+'" data-ascat="">All</button>'+cats.map(function(c){ return '<button type="button" class="as-chip'+(S.cat === c ? ' on' : '')+'" data-ascat="'+escapeHtml(c)+'">'+escapeHtml(c)+'</button>'; }).join('')+'</div>'
      + '<div class="as-list">' + (list.length ? list.slice(0, 40).map(function(x){ var c = x.c;
          return '<div class="as-clause"><button type="button" class="as-clause-main" data-asins="'+escapeHtml(c.key)+'" title="Insert after the paragraph you were on"><span class="as-clause-h">'+escapeHtml(c.label)+(c.intent ? ' <span class="ld-intent" title="States an intended action. Only use it if the decision is made.">intent</span>' : '')+'<span class="as-cat">'+escapeHtml(c.cat)+'</span></span>'
            + '<span class="as-clause-t">'+(A.preview ? A.preview(c.text) : escapeHtml(c.text))+'</span></button>'
            + (c.mine ? '<button type="button" class="as-del" data-asdel="'+c.mine+'" title="Remove from Your clauses">✕</button>' : '') + '</div>';
        }).join('') : '<div class="empty-note">No clause matches. Try other words, or draft one with AI.</div>') + '</div>'
      + (mine.unavailable ? '<div class="fine">Saved clauses aren’t available yet.</div>' : '');
    if(!box._asWired){
      box._asWired = true;
      box.addEventListener('input', function(e){ if(!e.target.classList.contains('as-q')) return; var A2 = box._A; A2.st.q = e.target.value; var pos = e.target.selectionStart; renderAssist(box, A2); var q = box.querySelector('.as-q'); q.focus(); q.selectionStart = q.selectionEnd = pos; });
      box.addEventListener('keydown', function(e){ if(e.target.classList.contains('as-q') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); var b = box.querySelector('[data-as="ai"]'); if(b && !b.disabled) b.click(); } });
      box.addEventListener('click', async function(e){
        var A2 = box._A, S2 = A2.st, t = e.target.closest('button'); if(!t) return;
        if(t.hasAttribute('data-ascat')){ S2.cat = t.getAttribute('data-ascat'); renderAssist(box, A2); return; }
        if(t.hasAttribute('data-asins')){
          var k = t.getAttribute('data-asins'), c = (userClauses[A2.scope] || []).map(function(u){ return { key: 'u:' + u.id, label: u.label, text: u.body }; }).concat(A2.builtins).filter(function(x){ return x.key === k; })[0];
          if(c){ A2.insert(c.text, { clause: k.indexOf('u:') === 0 ? null : k, label: c.label }); toast('Added “' + c.label + '”.'); }
          return;
        }
        if(t.hasAttribute('data-asdel')){
          var id = t.getAttribute('data-asdel'), gone = (userClauses[A2.scope] || []).filter(function(u){ return u.id === id; })[0], r = await sb.from('clause_library').delete().eq('id', id);
          if(r.error){ toast(r.error.message); return; }
          userClauses[A2.scope] = (userClauses[A2.scope] || []).filter(function(u){ return u.id !== id; }); renderAssist(box, A2);
          if(gone) toastUndo('“' + gone.label + '” removed from Your clauses.', async function(){ var r2 = await sb.from('clause_library').insert({ org_id: currentOrg.id, scope: gone.scope || A2.scope, category: gone.category || 'Your clauses', label: gone.label, body: gone.body }).select('id, scope, category, label, body').maybeSingle(); if(r2.data){ userClauses[A2.scope].push(r2.data); renderAssist(box, A2); } });
          return;
        }
        var act = t.getAttribute('data-as');
        if(act === 'ai'){
          if(A2.canAi && !A2.canAi()){ toast('Choose a case first.'); return; }
          S2.busy = true; S2.err = ''; renderAssist(box, A2);
          var res = await invokeFn('draft-correspondence', Object.assign({ kind: 'paragraph', purpose: A2.aiPurpose, instruction: S2.q }, A2.aiPayload ? A2.aiPayload() : {}));
          S2.busy = false;
          if(res && res.ok && res.draft && res.draft.text){ S2.draft = { text: res.draft.text, note: res.draft.note || '' }; }
          else S2.err = (res && res.error) || 'The draft didn’t come back. Please try again.';
          renderAssist(box, A2); return;
        }
        if(act === 'draft-insert' && S2.draft){ A2.insert(S2.draft.text, { label: 'AI draft', ai: true }); S2.draft = null; renderAssist(box, A2); toast('Draft inserted. Edit it on the page.'); return; }
        if(act === 'draft-save' && S2.draft){ await saveUserClause(A2.scope, S2.draft.text, S2.q.slice(0, 60)); renderAssist(box, A2); return; }
        if(act === 'draft-drop'){ S2.draft = null; renderAssist(box, A2); return; }
      });
    }
    box._A = A;
    if(!userClauses[A.scope] && currentOrg){ loadUserClauses(A.scope).then(function(){ if(box._A === A) renderAssist(box, A); }); }
  }

  // Claim details: facts-only starters for tribunal and court applications. {{fields}} fill from the case when inserted; [brackets] are gaps to complete.
  var CLAIM_CLAUSES = [
    { cat:'What happened', key:'c_supply', label:'What we supplied', text:'Between [start date] and [end date], we supplied [goods or services] to {{debtor_name}} at their request.' },
    { cat:'What happened', key:'c_agree', label:'The agreement', text:'{{debtor_name}} accepted our [quote / terms of trade] dated [date]. The terms require payment within [number] days of the invoice date.' },
    { cat:'What happened', key:'c_invoices', label:'Invoices issued', text:'We issued invoices {{invoice_list}}. The earliest fell due on {{due_date}}.' },
    { cat:'What happened', key:'c_delivered', label:'Work completed', text:'The work was completed on [date] and {{debtor_name}} did not raise any problem with it at the time.' },
    { cat:'Payment and demands', key:'c_unpaid', label:'Still unpaid', text:'As at {{today}}, {{principal}} remains unpaid.' },
    { cat:'Payment and demands', key:'c_part', label:'Part payment', text:'{{debtor_name}} paid [amount] on [date], which we applied to [invoice number]. The balance remains unpaid.' },
    { cat:'Payment and demands', key:'c_reminders', label:'Reminders sent', text:'We sent payment reminders by [email / post] on [dates].' },
    { cat:'Payment and demands', key:'c_demand', label:'Letter of demand', text:'We sent a letter of demand on {{last_letter_date}} asking for payment by [date]. We did not receive payment or a proposal to pay.' },
    { cat:'Payment and demands', key:'c_contact', label:'Other contact', text:'We also contacted {{contact_name}} by [phone / email] on [dates] about the overdue amount.' },
    { cat:'Disputes', key:'c_nodispute', label:'No dispute raised', text:'{{debtor_name}} has not disputed the goods or services supplied or the amounts invoiced.' },
    { cat:'Disputes', key:'c_dispute', label:'Their dispute and our answer', text:'{{debtor_name}} says [their reason]. We do not agree because [our reason], as shown in [document].' },
    { cat:'Amount claimed', key:'c_total', label:'Amount claimed', text:'We claim {{total_owing}}, made up of {{principal}} in unpaid invoices{{charges_phrase}}.' },
    { cat:'Amount claimed', key:'c_interest', label:'Interest under terms', text:'Our terms of trade allow interest on overdue amounts at {{interest_rate}} per year. We claim interest of {{interest}} to {{today}}.' },
    { cat:'Amount claimed', key:'c_costs', label:'Filing and service costs', text:'We also ask for the filing fee and the cost of serving the application.' }
  ];

  /* =====================================================================
     APP SHELL: one Insert panel (right) and one Style dock (bottom)
     Each section turns on what it needs. Open by default where you write;
     elsewhere, peek from the screen edge or use the top-bar buttons.
     The pin is remembered per section.
     ===================================================================== */
  var SHELL = { cases: { ins: 'notes' }, detail: { ins: 'notes' }, interest: { ins: 'terms', when: function(){ return chgTab === 'terms'; } },
    statements: { ins: 'statement', dock: true, when: function(){ return stmtTab === 'statement' || stmtTab === 'templates'; } },
    letters: { ins: 'letter', dock: true, when: function(){ return ldPane === 'letter' || ldPane === 'templates'; } },
    recovery: { ins: 'claim', when: function(){ return recTab === 'claim'; } } };
  var curView = 'dashboard', insTab = 'clauses', insTarget = null, insLastDj = null;
  var shellPins = (function(){ try { return JSON.parse(localStorage.getItem('dj.pins') || '{}') || {}; } catch(e){ return {}; } })();
  function pinOf(kind, view){ var k = kind + ':' + view; if(Object.prototype.hasOwnProperty.call(shellPins, k)) return !!shellPins[k]; return kind === 'ins' ? /^(letters|statements|recovery)$/.test(view) : /^(letters|statements)$/.test(view); }
  function setPin(kind, view, on){ shellPins[kind + ':' + view] = !!on; try { localStorage.setItem('dj.pins', JSON.stringify(shellPins)); } catch(e){} }
  var PIN_SVG = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2h4l-1 4 3 3H4l3-3z"/><path d="M8 9v5"/></svg>';
  var STMT_CLAUSES = [
    { cat:'Above the invoices', key:'s_greet', label:'Greeting with contact name', text:'Dear [name], please find your current account statement below. If you have any questions about an item, or have already made a payment, please let us know.' },
    { cat:'Above the invoices', key:'s_asat', label:'Account as at today', text:'Here is your account as at today. Thank you for your business.' },
    { cat:'Above the invoices', key:'s_overdue', label:'Some invoices overdue', text:'Some of the invoices below are now overdue. Please arrange payment at your earliest convenience.' },
    { cat:'Above the invoices', key:'s_monthly', label:'Monthly statement', text:'This is your monthly statement. It lists every invoice that is unpaid, including any not yet due.' },
    { cat:'After the totals', key:'s_paynow', label:'Pay the overdue amount', text:'Please pay the amount shown under “Pay now” by [date]. Invoices not yet due can be paid by their own due dates.' },
    { cat:'After the totals', key:'s_paid', label:'Already paid?', text:'If you have paid in the last few days, thank you. Please send the remittance so we can match it.' },
    { cat:'After the totals', key:'s_plan', label:'Payment plan offer', text:'If you can’t pay the full amount now, contact us and we can talk about a payment arrangement.' },
    { cat:'After the totals', key:'s_query', label:'Query an invoice', text:'If you think anything on this statement is wrong, tell us which invoice and why, and we will look into it.' },
    { cat:'How to pay', key:'s_ref', label:'Use the reference', text:'Please use the statement number as your payment reference so we can match your payment quickly.' },
    { cat:'How to pay', key:'s_remit', label:'Send remittance', text:'Please email your remittance advice to [email] when you pay.' },
    { cat:'How to pay', key:'s_bank', label:'Bank details warning', text:'We will never email you to say our bank details have changed. If you get a message like that, call us on a number you already know before paying.' },
    { cat:'Closing message', key:'s_thanks', label:'Thanks', text:'Thank you for your business. We appreciate prompt payment.' },
    { cat:'Closing message', key:'s_contact', label:'Questions? Call us', text:'If you have any questions about this statement, call [name] on [phone].' },
    { cat:'Notes under invoices', key:'s_dispute', label:'Disputed: on hold', text:'Under review, so no payment is requested for this invoice while we look into it.' },
    { cat:'Notes under invoices', key:'s_promise', label:'Promise noted', text:'Thanks for confirming payment by [date].' },
    { cat:'Notes under invoices', key:'s_remit', label:'Remittance please', text:'Thanks for letting us know this was paid. Please send the remittance so we can match it.' }
  ];
  var TERMS_CLAUSES = [
    { cat:'Terms of trade', key:'t_terms', label:'Payment terms', text:'Invoices are payable within [14] days of the invoice date.' },
    { cat:'Terms of trade', key:'t_interest', label:'Interest on overdue amounts', text:'Overdue amounts attract interest at [10]% per year, calculated daily from the due date until paid.' },
    { cat:'Terms of trade', key:'t_latefee', label:'Late payment fee', text:'A late payment fee of $[amount] applies to each invoice not paid within [7] days after the due date.' },
    { cat:'Terms of trade', key:'t_costs', label:'Recovery costs', text:'The customer agrees to pay reasonable costs we incur in recovering overdue amounts, including collection and legal costs.' },
    { cat:'Terms of trade', key:'t_dishonour', label:'Dishonoured payment fee', text:'A fee of $[amount] applies to any payment that is dishonoured or reversed.' },
    { cat:'Terms of trade', key:'t_suspend', label:'Suspending credit', text:'We may suspend further supply on credit while any amount is overdue.' },
    { cat:'Terms of trade', key:'t_apply', label:'How payments are applied', text:'Payments are applied first to interest and fees, then to the oldest unpaid invoice.' }
  ];
  var NOTE_CLAUSES = [
    { cat:'Call notes', key:'n_noanswer', label:'No answer', text:'Called [name] on [phone]. No answer; left a voicemail asking them to call back about the overdue invoices.' },
    { cat:'Call notes', key:'n_promise', label:'Promise to pay', text:'Spoke to [name]. They will pay $[amount] by [date] for [invoice].' },
    { cat:'Call notes', key:'n_paid', label:'Says paid', text:'[name] says they paid [invoice] on [date]. Asked for the remittance.' },
    { cat:'Call notes', key:'n_dispute', label:'Dispute raised', text:'[name] disputes [invoice] because [reason]. Told them we will review it and hold off asking for payment of it.' },
    { cat:'Call notes', key:'n_plan', label:'Asked for a plan', text:'[name] asked to pay by instalments: $[amount] every [week / fortnight] from [date].' },
    { cat:'Call notes', key:'n_contact', label:'New contact details', text:'Accounts contact is now [name], [email], [phone].' }
  ];
  function insertIntoTarget(text, fallbackEl){
    var el = insTarget && document.body.contains(insTarget) && insTarget.offsetParent ? insTarget : (fallbackEl && fallbackEl.offsetParent ? fallbackEl : null);
    if(!el){
      var t0 = djPlain(text);
      try { navigator.clipboard.writeText(t0).then(function(){ toast('Copied. Paste it where you need it, or click a box first to insert straight into it.'); }, function(){ toast('Click a box first, then choose the wording.'); }); } catch(e){ toast('Click a box first, then choose the wording.'); }
      return;
    }
    if(el.hasAttribute('data-dj-edit')){ var cur = djSerialize(el); el.innerHTML = djRich((cur ? cur + '\n\n' : '') + text, (el._dj && el._dj.vars) || {}, 'edit'); djFire(el); return; }
    var t = djPlain(text), v = el.value || '', a = el.selectionStart != null ? el.selectionStart : v.length, b = el.selectionEnd != null ? el.selectionEnd : a;
    var pre = v.slice(0, a), sep = pre && !/\s$/.test(pre) ? (el.tagName === 'TEXTAREA' ? '\n' : ' ') : '';
    el.value = pre + sep + t + v.slice(b); el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus(); el.selectionStart = el.selectionEnd = (pre + sep + t).length;
    toast('Added to ' + insTargetLabel(el) + '.');
  }
  var STMT_ASSIST = { scope: 'statement', builtins: STMT_CLAUSES, beforeInsert: function(){ var el = insTarget && document.body.contains(insTarget) && insTarget.offsetParent ? insTarget : null; if(!el){ setStmtTxt('cover', true); } }, noAi: 'AI notes for statements: use “Draft notes with DebtJet AI” on the Statement tab.', placeholder: 'e.g. thank them, or note a promise', insert: function(t){ STMT_ASSIST.beforeInsert(); insertIntoTarget(t, document.getElementById('stmtNotes-rich') || document.getElementById('stmtNotes')); } };
  var TERMS_ASSIST = { scope: 'letter', builtins: TERMS_CLAUSES, noAi: 'Wording to adapt for your own terms of trade. Check it with your adviser.', placeholder: 'e.g. interest on overdue invoices', insert: function(t){ insertIntoTarget(t); } };
  var NOTES_ASSIST = { scope: 'letter', builtins: NOTE_CLAUSES, noAi: 'Click a notes box first, then a note to add it.', placeholder: 'e.g. promise to pay', insert: function(t){ insertIntoTarget(t); } };
  var INS_KINDS = {
    letter: { assist: function(){ return LD_ASSIST; }, fields: true, off: { evidence: 'Debt Recovery' }, where: function(){ return 'Adds to: <b>the letter</b>, after the paragraph you’re on'; } },
    claim: { assist: function(){ return recAssistCtx ? REC_ASSIST : null; }, evidence: true, off: { fields: 'Letters of Demand' }, empty: 'Open a case’s Claim tab and start a recovery file, then write the claim from here.' },
    statement: { assist: function(){ return STMT_ASSIST; }, off: { fields: 'Letters of Demand', evidence: 'Debt Recovery' } },
    terms: { assist: function(){ return TERMS_ASSIST; }, off: { fields: 'Letters of Demand', evidence: 'Debt Recovery' } },
    notes: { assist: function(){ return NOTES_ASSIST; }, off: { fields: 'Letters of Demand', evidence: 'Debt Recovery' } }
  };
  function insTargetLabel(el){
    el = el || insTarget; if(!el || !document.body.contains(el) || !el.offsetParent) return '';
    if(el.closest('#letterPaper')) return 'the letter';
    if(el.classList.contains('rec-rich') && el.getAttribute('data-ins-label')) return el.getAttribute('data-ins-label');
    if(el.classList.contains('rec-rich')){ var sec = el.closest('.rec-sec'); return sec ? ((sec.querySelector('.rec-sec-title') || {}).value || 'Section') : 'Details of the claim'; }
    if(el.getAttribute('data-ins-label')) return el.getAttribute('data-ins-label');
    var lab = el.closest('label'); if(lab){ var txt = Array.prototype.filter.call(lab.childNodes, function(n){ return n.nodeType === 3; }).map(function(n){ return n.nodeValue; }).join(' ').trim(); if(txt) return txt.slice(0, 50); }
    var rf = el.closest('.rec-f'); if(rf && rf.querySelector('span')) return rf.querySelector('span').textContent.slice(0, 50);
    return (el.getAttribute('placeholder') || 'the box you last clicked').slice(0, 50);
  }
  var STMT_TARGET_CAT = { stmtNotes: 'Above the invoices', 'stmtTxt-after_totals': 'After the totals', 'stmtTxt-pay_note': 'How to pay', 'stmtTxt-closing': 'Closing message',
    'stmtNotes-rich': 'Above the invoices', 'stmtTxt-after_totals-rich': 'After the totals', 'stmtTxt-pay_note-rich': 'How to pay', 'stmtTxt-closing-rich': 'Closing message' };
  function updateInsTarget(){
    if(curView === 'statements' && insTarget && STMT_ASSIST.st){
      var want = STMT_TARGET_CAT[insTarget.id] || (insTarget.hasAttribute('data-line-note') ? 'Notes under invoices' : '');
      if(want && STMT_ASSIST.st.cat !== want){ STMT_ASSIST.st.cat = want; var bx = document.getElementById('insBody'); if(bx && bx._A === STMT_ASSIST) renderAssist(bx, STMT_ASSIST); }
    }
    var box = document.querySelector('#insPanel .ins-target'); if(!box) return;
    var cfg = SHELL[curView] || {}, K = INS_KINDS[cfg.ins] || {};
    if(K.where){ box.innerHTML = K.where(); return; }
    var l = insTargetLabel();
    box.innerHTML = l ? 'Adds to: <b>' + escapeHtml(l) + '</b>' : (cfg.ins === 'statement' ? 'Adds to: <b>Message above the invoices</b>, or click another box first' : 'Click a box first. Otherwise wording is copied for you to paste.');
  }
  function renderInsPanel(){
    var cfg = SHELL[curView]; if(!cfg || !cfg.ins) return;
    var K = INS_KINDS[cfg.ins], p = document.getElementById('insPanel'), pinned = pinOf('ins', curView);
    var avail = { clauses: true, fields: !!K.fields, evidence: !!K.evidence };
    if(!avail[insTab]) insTab = 'clauses';
    var tabs = [['clauses', 'Clauses & AI'], ['fields', 'Fields'], ['evidence', 'Evidence']];
    p.innerHTML = '<div class="ins-head"><h2>Insert</h2><button type="button" class="ins-pin" data-ins="pin" aria-pressed="'+pinned+'" title="'+(pinned ? 'Unpin: open from the right edge instead' : 'Keep this panel open in ' + escapeHtml(TITLES[curView][0]))+'">'+PIN_SVG+(pinned ? 'Pinned' : 'Pin')+'</button></div>'
      + '<div class="ins-tabs" role="tablist">' + tabs.map(function(t){ return '<button type="button" role="tab" data-instab="'+t[0]+'" class="'+(insTab === t[0] ? 'on' : '')+'" aria-selected="'+(insTab === t[0])+'"'+(avail[t[0]] ? '' : ' disabled title="Used in '+escapeHtml((K.off || {})[t[0]] || 'another section')+'"')+'>'+t[1]+'</button>'; }).join('') + '</div>'
      + '<div class="ins-target"></div><div id="insBody"></div>'
      + (Object.keys(K.off || {}).length ? '<div class="ins-off">'+Object.keys(K.off).map(function(k){ return escapeHtml(k === 'fields' ? 'Fields' : 'Evidence') + ' are used in ' + escapeHtml(K.off[k]); }).join('. ')+'.</div>' : '');
    updateInsTarget();
    var body = document.getElementById('insBody');
    if(insTab === 'fields'){
      body.innerHTML = '<div class="ins-fields">' + LETTER_VARS.map(function(v){ return '<button type="button" data-insfield="'+v[0]+'"><span>'+escapeHtml(v[1])+'</span><code>{{'+v[0]+'}}</code></button>'; }).join('') + '</div><div class="fine">Click into a paragraph on the letter first. The field goes where your cursor is and fills in from the case.</div>';
      return;
    }
    if(insTab === 'evidence'){
      body.innerHTML = '<p class="muted small">The evidence pack is built from your invoices, letters, payments and notes.</p><div style="display:flex;flex-direction:column;gap:6px;"><button type="button" class="btn sm" data-ins="go-evidence">Open the evidence pack</button><button type="button" class="btn sm" data-ins="go-disputes">Disputed facts</button></div>';
      return;
    }
    var A = K.assist();
    if(!A){ body.innerHTML = '<div class="empty-note">'+escapeHtml(K.empty || '')+'</div>'; return; }
    renderAssist(body, A);
  }
  var DOCK = {
    letters: { scope: 'this letter template', spacing: [['compact','Compact'],['normal','Normal'],['relaxed','Relaxed']],
      ok: function(){ return !!ldTpl; },
      get: function(k){ var st = ldSettings(), o = st.overrides || {}, base = normaliseTpl(brandSettings(st.design_source)); if(k === 'spacing') return st.spacing; if(k === 'colors.accent') return (o.colors && o.colors.accent) || base.colors.accent; return o[k] != null && o[k] !== '' ? o[k] : base[k]; },
      set: function(k, v){ var st = ldTpl.settings = ldTpl.settings || {}; st.overrides = st.overrides || {}; if(k === 'spacing') st.spacing = v; else if(k === 'scheme'){ st.overrides.colors = Object.assign(st.overrides.colors || {}, { accent: v.accent, heading: v.heading, th_bg: v.th_bg, th_text: v.th_text, border: v.border }); } else if(/^colors\./.test(k)){ st.overrides.colors = st.overrides.colors || {}; st.overrides.colors[k.slice(7)] = v; } else st.overrides[k] = v; if(k === 'font') ensureFont(v); markLetterDirty(); if(ldTab === 'design' && ldPane === 'templates') renderLetterEditor(); },
      more: function(){ ldTab = 'design'; setLetterTab('templates'); } },
    statements: { scope: 'this statement template', spacing: [['compact','Compact'],['regular','Regular'],['roomy','Roomy']],
      ok: function(){ return !!stmtTplSettings; },
      get: function(k){ var v = getPath(stmtTplSettings, k === 'spacing' ? 'density' : k); return v == null && /^colors\./.test(k) ? TPL_BASE.colors[k.slice(7)] : v; },
      set: function(k, v){ if(k === 'scheme'){ Object.keys(v).forEach(function(ck){ setPath(stmtTplSettings, 'colors.' + ck, v[ck]); }); } else setPath(stmtTplSettings, k === 'spacing' ? 'density' : k, v); if(k === 'font') ensureFont(v); renderDesigner(); markTplDirty(); },
      more: function(){ setStmtTab('templates'); } }
  };
  // Ready-made colour schemes. Each says what its colours mean on the statement.
  var COLOUR_SCHEMES = [
    { name: 'DebtJet navy', note: 'Navy headings and lines · red overdue', c: { accent:'#0b2a5b', heading:'#0b2a5b', th_bg:'#eef2f8', th_text:'#0b2a5b', border:'#d9e0ea', stripe:'#f6f8fb', overdue:'#b42318', paid:'#1f7a45', disputed:'#9a5b00' } },
    { name: 'Jet blue', note: 'Blue accent · red overdue · green paid', c: { accent:'#1e6fd9', heading:'#0b2a5b', th_bg:'#e6eefa', th_text:'#0b2a5b', border:'#d6e0ee', stripe:'#f4f8fe', overdue:'#b42318', paid:'#1f7a45', disputed:'#9a5b00' } },
    { name: 'Charcoal', note: 'Black and grey, minimal · red overdue', c: { accent:'#111111', heading:'#111111', th_bg:'#f3f4f6', th_text:'#111111', border:'#e5e7eb', stripe:'#fafafa', overdue:'#b42318', paid:'#166534', disputed:'#92400e' } },
    { name: 'Teal', note: 'Teal accent · orange overdue (softer than red)', c: { accent:'#0f766e', heading:'#0f172a', th_bg:'#e6f4f2', th_text:'#0f3f3a', border:'#d5e7e4', stripe:'#f0fdfa', overdue:'#c2410c', paid:'#166534', disputed:'#92400e' } },
    { name: 'Burgundy', note: 'Burgundy accent · dark red overdue', c: { accent:'#7a1f2b', heading:'#2b2b2b', th_bg:'#f4ecec', th_text:'#7a1f2b', border:'#e3d6d6', stripe:'#fbf7f7', overdue:'#991b1b', paid:'#166534', disputed:'#92400e' } },
    { name: 'Forest', note: 'Green accent · red overdue', c: { accent:'#2f6b3f', heading:'#1f3d27', th_bg:'#e8f3eb', th_text:'#1f3d27', border:'#d3e8da', stripe:'#f3faf5', overdue:'#b42318', paid:'#2f6b3f', disputed:'#92400e' } },
    { name: 'High contrast', note: 'Black on white · bold red overdue (best for printing)', c: { accent:'#000000', heading:'#000000', th_bg:'#ffffff', th_text:'#000000', border:'#9ca3af', stripe:'#f3f4f6', overdue:'#c00000', paid:'#000000', disputed:'#000000' } },
    { name: 'Calm', note: 'Slate accent · amber overdue (no red)', c: { accent:'#3f5170', heading:'#1e293b', th_bg:'#eef1f5', th_text:'#1e293b', border:'#dde3ea', stripe:'#f7f9fb', overdue:'#b45309', paid:'#166534', disputed:'#6b21a8' } }
  ];
  function schemeSw(c){ return ['accent', 'th_bg', 'overdue', 'paid'].map(function(k){ return '<span class="sch-sw" style="background:'+c[k]+'"></span>'; }).join(''); }
  function currentSchemeName(get){ var a = String(get('colors.accent') || '').toLowerCase(), o = String(get('colors.overdue') || '').toLowerCase(); var m = COLOUR_SCHEMES.filter(function(x){ return x.c.accent === a && (!o || x.c.overdue === o); })[0]; return m ? m.name : 'Custom'; }
  function renderStyleDock(){
    var D = DOCK[curView], el = document.getElementById('styleDock'); if(!D || el.hidden) return;
    setTimeout(placeInsPanel, 0);
    if(!D.ok()){ el.innerHTML = '<span class="sd-k">Style</span><span>Choose a template first.</span>'; return; }
    if(el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    var g = D.get, font = g('font'), size = Number(g('font_size')) || 11.5, acc = String(g('colors.accent') || '#0B2A5B');
    var SW = ['#0B2A5B', '#1E6FD9', '#3F5170', '#111111', '#14703D', '#8A1C2C'];
    var opt = function(list, cur){ return list.map(function(x){ return '<option value="'+escapeHtml(String(x[0]))+'"'+(String(x[0]) === String(cur) ? ' selected' : '')+'>'+escapeHtml(x[1])+'</option>'; }).join(''); };
    el.innerHTML = '<span class="sd-k">Style</span>'
      + '<label>Font <select data-dock="font">'+opt(FONT_OPTIONS.map(function(o){ return [o.name, o.name]; }), font)+'</select></label>'
      + '<label>Size <select data-dock="font_size">'+opt([10,10.5,11,11.5,12,12.5,13,14,15].map(function(n){ return [n, n + ' px']; }), size)+'</select></label>'
      + '<span class="sch-wrap"><button type="button" class="sd-more sch-btn" data-sch-open aria-haspopup="true">Colours: <b>'+escapeHtml(currentSchemeName(g))+'</b> ▾</button>'
      + '<div class="sch-menu" hidden role="menu">' + COLOUR_SCHEMES.map(function(x, i){ return '<button type="button" role="menuitem" data-sch="'+i+'"><span class="sch-sws">'+schemeSw(x.c)+'</span><span class="sch-t"><b>'+escapeHtml(x.name)+'</b><span>'+escapeHtml(x.note)+'</span></span></button>'; }).join('') + '</div></span>'
      + '<label>Accent ' + colourField('data-dock="colors.accent"', acc) + '</label>'
      + (curView === 'statements' ? '<label>Overdue ' + colourField('data-dock="colors.overdue"', g('colors.overdue') || '#b42318') + '</label>' : '')
      + '<label>Table <select data-dock="table_style">'+opt([['lined','Ruled'],['striped','Striped'],['boxed','Boxed'],['minimal','Minimal']], g('table_style'))+'</select></label>'
      + '<label>Spacing <select data-dock="spacing">'+opt(D.spacing, g('spacing'))+'</select></label>'
      + '<label>Logo <select data-dock="logo_position">'+opt([['left','Left'],['right','Right']], g('logo_position'))+'</select></label>'
      + '<button type="button" class="sd-more" data-dock-more>All design options</button><span style="opacity:.8;font-size:12px;">Applies to '+escapeHtml(D.scope)+'</span>'
      + '<button type="button" class="sd-x" data-dock-close aria-label="Hide the style dock" title="Hide (open again from the bottom edge or the Style button)">×</button>';
  }
  var peekTimer = null;
  // The Insert panel sits between the top bar and the Style dock, not as a full-height column.
  function placeInsPanel(){
    var panel = document.getElementById('insPanel'), dock = document.getElementById('styleDock'), tb = document.querySelector('.main > .topbar');
    var top = tb ? Math.max(0, Math.round(tb.getBoundingClientRect().bottom)) : 0;
    var dockShown = !dock.hidden, bottom = dockShown ? Math.max(0, Math.round(window.innerHeight - dock.getBoundingClientRect().top)) : 0;
    document.documentElement.style.setProperty('--ins-top', top + 'px');
    document.documentElement.style.setProperty('--ins-bottom', Math.min(bottom, dockShown ? dock.offsetHeight : 0) + 'px');
    document.querySelector('.app').classList.toggle('ins-open', !panel.hidden && !panel.classList.contains('peek'));
  }
  window.addEventListener('resize', function(){ placeInsPanel(); });
  window.addEventListener('scroll', function(){ placeInsPanel(); }, { passive: true });
  function shellRefresh(){
    var cfg = SHELL[curView] || {}, panel = document.getElementById('insPanel'), dock = document.getElementById('styleDock');
    if(cfg.when && !cfg.when()) cfg = {};
    var insOn = !!cfg.ins && pinOf('ins', curView), dockOn = !!cfg.dock && pinOf('dock', curView);
    panel.classList.remove('peek'); dock.classList.remove('peek');
    panel.hidden = !insOn; dock.hidden = !dockOn;
    var ti = document.getElementById('tbIns'), ts = document.getElementById('tbStyle');
    ti.hidden = !cfg.ins; ts.hidden = !cfg.dock; ti.setAttribute('aria-pressed', String(insOn)); ts.setAttribute('aria-pressed', String(dockOn));
    document.getElementById('edgeR').hidden = !cfg.ins || insOn; document.getElementById('edgeB').hidden = !cfg.dock || dockOn;
    if(insOn) renderInsPanel(); if(dockOn) renderStyleDock();
    placeInsPanel();
  }
  function shellPeek(kind, show){
    var el = document.getElementById(kind === 'ins' ? 'insPanel' : 'styleDock');
    if(show){ if(!el.hidden) return; el.hidden = false; el.classList.add('peek'); if(kind === 'ins') renderInsPanel(); else renderStyleDock(); }
    else if(el.classList.contains('peek') && !el.contains(document.activeElement)){ el.classList.remove('peek'); el.hidden = true; }
    placeInsPanel();
  }
  (function wireShell(){
    var panel = document.getElementById('insPanel'), dock = document.getElementById('styleDock');
    [['edgeR', 'ins'], ['edgeB', 'dock']].forEach(function(p){
      var h = document.getElementById(p[0]);
      h.addEventListener('mouseenter', function(){ clearTimeout(peekTimer); peekTimer = setTimeout(function(){ shellPeek(p[1], true); }, 280); });
      h.addEventListener('mouseleave', function(){ clearTimeout(peekTimer); });
    });
    [[panel, 'ins'], [dock, 'dock']].forEach(function(p){ p[0].addEventListener('mouseleave', function(){ if(p[0].classList.contains('peek')) setTimeout(function(){ if(!p[0].matches(':hover')) shellPeek(p[1], false); }, 450); }); });
    document.getElementById('tbIns').addEventListener('click', function(){ setPin('ins', curView, !pinOf('ins', curView)); shellRefresh(); });
    document.getElementById('tbStyle').addEventListener('click', function(){ setPin('dock', curView, !pinOf('dock', curView)); shellRefresh(); });
    panel.addEventListener('mousedown', function(e){ if(e.target.closest('[data-insfield]')) e.preventDefault(); });
    panel.addEventListener('click', function(e){
      var t = e.target.closest('button'); if(!t) return;
      if(t.getAttribute('data-ins') === 'pin'){ setPin('ins', curView, !pinOf('ins', curView)); shellRefresh(); return; }
      if(t.hasAttribute('data-instab')){ insTab = t.getAttribute('data-instab'); renderInsPanel(); return; }
      if(t.hasAttribute('data-insfield')){ var ed = djActive || (insLastDj && document.body.contains(insLastDj) ? insLastDj : null); if(!ed){ toast('Click into a paragraph on the letter first.'); return; } djInsertField(ed, t.getAttribute('data-insfield')); return; }
      if(t.getAttribute('data-ins') === 'go-evidence'){ setRecTab('evidence'); return; }
      if(t.getAttribute('data-ins') === 'go-disputes'){ setRecTab('disputes'); return; }
    });
    dock.addEventListener('change', function(e){ var k = e.target.getAttribute('data-dock'), D = DOCK[curView]; if(!k || !D) return; D.set(k, k === 'font_size' ? Number(e.target.value) : e.target.value); if(!e.target.classList.contains('cpick-val')) renderStyleDock(); else { var nb = dock.querySelector('.sch-btn b'); if(nb) nb.textContent = currentSchemeName(D.get); } });
    dock.addEventListener('click', function(e){
      var D = DOCK[curView]; if(!D) return; var t = e.target.closest('button'); if(!t) return;
      if(t.hasAttribute('data-sch-open')){ var mn = dock.querySelector('.sch-menu'); mn.hidden = !mn.hidden; return; }
      if(t.hasAttribute('data-sch')){ D.set('scheme', COLOUR_SCHEMES[Number(t.getAttribute('data-sch'))].c); renderStyleDock(); toast('Colours: ' + COLOUR_SCHEMES[Number(t.getAttribute('data-sch'))].name + '.'); return; }
      if(t.hasAttribute('data-dock-more')){ D.more(); return; }
      if(t.hasAttribute('data-dock-close')){ setPin('dock', curView, false); shellRefresh(); }
    });
    document.addEventListener('focusin', function(e){
      var el = e.target; if(!el || !el.closest) return;
      if(el.closest('#insPanel') || el.closest('#styleDock') || el.closest('.topbar') || el.closest('.dj-modal')) return;
      if(el.hasAttribute('data-dj-edit')) insLastDj = el;
      if(el.matches('textarea, [data-dj-edit], input[type="text"]:not(.as-q)') && !el.closest('[hidden]')){ insTarget = el; updateInsTarget(); }
    });
  })();

