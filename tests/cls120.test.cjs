// 1.20: دليل تصنيفات نوى — الشجرة كاملة، التعريفات في /api/lookups، القوائم المنسدلة بثلاث درجات في رابط التحديث،
// رفض الخادم لتركيبة غير قائمة، مطابقة البند في المراجعة، وأعمدة السجل وفلاتره والنافذة الجانبية والاسم الطويل.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);

  // 1) الشجرة والتعريفات
  const t = await p.evaluate(async () => { const j = await api('/api/lookups'); const L = (n) => j.fields.filter((f) => f.level == n); return { tree: [NCLS.length, NCLS.reduce((a, g) => a + g[2].length, 0), NCLS.reduce((a, g) => a + g[2].reduce((x, s) => x + s[1].length, 0), 0)], db: [L(1).length, L(2).length, L(3).length], def3: L(3).every((f) => f.def && f.sup), off: L(1).every((f) => f.official), unlinked: DB.filter((o) => !L(3).some((f) => f.name == o.s2)).length } });
  ok(t.tree.join() == '10,34,123' && t.db.join() == '10,34,123' && t.def3 && t.off && t.unlinked == 0, 'NCNP tree 10/34/123 in client and D1, every leaf has a definition and supervisor, every association linked ' + JSON.stringify(t));
  ok(await p.evaluate(() => !DB.some((o) => o.s2 == 'خدمات الأشخاص ذوي الإعاقة')), 'old name adopted: no association keeps «خدمات الأشخاص ذوي الإعاقة»');

  // 2) الأعمدة والفلاتر
  await p.evaluate(() => { ADM.dir.lay = 'table'; ADM.dir.view = 'main'; ADM.dir.cols = DVIEWS.main[1].slice(); DFIL.forEach((f) => ADM.dir[f[0]] = ''); renderAdmin() }); await W(p, 1200);
  ok(await p.evaluate(() => !DCOLS.some((c) => ['email', 'mobile', 'pres', 'del'].includes(c[0])) && DCOLS.some((c) => c[0] == 's1') && DCOLS.some((c) => c[0] == 's2') && Object.values(DVIEWS).every((v) => v[1].every((k) => DCOLS.some((c) => c[0] == k)))), 'column picker: contact fields folded into «بيانات التواصل», both sub-classifications added, every view uses known columns');
  const f = await p.evaluate(() => { const o = DB.find((x) => x.s2 == 'خدمات ذوي الاحتياجات الخاصة'); ADM.dir.s2 = o.s2; const n = dirList().length; ADM.dir.s2 = ''; return { n, want: DB.filter((x) => x.s2 == o.s2).length } });
  ok(f.n == f.want && f.n >= 13, 'second sub-classification filter works ' + JSON.stringify(f));
  ok(await p.evaluate(() => !!CLSX && Object.keys(CLSX.s2).length == 123), 'definitions index loaded for the registry');

  // 3) الاسم الطويل: سطر واحد، والاسم كاملاً عند المرور، دون تغيير عرض العمود
  const nm = await p.evaluate(() => { const th = $('#dirT th[data-col=n]'), w0 = th.getBoundingClientRect().width; const L = $$('#dirT .dvnt b'), b = L.find((x) => x.scrollWidth > x.clientWidth) || L[0]; b.textContent = b.textContent + ' ' + 'اسم إضافي طويل جداً لاختبار القص'.repeat(3); return { w0, w1: th.getBoundingClientRect().width, h: Math.round(b.getBoundingClientRect().height), i: L.indexOf(b) } });
  ok(Math.abs(nm.w0 - nm.w1) < 1 && nm.h <= 24, 'a long name stays on one line and does not widen the column ' + JSON.stringify(nm));
  await p.evaluate((i) => $$('#dirT .dvnt b')[i].scrollIntoView({ block: 'center' }), nm.i); await W(p, 400);
  const bb = await p.evaluate((i) => { const r = $$('#dirT .dvnt b')[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, nm.i);
  await p.mouse.move(bb[0], bb[1]); await W(p, 700);
  ok(await p.evaluate(() => { const t = $('#dvtip'); return t && !t.hidden && t.textContent.includes('اسم إضافي طويل') }), 'hovering a cut name shows it in full');
  await p.mouse.move(700, 100); await W(p, 300);
  ok(await p.evaluate(() => $('#dvtip').hidden), 'the tooltip hides when leaving');

  // 4) النافذة الجانبية
  await p.evaluate(() => { renderAdmin() }); await W(p, 500);
  const id = await p.evaluate(() => dirList()[0].id);
  await p.evaluate((id) => dirPeek(id), id); await W(p, 900);
  const dw = await p.evaluate(() => ({ qa: $$('#adrawer .adqas .adqa').length, cls: $$('#adrawer .adqcl li').length, def: !!$('#adrawer .adqcl p'), con: $$('#adrawer .dvppc li').length, foot: !!$('#adrawer .adqf .jbtn.pri'), nav: !!$('#adrawer .dvpk') }));
  ok(dw.qa >= 3 && dw.cls == 3 && dw.def && dw.con == 4 && dw.foot && dw.nav, 'peek drawer: quick actions, three-level classification with its definition, four contact rows, footer and navigation ' + JSON.stringify(dw));
  await p.evaluate(() => { window.__pp = SESSION.perms; SESSION.perms = { '*': 'read' } }); await p.evaluate((id) => dirPeek(id), id); await W(p, 400);
  ok(await p.evaluate(() => !$('#adrawer .adqas')), 'read-only role: no quick write actions in the drawer');
  await p.evaluate(() => { SESSION.perms = window.__pp; closeAll() }); await W(p, 300);

  // 5) رابط التحديث: ثلاث قوائم متتالية
  const aid = await p.evaluate(() => DB.find((o) => !o.closed && o.grp == 'الصحة').id);
  const url = await p.evaluate(async (aid) => (await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [aid], days: 2, pin: false }) })).links[0].url, aid);
  const q = await b.newPage(); q.on('pageerror', (e) => errs.push('portal: ' + e.message));
  await q.goto(url.replace(/^https?:\/\/[^/]+/, BASE)); await W(q, 1800);
  const s0 = await q.evaluate(() => ({ g: $('select[data-k=grp]').value, n1: $$('select[data-k=s1] option').length, s1: $('select[data-k=s1]').value, s2: $('select[data-k=s2]').value, full: $('select[data-k=grp] option:checked').textContent }));
  ok(s0.g == 'الصحة' && s0.n1 >= 4 && s0.s1 && s0.s2 && /الصحة \(|الصحة/.test(s0.full), 'portal: the three dropdowns open on the association\'s current classification ' + JSON.stringify(s0));
  await q.selectOption('select[data-k=grp]', 'البيئة'); await W(q, 500);
  const s1 = await q.evaluate(() => ({ s1: PS.d.s1, s2: PS.d.s2, o1: $$('select[data-k=s1] option').map((o) => o.textContent), dis: $('select[data-k=s2]').disabled }));
  ok(!s1.s1 && !s1.s2 && s1.o1.includes('حماية الحيوان والبيئة') && s1.dis, 'changing the main classification clears and refills the lower lists ' + JSON.stringify(s1).slice(0, 160));
  await q.selectOption('select[data-k=s1]', 'حفظ النعمة'); await W(q, 400);
  ok(await q.evaluate(() => { const o = $$('select[data-k=s2] option').map((x) => x.value).filter(Boolean); return o.length == 1 && o[0] == 'حفظ النعمة (الغذاء)' }), 'second list follows the first');
  // الخادم يرفض تركيبة غير قائمة
  const bad = await q.evaluate(async () => { const fd = new FormData(); fd.append('submitter_name', 'اختبار'); fd.append('submitter_role', 'المدير التنفيذي'); fd.append('data', JSON.stringify({ grp: 'البيئة', s1: 'حفظ النعمة', s2: 'المستشفيات' })); fd.append('confirm', '[]'); const r = await fetch('/api/u/' + PORTAL.token, { method: 'POST', body: fd }); return [r.status, ((await r.json()).error || {}).message] });
  ok(bad[0] == 422 && /القوائم/.test(bad[1] || ''), 'server refuses a classification that is not in the guide ' + JSON.stringify(bad));
  // تركيبة صحيحة تُرسل، والمراجعة تختار البند المطابق
  const good = await q.evaluate(async () => { const fd = new FormData(); fd.append('submitter_name', 'اختبار'); fd.append('submitter_role', 'المدير التنفيذي'); fd.append('data', JSON.stringify({ grp: 'البيئة', s1: 'حفظ النعمة', s2: 'حفظ النعمة (الغذاء)' })); fd.append('confirm', '[]'); const r = await fetch('/api/u/' + PORTAL.token, { method: 'POST', body: fd }); return [r.status, await r.json()] });
  ok(good[0] < 300 && good[1].id, 'a valid three-level choice is accepted ' + JSON.stringify(good).slice(0, 120));
  await q.close();
  if (good[1] && good[1].id) {
    await p.evaluate((id) => updReview(id), good[1].id); await W(p, 1200);
    const rv = await p.evaluate(() => { const s = $('#rvField'); return s ? (FIELDS3.find((f) => f.id == +s.value) || {}).l : null });
    ok(/البيئة › حفظ النعمة › حفظ النعمة \(الغذاء\)/.test(rv || ''), 'review preselects the matching official item ' + rv);
    await p.evaluate(async (id) => { closeAll(); await api(`/api/update-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ decision: 'reject' }) }) }, good[1].id); await W(p, 300);
  }
  ok(errs.length == 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
