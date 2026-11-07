// v0.64: الدعم المهني داخل حالة التعثر: اقتراح، إضافة كاحتياج، تجاهل، وظهور الاحتياج القائم
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
  const aid = await t.evaluate(() => { const o = DB.find((o) => !o.closed && !PRO.needs.some((n) => n.aid == o.id) && !(PRO.dis || []).some((k) => k.startsWith(o.id + ':')) && !TRB.cases.some((c) => c.aid == o.id)); trNew(o.id, { types: ['تعثر مالي', 'ضعف الحوكمة أو مجلس الإدارة'], sev: 'عالية' }); trSave(); trOpen(o.id); return o.id; });
  await t.waitForTimeout(400);
  ok(await t.evaluate(() => ADM.mod == 'trcase' && /مقترح من بيانات الجمعية/.test(document.querySelector('.trpage').textContent)), 'اقتراحات الدعم المهني تظهر في صفحة حالة التعثر');
  ok((await t.$$('.trpage .trsg>div')).length === 2, 'اقتراحان من نوعي التعثر');
  await t.addScriptTag({ content: AXE });
  const ax = await t.evaluate(async () => (await axe.run(document.querySelector('.trpage'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id));
  ok(!ax.length, 'axe على صفحة الحالة ' + ax.join(' '));
  await t.click('.trpage .trsg .jbtn.pri'); await t.waitForTimeout(400);
  ok(await t.evaluate((a) => PRO.needs.some((n) => n.aid == a && n.src == 'suggest'), aid), 'إضافة كاحتياج تنشئ احتياجاً مرتبطاً بالجمعية');
  ok(await t.evaluate(() => document.querySelectorAll('.trpage .trneeds>div').length === 1 && document.querySelectorAll('.trpage .trsg:not(.trneeds)>div').length === 1), 'الصفحة تعرض الاحتياج القائم والاقتراح المتبقي');
  await t.click('.trpage [onclick^="proCaseDis"]'); await t.waitForTimeout(400);
  ok(await t.evaluate(() => !document.querySelector('.trpage [onclick^="proCaseDis"]')), 'التجاهل يخفي الاقتراح');
  await t.click('.trpage .trneeds .jbtn'); await t.waitForTimeout(400);
  ok(await t.evaluate(() => !!document.querySelector('#adrawer.on, #modal.on')), 'فتح الاحتياج القائم يعمل من الصفحة');
  // قياس الأثر: المقارنة تُثبَّت عند الاعتماد ولا تتبع التغيرات اللاحقة
  const imp = await t.evaluate((a) => { const o = DBI[a], c0 = o.comp; const g = { id: 'GX1', aid: a, an: o.n, st: 'work', base: proSnap(a), ms: [], hrs: [], log: [] };
    o.comp = Math.min(100, c0 + 25); g.st = 'done'; g.after = proSnap(a); o.comp = 0; PRO.engs.push(g);
    PRO.needs.push({ id: 'NX1', aid: a, an: o.n, area: 0, fmt: 'm', title: 'اختبار الأثر', st: 'done', eng: 'GX1', at: proNow(), log: [] });
    const d = proDelta(g); const html = proCaseBlock(a); o.comp = c0; return { row: d.rows[0].slice(1, 3), up: d.up, shown: /xpres/.test(html) }; }, aid);
  ok(imp.up && imp.row[1] !== '0%', 'المقارنة مثبّتة عند الاعتماد رغم تغير الاكتمال لاحقاً ' + JSON.stringify(imp.row));
  ok(imp.shown, 'حالة التعثر تعرض نتيجة المهمة المنجزة');
  ok(!errs.length, 'بلا أخطاء ' + errs.join(' | '));
  console.log(pass + ' ok, ' + fail + ' fail'); await b.close(); process.exit(fail ? 1 : 0);
})();
