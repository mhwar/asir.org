// 0.98: النطاق الجغرافي للجمعية (المقر ≠ نطاق الخدمة) في رابط التحديث والمراجعة والتحرير وملف الجمعية والصفحة العامة،
// وإعادة ترتيب الصفحة العامة (جمعيات مشابهة بعرض كامل، أدوات الفريق شريطاً عائماً). بلا فقد لأي بيانات سابقة.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PUB = process.env.PUB || 'http://127.0.0.1:8788';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  const id = await p.evaluate(() => DB.filter((o) => !o.closed && o.gov == 'أبها')[3].id);
  const before = await p.evaluate(async (id) => (await api(`/api/associations/${id}/full`)).data, id);
  // 1) رابط التحديث: سؤال النطاق، واختيار محافظات محددة
  const L = await p.evaluate(async (id) => (await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [id], days: 2, pin: false }) })).links[0].url, id);
  const q = await b.newPage({ viewport: { width: 1440, height: 1000 } }); q.on('pageerror', (e) => errs.push('portal: ' + e.message));
  await q.goto(L.replace(/^https?:\/\/[^/]+/, BASE)); await W(q, 1500);
  ok(await q.evaluate(() => $$('.pscope input[type=radio]').length == 4 && !$('#pf_scopeGovs')), 'update page asks «أين تقدّمون خدماتكم؟» with four options; governorate list hidden until «محافظات محددة»');
  await q.evaluate(() => { const r = $('.pscope input[value=govs]'); r.checked = true; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')) }); await W(q, 500);
  ok(await q.evaluate(() => !!$('#pf_scopeGovs') && !$$('#pf_scopeGovs .chips button').some((b) => b.textContent == PS.d.gov)), 'choosing «محافظات محددة» shows the governorates (without the HQ)');
  await q.evaluate(() => { const bs = $$('#pf_scopeGovs .chips button'); bs[0].click(); bs[1].click() });
  await q.evaluate(() => { const i = $('[data-k=branches]'); i.value = 'مكتب تجريبي'; i.dispatchEvent(new Event('input')) });
  const picked = await q.evaluate(() => PS.d.scopeGovs.slice());
  await q.evaluate(() => saveProfile()); await W(q, 500);
  await q.fill('#psubf [name=submitter_name]', 'اختبار'); await q.fill('#psubf [name=submitter_role]', 'المدير التنفيذي'); await q.click('#psubb'); await W(q, 1500);
  const rq = await p.evaluate(async (id) => { const r = await api('/api/update-requests'); return (r.data || []).find((z) => z.association_id == id && z.status == 'pending') }, id);
  ok(rq && ['نطاق الخدمة', 'محافظات نطاق الخدمة', 'الفروع والمكاتب'].every((k) => rq.fields.includes(k)), 'request carries scope, its governorates and branches');
  // 2) ملف الجمعية: بطاقة النطاق تقول «بانتظار الاعتماد»
  await p.evaluate((id) => { ADM.a360r = null; open360(id) }, id); await W(p, 1500);
  await p.evaluate(() => a360Tab('data')); await W(p, 600);
  ok(await p.evaluate(() => !!$('.a3c[data-c=scope]') && $$('.a3c[data-c=scope] .a3sct span').length >= 19 && /المقر: /.test($('.a360m').textContent)), 'file has a «النطاق الجغرافي» card with the governorate tiles, header shows HQ and scope');
  // 3) المراجعة: يظهر النوع بالعربية، والاعتماد يكتبه
  await p.evaluate((rid) => updReview(rid), rq.id); await W(p, 900);
  ok(await p.evaluate(() => /محافظات محددة/.test($('#adrawer').textContent)), 'review shows the scope type in Arabic, not its code');
  await p.evaluate(async (rid) => api(`/api/update-requests/${rid}/review`, { method: 'POST', body: JSON.stringify({ decision: 'approve', apply: ['scope', 'scopeGovs', 'branches'] }) }), rq.id);
  const after = await p.evaluate(async (id) => (await api(`/api/associations/${id}/full`)).data, id);
  ok(after.profile.scope == 'govs' && JSON.stringify(after.profile.scopeGovs) == JSON.stringify(picked) && after.profile.branches == 'مكتب تجريبي', 'approval saves type, governorates and branches');
  ok(after.association.governorate == before.association.governorate && after.profile.about == before.profile.about && JSON.stringify(after.profile.ben) == JSON.stringify(before.profile.ben) && after.association.license_no == before.association.license_no, 'HQ and all previous data untouched');
  // 4) التحرير: نوع غير «محددة» يمسح قائمة المحافظات، ومحافظة غير معروفة تُرفض
  const bad = await p.evaluate(async (id) => { try { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { scope: 'govs', scopeGovs: ['مدينة غير موجودة'] } }) }); return 'saved' } catch (e) { return e.message } }, id);
  ok(/غير معروفة/.test(bad), 'unknown governorate is refused');
  await p.evaluate(() => closeAll()); await p.evaluate((id) => recEdit(id, 'scope'), id); await W(p, 1200);
  ok(await p.evaluate(() => !!$('[data-rp=scope]') && $('#recF [name="p.scope"]').value == 'govs' && $$('#recScope button.on').length == 2), 'edit form has the scope section prefilled');
  await p.evaluate(() => { const s = $('#recF [name="p.scope"]'); s.value = 'region'; s.dispatchEvent(new Event('change', { bubbles: true })) }); await W(p);
  ok(await p.evaluate(() => getComputedStyle($('.recscg')).display == 'none'), 'governorate chips hide unless «محافظات محددة»');
  await p.click('#recSave'); await W(p, 1500);
  const ed = await p.evaluate(async (id) => (await api(`/api/associations/${id}/full`)).data.profile, id);
  ok(ed.scope == 'region' && ed.scopeGovs.length == 0 && ed.branches == 'مكتب تجريبي', 'saving «منطقة عسير كاملة» clears the specific list and keeps branches');
  ok(await p.evaluate((id) => scopeInfo(DBI[id]).label == 'منطقة عسير كاملة', id), 'register object updated without reload');
  // 5) الصفحة العامة
  const pub = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); pub.on('pageerror', (e) => errs.push('pub: ' + e.message));
  const lic = await p.evaluate((id) => DBI[id].lic, id);
  await pub.goto(PUB + '/association/' + lic); await W(pub, 2000);
  const pg = await pub.evaluate(() => ({ chips: $('.apchips').textContent, sec: !!$('.apscope'), txt: ($('.apscope') || {}).textContent || '', map: /نطاق/.test($('.apmap h3').textContent), sim: !!$('.apsim .apsimg'), tools: !!$('.aptools'), facts: $('.apfacts').textContent }));
  ok(/المقر: أبها/.test(pg.chips) && /نطاق الخدمة: منطقة عسير كاملة/.test(pg.chips), 'public header shows «المقر» and «نطاق الخدمة»');
  ok(pg.sec && /جميع محافظات منطقة عسير/.test(pg.txt) && /مكتب تجريبي/.test(pg.txt) && pg.map, '«أين تعمل الجمعية» section and the map shows HQ plus scope');
  ok(pg.sim && !pg.tools && /المقر/.test(pg.facts), 'similar associations full width at the bottom; no team tools for visitors');
  await pub.setViewportSize({ width: 390, height: 844 }); await W(pub, 400);
  ok(await pub.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'no horizontal overflow on mobile');
  // الفريق يرى شريط الأدوات العائم
  await p.goto(BASE + '/association/' + lic); await W(p, 2000);
  ok(await p.evaluate(() => !!$('.aptbar') && $$('.aptbar button').length == 4 && !$('.aptools')), 'team sees a floating tools bar instead of the side box');
  // تنظيف: إعادة الحقول كما كانت
  await p.evaluate(async ([id, pr]) => api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { scope: pr.scope || '', scopeGovs: pr.scopeGovs || [], branches: pr.branches || '' } }) }), [id, before.profile]);
  const fin = await p.evaluate(async (id) => (await api(`/api/associations/${id}/full`)).data.profile, id);
  ok(!fin.scope && !fin.branches, 'cleanup restores the empty scope');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
