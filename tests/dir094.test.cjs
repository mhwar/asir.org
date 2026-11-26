// 0.94: نمط الجداول الموحّد في سجل الجمعيات — الواجهات، الفلاتر، الترتيب، طرق العرض، المحدد، النظرة السريعة
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1 } };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('واجهة اختبار'));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  await p.evaluate(() => { localStorage.removeItem('asirDirViews'); dvApply('main'); goMod('directory') }); await W(p);
  // 1) الواجهات تبويبات بعدد نتائجها
  const t = await p.evaluate(() => ({ tabs: $$('.dvtabs [data-v]').map((b) => b.dataset.v), on: $('.dvtabs .on').dataset.v, n: +$('.dvtabs .on .tc').textContent.replace(/,/g, ''), all: DB.length, cards: !!$('.jq') }));
  ok(t.tabs.join() == 'main,attn,lic,contact,gov' && t.on == 'main' && t.n == t.all && !t.cards, 'views are tabs with counts; quick cards replaced ' + JSON.stringify(t));
  await p.click('[data-v=lic]'); await W(p);
  const l = await p.evaluate(() => ({ st: ADM.dir.st, sort: ADM.dir.sort, cols: ADM.dir.cols.join(), rows: dirList().length, tab: +$('.dvtabs .on .tc').textContent.replace(/,/g, ''), bad: dirList().filter((o) => o.st != 'منتهي' && o.st != 'ينتهي قريباً').length, hash: location.hash }));
  ok(l.st == 'due' && l.sort == 'days' && l.cols == 'gov,lic,exp,sup,comp' && l.rows == l.tab && !l.bad && /v=lic/.test(l.hash), 'licences view: due filter + its columns + sort, in the link ' + JSON.stringify(l));
  // 2) التصفية: قائمة الحقول ثم القيم بعددها، وشريحة قابلة للإزالة
  await p.click('#fBtn'); await W(p, 200);
  ok(await p.evaluate(() => $$('.dvpop [data-dp^="f:"]').length == 11), 'filter menu lists 11 fields (scope, follow-up list, and both NCNP sub-classifications since 1.20)');
  await p.click('[data-dp="f:gov"]'); await W(p, 200);
  const g = await p.evaluate(() => { const r = $$('.dvpop input[data-fv=gov]')[1]; return { v: r.value, n: +r.closest('label').querySelector('.g').textContent.replace(/,/g, '') } });
  await p.click(`.dvpop input[data-fv=gov][value="${g.v}"]`); await W(p);
  const g2 = await p.evaluate(() => ({ gov: ADM.dir.gov, rows: dirList().length, chip: !!$$('.fchip2').find((c) => c.textContent.includes('المحافظة')), dirty: !!$('.dvdirty'), open: !!$('.dvpop') }));
  ok(g2.gov == g.v && g2.rows == g.n && g2.chip && g2.dirty, 'value count matches results; chip + «عدّلت الواجهة» ' + JSON.stringify([g, g2]));
  await p.mouse.click(700, 130); await W(p);
  ok(await p.evaluate(() => !$('.dvpop') && !ADM.dir.pop), 'click outside closes the popover');
  await p.click('.fchip2 [data-fx=gov]'); await W(p);
  ok(await p.evaluate(() => !ADM.dir.gov && ADM.dir.st == 'due'), 'chip × removes only that filter');
  // 3) الترتيب
  await p.click('#sBtn'); await W(p, 200); await p.click('.dvpop [data-sk=comp]'); await W(p);
  ok(await p.evaluate(() => { const L = dirList(); return ADM.dir.sort == 'comp' && L.every((o, i) => !i || L[i - 1].comp <= o.comp) && $('#sBtn').textContent.includes('اكتمال') }), 'sort menu sorts and names the key');
  // 4) حفظ واجهة جديدة ثم حذفها
  await p.evaluate(() => { const b = $$('.dvdirty [data-vsave=new]')[0]; b.click() }); await W(p);
  const u = await p.evaluate(() => ({ v: ADM.dir.view, tabs: $$('.dvtabs [data-v]').length, saved: JSON.parse(localStorage.getItem('asirDirViews') || '[]') }));
  ok(u.v == 'u0' && u.tabs == 6 && u.saved[0].t == 'واجهة اختبار' && u.saved[0].f.st == 'due' && u.saved[0].sort[0] == 'comp', 'save as new view (browser) ' + JSON.stringify(u));
  await p.click('[data-v=main]'); await W(p); await p.click('[data-v=u0]'); await W(p);
  ok(await p.evaluate(() => ADM.dir.st == 'due' && ADM.dir.sort == 'comp' && !$('.dvdirty')), 'custom view re-applies its filters and sort');
  await p.click('[data-vdel=u0]'); await W(p);
  ok(await p.evaluate(() => $$('.dvtabs [data-v]').length == 5 && ADM.dir.view == 'main' && !ADM.dir.st), 'custom view deleted → back to main');
  // 5) طرق العرض
  await p.click('[data-lay=cards]'); await W(p);
  ok(await p.evaluate(() => $$('.dvcards .dcard').length == Math.min(ADM.dir.per, dirList().length) && !$('#dirT')), 'cards layout');
  await p.click('[data-lay=gov]'); await W(p);
  // 1.18: فهرس جانبي وأقسام لكل محافظة؛ الأول موسّع وفيه «فتح في الجدول»
  const gv = await p.evaluate(() => { const s = $('.dvgm>.dvgsec.op'); return { n: $$('.dvgm>.dvgsec').length, r: $$('.dvgr [data-gj]').length, g: s.querySelector('h3').textContent, c: s.querySelector('[data-gsel]').dataset.gsel.split(',').length } });
  await p.click('.dvgm>.dvgsec.op .dvgwh [data-mapf]'); await W(p);
  ok(await p.evaluate((x) => ADM.dir.gov == x.g && ADM.dir.lay == 'table' && dirList().length == x.c && !!$('#dirT'), gv) && gv.n > 5 && gv.r == gv.n, 'by-governorate groups; click opens its rows in the table ' + JSON.stringify(gv));
  await p.click('.fchip2 [data-fx=gov]'); await W(p);
  // 6) الخيارات: الأعمدة والكثافة ولكل صفحة
  await p.click('#colBtn'); await W(p, 200);
  await p.click('.dvpop input[data-c=sup]'); await W(p); await p.click('.dvpop [data-dense="1"]'); await W(p); await p.click('.dvpop [data-per="50"]'); await W(p);
  ok(await p.evaluate(() => ADM.dir.cols.includes('sup') && $('#dirT').classList.contains('dense') && $$('#dirT tbody tr').length == 50 && !!$('.dvpop')), 'options: column on, compact, 50 per page (menu stays open)');
  await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => !$('.dvpop')), 'Esc closes the options menu');
  await p.evaluate(() => { ADM.dir.dense = false; ADM.dir.per = 25; dvApply('main'); goMod('directory') }); await W(p);
  // 7) المحدد: شريط عائم + تحديد كل النتائج
  await p.click('#selAll'); await W(p);
  const s1 = await p.evaluate(() => ({ n: ADM.dir.sel.size, bar: !!$('.dvbulk'), all: !!$('#bulkAll') }));
  await p.click('#bulkAll'); await W(p);
  const s2 = await p.evaluate(() => ({ n: ADM.dir.sel.size, L: dirList().length, pos: getComputedStyle($('.dvbulk')).position }));
  await p.click('#bulkClr'); await W(p);
  ok(s1.n == 25 && s1.bar && s1.all && s2.n == s2.L && s2.pos == 'sticky' && await p.evaluate(() => !ADM.dir.sel.size && !$('.dvbulk')), 'select page → select all results → clear ' + JSON.stringify([s1, s2]));
  // 8) النظرة السريعة: السابقة والتالية حسب ترتيب الجدول
  await p.hover('#dirT tbody tr:nth-child(1)'); await p.click('#dirT tbody tr:nth-child(1) [data-peek]'); await W(p, 500);
  const k1 = await p.evaluate(() => ({ open: !!$('#adrawer .dvpk'), t: $('.dvpk span').textContent, prev: $('.dvpk [data-pk="-1"]').disabled }));
  await p.click('.dvpk [data-pk="1"]'); await W(p, 400);
  const k2 = await p.evaluate(() => ({ t: $('.dvpk span').textContent, name: $('#adrawer .adqh').textContent.includes(dirList()[1].n) }));
  ok(k1.open && /^1 من/.test(k1.t) && k1.prev && /^2 من/.test(k2.t) && k2.name, 'peek with prev/next in table order ' + JSON.stringify([k1, k2]));
  await p.evaluate(() => closeAll()); await W(p);
  // 9) «/» يركّز البحث
  await p.keyboard.press('/'); ok(await p.evaluate(() => document.activeElement.id == 'dq'), '«/» focuses the register search');
  // 10) الجوال: قائمة التصفية ورقة سفلية داخل الشاشة
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(BASE + '/#/admin/directory'); await W(m, 2500); await m.tap('#fBtn'); await W(m);
  ok(await m.evaluate(() => { const r = $('.dvpop').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth }), 'mobile: filter menu is a bottom sheet inside the screen');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
