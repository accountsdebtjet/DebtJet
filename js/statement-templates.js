/* DebtJet: statement-templates.js
 * Statement templates, designer, statement model, renderer, preview, save and print.
 * Loaded by index.html in a fixed order; see js/README.md. Everything here shares one global scope.
 */

  /* ---------- templates ---------- */
  var TPL_BASE = {
    colors: { accent:'#1f3a8a', heading:'#14213d', text:'#1b2433', muted:'#5b6474', th_bg:'#eef2f8', th_text:'#14213d', border:'#d9e0ea', stripe:'#f6f8fb', band_text:'#ffffff', overdue:'#b42318', paid:'#1f7a45', disputed:'#9a5b00' },
    font: 'Sora', heading_font: 'Sora', font_size: 12.5,
    table_style: 'lined', density: 'regular', header_style: 'plain',
    logo: null, hide_logo: false, logo_position: 'left', logo_height: 44, desc_mode: 'short_details', desc_max: 60, upcoming: 'separate', summary_style: 'boxes', show_to_details: true,
    title: 'Account Statement', from_lines: '', intro: '', footer: '', sign_off: 'Accounts team',
    columns: { invoice:true, description:true, issued:false, due:true, days_overdue:true, amount:true, paid:false, interest:true, fees:true, balance:true, status:true, pay_link:true },
    sections: { summary:true, ageing:true, line_notes:true, cover:true, payment:true, remittance:false, late_rate:false }
  };
  var TPL_PRESETS = {
    classic:  { name:'Classic', o:{} },
    modern:   { name:'Modern', o:{ colors:{ accent:'#0f766e', heading:'#0f172a', th_bg:'#0f766e', th_text:'#ffffff', stripe:'#f0fdfa', border:'#d5e7e4' }, font:'Inter', heading_font:'Inter', table_style:'striped', header_style:'band' } },
    minimal:  { name:'Minimal', o:{ colors:{ accent:'#111827', heading:'#111827', th_bg:'#ffffff', th_text:'#6b7280', border:'#e5e7eb', muted:'#6b7280' }, font:'IBM Plex Sans', heading_font:'IBM Plex Sans', table_style:'minimal', density:'roomy', sections:{ ageing:false } } },
    corporate:{ name:'Corporate', o:{ colors:{ accent:'#7a1f2b', heading:'#2b2b2b', th_bg:'#f4ecec', th_text:'#7a1f2b', border:'#e3d6d6', stripe:'#fbf7f7' }, font:'Source Serif 4', heading_font:'Playfair Display', table_style:'boxed', columns:{ issued:true, paid:true } } },
    friendly: { name:'Friendly', o:{ colors:{ accent:'#2f855a', heading:'#22543d', th_bg:'#e6f4ea', th_text:'#22543d', stripe:'#f3faf5', border:'#d3e8da' }, font:'Lato', heading_font:'Lato', table_style:'striped', density:'roomy', header_style:'centred' } }
  };
  var FONT_OPTIONS = [
    { name:'Sora', css:'"Sora", sans-serif', g:true }, { name:'Inter', css:'"Inter", sans-serif', g:true },
    { name:'Roboto', css:'"Roboto", sans-serif', g:true }, { name:'Lato', css:'"Lato", sans-serif', g:true },
    { name:'IBM Plex Sans', css:'"IBM Plex Sans", sans-serif', g:true }, { name:'Source Serif 4', css:'"Source Serif 4", Georgia, serif', g:true },
    { name:'Merriweather', css:'"Merriweather", Georgia, serif', g:true }, { name:'Playfair Display', css:'"Playfair Display", Georgia, serif', g:true },
    { name:'Arial', css:'Arial, Helvetica, sans-serif', g:false }, { name:'Georgia', css:'Georgia, serif', g:false },
    { name:'Times New Roman', css:'"Times New Roman", Times, serif', g:false }
  ];
  function fontCss(name){ var f = FONT_OPTIONS.filter(function(x){ return x.name === name; })[0] || FONT_OPTIONS[0]; return f.css; }
  var loadedFonts = { Sora: true };
  function ensureFont(name){
    var f = FONT_OPTIONS.filter(function(x){ return x.name === name; })[0];
    if(!f || !f.g || loadedFonts[name]) return;
    loadedFonts[name] = true;
    var l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;600;700&display=swap';
    document.head.appendChild(l);
  }
  function deepMerge(base, over){
    var out = JSON.parse(JSON.stringify(base));
    Object.keys(over || {}).forEach(function(k){
      if(over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object') out[k] = deepMerge(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }
  // Clean any template settings (saved, typed or loaded) so only known, safe values reach the page.
  function normaliseTpl(t){
    t = deepMerge(TPL_BASE, t || {});
    Object.keys(TPL_BASE.colors).forEach(function(k){ if(!/^#[0-9a-f]{6}$/i.test(String(t.colors[k]))) t.colors[k] = TPL_BASE.colors[k]; });
    if(!FONT_OPTIONS.some(function(f){ return f.name === t.font; })) t.font = TPL_BASE.font;
    if(!FONT_OPTIONS.some(function(f){ return f.name === t.heading_font; })) t.heading_font = TPL_BASE.heading_font;
    t.font_size = Math.min(15, Math.max(10, Number(t.font_size) || 12.5));
    if(['lined','striped','boxed','minimal'].indexOf(t.table_style) < 0) t.table_style = 'lined';
    if(['separate','together','exclude'].indexOf(t.upcoming) < 0) t.upcoming = 'separate';
    if(['boxes','headline','breakdown','ageing'].indexOf(t.summary_style) < 0) t.summary_style = 'boxes';
    if(['compact','regular','roomy'].indexOf(t.density) < 0) t.density = 'regular';
    if(['plain','band','centred'].indexOf(t.header_style) < 0) t.header_style = 'plain';
    if(['left','right'].indexOf(t.logo_position) < 0) t.logo_position = 'left';
    t.logo_height = Math.min(90, Math.max(24, Number(t.logo_height) || 44));
    t.hide_logo = !!t.hide_logo;
    if(['full','short','short_details','short_below','below'].indexOf(t.desc_mode) < 0) t.desc_mode = 'short_details';
    t.desc_max = Math.min(120, Math.max(30, Number(t.desc_max) || 60));
    if(t.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(t.logo)) t.logo = null;
    ['title','from_lines','intro','footer','sign_off'].forEach(function(k){ t[k] = String(t[k] == null ? '' : t[k]).slice(0, 1200); });
    return t;
  }

  function renderStatementTemplateOptions(){
    var sel = document.getElementById('stmtTplSelect');
    sel.innerHTML = '<optgroup label="Built-in">' + Object.keys(TPL_PRESETS).map(function(k){
        return '<option value="preset:'+k+'"'+(stmtTplKey === 'preset:'+k ? ' selected' : '')+'>'+escapeHtml(TPL_PRESETS[k].name)+'</option>';
      }).join('') + '</optgroup>'
      + (stmtTemplates.length ? '<optgroup label="Your templates">' + stmtTemplates.map(function(t){
        return '<option value="'+escapeHtml(t.id)+'"'+(stmtTplKey === t.id ? ' selected' : '')+'>'+escapeHtml(t.name)+(t.is_default ? ' (default)' : '')+'</option>';
      }).join('') + '</optgroup>' : '');
    var custom = stmtTplKey && stmtTplKey.indexOf('preset:') !== 0;
    document.getElementById('stmtTplDefault').disabled = !custom;
    document.getElementById('stmtTplDelete').disabled = !custom;
    document.getElementById('stmtTplStatus').textContent = stmtTplDirty
      ? 'Unsaved design changes' + (custom ? '' : ' — built-in templates are saved as a new template')
      : (custom ? 'Your template' : 'Built-in template — customise it, then “Save as new” to keep your own version');
  }
  function selectStatementTemplate(key, quiet){
    var row = stmtTemplates.filter(function(t){ return t.id === key; })[0];
    if(key.indexOf('preset:') === 0){
      var p = TPL_PRESETS[key.slice(7)] || TPL_PRESETS.classic;
      stmtTplSettings = normaliseTpl(p.o);
    } else if(row){
      stmtTplSettings = normaliseTpl(row.settings);
    } else { key = 'preset:classic'; stmtTplSettings = normaliseTpl({}); }
    stmtTplKey = key; stmtTplDirty = false;
    ensureFont(stmtTplSettings.font); ensureFont(stmtTplSettings.heading_font);
    if(!quiet){ renderStatementTemplateOptions(); if(!document.getElementById('stmtDesigner').hidden) renderDesigner(); renderStatementPreview(); }
  }

  /* ---------- designer ---------- */
  var DESIGN_GROUPS = [
    { title:'Quick styles', presets:true },
    { title:'Colours', fields:[
      ['colors.accent','color','Accent'], ['colors.heading','color','Headings'], ['colors.text','color','Body text'], ['colors.muted','color','Secondary text'],
      ['colors.th_bg','color','Table header'], ['colors.th_text','color','Table header text'], ['colors.border','color','Lines'], ['colors.stripe','color','Stripes'], ['colors.band_text','color','Header band text'], ['colors.overdue','color','Overdue (days and status)'], ['colors.paid','color','Paid'], ['colors.disputed','color','Disputed / on hold'] ] },
    { title:'Fonts & size', fields:[
      ['font','font','Body font'], ['heading_font','font','Heading font'], ['font_size','range','Text size', 10, 15, 0.5] ] },
    { title:'Table', fields:[
      ['table_style','select','Table style', [['lined','Lined'],['striped','Striped rows'],['boxed','Boxed grid'],['minimal','Minimal']]],
      ['density','select','Row spacing', [['compact','Compact'],['regular','Regular'],['roomy','Roomy']]] ] },
    { title:'Header & logo', fields:[
      ['header_style','select','Header layout', [['plain','Logo left, details right'],['band','Coloured band'],['centred','Centred']]],
      ['logo','logo','Logo for this template only (leave empty to use your logo from Settings)'], ['hide_logo','check','Don’t show a logo'], ['logo_position','select','Logo side', [['left','Left'],['right','Right']]],
      ['logo_height','range','Logo size', 24, 90, 2] ] },
    { title:'Wording', fields:[
      ['title','text','Document title'], ['sign_off','text','Signed by'],
      ['from_lines','textarea','Your business details (address, ABN, phone, email)'],
      ['intro','textarea','Standard message above the invoices'], ['footer','textarea','Footer (terms, privacy, contact)'] ] },
    { title:'Columns', fields:[
      ['columns.invoice','check','Invoice number'], ['columns.description','check','Description / reference'], ['columns.issued','check','Issue date'],
      ['columns.due','check','Due date'], ['columns.days_overdue','check','Days overdue'], ['columns.amount','check','Invoice amount'],
      ['columns.paid','check','Paid to date'], ['columns.interest','check','Interest'], ['columns.fees','check','Fees'],
      ['columns.balance','check','Balance owing'], ['columns.status','check','Status'], ['columns.pay_link','check','Pay online link'] ] },
    { title:'Long descriptions', fields:[
      ['summary_style','select','Summary at the top', [['boxes','Boxes: amount due, overdue, charges'],['headline','One headline figure with oldest invoice and reference'],['breakdown','Breakdown strip: owing, charges, overdue, total'],['ageing','Ageing strip: current to 90+ days, then the total']]],
      ['show_to_details','check','Show the customer’s address and ABN under “To”'],
      ['upcoming','select','Invoices not yet due', [['separate','Separate: overdue first, then not yet due'],['together','Together in one list'],['exclude','Leave them off the statement']]],
      ['desc_mode','select','How to show long invoice descriptions', [['short_below','Short in the table, full text under the invoice'],['short_details','Short in the table, full text in “Invoice details” at the end'],['short','Short in the table only'],['below','Full text under the invoice only (no description column)'],['full','Full text in the table']]],
      ['desc_max','range','Shorten to about (characters)', 30, 120, 5] ] },
    { title:'Sections', fields:[
      ['sections.summary','check','Amount-due summary'], ['sections.cover','check','Cover message'], ['sections.line_notes','check','Notes under each invoice'],
      ['sections.ageing','check','Ageing (current, 30, 60, 90+ days)'], ['sections.payment','check','How to pay'],
      ['sections.remittance','check','Tear-off remittance slip'], ['sections.late_rate','check','Late-payment rate (3 months)'] ] }
  ];
  function getPath(o, path){ return path.split('.').reduce(function(a, k){ return a == null ? a : a[k]; }, o); }
  function setPath(o, path, v){ var ks = path.split('.'); var last = ks.pop(); ks.reduce(function(a, k){ return a[k]; }, o)[last] = v; }
  function renderDesigner(){
    if(curView === 'statements') setTimeout(renderStyleDock, 0);
    var t = stmtTplSettings, open = {};
    Array.prototype.forEach.call(document.querySelectorAll('#stmtDesigner details'), function(d){ open[d.getAttribute('data-g')] = d.open; });
    document.getElementById('stmtDesigner').innerHTML = DESIGN_GROUPS.map(function(g, gi){
      var isOpen = open.hasOwnProperty(gi) ? open[gi] : gi < 2;
      var body;
      if(g.presets){
        body = '<div class="presets">' + Object.keys(TPL_PRESETS).map(function(k){
          var c = normaliseTpl(TPL_PRESETS[k].o).colors;
          return '<button type="button" class="preset-chip" data-preset="'+k+'"><i style="background:'+c.accent+'"></i><i style="background:'+c.th_bg+';border:1px solid '+c.border+'"></i>'+escapeHtml(TPL_PRESETS[k].name)+'</button>';
        }).join('') + '</div><div class="fine" style="margin-top:6px;">Applies colours, fonts and layout. Your wording and logo are kept.</div>';
      } else {
        body = '<div class="dz">' + g.fields.map(function(f){
          var path = f[0], type = f[1], label = escapeHtml(f[2]), v = getPath(t, path);
          if(type === 'color') return '<label>'+label+colourField('data-path="'+path+'"', v)+'</label>';
          if(type === 'font') return '<label>'+label+'<select data-path="'+path+'">'+FONT_OPTIONS.map(function(o){ return '<option'+(o.name===v?' selected':'')+'>'+escapeHtml(o.name)+'</option>'; }).join('')+'</select></label>';
          if(type === 'range') return '<label>'+label+' <span data-out="'+path+'">'+escapeHtml(v)+'</span><input type="range" data-path="'+path+'" min="'+f[3]+'" max="'+f[4]+'" step="'+f[5]+'" value="'+escapeHtml(v)+'" /></label>';
          if(type === 'select') return '<label>'+label+'<select data-path="'+path+'">'+f[3].map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===v?' selected':'')+'>'+escapeHtml(o[1])+'</option>'; }).join('')+'</select></label>';
          if(type === 'text') return '<label>'+label+'<input type="text" maxlength="120" data-path="'+path+'" value="'+escapeHtml(v)+'" /></label>';
          if(type === 'textarea') return '<label class="wide">'+label+'<textarea rows="2" maxlength="1200" data-path="'+path+'">'+escapeHtml(v)+'</textarea></label>';
          if(type === 'check') return '<label class="ck"><input type="checkbox" data-path="'+path+'"'+(v?' checked':'')+' />'+label+'</label>';
          if(type === 'logo') return '<label>'+label+'<input type="file" accept="image/png,image/jpeg,image/webp" data-logo="1" />'+(v ? '<button type="button" class="linkbtn" data-logo-remove="1" style="text-align:left;">Remove logo</button>' : '')+'</label>';
          return '';
        }).join('') + '</div>';
      }
      return '<details data-g="'+gi+'"'+(isOpen?' open':'')+'><summary>'+escapeHtml(g.title)+'</summary>'+body+'</details>';
    }).join('');
  }
  function markTplDirty(){ stmtTplDirty = true; renderStatementTemplateOptions(); schedulePreview(); }
  var previewQueued = false;
  function schedulePreview(){ if(previewQueued) return; previewQueued = true; requestAnimationFrame(function(){ previewQueued = false; renderStatementPreview(); }); }
  (function wireDesigner(){
    var box = document.getElementById('stmtDesigner');
    box.addEventListener('input', function(e){
      var el = e.target, path = el.getAttribute('data-path'); if(!path) return;
      var v = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
      setPath(stmtTplSettings, path, v);
      if(path === 'font' || path === 'heading_font') ensureFont(v);
      var out = box.querySelector('[data-out="'+path+'"]'); if(out) out.textContent = v;
      markTplDirty();
    });
    box.addEventListener('change', function(e){
      var el = e.target;
      if(el.getAttribute('data-path') && (el.tagName === 'SELECT' || el.type === 'checkbox')){ el.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if(!el.getAttribute('data-logo') || !el.files || !el.files[0]) return;
      var file = el.files[0];
      if(file.size > 5 * 1024 * 1024){ toast('That image is over 5 MB. Please choose a smaller logo.'); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        // Shrink to at most 600 px wide so templates stay small.
        var scale = Math.min(1, 600 / img.width, 240 / img.height), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        stmtTplSettings.logo = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
        renderDesigner(); markTplDirty();
      };
      img.onerror = function(){ URL.revokeObjectURL(url); toast('That file could not be read as an image.'); };
      img.src = url;
    });
    box.addEventListener('click', function(e){
      var chip = e.target.closest('[data-preset]');
      if(chip){
        var keep = { logo: stmtTplSettings.logo, logo_position: stmtTplSettings.logo_position, logo_height: stmtTplSettings.logo_height, title: stmtTplSettings.title,
          from_lines: stmtTplSettings.from_lines, intro: stmtTplSettings.intro, footer: stmtTplSettings.footer, sign_off: stmtTplSettings.sign_off };
        stmtTplSettings = normaliseTpl(Object.assign(deepMerge(TPL_BASE, TPL_PRESETS[chip.getAttribute('data-preset')].o), keep));
        ensureFont(stmtTplSettings.font); ensureFont(stmtTplSettings.heading_font);
        renderDesigner(); markTplDirty(); return;
      }
      if(e.target.getAttribute('data-logo-remove')){ stmtTplSettings.logo = null; renderDesigner(); markTplDirty(); }
    });
  })();
  document.getElementById('stmtTplSelect').addEventListener('change', async function(){
    if(stmtTplDirty && !await djAsk('Discard your unsaved design changes?')){ this.value = stmtTplKey; return; }
    selectStatementTemplate(this.value);
  });
  document.getElementById('stmtTplCustomise').addEventListener('click', function(){
    var d = document.getElementById('stmtDesigner'); d.hidden = !d.hidden;
    if(!d.hidden) renderDesigner();
    this.textContent = d.hidden ? '🎨 Customise' : '🎨 Hide design options';
  });
  async function saveTemplateAsNew(){
    var name = (prompt('Name for this template:', stmtTplKey && stmtTplKey.indexOf('preset:') === 0 ? 'My ' + TPL_PRESETS[stmtTplKey.slice(7)].name.toLowerCase() + ' statement' : 'My statement') || '').trim();
    if(!name) return;
    var r = await sb.from('statement_templates').insert({ org_id: currentOrg.id, name: name.slice(0, 80), settings: stmtTplSettings, is_default: stmtTemplates.length === 0, created_by: session.user.id }).select('*').single();
    if(r.error){ toast('Could not save template: ' + r.error.message); return; }
    stmtTemplates.push(r.data); stmtTemplates.sort(function(a, b){ return a.name.localeCompare(b.name); });
    stmtTplKey = r.data.id; stmtTplDirty = false; renderStatementTemplateOptions();
    toast('Template “' + r.data.name + '” saved' + (r.data.is_default ? ' as your default.' : '.'));
  }
  document.getElementById('stmtTplSaveAs').addEventListener('click', saveTemplateAsNew);
  document.getElementById('stmtTplSave').addEventListener('click', async function(){
    if(!stmtTplKey || stmtTplKey.indexOf('preset:') === 0){ await saveTemplateAsNew(); return; }
    var r = await sb.from('statement_templates').update({ settings: stmtTplSettings, updated_at: new Date().toISOString() }).eq('id', stmtTplKey).select('*').single();
    if(r.error){ toast('Could not save template: ' + r.error.message); return; }
    stmtTemplates = stmtTemplates.map(function(t){ return t.id === r.data.id ? r.data : t; });
    stmtTplDirty = false; renderStatementTemplateOptions(); toast('Template saved.');
  });
  document.getElementById('stmtTplDefault').addEventListener('click', async function(){
    var id = stmtTplKey; if(!id || id.indexOf('preset:') === 0) return;
    var a = await sb.from('statement_templates').update({ is_default: false }).eq('org_id', currentOrg.id).eq('is_default', true);
    var b = a.error ? a : await sb.from('statement_templates').update({ is_default: true }).eq('id', id);
    if(b.error){ toast('Could not set default: ' + b.error.message); return; }
    stmtTemplates.forEach(function(t){ t.is_default = t.id === id; });
    renderStatementTemplateOptions(); toast('Default template updated.');
  });
  document.getElementById('stmtTplDelete').addEventListener('click', async function(){
    var t = stmtTemplates.filter(function(x){ return x.id === stmtTplKey; })[0]; if(!t) return;
    if(!await djAsk('Delete the template “' + t.name + '”? Saved statements keep their own copy of the design.')) return;
    var r = await sb.from('statement_templates').delete().eq('id', t.id);
    if(r.error){ toast('Could not delete: ' + r.error.message); return; }
    stmtTemplates = stmtTemplates.filter(function(x){ return x.id !== t.id; });
    selectStatementTemplate('preset:classic'); toast('Template deleted.');
  });

  /* ---------- statement model ---------- */
  function statusLabel(i){
    if(i.fullyPaid) return 'Paid';
    if(i.disputed) return 'Disputed';
    if(i.daysOverdue > 0) return 'Overdue';
    if(i.daysOverdue === 0) return 'Due today';
    return 'Current';
  }
  function paymentReference(m){
    var p = orgPayment || {};
    if(p.reference_format === 'debtor') return (m.recipient || '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, 18).trim() || 'Your account name';
    if(p.reference_format === 'statement') return m.number;
    var nums = m.items.filter(function(i){ return !i.fullyPaid && !i.disputed && i.invoice_number; }).map(function(i){ return i.invoice_number; });
    // Bank references are short (often 18 characters), so several invoices use the statement number.
    return nums.length === 1 ? nums[0] : m.number;
  }
  function buildStatementModel(){
    var sel = selectedStatementItems();
    var items = sel.items.map(function(i){
      var note = stmtNotesByInvoice[i.id];
      var disputed = !i.fullyPaid && !!note && note.category === 'dispute';
      var balance = i.fullyPaid ? 0 : r2(Math.max(0, i.amount - (i.paid || 0)));
      var ch = invoiceCharges({ id: i.id, case_id: i.case_id, debtor_id: i.debtor_id, issued_date: i.issued_date, due_date: i.due_date, balance: balance, fullyPaid: i.fullyPaid, disputed: disputed });
      if(!ch.applied){ ch = { interest: 0, feeTotal: 0, fees: [], applied: false }; }
      var item = {
        id: i.id, debtor_id: i.debtor_id, debtor_name: i.debtor_name, invoice_number: i.invoice_number, description: i.description,
        issued_date: i.issued_date, due_date: i.due_date, amount: i.amount, paid: i.paid || 0, balance: balance,
        daysOverdue: i.daysOverdue, fullyPaid: i.fullyPaid, disputed: disputed,
        interest: ch.interest, fees: ch.feeTotal, feeLines: ch.fees, chargesApplied: ch.applied,
        note: (stmtLineNotes[i.id] || '').trim(), pay_url: stmtPayLinks[i.id] || i.pay_url || null, desc_short: (stmtDescOverride[i.id] || '').trim()
      };
      item.status = statusLabel(item);
      item.notDue = !item.fullyPaid && !item.disputed && !!item.due_date && String(item.due_date).slice(0, 10) > todayISO();
      return item;
    });
    var upMode = normaliseTpl(stmtTplSettings).upcoming;
    if(upMode === 'exclude') items = items.filter(function(i){ return !i.notDue; });
    var live = items.filter(function(i){ return !i.fullyPaid && !i.disputed; });
    var sum = function(arr, k){ return r2(arr.reduce(function(s, i){ return s + (Number(i[k]) || 0); }, 0)); };
    var stmtFees = calcStatementFees(items);
    var totals = {
      balance: sum(live, 'balance'), interest: sum(live, 'interest'), fees: sum(live, 'fees'),
      statement_fees: stmtFees, overdue: sum(live.filter(function(i){ return i.daysOverdue > 0; }), 'balance'),
      disputed: sum(items.filter(function(i){ return i.disputed; }), 'balance'),
      upcoming: sum(live.filter(function(i){ return i.notDue; }), 'balance')
    };
    totals.due = r2(totals.balance + totals.interest + totals.fees + stmtFees.reduce(function(s, f){ return s + f.amount; }, 0));
    totals.pay_now = r2(totals.due - totals.upcoming);
    var ageing = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
    live.forEach(function(i){
      var d = i.daysOverdue, k = d <= 0 ? 'current' : d <= 30 ? 'd1_30' : d <= 60 ? 'd31_60' : d <= 90 ? 'd61_90' : 'd90';
      ageing[k] = r2(ageing[k] + i.balance);
    });
    var today = new Date();
    var m = {
      items: items, totals: totals, ageing: ageing, debtorIds: sel.debtorIds, upcoming_mode: upMode,
      multi: sel.debtorIds.length > 1,
      recipient: document.getElementById('stmtRecipientName').value || '',
      recipient_lines: (function(){
        var ds = sel.debtorIds.map(function(id){ return stmtDebtors.filter(function(x){ return x.id === id; })[0]; }).filter(Boolean); if(!ds.length) return [];
        var d0 = ds[0], sameAbn = ds.every(function(d){ return d.abn && d.abn === d0.abn; });
        if(ds.length > 1 && !sameAbn) return [];
        var out = (d0.address || []).slice();
        if(d0.abn && d0.debtor_kind !== 'individual') out.push('ABN ' + fmtAbn(d0.abn));
        return out;
      })(),
      date: today.toISOString(),
      number: 'ST-' + today.toISOString().slice(2, 10).replace(/-/g, '') + '-' + (sel.debtorIds[0] || '0000').replace(/-/g, '').slice(0, 4).toUpperCase(),
      cover: stmtTxtMaster && stmtTxtOn.cover ? document.getElementById('stmtNotes').value.trim() : '',
      texts: ['after_totals', 'pay_note', 'closing'].reduce(function(o, k){ var el = document.getElementById('stmtTxt-' + k); if(stmtTxtMaster && stmtTxtOn[k] && el && el.value.trim()) o[k] = el.value.trim(); return o; }, {}),
      late: sel.debtorIds.length ? lateMetrics(sel.debtorIds) : null,
      payment: orgPayment ? {
        account_name: orgPayment.account_name, bsb: orgPayment.bsb, account_number: orgPayment.account_number, bank_name: orgPayment.bank_name,
        payid: orgPayment.payid, payid_type: orgPayment.payid_type, bpay_biller_code: orgPayment.bpay_biller_code,
        show_bank: orgPayment.show_bank, show_payid: orgPayment.show_payid, show_bpay: orgPayment.show_bpay,
        online_provider: orgPayment.online_provider, instructions: orgPayment.instructions
      } : null,
      charges: (function(){ var t = sel.debtorIds.length ? resolveTerms(sel.debtorIds[0], null) : null; return t && t.ok ? { rate_pa: t.cfg.interest_enabled ? Number(t.cfg.rate_pa) : 0, method: t.cfg.method, grace_days: t.cfg.grace_days } : null; })()
    };
    m.reference = paymentReference(m);
    return m;
  }

  /* ---------- renderer (shared by preview, print and saved statements) ---------- */
  function renderStatementDoc(m, t, orgName){
    t = normaliseTpl(t);
    var c = t.colors, cols = t.columns, sec = t.sections;
    var pad = { compact: '4px 7px', regular: '7px 9px', roomy: '10px 11px' }[t.density];
    var gapTxt = { compact: '8px', regular: '14px', roomy: '22px' }[t.density] || '14px', notePad = { compact: '0 7px 4px', regular: '1px 9px 8px', roomy: '3px 11px 12px' }[t.density] || '1px 9px 8px';
    var hasCharges = !!m.charges || m.items.some(function(i){ return i.interest || i.fees; });
    var showPay = !!(m.payment && m.payment.online_provider && m.payment.online_provider !== 'none') && m.items.some(function(i){ return i.pay_url; });
    var refMap = new Map(), refN = 0;
    if(t.desc_mode === 'short_details' && (t.columns || {}).description) m.items.forEach(function(i){ if(itemDesc(i, t).shortened) refMap.set(i, ++refN); });
    var colDefs = [
      ['invoice', 'Invoice', function(i){ return '<b class="nw">'+escapeHtml(i.invoice_number || '—')+'</b>' + (m.multi ? '<div class="sd-sub">'+escapeHtml(i.debtor_name || '')+'</div>' : ''); }],
      ['description', 'Description', function(i){ var dd = itemDesc(i, t), n = refMap.get(i); return '<span'+(dd.shortened ? ' title="'+escapeHtml(dd.full)+'"' : '')+'>'+escapeHtml(dd.text)+'</span>'+(n ? '<sup class="sd-ref">'+n+'</sup>' : ''); }, 'sd-desc'],
      ['issued', 'Issued', function(i){ return escapeHtml(fmt(i.issued_date)); }, 'nw'],
      ['due', 'Due', function(i){ return escapeHtml(fmt(i.due_date)); }, 'nw'],
      ['days_overdue', 'Days overdue', function(i){ return i.fullyPaid || i.daysOverdue <= 0 ? '<span class="sd-muted">—</span>' : '<b class="sd-od">'+i.daysOverdue+'</b>'; }, 'num'],
      ['amount', 'Amount', function(i){ return money(i.amount); }, 'num'],
      ['paid', 'Paid', function(i){ return i.paid ? money(i.paid) : '<span class="sd-muted">—</span>'; }, 'num'],
      ['interest', 'Interest', function(i){ return i.interest ? money(i.interest) : '<span class="sd-muted">—</span>'; }, 'num', !hasCharges],
      ['fees', 'Fees', function(i){ return i.fees ? '<span title="'+escapeHtml(i.feeLines.map(function(f){ return f.name+' '+money(f.amount); }).join(', '))+'">'+money(i.fees)+'</span>' : '<span class="sd-muted">—</span>'; }, 'num', !hasCharges],
      ['balance', 'Balance', function(i){ return '<b>'+money(r2(i.balance + i.interest + i.fees))+'</b>'; }, 'num'],
      ['status', 'Status', function(i){ return '<span class="sd-st sd-st-'+i.status.toLowerCase().replace(/ /g, '-')+'">'+escapeHtml(i.status)+'</span>'; }],
      ['pay_link', 'Pay', function(i){ return i.pay_url && !i.fullyPaid && !i.disputed ? '<a href="'+escapeHtml(i.pay_url)+'" target="_blank" rel="noopener">Pay online</a>' : ''; }, '', !showPay]
    ].filter(function(d){ return cols[d[0]] && !d[4] && !(d[0] === 'description' && t.desc_mode === 'below'); });
    var ncol = colDefs.length;
    var S = '.sd';
    var css = '<style>'
      + S+'{font-family:'+fontCss(t.font)+';font-size:'+t.font_size+'px;line-height:1.5;color:'+c.text+';background:#fff;padding:30px 34px;}'
      + S+' h1,'+S+' h2,'+S+' .sd-name{font-family:'+fontCss(t.heading_font)+';color:'+c.heading+';margin:0;}'
      + S+' h1{font-size:1.75em;letter-spacing:-.01em;}'+S+' h2{font-size:1.05em;margin:18px 0 8px;}'
      + S+' .sd-name{font-size:1.25em;font-weight:700;}'
      + S+' .sd-muted,'+S+' .sd-sub{color:'+c.muted+';}'+S+' .sd-sub{font-size:.85em;}'
      + S+' .sd-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px;}'
      + S+' .sd-head.right{flex-direction:row-reverse;}'+S+' .sd-head.right .sd-meta{text-align:left;}'
      + S+' .sd-head.centred{flex-direction:column;align-items:center;text-align:center;}'+S+' .sd-head.centred .sd-meta{text-align:center;}'
      + S+' .sd-band{background:'+c.accent+';color:'+c.band_text+';margin:-30px -34px 22px;padding:22px 34px;}'
      + S+' .sd-band h1,'+S+' .sd-band .sd-name,'+S+' .sd-band .sd-muted{color:'+c.band_text+';}'
      + S+' .sd-logo{max-height:'+t.logo_height+'px;max-width:220px;display:block;margin-bottom:6px;}'
      + S+' .sd-head.centred .sd-logo{margin:0 auto 6px;}'
      + S+' .sd-from{white-space:pre-line;font-size:.88em;}'
      + S+' .sd-meta{text-align:right;font-size:.92em;}'+S+' .sd-meta b{color:'+c.heading+';}'
      + S+' .sd-band .sd-meta b{color:'+c.band_text+';}'
      + S+' .sd-summary{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 16px;}'
      + S+' .sd-box{flex:1 1 120px;border:1px solid '+c.border+';border-radius:8px;padding:9px 12px;}'
      + S+' .sd-box .k{font-size:.78em;text-transform:uppercase;letter-spacing:.05em;color:'+c.muted+';}'
      + S+' .sd-box .v{font-size:1.25em;font-weight:700;font-variant-numeric:tabular-nums;}'
      + S+' .sd-box.main{border-color:'+c.accent+';border-width:2px;}'+S+' .sd-box.main .v{color:'+c.accent+';font-size:1.45em;}'
      + S+' .sd-cover{margin:0 0 '+gapTxt+';white-space:pre-line;line-height:'+(t.density === 'compact' ? 1.4 : t.density === 'roomy' ? 1.7 : 1.55)+';}'
      + S+' table.sd-t{width:100%;border-collapse:collapse;margin:4px 0 6px;}'
      + S+' .sd-t th{background:'+(t.table_style === 'minimal' ? 'transparent' : c.th_bg)+';color:'+c.th_text+';text-align:left;font-size:.8em;text-transform:uppercase;letter-spacing:.04em;padding:'+pad+';font-weight:700;}'
      + S+' .sd-t td{padding:'+pad+';vertical-align:top;}'+S+' .sd-t th{white-space:normal;vertical-align:bottom;line-height:1.25;}'
      + S+' .sd-t .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}'+S+' .nw{white-space:nowrap;}'
      + (t.table_style === 'lined' ? S+' .sd-t th{border-bottom:2px solid '+c.accent+';}'+S+' .sd-t tr.sd-end td{border-bottom:1px solid '+c.border+';}' : '')
      + (t.table_style === 'striped' ? S+' .sd-t tr.alt td{background:'+c.stripe+';}' : '')
      + (t.table_style === 'boxed' ? S+' .sd-t th,'+S+' .sd-t td{border:1px solid '+c.border+';}'+S+' .sd-t tr.sd-has-note td{border-bottom:none;}'+S+' .sd-t tr.sd-note td{border-top:none;}' : '')
      + (t.table_style === 'minimal' ? S+' .sd-t th{border-bottom:1px solid '+c.border+';}' : '')
      + S+' .sd-t tr.sd-note td{padding:'+notePad+';font-size:.88em;color:'+c.muted+';line-height:'+(t.density === 'roomy' ? 1.6 : 1.45)+';}'
      + S+' .sd-t tr.sd-fulldesc td .sd-fd{white-space:pre-line;color:'+c.text+';font-size:.95em;padding-left:2px;}'
      + S+' .sd-t tr.sd-grp td{padding:12px 0 5px;font-weight:800;color:'+c.heading+';border-bottom:2px solid '+c.accent+';background:transparent;}'
      + S+' .sd-t tr.sd-grp td span.sd-grp-amt{float:right;font-variant-numeric:tabular-nums;}'
      + S+' .sd-ref{color:'+c.accent+';font-weight:700;margin-left:2px;}'+S+' .sd-t .sd-desc{min-width:90px;}'
      + S+' .sd-det{display:grid;grid-template-columns:110px 1fr;gap:10px;font-size:.9em;padding:6px 0;border-bottom:1px solid '+c.border+';page-break-inside:avoid;}'
      + S+' .sd-det .k{font-weight:700;color:'+c.heading+';}'+S+' .sd-det .k sup{color:'+c.accent+';}'+S+' .sd-det .v{white-space:pre-line;}'
      + S+' .sd-t tr.sd-note td span{display:block;border-left:3px solid '+c.accent+';padding:1px 0 1px 8px;font-style:italic;}'
      + S+' .sd-od{color:'+c.overdue+';}'
      + S+' .sd-st{font-size:.85em;font-weight:700;white-space:nowrap;}'
      + S+' .sd-st-overdue{color:'+c.overdue+';}'+S+' .sd-st-paid{color:'+c.paid+';}'+S+' .sd-st-disputed{color:'+c.disputed+';}'+S+' .sd-st-due-today{color:'+c.overdue+';}'
      + S+' .sd-t a{color:'+c.accent+';font-weight:600;white-space:nowrap;}'
      + S+' .sd-tot{margin-left:auto;width:min(340px,100%);border-collapse:collapse;}'
      + S+' .sd-tot td{padding:4px 0;}'+S+' .sd-tot td:last-child{text-align:right;font-variant-numeric:tabular-nums;}'
      + S+' .sd-tot tr.due td{border-top:2px solid '+c.accent+';font-weight:800;font-size:1.15em;color:'+c.heading+';padding-top:8px;}'
      + S+' .sd-age{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid '+c.border+';border-radius:8px;overflow:hidden;margin-top:6px;}'
      + S+' .sd-age > div{padding:7px 10px;border-right:1px solid '+c.border+';}'+S+' .sd-age > div:last-child{border-right:none;}'
      + S+' .sd-age .k{font-size:.76em;color:'+c.muted+';text-transform:uppercase;letter-spacing:.04em;}'+S+' .sd-age .v{font-weight:700;font-variant-numeric:tabular-nums;}'
      + S+' .sd-pay{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;}'
      + S+' .sd-pay > div{border:1px solid '+c.border+';border-radius:8px;padding:10px 12px;}'
      + S+' .sd-pay .k{font-size:.78em;text-transform:uppercase;letter-spacing:.05em;color:'+c.accent+';font-weight:700;margin-bottom:3px;}'
      + S+' .sd-pay dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:1px 10px;}'+S+' .sd-pay dt{color:'+c.muted+';}'+S+' .sd-pay dd{margin:0;font-weight:600;}'
      + S+' .sd-sign{margin-top:20px;}'+S+' .sd-to{font-size:.92em;color:'+c.muted+';margin-top:2px;line-height:1.4;}'
      + S+' .sd-big{display:flex;justify-content:space-between;align-items:center;gap:16px;border:2px solid '+c.accent+';border-radius:8px;padding:12px 16px;margin:6px 0 16px;}'
      + S+' .sd-big .k{font-size:.8em;text-transform:uppercase;letter-spacing:.05em;color:'+c.muted+';}'+S+' .sd-big .v{font-size:1.9em;font-weight:800;color:'+c.accent+';font-variant-numeric:tabular-nums;}'
      + S+' .sd-big .s{font-size:.9em;color:'+c.muted+';text-align:right;}'
      + S+' .sd-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));border-top:2px solid '+c.accent+';border-bottom:1px solid '+c.border+';margin:6px 0 16px;}'
      + S+' .sd-strip > div{padding:8px 10px;border-right:1px solid '+c.border+';}'+S+' .sd-strip > div:last-child{border-right:none;}'
      + S+' .sd-strip .k{font-size:.74em;text-transform:uppercase;letter-spacing:.04em;color:'+c.muted+';}'+S+' .sd-strip .v{font-weight:700;font-variant-numeric:tabular-nums;}'+S+' .sd-strip .main .v{color:'+c.accent+';font-size:1.15em;}'
      + S+' .sd-foot{margin-top:18px;padding-top:10px;border-top:1px solid '+c.border+';font-size:.8em;color:'+c.muted+';white-space:pre-line;}'
      + S+' .sd-slip{margin-top:22px;border-top:2px dashed '+c.muted+';padding-top:12px;font-size:.9em;}'
      + S+' .sd-slip .row{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 20px;}'
      + S+' .sd-slip .line{border-bottom:1px solid '+c.muted+';min-width:120px;display:inline-block;}'
      + '@media print{'+S+'{padding:0;}'+S+' .sd-band{margin:0 0 22px;padding:18px 20px;}'+S+' tr,'+S+' .sd-pay,'+S+' .sd-age,'+S+' .sd-tot,'+S+' .sd-slip,'+S+' .sd-summary{page-break-inside:avoid;}'+S+' h2{page-break-after:avoid;}}'
      + '</style>';

    var lgo = effectiveLogo(t), fromTxt = t.from_lines || orgFromLines();
    var logo = lgo ? '<img class="sd-logo" src="'+lgo+'" alt="" />' : '';
    var who = '<div>'+logo+'<div class="sd-name">'+escapeHtml(orgName)+'</div>'+(fromTxt ? '<div class="sd-from sd-muted">'+escapeHtml(fromTxt)+'</div>' : '')+'</div>';
    var meta = '<div class="sd-meta"><h1>'+escapeHtml(t.title || 'Account Statement')+'</h1>'
      + '<div>Statement date: <b>'+escapeHtml(fmt(m.date))+'</b></div>'
      + '<div>Statement no: <b>'+escapeHtml(m.number || '—')+'</b></div>'
      + '<div>To: <b>'+escapeHtml(m.recipient || '—')+'</b>'+(t.show_to_details !== false && (m.recipient_lines || []).length ? '<div class="sd-to">'+m.recipient_lines.map(escapeHtml).join('<br>')+'</div>' : '')+'</div></div>';
    var headCls = t.header_style === 'centred' ? 'centred' : (t.logo_position === 'right' ? 'right' : '');
    var head = '<div class="sd-head '+headCls+'">'+who+meta+'</div>';
    if(t.header_style === 'band') head = '<div class="sd-band">'+head+'</div>';

    var T = m.totals;
    var stmtFeeTotal = (T.statement_fees || []).reduce(function(s, f){ return s + f.amount; }, 0);
    var sepUp = T.upcoming && m.upcoming_mode === 'separate', A0 = m.ageing || {};
    var oldestDays = m.items.filter(function(i){ return !i.fullyPaid && !i.disputed && i.daysOverdue > 0; }).reduce(function(mx, i){ return Math.max(mx, i.daysOverdue); }, 0);
    var headline = sepUp ? ['Pay now', T.pay_now] : ['Amount due', T.due];
    var box = function(k, v, main){ return '<div class="sd-box'+(main ? ' main' : '')+'"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>'; };
    var cell = function(k, v, main){ return '<div'+(main ? ' class="main"' : '')+'><div class="k">'+k+'</div><div class="v">'+v+'</div></div>'; };
    var summary = '';
    if(sec.summary){
      var style = t.summary_style || 'boxes';
      if(style === 'boxes') summary = '<div class="sd-summary">'
        + box(headline[0], money(headline[1]), true) + (sepUp ? box('Not yet due', money(T.upcoming)) : '')
        + box('Overdue', money(T.overdue))
        + ((T.interest + T.fees + stmtFeeTotal) > 0 ? box('Interest &amp; fees', money(T.interest + T.fees + stmtFeeTotal)) : '')
        + (T.disputed > 0 ? box('Disputed, on hold', money(T.disputed)) : '') + '</div>';
      else if(style === 'headline') summary = '<div class="sd-big"><div><div class="k">'+headline[0]+'</div><div class="v">'+money(headline[1])+'</div></div>'
        + '<div class="s">'+(oldestDays ? 'Oldest invoice '+oldestDays+' days overdue' : 'Nothing overdue')+(sepUp ? '<br>'+money(T.upcoming)+' not yet due' : '')+'<br>Reference '+escapeHtml(m.reference || '')+'</div></div>';
      else if(style === 'breakdown') summary = '<div class="sd-strip">' + cell('Invoices owing', money(T.balance))
        + ((T.interest + T.fees + stmtFeeTotal) > 0 ? cell('Interest &amp; fees', money(T.interest + T.fees + stmtFeeTotal)) : '')
        + cell('Overdue', money(T.overdue)) + (sepUp ? cell('Not yet due', money(T.upcoming)) : '')
        + (T.disputed > 0 ? cell('On hold', money(T.disputed)) : '') + cell(headline[0], money(headline[1]), true) + '</div>';
      else if(style === 'ageing') summary = '<div class="sd-strip">' + cell('Current', money(A0.current || 0)) + cell('1–30 days', money(A0.d1_30 || 0))
        + cell('31–60 days', money(A0.d31_60 || 0)) + cell('61–90 days', money(A0.d61_90 || 0)) + cell('90+ days', money(A0.d90 || 0)) + cell(headline[0], money(headline[1]), true) + '</div>';
    }
    var coverText = [t.intro, m.cover].filter(function(x){ return x && x.trim(); }).join('\n\n');
    var cover = sec.cover && coverText ? '<div class="sd-cover">'+escapeHtml(coverText)+'</div>' : '';

    var rowHtml = function(list){ return list.map(function(i, idx){
      var alt = idx % 2 ? ' alt' : '';
      var hasNote = sec.line_notes && i.note;
      var dd = itemDesc(i, t), showFull = dd.full && (t.desc_mode === 'below' || (t.desc_mode === 'short_below' && (dd.shortened || !(t.columns || {}).description)));
      var tr = '<tr class="'+(hasNote || showFull ? 'sd-has-note' : 'sd-end')+alt+'">' + colDefs.map(function(d){ return '<td class="'+(d[3] || '')+'">'+d[2](i)+'</td>'; }).join('') + '</tr>';
      if(showFull) tr += '<tr class="sd-note sd-fulldesc'+(hasNote ? ' sd-has-note' : ' sd-end')+alt+'"><td colspan="'+ncol+'"><div class="sd-fd">'+escapeHtml(dd.full)+'</div></td></tr>';
      if(hasNote) tr += '<tr class="sd-note sd-end'+alt+'"><td colspan="'+ncol+'"><span>'+escapeHtml(i.note)+'</span></td></tr>';
      return tr;
    }).join(''); };
    var upList = m.items.filter(function(i){ return i.notDue; }), nowList = m.items.filter(function(i){ return !i.notDue; });
    var grpTot = function(list){ return money(r2(list.filter(function(i){ return !i.fullyPaid && !i.disputed; }).reduce(function(s, i){ return s + i.balance + i.interest + i.fees; }, 0))); };
    var grpHead = function(label, list){ return '<tr class="sd-grp"><td colspan="'+ncol+'"><span>'+label+'</span><span class="sd-grp-amt">'+grpTot(list)+'</span></td></tr>'; };
    var rows = m.upcoming_mode === 'separate' && upList.length && nowList.length
      ? grpHead('Overdue and due now', nowList) + rowHtml(nowList) + grpHead('Not yet due', upList) + rowHtml(upList)
      : rowHtml(m.items);
    var table = '<table class="sd-t"><thead><tr>'+colDefs.map(function(d){ return '<th class="'+(d[3] || '')+'">'+escapeHtml(d[1])+'</th>'; }).join('')+'</tr></thead><tbody>'+rows+'</tbody></table>';

    var tot = '<table class="sd-tot"><tbody>'
      + '<tr><td>Invoices owing</td><td>'+money(T.balance)+'</td></tr>'
      + (T.interest ? '<tr><td>Interest'+(m.charges && m.charges.rate_pa ? ' ('+r2(m.charges.rate_pa * 100)+'% p.a.)' : '')+'</td><td>'+money(T.interest)+'</td></tr>' : '')
      + (T.fees ? '<tr><td>Fees</td><td>'+money(T.fees)+'</td></tr>' : '')
      + (T.statement_fees || []).map(function(f){ return '<tr><td>'+escapeHtml(f.name)+'</td><td>'+money(f.amount)+'</td></tr>'; }).join('')
      + (T.upcoming && m.upcoming_mode === 'separate'
          ? '<tr class="due"><td>Pay now</td><td>'+money(T.pay_now)+'</td></tr><tr><td>Not yet due</td><td>'+money(T.upcoming)+'</td></tr><tr><td><b>Total balance</b></td><td><b>'+money(T.due)+'</b></td></tr>'
          : '<tr class="due"><td>Amount due</td><td>'+money(T.due)+'</td></tr>')
      + (T.disputed ? '<tr><td class="sd-muted">Disputed, not requested while under review</td><td class="sd-muted">'+money(T.disputed)+'</td></tr>' : '')
      + '</tbody></table>';

    var A = m.ageing || {};
    var ageing = sec.ageing ? '<h2>Ageing</h2><div class="sd-age">'
      + [['Current', A.current], ['1–30 days', A.d1_30], ['31–60 days', A.d31_60], ['61–90 days', A.d61_90], ['90+ days', A.d90]].map(function(a){
          return '<div><div class="k">'+a[0]+'</div><div class="v">'+money(a[1] || 0)+'</div></div>'; }).join('') + '</div>' : '';

    var P = m.payment, pay = '';
    if(sec.payment && P){
      var blocks = [];
      if(P.show_bank && P.bsb && P.account_number) blocks.push('<div><div class="k">Bank transfer</div><dl>'
        + '<dt>Account name</dt><dd>'+escapeHtml(P.account_name || '')+'</dd>'
        + '<dt>BSB</dt><dd>'+escapeHtml(P.bsb)+'</dd><dt>Account</dt><dd>'+escapeHtml(P.account_number)+'</dd>'
        + (P.bank_name ? '<dt>Bank</dt><dd>'+escapeHtml(P.bank_name)+'</dd>' : '')
        + '<dt>Reference</dt><dd>'+escapeHtml(m.reference)+'</dd></dl></div>');
      if(P.show_payid && P.payid) blocks.push('<div><div class="k">PayID</div><dl>'
        + '<dt>'+escapeHtml({ email:'Email', phone:'Mobile', abn:'ABN', org_id:'Org ID' }[P.payid_type] || 'PayID')+'</dt><dd>'+escapeHtml(P.payid)+'</dd>'
        + '<dt>Name</dt><dd>'+escapeHtml(P.account_name || '')+'</dd><dt>Reference</dt><dd>'+escapeHtml(m.reference)+'</dd></dl></div>');
      if(P.show_bpay && P.bpay_biller_code) blocks.push('<div><div class="k">BPAY</div><dl>'
        + '<dt>Biller code</dt><dd>'+escapeHtml(P.bpay_biller_code)+'</dd><dt>Ref</dt><dd>'+escapeHtml(m.reference)+'</dd></dl></div>');
      if(showPay) blocks.push('<div><div class="k">Pay online</div>Use the <b>Pay online</b> link next to each invoice.</div>');
      if(blocks.length || P.instructions) pay = '<h2>How to pay</h2><div class="sd-pay">'+blocks.join('')+'</div>'
        + (P.instructions ? '<div class="sd-muted" style="margin-top:8px;white-space:pre-line;">'+escapeHtml(P.instructions)+'</div>' : '');
    }
    var late = sec.late_rate && m.late ? '<div class="sd-muted" style="margin-top:12px;font-size:.88em;">Payment history (rolling 3 months): '+m.late.lateCount+' of '+m.late.total+' invoices paid after their due date ('+(m.late.total ? Math.round(m.late.lateCount / m.late.total * 100) : 0)+'%).</div>' : '';
    var sign = '<div class="sd-sign">Regards,<br><b>'+escapeHtml(t.sign_off || 'Accounts team')+'</b><br>'+escapeHtml(orgName)+'</div>';
    var foot = t.footer ? '<div class="sd-foot">'+escapeHtml(t.footer)+'</div>' : '';
    var slip = sec.remittance ? '<div class="sd-slip"><b>✂ Remittance advice</b> <span class="sd-muted">— please return with your payment</span><div class="row" style="margin-top:8px;">'
      + '<div>To: <b>'+escapeHtml(orgName)+'</b></div><div>From: <b>'+escapeHtml(m.recipient || '')+'</b></div>'
      + '<div>Statement no: <b>'+escapeHtml(m.number || '')+'</b></div><div>Amount due: <b>'+money(T.due)+'</b></div>'
      + '<div>Reference: <b>'+escapeHtml(m.reference || '')+'</b></div><div>Amount paid: <span class="line">&nbsp;</span></div>'
      + '<div>Date paid: <span class="line">&nbsp;</span></div></div></div>' : '';
    var details = refN ? '<h2>Invoice details</h2><div class="sd-details">' + m.items.filter(function(i){ return refMap.has(i); }).map(function(i){
        return '<div class="sd-det"><div class="k"><sup>'+refMap.get(i)+'</sup> '+escapeHtml(i.invoice_number || '')+'</div><div class="v">'+escapeHtml(String(i.description || '').trim())+'</div></div>'; }).join('') + '</div>' : '';
    var TX = m.texts || {}, txt = function(k){ return TX[k] ? '<div class="sd-cover">' + escapeHtml(TX[k]) + '</div>' : ''; };
    if(TX.pay_note && pay) pay += '<div class="sd-cover" style="margin-top:8px;">' + escapeHtml(TX.pay_note) + '</div>';
    return css + '<div class="sd">' + head + summary + cover + table + tot + txt('after_totals') + details + ageing + pay + late + txt('closing') + sign + foot + slip + '</div>';
  }

  // Keep the invoice table inside the page: if it is wider than the paper, shrink its text a little at a time.
  function fitStatementTable(root){
    var sd = root && root.querySelector('.sd'); if(!sd) return;
    var cs = getComputedStyle(sd), avail = sd.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    sd.querySelectorAll('table.sd-t').forEach(function(t){
      t.style.fontSize = ''; var fs = 100;
      while(t.scrollWidth > avail + 1 && fs > 66){ fs -= 4; t.style.fontSize = fs + '%'; }
    });
  }
  // On screen: lay the statement out at A4 width (794px) and scale it to the column, so the preview matches the PDF.
  function fitStatementPreview(paper){
    var sd = paper && paper.querySelector('.sd'); if(!sd) return;
    sd.style.zoom = ''; sd.style.width = '794px'; sd.style.boxSizing = 'border-box';
    fitStatementTable(paper);
    var w = paper.clientWidth; if(w > 0 && w < 794) sd.style.zoom = String(Math.max(0.35, w / 794));
  }
  window.addEventListener('resize', function(){ var p = document.getElementById('statementPaper'); if(p && p.offsetParent) fitStatementPreview(p); });
  /* ---------- preview, notes, save, print ---------- */
  function renderLineNoteEditors(sel){
    var key = sel.items.map(function(i){ return i.id; }).join(',');
    if(key === lastLineNoteKey) return;
    lastLineNoteKey = key;
    var box = document.getElementById('stmtLineNotesBox');
    var todayD = todayISO();
    box.innerHTML = sel.items.length ? sel.items.map(function(i){
      var n = stmtNotesByInvoice[i.id], bal = i.fullyPaid ? 0 : r2(Math.max(0, i.amount - (i.paid || 0)));
      var due = String(i.due_date || '').slice(0, 10), late = due && due < todayD ? i.daysOverdue + ' days overdue' : (due === todayD ? 'Due today' : (due ? 'Not yet due' : ''));
      var desc = String(i.description || '').trim();
      return '<div class="ln-row">'
        + '<div class="ln-head"><b>'+escapeHtml(i.invoice_number || '—')+'</b><span class="ln-amt">'+money(bal)+'</span>'
        + '<span class="ln-meta">Due '+escapeHtml(fmt(i.due_date))+(late ? ' · <span class="'+(due < todayD ? 'ln-od' : '')+'">'+late+'</span>' : '')+'</span>'
        + (n ? '<span class="ln-cat">'+escapeHtml(NOTE_CATEGORY_LABEL[n.category] || 'Email note')+'</span>' : '') + '</div>'
        + (desc ? '<div class="ln-desc" title="'+escapeHtml(desc)+'">'+escapeHtml(desc)+'</div>' : '')
        + (n ? '<div class="ln-email">From email: '+escapeHtml(String(n.summary || '').slice(0, 220))+'</div>' : '')
        + '<div class="ln-lab"><span class="ln-lab-row"><label for="ln-'+escapeHtml(i.id)+'">Note under this invoice</label><button type="button" class="ln-clear" data-ln-clear="'+escapeHtml(i.id)+'" title="Remove this note"'+(stmtLineNotes[i.id] ? '' : ' hidden')+'>Remove</button></span><textarea id="ln-'+escapeHtml(i.id)+'" data-ins-label="Note under '+escapeHtml(i.invoice_number || 'this invoice')+'" rows="2" maxlength="240" data-line-note="'+escapeHtml(i.id)+'" placeholder="e.g. Stage 2 kitchen cabinetry, installed 14 Oct">'+escapeHtml(stmtLineNotes[i.id] || '')+'</textarea></div>'
        + (desc.length > 40 ? '<label class="ln-lab">Short description for the table<input type="text" class="desc-short" maxlength="120" data-desc-short="'+escapeHtml(i.id)+'" value="'+escapeHtml(stmtDescOverride[i.id] || '')+'" placeholder="'+escapeHtml(shortDesc(desc, 60))+'" /></label>' : '')
        + '</div>';
    }).join('') : '<div class="empty-note">Select invoices to add notes.</div>';
  }
  document.getElementById('stmtLineNotesBox').addEventListener('input', function(e){
    var ds = e.target.getAttribute('data-desc-short'); if(ds){ stmtDescOverride[ds] = e.target.value; schedulePreview(); return; }
    var id = e.target.getAttribute('data-line-note'); if(!id) return;
    stmtLineNotes[id] = e.target.value; schedulePreview();
    var cb = e.target.parentNode.querySelector('.ln-clear'); if(cb) cb.hidden = !e.target.value;
  });
  document.getElementById('stmtLineNotesBox').addEventListener('click', function(e){
    var b = e.target.closest('[data-ln-clear]'); if(!b) return;
    var id = b.getAttribute('data-ln-clear'), ta = document.getElementById('ln-' + id), old = stmtLineNotes[id] || '';
    stmtLineNotes[id] = ''; if(ta) ta.value = ''; b.hidden = true; schedulePreview();
    toastUndo('Note removed.', function(){ stmtLineNotes[id] = old; if(ta) ta.value = old; b.hidden = !old; schedulePreview(); });
  });
  function renderStatementWarnings(m){
    var w = [];
    if(bankChangedRecently()) w.push({ level: 'stop', message: 'Your bank details were changed ' + fmtDateTime(orgPayment.bank_changed_at) + '. Check with the owner that this was them before sending any statement.' });
    if(stmtTplSettings && stmtTplSettings.sections.payment && !(orgPayment && ((orgPayment.show_bank && orgPayment.bsb) || (orgPayment.show_payid && orgPayment.payid) || (orgPayment.show_bpay && orgPayment.bpay_biller_code))))
      w.push({ level: 'info', message: 'No payment details on this statement yet. Add your BSB and account number under Payment Portal.' });
    if(m && m.totals.disputed) w.push({ level: 'caution', message: 'Disputed invoices are shown but left out of the amount due, with no interest or fees.' });
    renderFlags(document.getElementById('stmtWarn'), w);
  }
  function maybeFetchPayLinks(m){
    if(!orgPayment || orgPayment.online_provider !== 'xero' || !xeroConnected) return;
    var want = m.items.filter(function(i){ return !i.fullyPaid && !i.pay_url && !stmtPayLinksAsked[i.id]; }).map(function(i){ return i.id; });
    want = want.filter(function(id){ var inv = stmtInvoices.filter(function(x){ return x.id === id; })[0]; return inv && inv.source === 'xero'; });
    if(!want.length) return;
    want.forEach(function(id){ stmtPayLinksAsked[id] = true; });
    invokeFn('pay-links', { org_id: currentOrg.id, invoice_ids: want }).then(function(d){
      if(d && d.links){ Object.keys(d.links).forEach(function(k){ if(d.links[k]) stmtPayLinks[k] = d.links[k]; }); schedulePreview(); }
      else if(d && d.error) toast('Pay online links: ' + d.error);
    });
  }
  function renderStatementPreview(){
    var sel = selectedStatementItems();
    var recipEl = document.getElementById('stmtRecipientName');
    if(!recipEl.dataset.manual){
      var names = sel.debtorIds.map(function(id){ var d = stmtDebtors.filter(function(x){ return x.id===id; })[0]; return d ? d.name : ''; }).filter(Boolean);
      recipEl.value = names.join(' + ');
    }
    ['stmtSaveBtn','stmtAiNotesBtn','stmtPrintBtn'].forEach(function(id){ document.getElementById(id).disabled = sel.items.length === 0; });
    document.getElementById('stmtSelectionSummary').textContent = sel.debtorIds.length
      ? sel.debtorIds.length+' contact'+(sel.debtorIds.length===1?'':'s')+' merged · '+sel.items.length+' invoice'+(sel.items.length===1?'':'s')+' selected'
      : 'No contacts selected yet.';
    renderLineNoteEditors(sel);
    setHistoryDebtors('stmt', acctFocus ? acctIds() : sel.debtorIds);
    stmtViewingSavedId = null;
    var paper = document.getElementById('statementPaper');
    paper.className = 'statement-paper';
    if(!stmtTplSettings) stmtTplSettings = normaliseTpl({});
    if(!sel.items.length){
      renderStmtSelection(sel, null);
      renderStatementWarnings(null);
      if(stmtTab === 'templates'){
        paper.innerHTML = renderStatementDoc(sampleStatementModel(), stmtTplSettings, currentOrg.name); fitStatementPreview(paper);
        renderFlags(document.getElementById('stmtWarn'), [{ level: 'info', message: 'Showing sample data. Select contacts in the Contacts tab to preview a real statement with this template.' }]);
      } else paper.innerHTML = '<div class="empty-note">Select one or more contacts in the Contacts tab, and the invoices to include, to build a statement.</div>';
      return;
    }
    var m = buildStatementModel();
    renderStmtSelection(sel, m);
    renderStatementWarnings(m);
    paper.innerHTML = renderStatementDoc(m, stmtTplSettings, currentOrg.name); fitStatementPreview(paper);
    maybeFetchPayLinks(m);
  }
  document.getElementById('stmtRecipientName').addEventListener('input', function(){ this.dataset.manual = '1'; schedulePreview(); });
  document.getElementById('stmtNotes').addEventListener('input', schedulePreview);
  var stmtTxtOn = { cover: false, after_totals: false, pay_note: false, closing: false };
  function setStmtTxt(k, on){
    stmtTxtOn[k] = !!on;
    var box = document.querySelector('[data-txt-sec="' + k + '"]'); if(!box) return;
    box.querySelector('[data-ts-on]').checked = !!on; box.classList.toggle('on', !!on);
    var ta = box.querySelector('textarea'); ta.hidden = !on; syncTxtClear(ta);
    schedulePreview();
  }
  document.querySelectorAll('[data-ts-on]').forEach(function(cb){ cb.addEventListener('change', function(){ setStmtTxt(cb.getAttribute('data-ts-on'), cb.checked); if(cb.checked) cb.closest('.txt-sec').querySelector('textarea').focus(); }); });
  var stmtTxtMaster = true;
  function stmtTxtBoxes(){ return [document.getElementById('stmtNotes')].concat(Array.prototype.slice.call(document.querySelectorAll('textarea[data-ts]'))); }
  function syncTxtClear(ta){ var sec = ta.closest('.txt-sec'), b = sec && sec.querySelector('[data-ts-clear]'); if(b) b.hidden = !ta.value || ta.hidden; }
  stmtTxtBoxes().forEach(function(ta){ ta.addEventListener('input', function(){ schedulePreview(); syncTxtClear(ta); }); });
  document.getElementById('stmtTxtMaster').addEventListener('change', function(){ stmtTxtMaster = this.checked; document.getElementById('stmtTxtSecs').hidden = !this.checked; schedulePreview(); });
  document.getElementById('stmtTxtSecs').addEventListener('click', function(e){
    var b = e.target.closest('[data-ts-clear]'); if(!b) return;
    var k = b.getAttribute('data-ts-clear'), ta = k === 'cover' ? document.getElementById('stmtNotes') : document.getElementById('stmtTxt-' + k), old = ta.value;
    ta.value = ''; syncTxtClear(ta); schedulePreview();
    toastUndo('Text removed.', function(){ ta.value = old; syncTxtClear(ta); schedulePreview(); });
  });
  document.getElementById('stmtAiNotesBtn').addEventListener('click', async function(){
    var sel = selectedStatementItems(); if(!sel.items.length) return;
    var btn = this; btn.disabled = true; btn.textContent = 'Drafting…';
    try{
      var d = await invokeFn('draft-correspondence', { kind: 'statement', debtor_ids: sel.debtorIds, invoice_ids: sel.items.map(function(i){ return i.id; }) });
      renderFlags(document.getElementById('stmtFlags'), d.flags || []);
      if(!d.ok || !d.draft){ toast(d.error || 'AI notes failed.'); return; }
      var byNumber = {};
      (d.draft.line_notes || []).forEach(function(n){ if(n && n.invoice_number) byNumber[String(n.invoice_number).trim()] = String(n.note || '').trim(); });
      sel.items.forEach(function(i){ if(byNumber.hasOwnProperty(i.invoice_number)) stmtLineNotes[i.id] = byNumber[i.invoice_number]; });
      if(typeof d.draft.message === 'string'){ document.getElementById('stmtNotes').value = d.draft.message; if(d.draft.message.trim()) setStmtTxt('cover', true); }
      if(d.draft.internal_summary) renderFlags(document.getElementById('stmtFlags'), (d.flags || []).concat([{ level:'info', message:'For staff: ' + d.draft.internal_summary }]));
      lastLineNoteKey = '';
      renderStatementPreview();
      toast('AI notes drafted on each invoice. Check them before saving or printing.');
    } finally { btn.disabled = selectedStatementItems().items.length === 0; btn.innerHTML = AI_MARK + 'Draft notes with DebtJet AI'; }
  });
  async function confirmBankSafety(action){
    if(!bankChangedRecently()) return true;
    return await djAsk('Your bank details were changed ' + fmtDateTime(orgPayment.bank_changed_at) + '.\n\nHave you confirmed with the owner that this change is genuine? Choose OK to ' + action + ' anyway.');
  }
  // Saves the statement on screen. Returns the saved row (or null). Reuses the last save when nothing has changed.
  async function saveCurrentStatement(skipConfirm){
    var sel = selectedStatementItems(); if(!sel.items.length) return null;
    if(!skipConfirm && !await confirmBankSafety('save')) return null;
    var m = buildStatementModel();
    var key = sel.debtorIds.slice().sort().join(',') + '|' + sel.items.map(function(i){ return i.id || i.invoice_number; }).sort().join(',') + '|' + m.totals.due + '|' + (m.cover || '');
    if(stmtLastSave && stmtLastSave.key === key){ var prev = savedStatements.filter(function(x){ return x.id === stmtLastSave.id; })[0]; if(prev) return prev; }
    var recipient = m.recipient.trim() || 'Statement recipient';
    var lm = m.late || { lateCount: 0, lateValue: 0 };
    var itemsSnapshot = m.items.map(function(i){
      return { debtor_name: i.debtor_name, invoice_number: i.invoice_number, description: i.description, desc_short: i.desc_short || '', issued_date: i.issued_date, due_date: i.due_date,
        amount: i.amount, paid: i.paid, balance: i.balance, days_overdue: i.daysOverdue, interest: i.interest, fees: i.fees, fee_lines: i.feeLines,
        status: i.status, disputed: i.disputed, fully_paid: i.fullyPaid, note: i.note, pay_url: i.pay_url };
    });
    var r = await sb.from('statements').insert({
      org_id: currentOrg.id, title: 'Statement ' + m.number + ' — ' + recipient, recipient_name: recipient,
      debtor_ids: sel.debtorIds, items: itemsSnapshot, total_amount: m.totals.due,
      late_count: lm.lateCount, late_value: lm.lateValue, notes: m.cover || null, created_by: session.user.id,
      template_id: stmtTplKey && stmtTplKey.indexOf('preset:') !== 0 ? stmtTplKey : null, template_settings: Object.assign({}, stmtTplSettings, { logo: effectiveLogo(stmtTplSettings), hide_logo: !effectiveLogo(stmtTplSettings), from_lines: stmtTplSettings.from_lines || orgFromLines() }),
      totals: Object.assign({}, m.totals, { ageing: m.ageing, number: m.number, reference: m.reference, payment: m.payment, charges: m.charges, multi: m.multi })
    }).select().single();
    if(r.error){ toast('Could not save statement: ' + r.error.message); return null; }
    var row = Array.isArray(r.data) ? r.data[0] : r.data;
    if(row) stmtLastSave = { key: key, id: row.id };
    toast('Statement ' + m.number + ' saved for ' + recipient + '. It shows as a draft until you mark it sent.');
    await loadSavedStatements();
    return row ? (savedStatements.filter(function(x){ return x.id === row.id; })[0] || row) : null;
  }
  document.getElementById('stmtSaveBtn').addEventListener('click', function(){ saveCurrentStatement(false); });
  document.getElementById('stmtPrintBtn').addEventListener('click', async function(){
    if(!await confirmBankSafety('print')) return;
    window.print();
    // Auto-detect: printing or exporting usually means it is going out. Ask, then record it.
    var viewing = stmtViewingSavedId ? savedStatements.filter(function(x){ return x.id === stmtViewingSavedId; })[0] : null;
    if(viewing && viewing.status === 'sent') return;
    var who = viewing ? viewing.recipient_name : (document.getElementById('stmtRecipientName').value.trim() || 'this contact');
    var how = await djAsk('Did you send this statement to ' + who + '?\n\nDebtJet will save it and record it as sent today, so the account shows what has gone out.',
      { choices: [{ label: 'Yes, another way', value: 'other' }, { label: 'Yes, posted', value: 'post' }, { label: 'Yes, emailed', value: 'email' }], cancel: 'Not yet' });
    if(!how) return;
    var row = viewing || await saveCurrentStatement(true);
    if(!row) return;
    var d0 = (stmtDebtors.filter(function(x){ return (row.debtor_ids || [])[0] === x.id; })[0] || {});
    await markStatementSent(row.id, { sent_at: new Date().toISOString(), sent_via: how, sent_to: how === 'email' ? (d0.email || null) : null });
  });
  // Printing: fit the table to the A4 content width first, then put the on-screen preview back.
  window.addEventListener('beforeprint', function(){ var p = document.getElementById('statementPaper'); if(!p || !p.offsetParent) return; var sd = p.querySelector('.sd'); if(sd){ sd.style.zoom = ''; sd.style.width = ''; } p.dataset.w = p.style.width || ''; p.style.width = '733px'; fitStatementTable(p); });
  window.addEventListener('afterprint', function(){ var p = document.getElementById('statementPaper'); if(!p || p.dataset.w === undefined) return; p.style.width = p.dataset.w; delete p.dataset.w; fitStatementPreview(p); });
  window.addEventListener('beforeprint', function(){
    var paper = document.getElementById('statementPaper'), lpaper = document.getElementById('letterPaper');
    var onStatements = !document.querySelector('.view[data-view="statements"]').hidden;
    var onLetters = !document.querySelector('.view[data-view="letters"]').hidden;
    var src = onStatements && paper.querySelector('.sd, table') ? paper : (onLetters && lpaper.querySelector('.ld') ? letterCleanPaper() : null);
    var ok = !!src;
    document.getElementById('printRoot').innerHTML = ok ? src.outerHTML.replace(/id="(statementPaper|letterPaper)"/, '') : '';
    var recBox = document.getElementById('recPrint');
    if(!document.querySelector('.view[data-view="recovery"]').hidden && recBox && recBox.innerHTML){ document.getElementById('printRoot').innerHTML = recBox.innerHTML; ok = true; }
    document.body.classList.toggle('printing-stmt', ok);
  });
  window.addEventListener('afterprint', function(){ document.getElementById('printRoot').innerHTML = ''; document.body.classList.remove('printing-stmt'); var rb = document.getElementById('recPrint'); if(rb) rb.innerHTML = ''; });

  function viewSavedStatement(id){
    var s = savedStatements.filter(function(x){ return x.id===id; })[0]; if(!s) return;
    setStmtTab('statement', true); window.scrollTo(0, 0); stmtViewingSavedId = s.id;
    var recipEl = document.getElementById('stmtRecipientName');
    recipEl.value = s.recipient_name; recipEl.dataset.manual = '1';
    if(!s.template_settings || !s.totals){ viewLegacyStatement(s); }
    else {
      var T = s.totals;
      var m = {
        items: (s.items || []).map(function(i){
          return { debtor_name: i.debtor_name, invoice_number: i.invoice_number, description: i.description, desc_short: i.desc_short || '', issued_date: i.issued_date, due_date: i.due_date,
            amount: Number(i.amount) || 0, paid: Number(i.paid) || 0, balance: Number(i.balance) || 0, daysOverdue: Number(i.days_overdue) || 0,
            interest: Number(i.interest) || 0, fees: Number(i.fees) || 0, feeLines: i.fee_lines || [], status: i.status || 'Overdue',
            disputed: !!i.disputed, fullyPaid: !!i.fully_paid, note: i.note || '', pay_url: i.pay_url || null };
        }),
        totals: T, ageing: T.ageing, multi: !!T.multi, recipient: s.recipient_name, date: s.generated_at,
        number: T.number, reference: T.reference, payment: T.payment, charges: T.charges, cover: s.notes || '', late: null
      };
      var paper = document.getElementById('statementPaper');
      paper.className = 'statement-paper';
      ensureFont(s.template_settings.font); ensureFont(s.template_settings.heading_font);
      paper.innerHTML = renderStatementDoc(m, s.template_settings, currentOrg.name); fitStatementPreview(paper);
      renderFlags(document.getElementById('stmtWarn'), [{ level: 'info', message: 'Showing saved statement ' + (T.number || '') + ' exactly as it was issued on ' + fmt(s.generated_at || s.created_at) + '.' }]);
    }
    document.getElementById('stmtPrintBtn').disabled = false;
    toast('Showing saved statement for ' + s.recipient_name + '.');
  }

