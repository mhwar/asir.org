// «بيانات تحتاج تحقق»: علامة على حقل → تظهر في ملف الجمعية (شريط + الخانة) والسجل وجودة البيانات،
// تُغلق تلقائياً عند تعديل الحقل أو يدوياً بزر «تأكدنا منها»، ولا تظهر للجمعية في رابط التحديث.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(600);
  const A = 31;
  const r = await p.evaluate(async (A) => {
    const post = async (b) => { const r = await fetch(`/api/associations/${A}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
    const bad = (await post({ field: 'gov', kind: 'weird', text: 'xxx' }))[0];
    const nofield = (await post({ kind: 'verify', text: 'xxx' }))[0];
    const g = await post({ field: 'gov', kind: 'assumed', text: 'وُضعت أبها مؤقتاً، صحّحوها' });
    const f = await post({ field: 'field', kind: 'verify', text: 'التصنيف مقترح من تصنيف المركز الوطني' });
    const all = (await (await fetch('/api/flags')).json()).data.filter((x) => x.aid == A);
    return { bad, nofield, g: g[0], gid: g[1].id, fid: f[1].id, all, vis: g[1].notes.find((n) => n.id == g[1].id).visible };
  }, A);
  ok(r.bad == 422 && r.nofield == 422, 'invalid kind / missing field rejected');
  ok(r.g == 201 && r.all.length == 2 && r.vis == 0, 'flags created, internal (visible=0), listed in /api/flags');
  await p.reload(); await p.waitForTimeout(900);
  const pubv = await (await b.newContext()).newPage(); await pubv.goto(BASE + '/'); await pubv.waitForTimeout(800);
  const pv = await pubv.evaluate((A) => ({ gov: (assoc.find((x) => x.id == A) || {}).gov, govs: ALLG.length, hasUnk: ALLG.includes('غير محددة') }), A);
  ok(pv.gov == 'غير محددة' && !pv.hasUnk, 'public site hides an assumed governorate (shows «غير محددة», not counted as a governorate)');
  await p.evaluate((A) => { go('admin'); }, A); await p.waitForTimeout(900);
  await p.evaluate((A) => open360(A, 'data'), A); await p.waitForTimeout(1500);
  const v = await p.evaluate(() => ({ ban: document.querySelectorAll('.flgban li').length, cells: document.querySelectorAll('.flgcell').length, gov: !!document.querySelector('.a360m .flgtxt') }));
  ok(v.ban == 2, 'banner lists 2 flags on the association page');
  ok(v.cells >= 2, 'flagged cells highlighted in the data tab (' + v.cells + ')');
  ok(v.gov, 'governorate in the header marked');
  await p.screenshot({ path: 'tests/out/flags_360.png' });
  await p.evaluate(() => goMod('directory', { iss: 'flag' })); await p.waitForTimeout(800);
  const d = await p.evaluate(() => ({ rows: document.querySelectorAll('tr.cl').length, dots: document.querySelectorAll('.flgdot').length, iss: ADM.dir.iss, mod: ADM.mod, n: Object.keys(FLAGS).length, html: (document.querySelector('tr.cl')||{}).outerHTML?.slice(0,300) }));
  ok(d.rows >= 1 && d.dots >= 1, 'directory filter iss=flag + row marker (' + d.rows + ')');
  await p.evaluate(() => goMod('quality')); await p.waitForTimeout(800);
  const q = await p.evaluate(() => ({ panel: !!document.querySelector('.flgq'), rows: document.querySelectorAll('.flgq tbody tr').length }));
  ok(q.panel && q.rows >= 1, 'quality module shows the queue');
  await p.click('.flgq [data-fk=assumed]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('.flgq [data-fk=assumed]').classList.contains('on')), 'kind filter chip works');
  await p.screenshot({ path: 'tests/out/flags_quality.png', fullPage: true });
  // auto-resolve: change the governorate
  const auto = await p.evaluate(async (A) => {
    const cur = (await (await fetch('/api/associations/' + A)).json()).data;
    const g = cur.governorate_id == 1 ? 2 : 1;
    await fetch('/api/associations/' + A, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ governorate_id: g }) });
    await fetch('/api/associations/' + A, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ governorate_id: cur.governorate_id }) });
    return (await (await fetch('/api/flags')).json()).data.filter((x) => x.aid == A).map((x) => x.field);
  }, A);
  ok(auto.length == 1 && auto[0] == 'field', 'editing the governorate auto-resolved its flag');
  // manual resolve from the banner
  await p.evaluate(async () => { await flagsLoad(true); }); await p.waitForTimeout(300);
  await p.evaluate((A) => open360(A, 'ov'), A); await p.waitForTimeout(1500);
  await p.click('.flgban li .flga button:last-child'); await p.waitForTimeout(900);
  const left = await p.evaluate(async (A) => ({ api: (await (await fetch('/api/flags')).json()).data.filter((x) => x.aid == A).length, ban: !!document.querySelector('.flgban') }), A);
  ok(left.api == 0 && !left.ban, '«تأكدنا منها» resolves the flag and the banner disappears');
  // flag never reaches the association portal
  await p.evaluate(async (A) => fetch(`/api/associations/${A}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'email', kind: 'missing', text: 'علامة سرية للفريق' }) }), A);
  const link = await p.evaluate(async (A) => (await (await fetch('/api/update-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ association_ids: [A] }) })).json()).links[0], A);
  const asc = await (await b.newContext()).newPage(); await asc.goto(link.url); await asc.fill('input[name=pin]', link.pin); await asc.click('button'); await asc.waitForTimeout(1200);
  ok(!(await asc.content()).includes('علامة سرية للفريق'), 'flag text not shown in the association portal');
  // cleanup the remaining flag
  await p.evaluate(async (A) => { const L = (await (await fetch('/api/flags')).json()).data.filter((x) => x.aid == A); for (const f of L) await fetch(`/api/associations/${A}/notes/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) }); }, A);
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
