// 0.95: التحليلات (النطاق، المؤشرات، ما يحتاج انتباهك) + مركز التقارير (القوالب، المنشئ، سجل التنزيلات) + معاينة نافذة التصدير
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/analytics'); await W(p, 2500);
  await p.evaluate(() => { ADM.asc = { gov: '', grp: '', sup: '' }; localStorage.removeItem('asirAnaScope'); goMod('analytics') }); await W(p, 500);
  // 1) النطاق والمؤشرات
  const a = await p.evaluate(() => ({ sel: $$('[data-asc]').length, k: $$('.anks .ank').length, n: +$('.anks .ank b').firstChild.textContent.replace(/,/g, ''), act: DB.filter((o) => !o.closed).length, ins: $$('.aninr').length, heat: !!$('#ap-heat') }));
  ok(a.sel == 3 && a.k == 5 && a.n == a.act && a.ins >= 2 && a.heat, 'scope bar, 5 KPIs (count = active associations), insights, existing panels kept ' + JSON.stringify(a));
  const g = await p.evaluate(() => cntBy(DB.filter((o) => !o.closed), 'gov')[1][0]);
  await p.selectOption('[data-asc=gov]', g); await W(p, 500);
  const s = await p.evaluate((g) => ({ n: +$('.anks .ank b').firstChild.textContent.replace(/,/g, ''), want: DB.filter((o) => !o.closed && o.gov == g).length, rows: $$('#ap-heat tbody tr').length, saved: JSON.parse(localStorage.getItem('asirAnaScope') || '{}').gov, sub: $('.anin header small').textContent }), g);
  ok(s.n == s.want && s.rows == 1 && s.saved == g && s.sub.includes(g), 'scope applies to KPIs, heat map and insights, and persists ' + JSON.stringify(s));
  // 2) «عرض» يفتح السجل بنفس الفلتر والنطاق
  await p.click('.aninr [data-anv]'); await W(p, 500);
  const d = await p.evaluate(() => ({ mod: ADM.mod, gov: ADM.dir.gov, st: ADM.dir.st, attn: ADM.dir.attn }));
  ok(d.mod == 'directory' && d.gov == g && (d.st == 'due' || d.attn == 'crit'), 'insight «عرض» → register filtered by insight + scope ' + JSON.stringify(d));
  await p.evaluate(() => goMod('analytics')); await W(p, 500);
  // 3) «تحويل إلى قرار» يفتح قراراً بالقالب والنطاق
  await p.click('.aninr [data-anq]'); await W(p, 500);
  const q = await p.evaluate(() => ({ form: !!$('#decF'), gov: $('#decF') && $('#decF').gov.value, tpl: ($('.dtpl .on') || {}).textContent }));
  ok(q.form && q.gov == g && q.tpl, 'insight → new decision with template + scope ' + JSON.stringify(q));
  await p.evaluate(() => closeAll()); await W(p);
  await p.click('[data-ascx]'); await W(p, 400);
  ok(await p.evaluate(() => !ADM.asc.gov && $$('#ap-heat tbody tr').length > 5), 'reset scope');
  // 4) مركز التقارير: القوالب ← المنشئ، والسجل
  await p.evaluate(() => { ADM.rp.tab = 'tpl'; goMod('reports') }); await W(p, 600);
  const r = await p.evaluate(() => ({ tabs: $$('[data-rtab]').map((x) => x.dataset.rtab).join(), cards: $$('.rptc[data-rk]').length, quick: !!$('.rptc[data-rq]') }));
  ok(r.tabs == 'tpl,build,log' && r.cards == 8 && r.quick, 'reports: tabs + 8 templates + ready exports ' + JSON.stringify(r));
  await p.click('.rptc[data-rk=cmp]'); await W(p, 600);
  ok(await p.evaluate(() => ADM.rp.tab == 'build' && ADM.rp.kind == 'cmp' && !!$('#rpView') && !!$('.rpquick')), 'template opens the existing builder on that kind');
  await p.evaluate(() => { ADM.rp.tab = 'tpl'; rpGo('gov') }); await W(p, 600);
  ok(await p.evaluate(() => ADM.rp.tab == 'build' && ADM.rp.kind == 'gov'), 'links from other pages (rpGo) land in the builder');
  await p.evaluate(() => expLog('اختبار سجل التنزيلات 0.95', 'xlsx', 7)); await W(p, 800);
  await p.click('[data-rtab=log]'); await W(p, 1500);
  const l = await p.evaluate(() => ({ rows: $$('#rpLogT tbody tr').length, has: !!$$('#rpLogT tbody tr').find((t) => t.textContent.includes('اختبار سجل التنزيلات 0.95')) }));
  ok(l.rows >= 1 && l.has, 'downloads log lists the export ' + JSON.stringify(l));
  // 5) معاينة نافذة التصدير تتبع الصيغة
  await p.evaluate(() => { goMod('directory'); expDir() }); await W(p, 500);
  const e = [];
  for (const f of ['xlsx', 'pdf', 'csv']) { await p.click(`[data-uc=fmt][data-v=${f}]`); await W(p, 250); e.push(await p.evaluate(() => ({ x: !!$('.xpv.xls .tabs'), pdf: $$('.xpv.pdf .xpg').length, csv: !!$('.xpv.csv code') }))) }
  ok(e[0].x && e[1].pdf >= 1 && e[2].csv, 'export dialog preview follows the format ' + JSON.stringify(e));
  await p.evaluate(() => closeAll());
  // 6) الجوال
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); m.on('pageerror', (x) => errs.push(x.message));
  await m.goto(BASE + '/#/admin/analytics'); await W(m, 2500);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle($('.anks')).gridTemplateColumns.split(' ').length == 2), 'mobile: KPIs in 2 columns, no horizontal scroll');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
