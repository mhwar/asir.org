// السياق الموحد للوحة (0.49): ترويسة واحدة، تبويبات ومرشحات موحدة، الحالة في الرابط، الدرج في سجل التصفح
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const E = (p, f, a) => Promise.race([p.evaluate(f, a), new Promise((_, rj) => setTimeout(() => rj(new Error('evaluate timeout')), 25000))]);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const W = (p, ms) => p.waitForTimeout(ms || 450);
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1366, height: 860 } }); await p.addInitScript(() => { window.__noConfirm = true }); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/#/admin/home'); await W(p, 1600);
  // 1) كل الصفحات: عنوان واحد، زر أساسي واحد على الأكثر وفي الترويسة فقط، لا تكرار للصفحة الحالية في المسار
  const all = await E(p, async () => { const bad = []; for (const m of MODS.map((x) => x[0]).filter((m) => can(m) && m != 'home')) { goMod(m); await new Promise((r) => setTimeout(r, 120)); const pri = $$('#jstick .acts2 .jbtn.pri').length, inPri = $$('#acontent .jbtn.pri').length, h1 = $$('.jph h1').length, crumbDup = !!$('.jcrumb .cur'), hash = location.hash.startsWith('#/admin/' + (m == 'assoc' && ADM.aid ? 'assoc-' : m == 'comm' && ADM.cid ? 'comm-' : m)); if (pri > 1 || inPri || h1 != 1 || crumbDup || !hash) bad.push({ m, pri, inPri, h1, crumbDup, hash: location.hash }) } return bad });
  ok(!all.length, 'every page: one title, at most one primary action (header only), no duplicated crumb, URL matches ' + JSON.stringify(all));
  // 2) نمط تبويب واحد (خط سفلي) للتبويبات الفرعية وتبويبات الدرج؛ المرشحات مقطعية
  const st = await E(p, () => { goMod('content'); const t = getComputedStyle($('#acontent .tabs2>button.on')), s = getComputedStyle($('#acontent .tabs2')); const r = { tb: t.borderBottomWidth, tbg: t.backgroundColor, line: s.borderBottomStyle }; goMod('mops'); r.fbg = getComputedStyle($('#acontent .csf')).backgroundColor; return r });
  ok(st.tb == '2px' && /rgba\(0, 0, 0, 0\)|transparent/.test(st.tbg) && st.line == 'solid' && st.fbg != 'rgba(0, 0, 0, 0)', 'tabs share the underline style; filters keep the segmented style');
  // 3) المرشحات في الرابط وتُستعاد بعد إعادة التحميل
  await E(p, () => { goMod('partners'); ADM.pt.tab = 'council'; ADM.pt.f = 'exp'; AM.partners($('#acontent')) }); await W(p, 200);
  const h1 = await E(p, () => location.hash);
  ok(/#\/admin\/partners\?f=exp/.test(h1), 'partner filter is written to the URL ' + h1);
  await E(p, () => { ADM.pt.f = 'all'; AM.partners($('#acontent')) }); await W(p, 200);
  ok((await E(p, () => location.hash)) == '#/admin/partners', 'default filter leaves a clean URL');
  await p.goto(BASE + '/#/admin/mops?f=done&k=forum'); await W(p, 1600);
  const rl = await E(p, () => ({ mod: ADM.mod, f: ADM.evF, k: ADM.evK, on: ($('#acontent .csf button.on') || {}).textContent || '', rows: $$('#acontent [data-ev]').length, kinds: [...new Set($$('#acontent [data-ev]').map((r) => EVTS.list.find((e) => e.id == r.dataset.ev).kind))] }));
  ok(rl.mod == 'mops' && rl.f == 'done' && rl.k == 'forum' && rl.on.includes('المنتهية') && rl.rows > 0 && rl.kinds.join() == 'forum', 'opening a shared link restores page + filters');
  // 4) فتح سجل = صفحة كاملة وخطوة في سجل التصفح؛ الرجوع يعود إلى القائمة بفلاترها
  await E(p, () => { ADM.evTab = 'ov'; evOpen('c-x-ev-tawasul') }); await W(p, 300);
  const o = await E(p, () => ({ h: location.hash, mod: ADM.mod, page: !!document.querySelector('.aspage'), dark: !!document.querySelector('.aspage .dh:not(.dhl)'), back: ($('#jstick .jback button') || {}).textContent }));
  ok(o.mod == 'ev' && o.page && !o.dark && /#\/admin\/ev-c-x-ev-tawasul/.test(o.h) && /العودة إلى الفعاليات/.test(o.back), 'opening a record opens a light full page with its own URL and a back link ' + o.h);
  await p.goBack(); await W(p, 600);
  const bk = await E(p, () => ({ h: location.hash, page: !!document.querySelector('.aspage'), mod: ADM.mod, f: ADM.evF }));
  ok(!bk.page && bk.mod == 'mops' && bk.f == 'done' && /f=done/.test(bk.h), 'browser back returns to the list and keeps its filters');
  await p.goForward(); await W(p, 600);
  ok(await E(p, () => ADM.mod == 'ev' && /تواصل/.test($('.aspage .dh').textContent)), 'browser forward reopens the same record page');
  // 5) زر العودة في الرأس يعود إلى القائمة
  await E(p, () => $('#jstick .jback button').click()); await W(p, 500);
  ok(await E(p, () => ADM.mod == 'mops' && !document.querySelector('.aspage')), 'header back link returns to the list');
  // 6) رابط مباشر لسجل مع تبويبه
  await p.goto(BASE + '/#/admin/pt-16?dt=ob'); await W(p, 1600);
  const dl = await E(p, () => ({ mod: ADM.mod, t: ($('#adrawer [data-ptt].on') || {}).dataset || {}, h: location.hash }));
  ok(dl.mod == 'pt' && dl.t.ptt == 'ob', 'deep link opens the record page on the requested tab');
  // 7) تبديل التبويب يحدّث الرابط، وEsc يغلق النافذة فقط ويبقي الصفحة
  await E(p, () => $('#adrawer [data-ptt="fu"]').click()); await W(p, 300);
  ok(/dt=fu/.test(await E(p, () => location.hash)), 'record tab is kept in the URL');
  await E(p, () => ptEdit(16)); await W(p, 150); await p.keyboard.press('Escape'); await W(p, 150);
  ok(await E(p, () => !$('#modal').classList.contains('on') && ADM.mod == 'pt' && !!document.querySelector('.aspage')), 'Escape closes the modal and keeps the record page');
  await E(p, () => goMod('partners')); await W(p, 400);
  // 8) الترويسة تتجدد مع التبويب (زر الإنشاء يتبع التبويب)
  const hd = await E(p, () => { ADM.pt.tab = 'between'; AM.partners($('#acontent')); const a = $('#jstick .acts2').textContent; ADM.pt.tab = 'council'; AM.partners($('#acontent')); return { a, b: $('#jstick .acts2').textContent } });
  ok(/توثيق شراكة/.test(hd.a) && /شراكة جديدة/.test(hd.b), 'header create action follows the active tab');
  // 9) الجرس: قائمة ما يحتاج انتباهاً، وكل عنصر ينقل للصفحة المعنية
  const bl = await E(p, () => { $('#bellBtn').click(); const n = $$('#jntf .jntf-i').length, cnt = ($('.jcnt') || {}).textContent; const it = $('#jntf .jntf-i'); it && it.click(); return { n, cnt, closed: !$('#jntf'), mod: ADM.mod } });
  ok(bl.n > 0 && String(bl.n) == String(bl.cnt) && bl.closed && bl.mod != 'partners', 'bell opens the attention list, badge matches, item navigates');
  // 10) لوحة المفاتيح: الصفوف قابلة للتركيز وEnter يفتح
  await E(p, () => goMod('projects')); await W(p, 200);
  const kb = await E(p, async () => { goMod('mops'); ADM.evF = 'done'; AM.mops($('#acontent')); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))); const r = $('#acontent tr.cl'); const pressed = $('#acontent .csf button.on').getAttribute('aria-pressed'); r.focus(); r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return { tab: r.tabIndex, pressed } });
  await W(p, 300);
  ok(kb.tab == 0 && kb.pressed == 'true' && await E(p, () => ADM.mod == 'ev'), 'rows are keyboard-focusable, Enter opens the record page, filter buttons expose aria-pressed');
  await E(p, () => goMod('mops')); await W(p, 500);
  // 11) شريط التقدم لا يتداخل مع النسبة، وعرض الجوال يطوي البطاقات
  ok(await E(p, () => { goMod('directory'); const c = $('#dirT .cbar'); return !c || getComputedStyle(c).overflow != 'hidden' }), 'completeness bar no longer clips its label');
  await p.setViewportSize({ width: 390, height: 844 }); await W(p, 300);
  ok(await E(p, () => { const q = $('.jq'); return getComputedStyle(q).display == 'flex' && q.scrollWidth > q.clientWidth && getComputedStyle($('#jstick')).position == 'static' }), 'mobile: quick filters scroll in one row, header not sticky');
  const mc = await E(p, async () => { goMod('directory'); await new Promise((r) => setTimeout(r, 300)); const t = $('#dirT'), tr = t.querySelector('tbody tr'), td = tr.querySelector('td[data-l]'); return { head: getComputedStyle(t.querySelector('thead')).display, card: getComputedStyle(tr).display, lab: td && td.dataset.l, before: td && getComputedStyle(td, '::before').content, title: !!tr.querySelector('td.mc1'), ck: !!tr.querySelector('td.mck') } });
  ok(mc.head == 'none' && mc.card == 'flex' && mc.lab && mc.before.includes(mc.lab) && mc.title && mc.ck, 'mobile: tables become labelled cards (title cell, checkbox, column labels)');
  const nm = await E(p, async () => { goMod('mops'); ADM.evF = 'done'; AM.mops($('#acontent')); await new Promise((r) => setTimeout(r, 200)); ADM.evTab = 'rg'; evOpen(EVTS.list[0].id); await new Promise((r) => setTimeout(r, 200)); const t = $('#adrawer table.nomc'); const r = { hasMatrix: !!t || !$('#adrawer table') }; closeAll(); return r });
  ok(nm.hasMatrix, 'attendance/permission matrices stay as tables (nomc)');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
