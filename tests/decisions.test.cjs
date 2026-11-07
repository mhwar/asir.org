// القرارات v2 (0.42): قوالب بمؤشر يُقاس تلقائياً، مهام، سجل، وتسجيل مشروع
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/decisions'); await p.waitForTimeout(1300);
  await p.evaluate(() => { DECX = []; PROJS = []; CAMPS.list = []; ADM.dec = {}; AM.decisions($('#acontent')) });
  await p.evaluate(() => decNew({ tpl: 'data' })); await p.waitForTimeout(300);
  await p.selectOption('#decF [name=gov]', 'أبها'); await p.evaluate(() => $('#decF').requestSubmit()); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const x = DECX[0]; return { tpl: x.tpl, base: x.base, cur: decCur(x), tg: x.target, tk: decTasks(x).length, dt: x.tasks.length, ph: decPj(x) && decPj(x).phases.length, pid: !!x.pid, pj: PROJS.length, sc: x.scope.gov } });
  ok(r.tpl == 'data' && r.sc == 'أبها', 'decision created with template + scope');
  ok(r.base === r.cur && r.tg < r.base, 'metric baseline measured, target below baseline');
  ok(r.tk >= 3 && r.dt == 0 && r.ph == 3 && r.pid && r.pj == 1, 'tasks moved into project phases (single source)');
  await p.evaluate(() => { ADM.dxTab = 'tk'; decOpen(DECX[0].id) }); await p.waitForTimeout(300);
  await p.click('#adrawer [data-tk="0"]'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({ st: DECX[0].st, pr: decProg(DECX[0]).p, pst: PROJS[0].st, log: DECX[0].log.length }));
  ok(s.st == 'قيد التنفيذ' && s.pr > 0 && s.pst == 'قيد التنفيذ' && s.log >= 3, 'task completion moves status, progress, project');
  await p.evaluate(() => { closeAll(); ADM.decTab = 'auto'; AM.decisions($('#acontent')) }); await p.waitForTimeout(300);
  await p.click('[data-conv]'); await p.waitForTimeout(300); await p.evaluate(() => $('#decF').requestSubmit()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => DECX.length == 2 && Object.values(ADM.dec).some((m) => m.conv)), 'auto insight converted to decision');
  await p.evaluate(() => { closeAll(); goMod('projects') }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('#acontent [data-pj]').length >= 1), 'projects page lists projects');
  // المشروع: مرحلة، شريك، مستفيد، مخرج، وحالة تنعكس على القرار
  const pj = await p.evaluate(() => { const x = PROJS[0]; ADM.pjTab = 'ph'; pjOpen(x.id); $('#phA').t.value = 'متابعة لاحقة'; $('#phA').requestSubmit(); ADM.pjTab = 'pb'; pjOpen(x.id); const f = $('#prA'); f.n.value = 'جهة اختبار'; f.amt.value = '1000'; f.requestSubmit();
    ADM.pjTab = 'out'; pjOpen(x.id); $('#otA').t.value = 'تقرير'; $('#otA').requestSubmit(); ADM.pjTab = 'ov'; pjOpen(x.id); $('#acontent [data-pst="مكتمل"]').click();
    const D = DECX.find((d) => d.id == x.did); return { ph: x.phases.length, pa: x.partners.length, out: x.outs.length, st: x.st, dst: D.st, prog: pjProg(x) } });
  ok(pj.ph == 4 && pj.pa == 1 && pj.out == 1, 'project phases/partners/outputs editable');
  ok(pj.st == 'مكتمل' && pj.dst == 'منفّذ' && pj.prog == 1, 'project completion closes decision');
  // الحملة من القرار: جمهور مثبّت ونتيجة تُقاس من البيانات
  const cp = await p.evaluate(() => { closeAll(); const D = DECX[0]; campNew({ tp: 'data', rule: D.scope, did: D.id }); $('#cpF').requestSubmit(); const c = CAMPS.list[0]; ADM.cpTab = 'ov'; campOpen(c.id); $('#cpSend').click();
    const r = campRes(c); return { st: c.st, aud: c.aud.length, did: c.did == D.id, pid: c.pid == D.pid, n: r.n, logD: D.log.some((l) => l.t.includes('أُرسلت الحملة')) } });
  ok(cp.st == 'أُرسلت' && cp.aud > 0 && cp.n == cp.aud, 'campaign send snapshots audience');
  ok(cp.did && cp.pid && cp.logD, 'campaign linked to decision + project and logged');
  await p.evaluate(() => { closeAll(); goMod('campaigns') }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $$('#acontent [data-cp]').length == 1 && $$('#acontent [data-cnew]').length >= 3), 'campaigns page: table + opportunities');
  await p.evaluate(() => { DECX = []; PROJS = []; CAMPS.list = []; ADM.dec = {}; SS('asirDecX', DECX); SS('asirProjects', PROJS); SS('asirDec', ADM.dec) });
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
