// 1.17: إصلاحات المراجعة المستقلة لملف الجمعية — سلامة الحفظ، تهريب منجزات سجام، صلاحية الكتابة،
// المسودة عند تبديل التبويب، لوحة المفاتيح والتركيز، ومسار المطابقة المستقل في الخادم.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  // كل الكتابات تُعترض: الاختبار لا يغيّر بيانات الجمعيات
  const puts = [];
  await p.route('**/api/associations/*/full', (r) => { if (r.request().method() == 'PUT') { const d = r.request().postData() || ''; if (!/hsSnap/.test(d)) puts.push(d); r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"اعتراض الاختبار"}}' }) } else r.continue() });
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  const id = await p.evaluate(() => DB.find((o) => /آباء/.test(o.n)).id);
  await p.evaluate((id) => { ADM.a5tab = ''; ADM.a6aud = 0; ADM.a6t = {}; ADM.a6col = 0; open360(id) }, id); await W(p, 2500);

  // 1) قيمة خارج القائمة وتاريخ غير ISO لا يُمسحان عند الحفظ بلا تعديل
  await p.evaluate(() => { const f = ADM.a360f && ADM.a360f.data; if (f) { f.profile = f.profile || {}; f.profile.execType = 'دوام جزئي'; f.profile.assembly = '1446/05/01' } ADM.a6t.con = 'lead'; ADM.a6ed = 'con'; AM.assoc($('#acontent')) }); await W(p);
  const exS = await p.evaluate(() => { const s = $('.a6c.ed select[data-a6e=execType]'); return s ? s.value : null });
  ok(exS == 'دوام جزئي', 'a value outside the list stays selected (' + exS + ')');
  if (await p.$('.a6c.ed [data-a6sv]')) { await p.click('.a6c.ed [data-a6sv]'); await W(p, 600) }
  await p.evaluate(() => { ADM.a6t.place = 'gov'; ADM.a6ed = 'place'; AM.assoc($('#acontent')) }); await W(p);
  const exD = await p.evaluate(() => { const d = $('.a6c.ed [data-a6e=assembly]'); return d ? d.type + ':' + d.value : null });
  ok(exD == 'text:1446/05/01', 'a non-ISO date is shown as text, not blanked (' + exD + ')');
  if (await p.$('.a6c.ed [data-a6sv]')) { await p.click('.a6c.ed [data-a6sv]'); await W(p, 600) }
  ok(puts.length == 0, 'saving with nothing touched sends no request (sent ' + puts.length + ')');

  // 2) المسودة تبقى عند تبديل تبويب البطاقة، ويُرسل الملموس فقط
  await p.evaluate(() => { ADM.a6t.place = 'gov'; ADM.a6ed = 'place'; ADM.a6dr = null; AM.assoc($('#acontent')) }); await W(p);
  await p.evaluate(() => { const i = $('.a6c.ed input[data-a6e=staff]'); i.value = '١٢'; i.dispatchEvent(new Event('input')) }); await W(p);
  const other = await p.evaluate(() => { const b = $$('[data-a6c=place] .a6ct button').find((x) => !x.classList.contains('on')); return b ? b.dataset.a6t : '' });
  if (other) { await p.click(`[data-a6t="${other}"]`); await W(p); await p.click('[data-a6t="place:gov"]'); await W(p) }
  ok(await p.evaluate(() => { const i = $('.a6c.ed input[data-a6e=staff]'); return i && i.value == '١٢' && i.dataset.touched }), 'typed value survives a card-tab switch');
  await p.click('.a6c.ed [data-a6sv]'); await W(p, 700);
  const body = puts.length ? JSON.parse(puts[puts.length - 1]) : {};
  ok(body.profile && Object.keys(body.profile).join() == 'staff' && body.profile.staff == '12' && !body.contacts, 'only the touched field is sent, Arabic digits normalised (' + JSON.stringify(body) + ')');
  ok(await p.evaluate(() => !!$('.a6c.ed') && $('.a6c.ed [data-a6sv]').textContent.includes('حفظ') && !$('.a6c.ed [data-a6sv]').disabled), 'a failed save keeps edit mode and the button');
  // Escape يلغي ويعيد التركيز للقلم
  await p.focus('.a6c.ed input[data-a6e=staff]'); await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => !$('.a6c.ed') && !ADM.a6dr && document.activeElement && document.activeElement.hasAttribute('data-a6ed')), 'Escape cancels editing and returns focus to the pen');
  // تبويب «المقر والنطاق» بلا حقول تحرير: لا قلم
  await p.evaluate(() => { ADM.a6t.place = 'scope'; AM.assoc($('#acontent')) }); await W(p);
  ok(await p.evaluate(() => !$('[data-a6c=place] [data-a6ed]') || $$('[data-a6c=place] .a6r').some((r) => A6ED[r.dataset.a6f])), 'no pen on a card tab with no editable field');
  await p.evaluate(() => { ADM.a6t.place = 'gov'; AM.assoc($('#acontent')) });

  // 3) الانتقال لجمعية أخرى لا يحمل وضع التحرير
  await p.evaluate(() => { ADM.a6ed = 'place'; ADM.a6dr = { staff: '9' }; a360Nav(1) }); await W(p, 1500);
  ok(await p.evaluate(() => !ADM.a6ed && !ADM.a6dr && !$('.a6c.ed')), 'moving to the next association leaves edit mode');
  await p.evaluate((id) => open360(id), id); await W(p, 2000);

  // 4) لوحة المفاتيح: الأسهم داخل التبويبات لا تنقل الجمعية، والتركيز يبقى
  await p.focus('[data-a6tab=rel]'); await p.keyboard.press('Enter'); await W(p);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.a6tab == 'rel' && ADM.a5tab == 'rel'), 'focus stays on the tab after Enter');
  const a0 = await p.evaluate(() => ADM.aid); await p.keyboard.press('ArrowLeft'); await W(p, 700);
  ok(await p.evaluate((a) => ADM.aid == a, a0), 'ArrowLeft on a tab does not jump to another association');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('4'); await W(p);
  ok(await p.evaluate(() => ADM.a5tab == 'pj' && $('.a6tabs .on').dataset.a6tab == 'pj'), 'key 4 opens the projects tab');
  await p.evaluate(() => { ADM.a5tab = 'data'; AM.assoc($('#acontent')) }); await W(p);

  // 5) تهريب منجزات سجام المخزّنة
  const xss = await p.evaluate((id) => {
    const prev = SJ; SJ = { at: '2026-11-25', items: [{ id: '1" onmouseover="window.__x=1', t: 'اختبار', sid: 99, sn: DBI[id].n, doc: 'javascript:window.__x=1' }], map: {} }; ADM.sjIx = null;
    const h = sjOf(id).map(sjCard).join(''); const d = document.createElement('div'); d.innerHTML = h;
    const r = { onm: !!d.querySelector('[onmouseover]'), js: [...d.querySelectorAll('a')].some((a) => /^javascript:/i.test(a.getAttribute('href'))), href: (d.querySelector('a') || {}).getAttribute && d.querySelector('a').getAttribute('href') };
    SJ = prev; ADM.sjIx = null; return r }, id);
  ok(!xss.onm && !xss.js && /achievements\/1$/.test(xss.href || ''), 'stored Sijam item cannot inject attributes or javascript: links (' + xss.href + ')');
  ok(await p.evaluate(() => a6Id("x');window.__p=1;//") == 'xwindow__p1'), 'link ids in onclick handlers are reduced to safe characters');

  // 6) الخادم: asirSijam لا يُكتب من مسار الحالة العام، والمطابقة لها مسارها
  const st = await p.evaluate(async () => (await fetch('/api/state/asirSijam', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: '{}', version: 0 }) })).status);
  ok(st == 405, 'PUT /api/state/asirSijam is refused (' + st + ')');
  const mp = await p.evaluate(async () => { const r = await fetch('/api/sijam/map', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'x' }) }); return r.status });
  ok(mp == 422, 'an invalid map is rejected (' + mp + ')');

  // 7) دور الاطلاع: لا أزرار كتابة
  await p.evaluate(() => { window.__pp = SESSION.perms; SESSION.perms = { '*': 'read' }; AM.assoc($('#acontent')) }); await W(p);
  ok(await p.evaluate(() => !$('[data-a6rq]') && !$('[data-a6ed]') && !$('#a6qlog') && !$('.a5mb') && !$$('.a3more [role=menuitem]').some((b) => /تحرير البيانات|نوع العضوية/.test(b.textContent))), 'read-only role sees no write controls');
  await p.evaluate(() => { a6Mem(ADM.aid) }); await W(p);
  ok(await p.evaluate(() => !$('#modal').classList.contains('on') || !$('#mmGo')), 'membership dialog does not open for read-only');
  await p.evaluate(() => { SESSION.perms = window.__pp; closeAll(); AM.assoc($('#acontent')) }); await W(p);

  // 8) الإعلانات والعدّ
  ok(await p.evaluate(() => $('#toast').getAttribute('role') == 'status' && $('#toast').getAttribute('aria-live') == 'polite'), 'toast is a polite live region');
  ok(await p.evaluate(() => arN(1, 'منجز', 'منجزان', 'منجزات', 'منجزاً') == 'منجز واحد' && arN(2, 'منجز', 'منجزان', 'منجزات', 'منجزاً') == 'منجزان' && arN(4, 'منجز', 'منجزان', 'منجزات', 'منجزاً') == '4 منجزات' && arN(58, 'منجز', 'منجزان', 'منجزات', 'منجزاً') == '58 منجزاً'), 'Arabic number agreement helper');

  // 9) قائمة «المزيد» داخل الشاشة
  await p.evaluate(() => { const m = $$('.a6hd .a3more').pop(); m.querySelector('button').click() }); await W(p);
  const mx = await p.evaluate(() => { const r = $$('.a6hd .a3more.open>div').pop().getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)] });
  ok(mx[0] >= 0 && mx[1] <= 1440, '«المزيد» menu stays on screen (' + mx + ')');
  await p.mouse.click(700, 600); await W(p);

  // 10) نافذة طلب الناقص: الأزرار أسفل القائمة لا فوقها
  if (await p.$('[data-a6rq]')) {
    await p.click('[data-a6rq]'); await W(p, 500);
    const g = await p.evaluate(() => { const l = $('#modal .a6rqd').getBoundingClientRect(), f = $('#modal .uifoot').getBoundingClientRect(); return [Math.round(l.bottom), Math.round(f.top)] });
    ok(g[1] >= g[0] - 1, 'request dialog footer sits below the list (' + g + ')');
    await p.keyboard.press('Escape'); await W(p, 400);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-a6rq')), 'closing the dialog returns focus to the button that opened it');
  }

  // 11) الجوال: الرأس المصغّر لا يغطي التبويبات
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { ADM.a6col = 1; AM.assoc($('#acontent')) }); await W(p, 500);
  await p.evaluate(() => scrollTo(0, 700)); await W(p, 600);
  ok(await p.evaluate(() => { const t = $('.a6tabs').getBoundingClientRect(), e = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return !!(e && e.closest('.a6tabs')) }), 'mobile: collapsed header leaves the tabs visible');
  ok(await p.evaluate(() => $$('.a6ib').filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 43)), 'mobile: icon buttons are at least 44px');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 391), 'mobile: no horizontal overflow');
  await p.evaluate(() => { ADM.a6col = 0 });
  ok(errs.length == 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
