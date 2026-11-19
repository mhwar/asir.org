// ملف الجمعية (أُعيدت كتابته في 1.10 للصفحة الموحّدة): الزر السياقي، «المزيد» بلا تكرار، التصدير، السجل، اللاصق، الأسهم،
// علامات التحقق، الجمعية السليمة والمغلقة، الجوال. التفاصيل الجديدة في file110.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  const A = await p.evaluate(() => (DB.find((o) => !o.closed && o.st == 'ينتهي قريباً') || DB.find((o) => !o.closed && o.st == 'منتهي')).id);
  await p.evaluate((A) => open360(A), A); await p.waitForTimeout(1800);
  const h = await p.evaluate(() => ({ flag: !!$('#a5flag'), st: $('.a5st').textContent, pri: ($('.a3bar .jbtn.pri') || {}).textContent || '' }));
  ok(h.flag && /الترخيص/.test(h.st), 'licence issue surfaces in the status sentence and the flag');
  ok(/رابط تحديث/.test(h.pri), 'the top need marks its bar button as primary (no duplicate)');
  const mn = await p.evaluate(() => { const m = $$('.a3more > button').find((x) => /المزيد/.test(x.textContent)); m.click(); const box = m.parentElement; return { open: box.classList.contains('open'), groups: box.querySelectorAll('small').length, items: [...box.querySelectorAll('[role=menuitem]')].map((x) => x.textContent.trim()) } });
  ok(mn.open && mn.groups == 2 && mn.items.some((x) => /تصدير الملف/.test(x)), '«المزيد»: two groups, export entry present');
  await p.evaluate(() => document.body.click()); ok(await p.evaluate(() => !$('.a3more.open')), 'menu closes on outside click');
  await p.evaluate((A) => recPrint(A), A); await p.waitForTimeout(700);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && $$('[data-uc=fmt]').length == 2), 'export goes through the unified export dialog (PDF/Excel)');
  await p.evaluate(() => closeAll());
  // السجل: تسجيل تواصل يظهر في جدول العلاقة
  await p.evaluate((A) => a360LogDlg(A), A); await p.waitForTimeout(300);
  await p.fill('#clD [name=summary]', 'مكالمة اختبار ملف الجمعية'); await p.click('#clDGo'); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => /مكالمة اختبار ملف الجمعية/.test($('#a5rel').textContent)), 'logged contact appears in the relation table');
  const fk = await p.evaluate(() => { const b = $$('#a5rel [data-a5k]').find((x) => x.dataset.a5k); b.click(); return b.dataset.a5k; }); await p.waitForTimeout(300);
  ok(await p.evaluate((fk) => $$('#a5rel .a5t tbody tr').every((r) => r.textContent.includes((A360_FK[fk] || [fk])[0])), fk), 'relation filter narrows the table to one kind');
  // اللاصق
  await p.evaluate(() => $('#a5rel').scrollIntoView()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $('.a3sticky').classList.contains('on') && $$('.a3sticky .a5sn button').length == 3), 'sticky bar appears on scroll with the three section links');
  await p.evaluate(() => window.scrollTo(0, 0));
  // الأسهم
  const before = await p.evaluate(() => ADM.aid); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  ok(await p.evaluate((b) => ADM.aid != b, before), 'ArrowLeft moves to the next association');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(900);
  ok(await p.evaluate((b) => ADM.aid == b, before), 'ArrowRight moves back');
  // علامة تحقق تظهر حالة «يحتاج مراجعة» وفي العلامة
  const Fid = await p.evaluate(async (A) => { const r = await (await fetch(`/api/associations/${A}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'gov', kind: 'assumed', text: 'اختبار ملف الجمعية' }) })).json(); await flagsLoad(true); return r.data ? r.data.id : r.id; }, A);
  await p.evaluate((A) => { ADM.a360f = null; open360(A) }, A); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => { ADM.a5v = 'off'; AM.assoc($('#acontent')); return [...$$('#a5data .a5t tbody tr')].some((r) => /المقر/.test(r.textContent) && /يحتاج مراجعة/.test(r.textContent)) }), 'flagged field shows «يحتاج مراجعة» in the data table');
  ok(await p.evaluate(() => { $('#a5flag').click(); return /تحتاج تحقق/.test($('.a5pop').textContent) }), 'flag popover lists the fields needing verification');
  await p.evaluate(([A, id]) => fetch(`/api/associations/${A}/notes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) }), [A, Fid]);
  // جمعية سليمة
  const G = await p.evaluate(() => (DB.filter((o) => !o.closed && o.st == 'ساري' && o.comp >= 60 && (!flagsOf(o.id).length) && o.days > 120 && !(typeof trCase == 'function' && trCase(o.id))).sort((a, b) => b.hs - a.hs)[0] || {}).id);
  if (G) { await p.evaluate((G) => open360(G), G); await p.waitForTimeout(1800);
    ok(await p.evaluate(() => !$('.a3bar .jbtn.pri') || !$('#a5flag')), 'healthy association: no urgent flag or no contextual primary'); }
  // مغلقة
  const C = await p.evaluate(() => (DB.find((o) => o.closed) || {}).id);
  if (C) { await p.evaluate((C) => open360(C), C); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => /مغلقة نهائياً/.test($('.a5hd').textContent) && !$('#a5flag') && !$('#a5eval')), 'closed association: closed label, no flag, no evaluation'); }
  // الجوال
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); m.on('pageerror', (e) => errs.push('m: ' + e.message));
  await m.goto(BASE + '/'); await m.waitForTimeout(600); await m.evaluate((A) => { go('admin'); setTimeout(() => open360(A), 300); }, A); await m.waitForTimeout(2200);
  ok(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0), 'mobile: no horizontal scroll');
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
