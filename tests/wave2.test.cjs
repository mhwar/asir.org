// الموجة الثانية لتبويب الجمعيات: حقول الحجم والحوكمة، سجل التواصل، التنبيهات المجدولة، وبوابة التحديث
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); await p.addInitScript(() => { window.__noConfirm = true }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/#/admin/directory'); await p.waitForTimeout(1200);
  const id = await p.evaluate(() => DB.find((x) => x.st == 'ساري' && !x.closed).id);
  // 1) حقول الحجم والحوكمة عبر PUT full
  const saved = await p.evaluate(async (id) => { const j = await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { staff: '12', vols: '340', benef: '2500', assembly: '2024-03-10', finYear: '2024', revBand: '500 ألف – 2 مليون' } }) }); return j.data.profile; }, id);
  ok(saved.staff === 12 && saved.vols === 340 && saved.assembly === '2024-03-10' && saved.finYear === 2024 && saved.revBand === '500 ألف – 2 مليون', 'size & governance saved ' + JSON.stringify(saved));
  const bad = await p.evaluate(async (id) => { try { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { revBand: 'x' } }) }); return 'accepted'; } catch (e) { return e.message; } }, id);
  ok(bad !== 'accepted', 'invalid band rejected: ' + bad);
  // 2) سجل التواصل
  const log = await p.evaluate(async (id) => { const r = await api(`/api/associations/${id}/contact-log`, { method: 'POST', body: JSON.stringify({ channel: 'call', outcome: 'promised', summary: 'اتصال تجريبي — وعدوا بالتحديث', next_on: new Date().toISOString().slice(0, 10) }) }); const f = (await api(`/api/associations/${id}/full`)).data; return [r.data.id, f.log.length, f.log[0].channel]; }, id);
  ok(log[0] > 0 && log[1] >= 1 && log[2] === 'call', 'contact log add ' + JSON.stringify(log));
  // 3) الملف 360°: الحجم والحوكمة + التوصيات + سجل التواصل في تبويب المتابعة
  await p.evaluate((id) => { ADM.a360f = null; openAssoc(id, 'data'); }, id); await p.waitForTimeout(1500);
  const dataTab = await p.evaluate(() => document.body.innerText.includes('الحجم والحوكمة') && document.body.innerText.includes('2024-03-10'));
  await p.evaluate(() => { ADM.atab = 'ov'; renderAdmin(); }); await p.waitForTimeout(300);
  const recs = await p.evaluate((id) => hsOf(DBI[id]).recs.map((r) => r.t), id);
  ok(dataTab && recs.some((t) => t.includes('جمعية عمومية')), '360 governance ' + JSON.stringify([dataTab, recs.length]));
  await p.evaluate(() => { ADM.atab = 'follow'; renderAdmin(); }); await p.waitForTimeout(400);
  const follow = await p.evaluate(() => !!document.querySelector('#clF') && document.querySelectorAll('.trlog [data-cld]').length >= 1);
  ok(follow, 'contact log in follow tab');
  await p.screenshot({ path: 'tests/out/w2_follow.png' });
  // 4) التنبيهات: التشغيل اليدوي ثم القائمة (موعد المتابعة اليوم يولّد تنبيهاً)
  const run = await p.evaluate(async () => await api('/api/alerts/run', { method: 'POST' }));
  const al = await p.evaluate(async (id) => (await api('/api/alerts')).data.filter((a) => a.association_id == id && a.type == 'followup' && !a.done_at), id);
  ok(run.checked >= 1 && al.length >= 1, 'alerts computed ' + JSON.stringify([run, al.length]));
  const run2 = await p.evaluate(async () => await api('/api/alerts/run', { method: 'POST' }));
  ok(run2.created === 0, 'alerts idempotent');
  await p.evaluate(() => { ALERTS.loaded = false; goMod('alerts'); }); await p.waitForTimeout(1200);
  const page = await p.evaluate(() => document.querySelectorAll('[data-ald]').length >= 1 && document.querySelector('.jsubt button.on')?.dataset.m == 'alerts');
  ok(page, 'alerts tab under overview');
  await p.screenshot({ path: 'tests/out/w2_alerts.png' });
  await p.evaluate(async (id) => { for (const a of ALERTS.data.filter((x) => x.association_id == id && x.type == 'followup' && !x.done_at)) await api(`/api/alerts/${a.id}/done`, { method: 'POST' }); }, id); await p.waitForTimeout(300);
  const done = await p.evaluate(async (id) => (await api('/api/alerts?all=1')).data.filter((a) => a.association_id == id && a.type == 'followup').every((a) => a.done_at), id);
  ok(!!done, 'alert done');
  // 5) بوابة التحديث تعرض قسم الحجم والحوكمة
  const link = await p.evaluate(async (id) => (await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [id], days: 7 }) })), id);
  const u = link.data && link.data[0] ? link.data[0] : link.links && link.links[0];
  if (u && u.url) {
    const q = await ctx.newPage(); await q.goto(u.url.startsWith('http') ? u.url : BASE + u.url); await q.waitForTimeout(800);
    if (await q.$('input[name=pin]')) { await q.fill('input[name=pin]', u.pin || ''); await q.click('button'); await q.waitForTimeout(800); }
    const sec = await q.evaluate(() => (typeof PSEC != 'undefined' && PSEC.some((s) => s[0] == 'size')) && [...document.querySelectorAll('[data-k]')].some((x) => x.dataset.k == 'staff'));
    ok(sec, 'portal size section'); await q.screenshot({ path: 'tests/out/w2_portal.png' }); await q.close();
  } else ok(false, 'portal link ' + JSON.stringify(link).slice(0, 200));
  // تنظيف
  await p.evaluate(async ({ id, lid }) => { await api(`/api/associations/${id}/contact-log/${lid}`, { method: 'DELETE' }); await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { staff: '', vols: '', benef: '', assembly: '', finYear: '', revBand: '' } }) }); }, { id, lid: log[0] });
  console.log(JSON.stringify({ errs }));
  await b.close();
})();
