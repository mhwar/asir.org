// 0.81: رأس صفحة السجل (عودة بدل تبويبات الأشقاء)، إزالة «التراخيص» من القائمة وتحويلها إلى فلتر، النظرة السريعة بالهوية الجديدة، إضافة إلى مجتمع.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  // 1) رأس صفحة الجمعية: زر عودة، لا تبويب «سجل الجمعيات | ملف الجمعية»
  const A = await p.evaluate(() => DB.find((o) => !o.closed).id);
  await p.evaluate((A) => open360(A), A); await p.waitForTimeout(1200);
  const hd = await p.evaluate(() => ({ back: !!$('#jstick .jsubt.jback'), tabs: $$('#jstick .jsubt:not(.jback) button').length, txt: ($('#jstick .jback button') || {}).textContent }));
  ok(hd.back && hd.tabs == 0 && /العودة إلى سجل الجمعيات/.test(hd.txt), 'record page header shows a back link instead of sibling tabs');
  await p.click('#jstick .jback button'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => ADM.mod == 'directory'), 'back link returns to the directory');
  // 2) التراخيص: لا عنصر في القائمة، والروابط القديمة تتحول إلى فلتر
  ok(await p.evaluate(() => !document.querySelector('.jside [data-m=licenses]')), 'no «التراخيص» item in the side nav');
  await p.evaluate(() => goMod('licenses')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => ADM.mod == 'directory' && ADM.dir.st == 'منتهي'), 'goMod("licenses") → directory filtered to expired');
  await p.evaluate(() => goMod('overview')); await p.waitForTimeout(500);
  await p.evaluate(() => $('.kpi.warn').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => ADM.mod == 'directory' && ADM.dir.st == 'ينتهي قريباً'), 'overview KPI opens directory filtered to «ينتهي قريباً»');
  // 3) النظرة السريعة بالهوية الجديدة
  await p.evaluate((A) => { goMod('directory', { st: '', q: '' }); openRec(A); }, A); await p.waitForTimeout(500);
  const q = await p.evaluate(() => ({ on: $('#adrawer').classList.contains('on'), adq: !!$('#adrawer .adq'), dark: !!$('#adrawer .dh'), needs: !!$('#adrawer .a3need'), foot: $$('#adrawer .adqf .jbtn').length, pri: ($('#adrawer .adqf .jbtn.pri') || {}).textContent }));
  ok(q.on && q.adq && !q.dark && q.needs && q.foot >= 3 && /فتح الملف الكامل/.test(q.pri), 'quick view: light header, needs strip, footer actions');
  await p.screenshot({ path: 'tests/out/quickview.png' });
  await p.click('#adrawer .adqf .jbtn.pri'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => ADM.mod == 'assoc' && !$('#adrawer').classList.contains('on')), '«فتح الملف الكامل» goes to the page and closes the drawer');
  // 4) إضافة إلى مجتمع
  const cm = await p.evaluate(() => { let c = COMMS.list.find((x) => x.kind != 'sector'); if (!c) { c = { id: 'ctest', n: 'مجتمع اختبار', kind: 'custom', rule: {}, inc: [], exc: [], vals: [], rules: [], perm: {}, space: '', pub: 0, st: 'active', at: new Date().toISOString(), log: [] }; COMMS.list.push(c); window.__cmTest = 1; } return c.id; });
  await p.evaluate(([A, cm]) => { CMEM.list = CMEM.list.filter((m) => !(m.aid == A && m.cid == cm)); SS('asirCommMem', CMEM); }, [A, cm]);
  await p.evaluate((A) => cmAddTo(A), A); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => ({ on: $('#modal').classList.contains('on'), grid: $$('.cmaw [data-ug]').length, dis: $('#cmaGo').disabled }));
  ok(d1.on && d1.grid >= 1 && d1.dis, 'add-to-community dialog lists manual communities, save disabled without change');
  await p.click(`.cmaw [data-ug="${cm}"]`); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !$('#cmaGo').disabled && /إضافة إلى 1/.test($('#cmaGoE').textContent)), 'ticking a community enables save and previews «إضافة إلى 1»');
  await p.click('#cmaGo'); await p.waitForTimeout(600);
  ok(await p.evaluate(([A, cm]) => CMEM.list.some((m) => m.aid == A && m.cid == cm && m.st == 'active'), [A, cm]), 'membership saved');
  await p.evaluate(() => a360Tab('rel')); await p.waitForTimeout(400);
  ok(await p.evaluate((cm) => $('.a3c[data-c=eco]').textContent.includes(cmById(cm).n), cm), 'engagement card shows the new community');
  // row menu entry
  await p.evaluate(() => goMod('directory')); await p.waitForTimeout(600);
  await p.evaluate(() => { const btn = document.querySelector('tr.cl [data-rm], tr.cl .rm, tr.cl button[title="إجراءات"]') || document.querySelector('tr.cl td:last-child button'); btn && btn.click(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!$('#rmenu.on [data-a=comm]')), 'row menu has «إضافة إلى مجتمع»');
  await p.evaluate(() => $('#rmenu').classList.remove('on'));
  // undo membership
  await p.evaluate((A) => cmAddTo(A), A); await p.waitForTimeout(300); await p.click(`.cmaw [data-ug="${cm}"]`); await p.click('#cmaGo'); await p.waitForTimeout(400);
  ok(await p.evaluate(([A, cm]) => !CMEM.list.some((m) => m.aid == A && m.cid == cm && m.st == 'active'), [A, cm]), 'unticking removes the membership');
  await p.evaluate(() => { if (window.__cmTest) { COMMS.list = COMMS.list.filter((c) => c.id != 'ctest'); SS('asirComms', COMMS); } CMEM.list = CMEM.list.filter((m) => m.cid != 'ctest'); SS('asirCommMem', CMEM); });
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
