// منظومة التقارير v2: كل الأنواع تُبنى بلا أخطاء، وملفات Excel صالحة، وPDF بغلاف وترقيم
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/reports'); await p.waitForTimeout(1200);
  const res = await p.evaluate(() => { const A = rAct(), out = {};
    const cases = { region: ['region'], gov: ['gov', A[0].gov], grp: ['grp', A[0].grp], sup: ['sup', A[0].sup], assoc: ['assoc', A[3].id], cmp: ['cmp', null, { dim: 'grp', keys: cntBy(A, 'grp').slice(0, 3).map((x) => x[0]) }] };
    for (const [k, [kind, key, o]] of Object.entries(cases)) { const R = rBuild(kind, key, o || {}); const h = rHTML(R); out[k] = { secs: R.sections.filter((s) => s.on).length, personal: (()=>{const d=document.createElement('div');d.innerHTML=h;return /@|(^|\D)05\d{8}(\D|$)/.test(d.textContent)})(), html: h.length } }
    const R = rBuild('gov', A[0].gov); const kp = R.sections[0].blocks[0].items; out.rank = kp[0].rank; out.diff = kp[1].diff != null;
    return out });
  for (const k of ['region', 'gov', 'grp', 'sup', 'assoc', 'cmp']) { ok(res[k].secs >= 3, k + ' sections'); ok(!res[k].personal, k + ' has no personal data') }
  ok(res.rank && res.rank[1] > 1 && res.diff, 'gov KPIs have rank + diff');
  // 0.41: الصحة المؤسسية، التقرير الدوري، اللقطات، قسم المؤشر في الأنواع القديمة
  const w = await p.evaluate(() => { const H = rBuild('health'), n0 = SNAPS.list.length; const x0 = rSnapSave(false); const Pm = rBuild('period', null, { period: 'm' }), Pq = rBuild('period', null, { period: 'py' });
    const G = rBuild('gov', rAct()[0].gov), As = rBuild('assoc', rAct()[3].id), C = rBuild('cmp', null, { dim: 'gov', keys: cntBy(rAct(), 'gov').slice(0, 2).map((x) => x[0]) });
    return { hs: H.sections.filter((s) => s.on && s.blocks.length).length, crit: !!H.sections.find((s) => s.id == 'crit'), html: rHTML(H).includes('مؤشر الصحة'), snaps: SNAPS.list.includes(x0) && SNAPS.list.length <= 36,
      per: Pm.sections[0].blocks[0].items.length >= 6 && Pq.sections.some((s) => s.id == 'lic'), govHs: !!G.sections.find((s) => s.id == 'hs'), asHs: !!As.sections.find((s) => s.id == 'hs'), cmpHs: C.sections[0].blocks[0].rows.some((r) => r[0].includes('مؤشر الصحة')), kinds: Object.keys(RKIND).length } });
  ok(w.hs >= 6 && w.crit && w.html, 'health report builds'); ok(w.snaps, 'snapshot saved'); ok(w.per, 'period report builds'); ok(w.govHs && w.asHs && w.cmpHs, 'hs sections in old kinds'); ok(w.kinds == 8, '8 report kinds');
  // Excel
  fs.mkdirSync('tests/out', { recursive: true });
  const b64 = await p.evaluate(async () => { window.saveBlob = () => true; const blob = rXLSX(rBuild('gov', rAct()[0].gov)); const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; u.forEach((x) => s += String.fromCharCode(x)); return btoa(s) });
  fs.writeFileSync('tests/out/report_gov.xlsx', Buffer.from(b64, 'base64'));
  // UI: تبديل النوع وإخفاء قسم
  await p.click('[data-rk=grp]'); await p.waitForTimeout(300);
  await p.uncheck('[data-rs=list]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => rpCur().sections.find((s) => s.id == 'list').on === false), 'section toggle');
  await p.screenshot({ path: 'tests/out/reports_ui.png' });
  // PDF
  await p.evaluate(() => { window.print = () => {}; rPDF(rBuild('region')) }); await p.waitForTimeout(300);
  await p.emulateMedia({ media: 'print' }); await p.pdf({ path: 'tests/out/report_region.pdf', preferCSSPageSize: true, printBackground: true });
  ok(fs.statSync('tests/out/report_region.pdf').size > 50000, 'pdf written');
  // التصدير القديم يمر بالمحرك الموحّد
  ok(await p.evaluate(() => { const R = specToR({ title: 'اختبار', kpis: [['عدد', 5], ['نسبة', '40%']], tables: [{ name: 'ج', cols: [{ h: 'أ' }, { h: 'ب', t: 'p' }], rows: [['x', .5]] }] }); return R.sections.length == 2 && R.sections[0].blocks[0].items[1].t == 'r' }), 'legacy spec mapped');
  console.log(JSON.stringify({ res, errs }, null, 1)); ok(!errs.length, 'no page errors'); await b.close();
})();
