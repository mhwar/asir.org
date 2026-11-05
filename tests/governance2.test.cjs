// الحوكمة (0.46): الدورات، أعضاء المجلس وصورهم، الوثائق (رفع، ظهور، حذف)، الموقع العام
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/board'); await p.waitForTimeout(1800);
  const snap = await p.evaluate(() => JSON.stringify({ t: TERMS, b: BOARD, d: DOCS, i: IMPACT }));
  const t = await p.evaluate(() => ({ terms: TERMS.list.length, cur: termCur().k, m2: bMembers('t2').length, m1: bMembers('t1').length, tabs: $$('.termbar [data-term]').length, cards: $$('.bmc').length }));
  ok(t.terms >= 2 && t.cur == 't2' && t.m2 == 7 && t.m1 == 5 && t.tabs == t.terms && t.cards == 7, 'terms seeded; members per term; cards rendered');
  const nt = await p.evaluate(() => { termEdit(null); const f = $('#tmF'); f.t.value = 'الدورة الثالثة'; f.from.value = '1450هـ'; f.st.value = 'planned'; f.est.value = 'open'; f.edate.value = 'رجب 1450هـ'; f.requestSubmit(); const T = TERMS.list[TERMS.list.length - 1]; return { n: TERMS.list.length, st: T.st, el: T.elect.st, cur: termCur().k } });
  ok(nt.n == t.terms + 1 && nt.st == 'planned' && nt.el == 'open' && nt.cur == 't2', 'new term added as planned with open elections; current unchanged');
  await p.evaluate(() => { location.hash = '#/about' }); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!document.querySelector('#boardBox .ebanner') && $$('#boardBox .bcard').length == 7 && $$('#boardBox .bhist').length >= 1), 'public: elections banner, current members, past term history');
  await p.evaluate(() => { location.hash = '#/admin/board' }); await p.waitForTimeout(800);
  const ph = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').fillRect(0, 0, 200, 200); const im = new Image(); await new Promise((r) => { im.onload = r; im.src = c.toDataURL() }); const m = bMembers('t2')[3]; photoCrop(im, m, () => {}); $('#cpOk').click(); await new Promise((r) => setTimeout(r, 1500)); return { src: m.src } });
  ok(ph.src && ph.src.startsWith('/files/public/board/'), 'photo cropped + uploaded to public R2 path');
  ok(await p.evaluate(async (u) => (await fetch(u)).status, ph.src) == 200, 'uploaded photo served publicly');
  const d = await p.evaluate(async () => { goMod('docs'); for (const x of DOCS.list.filter((z) => z.n == 'وثيقة اختبار')) { if (x.key) await fetch('/api/docs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: x.key }) }); DOCS.list = DOCS.list.filter((z) => z != x) } docEdit(null); const f = $('#dcF'); f.n.value = 'وثيقة اختبار'; f.cat.value = 'policy'; f.vis.value = 'internal'; const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4 x'], 't.pdf', { type: 'application/pdf' })); f.file.files = dt.files; f.requestSubmit(); await new Promise((r) => setTimeout(r, 1500)); const D = DOCS.list.find((x) => x.n == 'وثيقة اختبار'); const st = (await fetch(D.url)).status; return { key: D.key, url: D.url, st } });
  ok(d.key && d.key.startsWith('docs/') && d.url.startsWith('/api/docs/file/') && d.st == 200, 'internal doc uploaded + served behind auth');
  const v = await p.evaluate(async () => { const D = DOCS.list.find((x) => x.n == 'وثيقة اختبار'); const j = await (await fetch('/api/docs/vis', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: D.key, vis: 'public' }) })).json(); const pub = (await fetch(j.url)).status; await fetch('/api/docs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: j.key }) }); const gone = (await fetch(j.url, { cache: 'no-store' })).status; return { key: j.key, pub, gone } });
  ok(v.key.startsWith('public/docs/') && v.pub == 200 && v.gone == 404, 'visibility switch moves file; delete removes it');
  const pl = await p.evaluate(async () => { const m = bMembers('t2')[3]; await fetch('/api/docs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: m.src.slice(7) }) }); return (await fetch('/files/public/../docs/x.pdf')).status });
  ok(pl != 200, 'public files route rejects traversal');
  await p.evaluate((x) => { const o = JSON.parse(x); TERMS = o.t; BOARD = o.b; DOCS = o.d; IMPACT = o.i; saveTerms(); saveBoard(); docsSave(); saveImpact() }, snap);
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
