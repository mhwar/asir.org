// 0.85: تنبيهات المتابعة من الحالات والمشاريع، تقارير الحالة والمشروع بالمحرك الموحد، تذكير الترخيص حملةً، الصفحات الجديدة على الجوال.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  const [A, B] = await p.evaluate(() => { TRB.cases = []; trSave(); PROJS = PROJS.filter((x) => !x.__t); pjSave(); return DB.filter((o) => !o.closed && o.st == 'ساري').slice(0, 2).map((o) => o.id); });
  // 1) تنبيهات محلية: متابعة متأخرة، تدخل متأخر، مشروع متأخر، مرحلة متأخرة
  const al = await p.evaluate(([A, B]) => {
    const c = trNew(A, { src: 'team', types: ['تعثر مالي'], sev: 'عالية' }); trNorm(c); c.next = '2026-01-10'; c.nextWhat = 'اتصال'; c.ints.push({ id: 'i1', k: 'contact', t: 'تواصل مع الجمعية', st: 'planned', due: '2026-02-01', at: trNow() }); trSave();
    const pj = pjNew({ n: 'مشروع متأخر اختبار', kind: 'custom', to: '2026-03-01', o: 'سلطان' }); pj.__t = 1; pj.phases[0].to = '2026-02-01'; PROJS.push(pj); pjSave();
    const L = localAlerts(); return { types: L.map((x) => x.type), n: localAlertsN(), first: L[0] && L[0].due_on };
  }, [A, B]);
  ok(['trnext', 'trint', 'pjlate', 'pjphase'].every((t) => al.types.includes(t)) && al.n == 3, 'local alerts: late follow-up, late intervention, late project, late phase; badge counts the urgent three');
  ok(al.first == '2026-01-10', 'alerts sorted by due date');
  await p.evaluate(() => goMod('alerts')); await p.waitForTimeout(700);
  ok(await p.evaluate(() => !!$('.laq') && $$('.laq tbody tr').length >= 4 && /متابعة «/.test($('.laq').textContent)), 'alerts page shows «من المتابعة والمشاريع» panel');
  await p.evaluate(() => $$('.laq tbody .jbtn')[0].click()); await p.waitForTimeout(600);
  ok(await p.evaluate((A) => ADM.mod == 'trcase' && ADM.taid == A, A), 'alert «فتح» opens the case page');
  await p.evaluate(() => goMod('home')); await p.waitForTimeout(600);
  ok(await p.evaluate(() => /متابعات حالات تعثر متأخرة/.test($('#acontent').textContent) && /مشاريع أو مراحل تجاوزت موعدها/.test($('#acontent').textContent)), 'home actions include late follow-ups and late projects');
  // 2) تقرير الحالة وتقرير المشروع عبر محرك التصدير
  await p.evaluate((A) => trReport(A), A); await p.waitForTimeout(500);
  const r1 = await p.evaluate(() => ({ on: $('#modal').classList.contains('on'), t: ($('#modal h3') || {}).textContent, secs: $$('#modal [data-ug]').length }));
  ok(r1.on && /تقرير حالة تعثر/.test(r1.t) && r1.secs >= 5, 'case report opens in the unified export dialog with its sections');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.evaluate(() => { $$('#modal [data-uc=fmt]').find((x) => x.dataset.v == 'xlsx') && $$('#modal [data-uc=fmt]').find((x) => x.dataset.v == 'xlsx').click(); $('#modal .uifoot .btn.p').click(); })]);
  ok(!!dl, 'case report downloads (xlsx)');
  await p.evaluate(() => closeAll());
  await p.evaluate(() => pjReport(PROJS.find((x) => x.__t).id)); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && /تقرير مشروع/.test($('#modal h3').textContent) && $$('#modal [data-ug]').length >= 4), 'project report opens with its sections');
  await p.evaluate(() => closeAll());
  // 3) تذكير الترخيص من الحالة = حملة ترخيص لهذه الجمعية
  await p.evaluate((A) => { trOpen(A); }, A); await p.waitForTimeout(600);
  await p.evaluate((A) => trIntAdd(A, 'remind'), A); await p.waitForTimeout(400); await p.click('#trIGo'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && /حملة جديدة/.test($('#modal').textContent) && $('.dtpl button.on') && $('.dtpl button.on').dataset.ct == 'lic'), 'licence reminder opens a licence campaign for the association');
  await p.evaluate(() => closeAll());
  // 4) الجوال: صفحة الحالة وصفحة المشروع بلا تجاوز أفقي
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await m.goto(BASE + '/'); await m.waitForTimeout(700); await m.evaluate(() => go('admin')); await m.waitForTimeout(600);
  await m.evaluate((A) => trOpen(A), A); await m.waitForTimeout(800);
  const mob1 = await m.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pipe: getComputedStyle($('.trpipe')).gridTemplateColumns.split(' ').length, pri: !!$('.a3a .jbtn.pri') }));
  await m.screenshot({ path: 'tests/out/trcase-mobile.png', fullPage: true });
  ok(mob1.ov <= 2 && mob1.pipe <= 2 && mob1.pri, `case page on mobile: no horizontal overflow (${mob1.ov}px), 2-column pipeline`);
  await m.evaluate(() => pjOpen(PROJS.find((x) => x.__t).id)); await m.waitForTimeout(800);
  const mob2 = await m.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, tabs: $$('.pjtabs button').length }));
  await m.screenshot({ path: 'tests/out/proj-mobile.png', fullPage: true });
  ok(mob2.ov <= 2 && mob2.tabs == 6, `project page on mobile: no horizontal overflow (${mob2.ov}px)`);
  await m.context().close();
  // تنظيف
  await p.evaluate(() => { TRB.cases = []; trSave(); PROJS = PROJS.filter((x) => !x.__t); pjSave(); CAMPS.list = CAMPS.list.filter((c) => !/تذكير بتجديد الترخيص ·/.test(c.n)); SS('asirCamps', CAMPS); });
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
