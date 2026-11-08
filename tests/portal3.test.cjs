// 0.90: صفحة ترحيب ورمز دخول تعرّف بالجمعية، وممثل البيانات، و«المدير التنفيذي هو المفوض نفسه»
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(800); await p.evaluate(() => go('admin')); await p.waitForTimeout(900);
  const prev = await p.evaluate(async () => (await api('/api/settings')).data.collect_personal);
  const pval = prev && typeof prev == 'object' ? prev.value : prev;
  await p.evaluate(async () => api('/api/settings', { method: 'PATCH', body: JSON.stringify({ values: { collect_personal: '1' } }) }));
  const id = await p.evaluate(() => DB.filter((o) => !o.closed && o.st == 'ساري')[12].id);
  const L = await p.evaluate(async (id) => { const j = await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [id], days: 3 }) }); return { url: j.links[0].url, pin: j.links[0].pin, n: DBI[id].n, lic: DBI[id].lic }; }, id);
  const url = L.url.replace(/^https?:\/\/[^/]+/, BASE);
  // 1) صفحة الترحيب قبل الرمز
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } }); q.on('pageerror', (e) => errs.push('gate: ' + e.message));
  await q.goto(url); await q.waitForTimeout(500);
  const g = await q.evaluate(() => ({ t: document.body.innerText, logo: document.querySelector('.top img') && document.querySelector('.top img').naturalWidth > 0, steps: document.querySelectorAll('.st li').length, need: document.querySelectorAll('.nd li').length, pin: !!document.querySelector('input[name=pin][autocomplete=one-time-code]') }));
  ok(g.t.includes(L.n) && g.t.includes(L.lic), 'gate shows the association name and licence before the code');
  ok(g.logo && g.steps == 3 && g.need >= 4 && g.pin, 'gate: council logo, welcome, three steps, what to prepare, code field');
  ok(!/@|05\d{8}/.test(g.t), 'gate exposes no personal data');
  await q.fill('input[name=pin]', '000000'); await q.click('button[type=submit]'); await q.waitForTimeout(500);
  ok(await q.evaluate((n) => document.body.innerText.includes(n) && !!document.querySelector('.e[role=alert]'), L.n), 'wrong code: error shown, page keeps the association identity');
  await q.screenshot({ path: 'tests/out/gate.png', fullPage: true });
  await q.fill('input[name=pin]', L.pin); await q.click('button[type=submit]'); await q.waitForTimeout(1800);
  ok(await q.evaluate(() => !!document.querySelector('.pvh')), 'correct code opens the update page');
  // 2) المدير التنفيذي هو المفوض نفسه
  const set = (k, v) => q.evaluate(([k, v]) => { const el = document.querySelector(`[data-k=${k}]`); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')) }, [k, v]);
  await set('del', 'مفوض اختبار'); await set('delEmail', 'del@example.org'); await set('delMobile', '0551234567'); await q.waitForTimeout(300);
  ok(await q.evaluate(() => !!document.querySelector('#pf_execSame') && !!document.querySelector('[data-k=exec]')), 'toggle «المدير التنفيذي هو المفوض نفسه» present; executive fields visible while off');
  await q.click('#pf_execSame .tg'); await q.waitForTimeout(300);
  const sm = await q.evaluate(() => ({ hid: !document.querySelector('[data-k=exec]'), e: PS.d.exec, m: PS.d.execEmail, mo: PS.d.execMobile }));
  ok(sm.hid && sm.e == 'مفوض اختبار' && sm.m == 'del@example.org' && sm.mo == '0551234567', 'turning it on hides the executive fields and copies the delegate');
  await set('delMobile', '0559999999'); await q.waitForTimeout(300);
  ok(await q.evaluate(() => PS.d.execMobile == '0559999999'), 'copied data stays in sync with the delegate');
  // 3) ممثل البيانات
  ok(await q.evaluate(() => !!document.querySelector('#ps_rep [data-k=repIs]') && !document.querySelector('[data-k=repName]')), 'data representative section: one question, details hidden until «شخص آخر»');
  await set('repIs', 'المدير التنفيذي'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => /مفوض اختبار/.test(document.querySelector('#pf_repInfo').textContent)), 'choosing «المدير التنفيذي» shows who that is (the delegate, since they are the same)');
  await set('repIs', 'شخص آخر'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => ['repName', 'repRole', 'repEmail', 'repMobile'].every((k) => document.querySelector(`[data-k=${k}]`))), '«شخص آخر» reveals name, role, email, mobile');
  await set('repName', 'ممثل اختبار'); await set('repRole', 'مسؤول البيانات'); await set('repEmail', 'rep@example.org');
  ok(await q.evaluate(() => !changed().some((f) => f.virt)), 'helper toggles are not sent as changes');
  // 4) الإرسال: من يرسل
  await q.evaluate(() => saveProfile()); await q.waitForTimeout(500);
  const sd = await q.evaluate(() => ({ n: document.querySelectorAll('.pvwho button').length, on: (document.querySelector('.pvwho button.on') || {}).textContent, name: document.querySelector('#psubf [name=submitter_name]').value, role: document.querySelector('#psubf [name=submitter_role]').value }));
  ok(sd.n >= 3 && /ممثل اختبار/.test(sd.on || '') && sd.name == 'ممثل اختبار' && sd.role == 'مسؤول البيانات', `submit dialog: sender choices, data representative preselected and prefilled (${sd.n})`);
  await q.evaluate(() => [...document.querySelectorAll('.pvwho button')].find((x) => /المفوض/.test(x.textContent)).click()); await q.waitForTimeout(200);
  ok(await q.evaluate(() => document.querySelector('#psubf [name=submitter_name]').value == 'مفوض اختبار' && /المفوض/.test(document.querySelector('#psubf [name=submitter_role]').value)), 'picking another person fills their name and role');
  await q.click('#psubb'); await q.waitForTimeout(1500);
  const rq = await p.evaluate(async (id) => { const r = (await api('/api/update-requests')).data.filter((x) => x.association_id == id).sort((a, b) => b.id - a.id)[0]; return r ? { f: r.fields || [], who: r.submitter_name, id: r.id } : null; }, id);
  ok(rq && rq.who == 'مفوض اختبار' && ['ممثل البيانات', 'اسم ممثل البيانات', 'اسم المدير التنفيذي'].every((x) => rq.f.includes(x)), 'request carries representative and copied executive fields' + (rq ? ' (' + rq.f.join('، ') + ')' : ''));
  // 5) الاعتماد يحفظ ممثل البيانات ويظهر في ملف الجمعية
  if (rq) { await p.evaluate(async (rid) => { const r = (await api(`/api/update-requests/${rid}`)).data; await api(`/api/update-requests/${rid}/review`, { method: 'POST', body: JSON.stringify({ decision: 'approve', apply: (r.items || []).map((i) => i.k) }) }); }, rq.id); }
  const full = await p.evaluate(async (id) => { const f = await recFull(id); return { is: f.profile.repIs, n: f.contacts.repName, e: f.contacts.exec }; }, id);
  ok(full.is == 'شخص آخر' && full.n == 'ممثل اختبار' && full.e == 'مفوض اختبار', 'after approval the record holds the data representative and the executive director');
  await p.evaluate((id) => recEdit(id, 'lead'), id); await p.waitForTimeout(800);
  ok(await p.evaluate(() => $('[name="p.repIs"]').value == 'شخص آخر' && $('[name="c.repName"]').value == 'ممثل اختبار'), 'team edit form shows the data representative');
  await p.evaluate(() => closeAll());
  // تنظيف
  await p.evaluate(async ([id, pv]) => { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { repIs: '' }, contacts: { repName: '', repRole: '', repEmail: '', repMobile: '', exec: '', execEmail: '', execMobile: '', del: '', delEmail: '', delMobile: '' } }) }); await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ values: { collect_personal: pv || '0' } }) }); }, [id, pval]);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
