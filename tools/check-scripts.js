#!/usr/bin/env node
/*
 * Checks the app's script files (js/*.js), in the order index.html loads them.
 *
 * The files share one global scope, so three mistakes break the app quietly:
 *   1. Syntax errors.
 *   2. The same top-level name declared in two files (the later one silently wins).
 *   3. Code that runs while a file loads, using something from a file that loads later
 *      (it isn't defined yet). Event handlers and functions called later are fine.
 *
 * Usage: node tools/check-scripts.js        (needs the "acorn" package: npm install --no-save acorn)
 * Exit code 1 if anything is wrong.
 */
const fs = require('fs');
const path = require('path');
let acorn;
try { acorn = require('acorn'); } catch (e) {
  for (const p of ['/opt/node-tools/node_modules/acorn', '/opt/npm-tools/node_modules/acorn']) { try { acorn = require(p); break; } catch (e2) {} }
}
if (!acorn) { console.error('Install acorn first: npm install --no-save acorn'); process.exit(2); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g)].map(m => m[1]);
if (!files.length) { console.error('No js/ scripts found in index.html'); process.exit(1); }

let bad = 0;
const fail = msg => { bad++; console.log('✗ ' + msg); };

// Every js/*.js file must be loaded, and every loaded file must exist.
const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
onDisk.filter(f => !files.includes(f)).forEach(f => fail(`${f} exists but index.html doesn't load it`));

const parsed = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { fail(`index.html loads ${f}, which doesn't exist`); continue; }
  try { parsed.push({ file: f, ast: acorn.parse(fs.readFileSync(p, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script', locations: true }) }); }
  catch (e) { fail(`${f}: syntax error: ${e.message}`); }
}
if (bad) process.exit(1);

// Top-level declarations, and which file declares each.
const declFile = {}, fnBody = {};
parsed.forEach(({ file, ast }, i) => {
  const add = (name, line) => {
    if (declFile[name] !== undefined) fail(`"${name}" is declared in both ${parsed[declFile[name]].file} and ${file} (line ${line}); rename one`);
    else declFile[name] = i;
  };
  for (const st of ast.body) {
    if (st.type === 'FunctionDeclaration') { add(st.id.name, st.loc.start.line); fnBody[st.id.name] = st.body; }
    if (st.type === 'VariableDeclaration') st.declarations.forEach(d => { if (d.id.type === 'Identifier') add(d.id.name, st.loc.start.line); });
  }
});

// Code that runs at load time: what it references, and which functions it calls.
const DEFER = new Set(['addEventListener', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'then', 'catch', 'finally', 'onAuthStateChange']);
function walk(node, refs, calls) {
  if (!node || typeof node.type !== 'string') return;
  switch (node.type) {
    case 'Identifier': refs.add(node.name); return;
    case 'MemberExpression': walk(node.object, refs, calls); if (node.computed) walk(node.property, refs, calls); return;
    case 'Property': if (node.computed) walk(node.key, refs, calls); walk(node.value, refs, calls); return;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return; // runs later, unless called (below)
    case 'CallExpression': case 'NewExpression': {
      const c = node.callee;
      if (/Function/.test(c.type)) walk(c.body, refs, calls);                       // IIFE runs now
      else {
        if (c.type === 'Identifier') calls.add(c.name);
        if (c.type === 'MemberExpression' && !c.computed && ['call', 'apply'].includes(c.property.name) && c.object.type === 'Identifier') calls.add(c.object.name);
        walk(c, refs, calls);
      }
      const name = c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
      node.arguments.forEach(a => {
        if (/Function/.test(a.type)) { if (!DEFER.has(name)) walk(a.body, refs, calls); }  // forEach/map callbacks run now
        else walk(a, refs, calls);
      });
      return;
    }
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(x => walk(x, refs, calls)); else if (v && typeof v.type === 'string') walk(v, refs, calls);
  }
}
const fnCache = {};
const fnInfo = n => fnCache[n] || (fnCache[n] = (() => { const r = new Set(), c = new Set(); walk(fnBody[n], r, c); return { r, c }; })());

parsed.forEach(({ file, ast }, i) => {
  for (const st of ast.body) {
    if (st.type === 'FunctionDeclaration') continue;
    const refs = new Set(), calls = new Set();
    walk(st, refs, calls);
    const via = {}, done = new Set(), queue = [...calls];
    while (queue.length) {
      const fn = queue.shift(); if (done.has(fn) || !fnBody[fn]) continue; done.add(fn);
      const { r, c } = fnInfo(fn);
      r.forEach(x => { if (!refs.has(x)) { refs.add(x); via[x] = fn; } });
      c.forEach(x => { if (!done.has(x)) { queue.push(x); if (!via[x]) via[x] = fn; } });
    }
    refs.forEach(n => {
      if (declFile[n] !== undefined && declFile[n] > i) {
        const chain = []; let x = n; while (via[x] && chain.length < 5) { chain.push(via[x]); x = via[x]; }
        fail(`${file} line ${st.loc.start.line} uses "${n}" from ${parsed[declFile[n]].file}, which loads later` + (chain.length ? ` (through ${chain.reverse().join(' → ')})` : '') + '. Move it to an earlier file, or run this code later.');
      }
    });
  }
});

if (bad) { console.log(`\n${bad} problem(s).`); process.exit(1); }
console.log(`✓ ${files.length} script files, ${Object.keys(declFile).length} top-level names: no duplicates, nothing used before it loads.`);
