// أداة تطوير: تحدد كود لوحة التحكم الذي لا يحتاجه الزائر، وتضع حوله علامتي /*@adm*/ … /*@/adm*/
// في src/site.src.html. build.py يحذف ما بين العلامتين من حزمة الزائر (pub) ويبقيه في حزمة الفريق (app).
//
//   node tools/split.cjs            تقرير فقط (لا يغيّر شيئاً)
//   node tools/split.cjs --write    يعيد وضع العلامات (يحذف القديمة أولاً)
//
// المبدأ: نقطة البدء كل ما يُنفَّذ عند تحميل الموقع العام + الدوال المذكورة في HTML والقوالب،
// ثم كل ما تعتمد عليه بالتتابع. ما لم يُصَل إليه = لوحة فقط. أسماء DENY مداخل للوحة لا يصلها الزائر
// (أزرار تظهر للفريق فقط)، وما يُستدعى بعد فحص typeof لا يُعد اعتماداً.
// تحتاج acorn و acorn-walk (npm i --no-save acorn acorn-walk).
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const FILE = path.join(__dirname, '..', 'src', 'site.src.html');
const WRITE = process.argv.includes('--write');

// مداخل لوحة التحكم: دوال تُفتح من أزرار الفريق داخل كود عام، أو بنى اللوحة نفسها
const DENY = new Set(`ADM AM HDR NAV MODS renderAdmin adminEnter adminLeave goMod cmdOpen recModal openAD adHead
 recEdit updLink recPrint openRec openCons portalSubmit portalFix portalBoot ptOpen pjOpen pjCreate pjEdit decOpen decNew decEdit
 campOpen campNew evOpen evNew evEdit keyNew userNew trOpen ntfOpen ntfClose`.split(/\s+/).filter(Boolean));
// أوامر تُنفَّذ عند التحميل داخل منطقة اللوحة ويحتاجها الموقع العام (تهيئة بيانات الفعاليات والمجالس…)
const PUB_EXEC = /^(if\(!(TERMS|DOCS|FPOL|POLS|COMMS)\b|if\(!Array\.isArray\((CMEM|EVTS)\.list\)\)|\(\(\)=>\{(const S=termSeed|let ch=0;BOARD)|renderBoard\(\)|fpApply\(\)|try\{(renderGov|evSync)\(\)|CMEM\.nom=|EVTS\.skip=|document\.addEventListener\('click',e=>\{const b=e\.target\.closest\('#comms|setTimeout\(\(\)=>\{try\{renderComms|document\.addEventListener\('keydown',e=>\{const t=e\.target;if\(\(e\.key=='Enter'|applyPref\(sitePref\(\)\)|route\(\)|setTimeout\(\(\)=>\$\$\('\[data-count\]'\))/;
const ADM_EXEC = /^(AM|ADM|HDR|P)\.|^\(\(\)=>\{const pick|^if\(SESSION\)|^if\(PORTAL\)|^if\(DEMO_CLOSED\)/;

let s = fs.readFileSync(FILE, 'utf8');
s = s.replace(/\/\*@\/?adm\*\//g, '');
const m = s.indexOf('const RAW=/*@RAW*/'), a = s.lastIndexOf('<script>', m) + 8, b = s.indexOf('</script>', m);
const body = s.slice(a, b), code = body.replace(/\{\{[a-z_]+\}\}/g, (x) => '0'.padEnd(x.length, ' '));
const CUT = body.indexOf('/* ================= DASHBOARD');
if (CUT < 0) throw new Error('DASHBOARD marker not found');
const ast = acorn.parse(code, { ecmaVersion: 'latest' });
const IDW = /[A-Za-z_$][\w$]*/g;
const st = ast.body.map((n, i) => {
  const defs = [];
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') defs.push(n.id.name);
  if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => walk.full(d.id, (x) => { if (x.type === 'Identifier') defs.push(x.name); }));
  const refs = new Set(), opt = new Set(), strs = [];
  walk.ancestor(n, {
    Identifier(x, anc) {
      const p = anc[anc.length - 2];
      if (p && p.type === 'MemberExpression' && p.property === x && !p.computed) return;
      if (p && p.type === 'Property' && p.key === x && !p.computed && !p.shorthand) return;
      if (p && p.type === 'UnaryExpression' && p.operator === 'typeof') opt.add(x.name);
      refs.add(x.name);
    },
    Literal(x) { if (typeof x.value === 'string') strs.push(x.value); },
    TemplateElement(x) { strs.push(x.value.cooked || ''); },
  });
  for (const t of strs) if (/[(=]/.test(t)) for (const w of t.match(IDW) || []) refs.add(w);
  for (const o of opt) refs.delete(o);
  const src = code.slice(n.start, n.end);
  return { i, n, defs, refs: [...refs], src, exec: !defs.length };
});
const def = {};
st.forEach((x) => x.defs.forEach((d) => (def[d] = def[d] || []).push(x.i)));
// أسماء مذكورة في HTML الثابت (onclick=…)
const html = s.slice(0, a) + s.slice(b);
const htmlRefs = new Set();
for (const mm of html.matchAll(/\son[a-z]+="([^"]*)"/g)) for (const w of mm[1].match(IDW) || []) htmlRefs.add(w);

const keep = new Set(), q = [];
const add = (i) => { if (!keep.has(i)) { keep.add(i); q.push(i); } };
for (const x of st) {
  if (!x.exec) continue;
  const pub = x.n.start < CUT;
  if (pub ? !ADM_EXEC.test(x.src) : PUB_EXEC.test(x.src)) add(x.i);
}
for (const w of htmlRefs) if (!DENY.has(w)) (def[w] || []).forEach(add);
while (q.length) { const i = q.pop(); for (const r of st[i].refs) if (!DENY.has(r)) (def[r] || []).forEach(add); }

// نطاقات متصلة من الجمل المستبعدة
const runs = []; let cur = null;
for (const x of st) {
  if (keep.has(x.i)) { cur = null; continue; }
  if (cur) cur[1] = x.n.end; else runs.push(cur = [x.n.start, x.n.end]);
}
const total = st.reduce((t, x) => t + x.src.length, 0), out = runs.reduce((t, r) => t + r[1] - r[0], 0);
console.log(`جمل: ${st.length} · مستبعدة من حزمة الزائر: ${st.length - keep.size} في ${runs.length} نطاقاً · ${Math.round(out / 1024)} ك.ب من ${Math.round(total / 1024)} ك.ب`);
// مراجع من كود الزائر إلى أسماء في كود اللوحة (يجب أن تكون في مسارات للفريق فقط أو محمية بـ typeof)
const dang = {};
for (const x of st) if (keep.has(x.i)) for (const r of x.refs) if (def[r] && def[r].every((j) => !keep.has(j))) (dang[r] = dang[r] || new Set()).add(x.defs[0] || ('@' + code.slice(0, x.n.start).split('\n').length));
if (process.argv.includes('--dangling')) for (const [k, v] of Object.entries(dang)) console.log(k, '←', [...v].join(' '));
if (!WRITE) process.exit(0);
let nb = body;
for (const [x, y] of runs.slice().reverse()) nb = nb.slice(0, x) + '/*@adm*/' + nb.slice(x, y) + '/*@/adm*/' + nb.slice(y);
fs.writeFileSync(FILE, s.slice(0, a) + nb + s.slice(b));
console.log('كُتبت العلامات في', path.relative(process.cwd(), FILE));
