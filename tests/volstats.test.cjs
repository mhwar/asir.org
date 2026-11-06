// v0.68: أرقام التطوع كما تبلغ عنها الجمعيات (ساعات، فرص، سنة) ومجموعها في «تطوّع بخبرتك»، والرقم الرسمي للمنطقة
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  const t = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; t.on('pageerror', (e) => errs.push(e.message));
  await t.goto(BASE + '/#/admin', { waitUntil: 'networkidle' }); await t.waitForTimeout(900);
  const before = await t.evaluate(async () => (await (await fetch('/api/pro/volunteering')).json()).total);
  ok(before && before.assocs > 0, 'ملخص التطوع يعمل ' + JSON.stringify(before));
  const put = await t.evaluate(async () => { const id = DB.find((o) => !o.closed).id;
    const r = await fetch('/api/associations/' + id + '/full', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { vols: '40', volHours: '1,250', volOpps: '6', volYear: '2025' } }) });
    const j = await r.json(); return { s: r.status, p: j.data && j.data.profile, id }; });
  ok(put.s === 200 && put.p.volHours == 1250 && put.p.volOpps == 6 && put.p.volYear == 2025, 'حفظ الساعات والفرص والسنة في ملف الجمعية ' + JSON.stringify(put.p && [put.p.volHours, put.p.volOpps, put.p.volYear]));
  const bad = await t.evaluate(async (id) => (await fetch('/api/associations/' + id + '/full', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { volYear: '1800' } }) })).status, put.id);
  ok(bad === 422, 'سنة غير صالحة تُرفض');
  const after = await t.evaluate(async () => (await (await fetch('/api/pro/volunteering')).json()));
  ok(after.total.hours >= 1250 && after.total.reported >= 1 && after.years.some((y) => y.y == 2025), 'المجموع يشمل أرقام الجمعية والسنة');
  const anon = await (await b.newContext()).newPage();
  // المسار محمي: الزائر لا يصل لأرقام الجمعيات
  const st = await anon.request.get(BASE.replace('8787', '8789') + '/api/pro/volunteering');
  ok(st.status() === 401 || st.status() === 403, 'المسار محمي للزائر (' + st.status() + ')');
  await t.evaluate(() => { ADM.volSum = null; closeAll(); ADM.prov = ADM.prov || {}; ADM.prov.tab = 'over'; goMod('pro'); }); await t.waitForTimeout(1200);
  ok(await t.evaluate(() => /التطوع في جمعيات المنطقة/.test(document.querySelector('.xpvol').textContent) && /1,250|1٬250/.test(document.querySelector('.xpvol').textContent)), 'اللوحة تعرض المجموع والتنبيه بحدود الرقم');
  await t.click('.xpvol h4 .r'); await t.waitForTimeout(300);
  await t.fill('#pxO [name=year]', '2025'); await t.fill('#pxO [name=vols]', '30000'); await t.fill('#pxO [name=hours]', '1200000'); await t.fill('#pxO [name=src]', 'اختبار: خطاب فرع الوزارة');
  await t.click('#pxO .btn.p'); await t.waitForTimeout(500);
  ok(await t.evaluate(() => PRO.official && PRO.official.hours === 1200000 && /الرقم الرسمي لمنطقة عسير/.test(document.querySelector('.xpvol').textContent)), 'الرقم الرسمي يُحفظ ويُعرض مع مصدره');
  await t.addScriptTag({ content: AXE });
  const ax = await t.evaluate(async () => (await axe.run(document.querySelector('.xpvol'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id));
  ok(!ax.length, 'axe على اللوحة ' + ax.join(' '));
  // تنظيف
  await t.evaluate(async (id) => { delete PRO.official; proSave(); await fetch('/api/associations/' + id + '/full', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { vols: '', volHours: '', volOpps: '', volYear: '' } }) }); }, put.id);
  // البوابة: الحقول الجديدة ضمن «الحجم والحوكمة»
  ok(await t.evaluate(() => ['volHours', 'volOpps', 'volYear'].every((k) => PF.some((f) => f.k == k && f.sec == 'size'))), 'حقول البوابة في قسم الحجم والحوكمة');
  ok(!errs.length, 'بلا أخطاء ' + errs.join(' | '));
  console.log(pass + ' ok, ' + fail + ' fail'); await b.close(); process.exit(fail ? 1 : 0);
})();
