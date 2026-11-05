// القرارات v2 (0.42): قوالب بمؤشر يُقاس تلقائياً، مهام، سجل، وتسجيل مشروع
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/decisions'); await p.waitForTimeout(1300);
  await p.evaluate(() => { DECX = []; PROJS = []; ADM.dec = {}; AM.decisions($('#acontent')) });
  await p.evaluate(() => decNew({ tpl: 'data' })); await p.waitForTimeout(300);
  await p.selectOption('#decF [name=gov]', 'أبها'); await p.evaluate(() => $('#decF').requestSubmit()); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const x = DECX[0]; return { tpl: x.tpl, base: x.base, cur: decCur(x), tg: x.target, tk: x.tasks.length, pid: !!x.pid, pj: PROJS.length, sc: x.scope.gov } });
  ok(r.tpl == 'data' && r.sc == 'أبها', 'decision created with template + scope');
  ok(r.base === r.cur && r.tg < r.base, 'metric baseline measured, target below baseline');
  ok(r.tk >= 3 && r.pid && r.pj == 1, 'tasks + project registered');
  await p.evaluate(() => { ADM.dxTab = 'tk'; decOpen(DECX[0].id) }); await p.waitForTimeout(300);
  await p.click('#adrawer [data-tk="0"]'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({ st: DECX[0].st, pr: decProg(DECX[0]).p, pst: PROJS[0].st, log: DECX[0].log.length }));
  ok(s.st == 'قيد التنفيذ' && s.pr > 0 && s.pst == 'قيد التنفيذ' && s.log >= 3, 'task completion moves status, progress, project');
  await p.evaluate(() => { closeAll(); ADM.decTab = 'auto'; AM.decisions($('#acontent')) }); await p.waitForTimeout(300);
  await p.click('[data-conv]'); await p.waitForTimeout(300); await p.evaluate(() => $('#decF').requestSubmit()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => DECX.length == 2 && Object.values(ADM.dec).some((m) => m.conv)), 'auto insight converted to decision');
  await p.evaluate(() => { closeAll(); goMod('projects') }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('#acontent [data-pd]').length >= 1), 'projects page lists registered projects');
  await p.evaluate(() => { DECX = []; PROJS = []; ADM.dec = {}; SS('asirDecX', DECX); SS('asirProjects', PROJS); SS('asirDec', ADM.dec) });
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
