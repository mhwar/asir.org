// 0.88: صفحة رابط التحديث بلغة المنصة + المؤشر الحي، ونافذة المؤشر في رأس ملف الجمعية.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(800); await p.evaluate(() => go('admin')); await p.waitForTimeout(900);
  // 1) نافذة المؤشر في رأس ملف الجمعية
  const id = await p.evaluate(() => DB.filter((o) => !o.closed && o.st == 'ساري')[9].id);
  await p.evaluate((id) => open360(id), id); await p.waitForTimeout(1500);
  await p.click('.a360s .hspk'); await p.waitForTimeout(300);
  const pk = await p.evaluate(() => ({ on: !!$('#hsPk'), dims: $$('#hsPk .hspr').length, conf: /ثقة/.test($('#hsPk').textContent), gaps: $$('#hsPk li').length, btns: $$('#hsPk .hspf button').length }));
  ok(pk.on && pk.dims == 3 && pk.conf && pk.gaps > 0 && pk.btns >= 2, 'clicking the header index opens the index panel (three scores, confidence, biggest gains, actions)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !$('#hsPk')), 'Escape closes the panel');
  await p.click('.a360s .hspk'); await p.waitForTimeout(200); await p.evaluate(() => $$('#hsPk .hspf button')[0].click()); await p.waitForTimeout(700);
  ok(await p.evaluate(() => ADM.atab == 'dev' || !!$('#a3-score:not(.fold)')), '«كل المؤشرات» moves to the development tab and the index card');
  // لقطة المؤشر تُحفظ عند فتح الملف
  // 2) رابط تحديث بلقطة
  const L = await p.evaluate(async (id) => { hsAll(); const sn = hsSnapOf(DBI[id]); const j = await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [id], days: 3, pin: false, hs: { [id]: sn } }) }); return { url: j.links[0].url, s: sn.s } }, id);
  const q = await b.newPage({ viewport: { width: 1440, height: 1000 } }); q.on('pageerror', (e) => errs.push('portal: ' + e.message));
  await q.goto(L.url.replace(/^https?:\/\/[^/]+/, BASE)); await q.waitForTimeout(1500);
  const pv = await q.evaluate(() => ({ head: !!$('.pvh'), idx: !!$('.pvidx'), s: hsPortal(PS.d).s, need: $$('.pvneed li').length, secs: $$('.pvsec').length, nav: $$('.pvnav button').length, lead: !!$('#ps_lead'), plat: !!$('#ps_plat'), execT: !!$('[data-k=execType]'), vol: !!$('[data-k=volSt]') }));
  ok(pv.head && pv.idx && pv.secs >= 6 && pv.nav == pv.secs, 'update page in the platform design: identity header, index widget, section cards, side navigation');
  ok(Math.abs(pv.s - L.s) <= 3, `page index matches the council's figure (${pv.s} vs ${L.s})`);
  ok(pv.need > 0, '«ما يرفع مؤشركم» lists the biggest gains with a button to each field');
  ok(pv.lead && pv.plat && pv.execT && pv.vol, 'executive director and platforms sections present (even without personal data)');
  // 3) المؤشر يرتفع مع الإدخال
  const set = async (k, v) => q.evaluate(([k, v]) => { const el = document.querySelector(`[data-k=${k}]`); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')) }, [k, v]);
  const s0 = await q.evaluate(() => hsPortal(PS.d).s);
  await set('volSt', 'مفعّلة'); await set('volLast', new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10)); await set('execType', 'متفرغ'); await q.waitForTimeout(500);
  const up = await q.evaluate(() => ({ s: hsPortal(PS.d).s, em: $('.pvidx em').textContent, ring: $('.pvidx text').textContent }));
  ok(up.s > s0 && /▲ الفاعلية \+\d+/.test(up.em) && up.ring == String(up.s), `index rises live while filling (${s0} → ${up.s}, «${up.em}»)`);
  // 4) تفاصيل المؤشر للجمعية
  await q.click('.pvidx'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => $('#modal').classList.contains('on') && $$('.pviw .pvil li').length == HS_IND.filter((i) => i.dim != 'eng').length && /كانت \d+ عند فتح الرابط/.test($('.pviw').textContent)), 'index details: profile completeness and effectiveness indicators, with before/after');
  await q.evaluate(() => closeAll());
  // 5) الإرسال يحمل الحقول الجديدة
  await q.evaluate(() => saveProfile()); await q.waitForTimeout(500);
  await q.fill('#psubf [name=submitter_name]', 'اختبار'); await q.fill('#psubf [name=submitter_role]', 'المدير التنفيذي'); await q.click('#psubb'); await q.waitForTimeout(1200);
  const req = await p.evaluate(async (id) => { const r = await api('/api/update-requests'); const x = (r.data || []).find((z) => z.association_id == id && z.status == 'pending'); return x ? x.fields : [] }, id);
  ok(['حساب الجمعية في المنصة الوطنية للعمل التطوعي', 'طبيعة عمل المدير التنفيذي', 'تاريخ آخر فرصة تطوعية منشورة'].every((k) => req.includes(k)), 'submitted request carries platform status and executive director (' + req.join(',') + ')');
  ok(await q.evaluate(() => /▲/.test($('.pvidx em').textContent)), 'after sending, the page still shows the gain since the link was opened');
  // الجوال
  await q.setViewportSize({ width: 390, height: 844 }); await q.waitForTimeout(400);
  ok(await q.evaluate(() => document.querySelector('#portal').scrollWidth <= document.querySelector('#portal').clientWidth + 2), 'no horizontal overflow on mobile');
  // تنظيف: رفض الطلب
  await p.evaluate(async (id) => { const r = await api('/api/update-requests'); for (const x of (r.data || []).filter((z) => z.association_id == id && z.status == 'pending')) { try { await api(`/api/update-requests/${x.id}/review`, { method: 'POST', body: JSON.stringify({ decision: 'reject', note: 'اختبار' }) }) } catch (e) {} } }, id);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
