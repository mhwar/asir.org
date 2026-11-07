// 0.86: تقارير PDF: غلاف للتحليلية ورأس مختصر للسجلات، صفحات عرضية للجداول العريضة، قص القوائم الطويلة، أرقام سالبة صحيحة، شارات الحالة، ملف الجمعية بالمحرك الموحد.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const OUT = 'tests/out/pdf'; const TXT = {}; fs.mkdirSync(OUT, { recursive: true });
const info = (f) => { const t = execFileSync('pdfinfo', ['-l', '99', f]).toString(); return { pages: +(t.match(/Pages:\s+(\d+)/) || [])[1], land: (t.match(/size:\s+841\.\d+ x 59/g) || []).length }; };
const text = (f) => execFileSync('pdftotext', ['-layout', f, '-']).toString();
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(800); await p.evaluate(() => go('admin')); await p.waitForTimeout(800);
  await p.evaluate(() => { window.print = () => { window.__pr = (window.__pr || 0) + 1 } });
  const make = async (name, fn) => { await p.evaluate(fn); await p.waitForTimeout(500); await p.evaluate(() => document.body.classList.add('printrpt')); await p.emulateMedia({ media: 'print' }); const f = `${OUT}/${name}.pdf`; TXT[name] = await p.evaluate(() => ({ t: $('#rptDoc').innerText, neg: [...document.querySelectorAll('#rptDoc td,#rptDoc .rkc b')].filter((e) => /(^|\s)-\d/.test(e.textContent) && !e.querySelector('bdi')).length })); await p.pdf({ path: f, preferCSSPageSize: true, printBackground: true }); await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => document.body.classList.remove('printrpt')); await p.waitForTimeout(2700); return f; };
  // 1) تقرير المنطقة: غلاف + فهرس + صفحة عرضية للمصفوفة
  const fr = await make('region', () => rPDF(rBuild('region')));
  const ir = info(fr), tr = TXT.region.t;
  ok(ir.land >= 1, `region report mixes portrait and landscape pages (${ir.land} landscape)`);
  ok(/محتويات التقرير/.test(tr) && /جمعيات تحتاج انتباهاً/.test(tr), 'cover has a table of contents; «جمعيات تحتاج انتباهاً» section present');
  ok(/يظهر أول 20 من/.test(tr), 'long lists cut to 20 rows with a note');
  ok(!/قائمة الجمعيات الكاملة/.test(tr.split('التعريفات والمنهجية')[0] || ''), 'full association list is an appendix, off by default');
  // 2) تقرير المحافظة أقصر بكثير من 15 صفحة
  const fg = await make('gov', () => rPDF(rBuild('gov', 'أبها')));
  const ig = info(fg), tg = TXT.gov.t;
  ok(ig.pages <= 10, `governorate report is ${ig.pages} pages (was 15)`);
  ok(TXT.gov.neg == 0 && /منتهٍ منذ/.test(tg), 'no reversed negative numbers; expired days read «منتهٍ منذ N»');
  // 3) تقرير الحالة: رأس مختصر بلا غلاف، مسار المراحل
  const fc = await make('trcase', () => { const a = DB.filter((o) => !o.closed)[5].id; TRB.cases = TRB.cases.filter((c) => c.aid != a); const c = trNew(a, { src: 'team', types: ['تعثر مالي'], sev: 'عالية' }); trNorm(c); c.cause = 'غادر المحاسب ولم تُعتمد القوائم المالية'; trSave(); window.__a = a; const R = (() => { let r; const e = expReport; expReport = (x) => { r = x }; trReport(a); expReport = e; return r })(); rPDF(R) });
  const ic = info(fc), tc = TXT.trcase.t;
  ok(ic.pages <= 3 && !/محتويات التقرير/.test(tc), `case report: compact header, no cover (${ic.pages} pages)`);
  ok(/رصد/.test(tc) && /تشخيص/.test(tc) && /إغلاق/.test(tc), 'case report shows the 6-stage pipeline');
  // 4) ملف الجمعية الشامل بالمحرك الموحد
  const fp = await make('profile', async () => { const id = DB.filter((o) => !o.closed)[3].id; const F = await recFull(id); profilePDF(F, { gen: 1, prof: 1, con: 1, lead: 1, notes: 1, mask: 'on' }) });
  const tp = TXT.profile.t;
  ok(/ملف جمعية/.test(tp) && /البيانات الرئيسية/.test(tp) && /التعريفات والمنهجية/.test(tp) && /مموّهة/.test(tp), 'association profile uses the unified engine with privacy note');
  // 5) شارات الحالة وأعمدة ثابتة العرض في المعاينة
  const ui = await p.evaluate(() => { const box = document.createElement('div'); box.innerHTML = rHTML(rBuild('gov', 'أبها')); return { pills: box.querySelectorAll('.rst.bad,.rst.ok,.rst.warn').length, col: box.querySelectorAll('colgroup').length, flex: box.querySelector('.rk').style.getPropertyValue('--c') } });
  ok(ui.pills > 10 && ui.col > 3 && ui.flex, 'status pills, fixed column widths, balanced KPI rows');
  // 6) نافذة التصدير: الغلاف حسب النوع، الاتجاه، القوائم كاملة، تقدير الصفحات
  await p.evaluate(() => { closeAll(); expReport(rBuild('gov', 'أبها')) }); await p.waitForTimeout(400);
  await p.evaluate(() => { const f = [...document.querySelectorAll('#modal [data-uc=fmt]')].find((x) => x.dataset.v == 'pdf'); f && f.click() }); await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ cover: ($('#modal [data-usw=cover]') || {}).checked, orient: $$('#modal [data-us=orient], #modal .uiseg [data-v]').length, full: !!$('#modal [data-usw=full]'), est: $('#exGoE').textContent }));
  ok(d.cover === true && d.full && /نحو \d+/.test(d.est), `export dialog: cover on for analytic reports, long-list switch, page estimate («${d.est}»)`);
  await p.evaluate(() => { closeAll(); expReport((() => { let r; const e = expReport; expReport = (x) => { r = x }; trReport(window.__a); expReport = e; return r })()) }); await p.waitForTimeout(400);
  await p.evaluate(() => { const f = [...document.querySelectorAll('#modal [data-uc=fmt]')].find((x) => x.dataset.v == 'pdf'); f && f.click() }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => ($('#modal [data-usw=cover]') || {}).checked === false), 'record reports default to the compact header');
  await p.evaluate(() => { closeAll(); TRB.cases = TRB.cases.filter((c) => c.aid != window.__a); trSave() });
  // 7) Excel ما زال يعمل بالبنية نفسها
  const xl = await p.evaluate(() => { try { const R = rBuild('gov', 'أبها'); const P = R.sections.flatMap((s) => rParts(s, R)); return P.length } catch (e) { return 'ERR ' + e.message } });
  ok(typeof xl == 'number' && xl > 5, 'Excel parts build from the same report model');
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
