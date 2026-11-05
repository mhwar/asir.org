// الجودة والامتثال + سلوك النوافذ والأدراج (0.52)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const W = (p, ms) => p.waitForTimeout(ms || 400);
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1366, height: 860 } }); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/#/admin/compliance'); await W(p, 1800);
  const c = await p.evaluate(() => ({ mod: ADM.mod, kpis: $$('.cmpk .kpi').length, items: $$('.cmpr').length, live: $$('.cmpl>div').length, refs: $$('.cmprefs a').length, frame: !!$('#cmpPv iframe'), crumb: $('.jcrumb').textContent }));
  ok(c.mod == 'compliance' && c.kpis == 6 && c.items >= 30 && c.live >= 8 && c.refs == 6 && c.frame && /الحوكمة/.test(c.crumb), 'compliance page: 6 domains, catalogue, live checks, references, device preview');
  const f = await p.evaluate(() => { $('.cmpk [data-cd="a11y"]').click(); const a = $$('.cmpr').length; $('[data-cs="plan"]').click(); const pl = $$('.cmpr').length, allPlan = $$('.cmpr>.pill2').every((x) => x.textContent == 'مخطط'); $('[data-cs=""]').click(); $('.cmpk [data-cd="a11y"]').click(); return { a, pl, allPlan, back: $$('.cmpr').length } });
  ok(f.a >= 8 && f.pl >= 1 && f.allPlan && f.back >= 30, 'domain and status filters work');
  await p.evaluate(() => { $('[data-dv="ipad"]').click() }); await W(p, 1500);
  const pv = await p.evaluate(() => { const fr = $('#cmpPv iframe'); return { w: fr.style.width, ok: !!fr.contentDocument && !!fr.contentDocument.querySelector('header.top'), vw: fr.contentWindow.innerWidth } });
  ok(pv.w == '820px' && pv.ok && pv.vw == 820, 'device preview renders the site at the real device width (same-origin frame allowed)');
  // النوافذ والأدراج
  await p.evaluate(() => goMod('partners')); await W(p, 300);
  await p.evaluate(() => { const b = $$('#acontent [data-po]')[0]; b.focus(); b.click() }); await W(p, 300);
  const d = await p.evaluate(() => ({ role: $('#adrawer').getAttribute('role'), modal: $('#adrawer').getAttribute('aria-modal'), lbl: !!$('#adrawer').getAttribute('aria-labelledby'), inF: $('#adrawer').contains(document.activeElement), lock: getComputedStyle(document.body).overflow }));
  ok(d.role == 'dialog' && d.modal == 'true' && d.lbl && d.inF && d.lock == 'hidden', 'drawer: dialog role, labelled, focus moves inside, page behind locked');
  for (let i = 0; i < 60; i++) await p.keyboard.press('Tab');
  ok(await p.evaluate(() => $('#adrawer').contains(document.activeElement)), 'Tab stays inside the drawer');
  await p.evaluate(() => ptEdit($('#adrawer [data-ptt]') ? ADM.rec.id : 16)); await W(p, 250);
  const m = await p.evaluate(() => ({ inF: $('#modal').contains(document.activeElement), tag: document.activeElement.tagName, close: !!$('#modal .mx') }));
  ok(m.inF && m.tag == 'INPUT' && m.close, 'modal: focus on first field, visible close button');
  for (let i = 0; i < 50; i++) await p.keyboard.press('Shift+Tab');
  ok(await p.evaluate(() => $('#modal').contains(document.activeElement)), 'Shift+Tab stays inside the modal');
  await p.keyboard.press('Escape'); await W(p, 200);
  ok(await p.evaluate(() => !$('#modal').classList.contains('on') && $('#adrawer').contains(document.activeElement)), 'Escape closes the modal and returns focus to the drawer');
  await p.keyboard.press('Escape'); await W(p, 500);
  const r = await p.evaluate(() => ({ back: !!document.activeElement.closest('#acontent'), lock: getComputedStyle(document.body).overflow }));
  ok(r.back && r.lock != 'hidden', 'closing the drawer returns focus to the row that opened it and unlocks the page');
  // الجوال: النافذة ورقة سفلية بعمود واحد
  await p.setViewportSize({ width: 390, height: 844 }); await W(p, 200);
  await p.evaluate(() => ptNew()); await W(p, 400);
  const mm = await p.evaluate(() => { const md = $('#modal').getBoundingClientRect(), f = $('#ptF'); const cols = getComputedStyle(f).gridTemplateColumns.split(' ').length; const over = [...f.querySelectorAll('input,select')].some((i) => i.getBoundingClientRect().left < -1 || i.getBoundingClientRect().right > innerWidth + 1); return { w: Math.round(md.width), bottom: Math.round(md.bottom), vh: innerHeight, cols, over } });
  ok(mm.w == 390 && Math.abs(mm.bottom - mm.vh) <= 1 && mm.cols == 1 && !mm.over, 'mobile: modal is a full-width bottom sheet with a one-column form');
  await p.evaluate(() => closeAll());
  // نافذة التأكيد الموحدة (بدل نافذة المتصفح)
  await p.setViewportSize({ width: 1366, height: 860 });
  await p.evaluate(() => { EVTS.list.push({ id: 'e-ask-test', t: 'فعالية اختبار التأكيد', kind: 'meet', mode: 'online', d: '2030-01-01', st: 'draft', pub: 0, att: [], cpIds: [], log: [], sessions: [] }); evEdit('e-ask-test'); $('#eeDel').click() }); await W(p, 150);
  const a1 = await p.evaluate(() => ({ on: $('#askd').classList.contains('on'), role: $('#askd .askb').getAttribute('role'), focus: document.activeElement.dataset.a, ok: $('#askd [data-a="1"]').textContent, dang: $('#askd [data-a="1"]').classList.contains('dang') }));
  ok(a1.on && a1.role == 'alertdialog' && a1.focus == '0' && a1.ok == 'حذف' && a1.dang, 'confirm dialog: platform style, destructive button labelled, focus starts on Cancel');
  await p.keyboard.press('Escape'); await W(p, 100);
  ok(await p.evaluate(() => !$('#askd').classList.contains('on') && EVTS.list.some((e) => e.id == 'e-ask-test') && $('#modal').classList.contains('on')), 'Escape cancels: nothing deleted, the form stays open');
  await p.evaluate(() => $('#eeDel').click()); await W(p, 120); await p.evaluate(() => $('#askd [data-a="1"]').click()); await W(p, 150);
  ok(await p.evaluate(() => !EVTS.list.some((e) => e.id == 'e-ask-test')), 'confirming deletes');
  await p.evaluate(() => { PARTNERS.push({ id: 999001, n: 'جهة اختبار الحذف', ty: 'اتفاقية شراكة', sec: 'قطاع خاص', st: 'سارية', show: 0 }); ptNorm(); ptEdit(999001); window.__noConfirm = true; $('#peDel').click() }); await W(p, 150);
  ok(await p.evaluate(() => { window.__noConfirm = false; return !PARTNERS.some((x) => x.id == 999001) }), 'partnership delete works (was a silent no-op)');
  await p.evaluate(() => closeAll());
  // البناء: صفحة صغيرة + ملفات ببصمة محتوى تُحفظ سنة، ولا قفزات تخطيط
  const bd = await p.evaluate(async () => { const h = await (await fetch('/', { cache: 'no-store' })).text(); const js = (h.match(/\/assets\/app\.[0-9a-f]{10}\.js/) || [])[0], css = (h.match(/\/assets\/app\.[0-9a-f]{10}\.css/) || [])[0]; const r = js && await fetch(js); return { js, css, cc: r && r.headers.get('cache-control'), htmlCC: (await fetch('/', { cache: 'no-store' })).headers.get('cache-control'), marks: (h.match(/\/\*@(RAW|PUB|SESSION|PORTAL|STATE)\*\//g) || []).length } });
  ok(bd.js && bd.css && /max-age=31536000, immutable/.test(bd.cc) && bd.htmlCC == 'no-store' && bd.marks == 5, 'build: fingerprinted code/styles cached for a year; the data page stays no-store with all data markers');
  const q = await b.newPage({ viewport: { width: 1350, height: 940 } }); await q.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push(e.value) }).observe({ type: 'layout-shift', buffered: true }) });
  await q.goto(BASE + '/'); await q.waitForTimeout(2500); const cls = await q.evaluate(() => window.__ls.reduce((a, b) => a + b, 0)); await q.close();
  ok(cls < 0.1, 'home page loads without layout shift (CLS ' + cls.toFixed(3) + ')');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
