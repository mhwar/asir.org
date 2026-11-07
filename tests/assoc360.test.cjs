// ملف الجمعية 0.78: رأس بثلاث مناطق (هوية، مؤشر بسببه، يحتاج تدخلاً)، زر سياقي، شبكة بطاقات برؤوس أعداد، طي يُحفظ، open360 يمرّر للبطاقة.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const a360OrderExpected = (r) => ({ admin: 'lic,contact,quality,diag,rel,eco,pub,score', analyst: 'quality,lic,contact,score,rel,diag,eco,pub', consult: 'diag,rel,eco,contact,lic,quality,pub,score' })[r];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.removeItem('asirUI:a360fold'); go('admin'); }); await p.waitForTimeout(600);
  // جمعية فيها ما يحتاج تدخلاً: ترخيص ينتهي قريباً أو منتهٍ
  const A = await p.evaluate(() => (DB.find((o) => !o.closed && o.st == 'ينتهي قريباً') || DB.find((o) => !o.closed && o.st == 'منتهي')).id);
  await p.evaluate((A) => open360(A), A); await p.waitForTimeout(1800);
  const h = await p.evaluate(() => ({ head: !!$('.a3h'), needs: $$('.a3need li').length, needT: ($('.a3need > b') || {}).textContent, why: ($('.a3h .a360s small:last-child') || {}).textContent, pri: $('.a3a .jbtn.pri').textContent, more: !!$('.a3more'), tabs: $$('#acontent .jsubt').length, cards: $$('.a3c').length }));
  ok(h.head && h.needs >= 1 && h.needT == 'يحتاج تدخلاً', 'header: needs-attention strip with items (' + h.needs + ')');
  ok(/الترخيص/.test(await p.evaluate(() => $('.a3need li').textContent)), 'first item is the licence');
  ok(h.pri == 'رابط تحديث' && h.more, 'contextual primary button follows the top need; «المزيد» menu present');
  ok(h.why && h.why.length > 6, 'score has a one-line reason: ' + h.why);
  ok(h.tabs == 0 && h.cards == 8, 'no tabs; 8 cards + activity rail');
  await p.screenshot({ path: 'tests/out/a360_header.png' });
  const heads = await p.evaluate(() => Object.fromEntries($$('.a3c').map((c) => [c.dataset.c, c.querySelector('.a3hs').textContent.trim()])));
  ok(heads.lic && heads.contact && heads.score && heads.pub, 'card heads carry status/counts: ' + JSON.stringify(heads).slice(0, 160));
  const rail = await p.evaluate(() => ({ rail: !!$('.a3rail'), comp: !!$('.a3rail #clF'), filters: $$('.a3rf button').length, items: $$('.a3ti').length, months: $$('.a3rm').length, jump: $$('.a3jump a').length, order: $$('.a3c').map((c) => c.dataset.c).join(',') }));
  ok(rail.rail && rail.comp && rail.filters >= 2 && rail.items > 0 && rail.months > 0, 'activity rail: composer, filters, grouped feed (' + rail.items + ')');
  ok(rail.jump == 9, 'jump nav lists 8 cards + rail');
  ok(rail.order == a360OrderExpected('admin'), 'admin order: ' + rail.order);
  // تصفية السجل
  const fk = await p.evaluate(() => { const b = $$('.a3rf button').find((x) => x.dataset.a3f); b.click(); return b.dataset.a3f; }); await p.waitForTimeout(200);
  ok(await p.evaluate((fk) => $$('.a3ti small').every((s) => s.textContent.includes((A360_FK[fk] || [fk])[0])) && $('.a3rf button.on').dataset.a3f == fk, fk), 'rail filter narrows the feed to one kind');
  await p.evaluate(() => $('.a3rf button[data-a3f=""]').click());
  // تسجيل تواصل من العمود الجانبي
  await p.fill('.a3rail #clF textarea', 'مكالمة اختبار من العمود الجانبي'); await p.click('.a3rail #clF button'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => /مكالمة اختبار من العمود الجانبي/.test($('.a3rail').textContent) && /تواصل/.test($('.a3c[data-c=rel] .a3hs').textContent)), 'composer logs a contact; feed and relation card update');
  // التثبيت
  await p.click('.a3c[data-c=pub] .a3pin'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('.a3c')[0].dataset.c == 'pub' && $('.a3jump a[data-a3j=pub]').classList.contains('pin')), 'pin moves the card first and marks it in the jump nav');
  await p.click('.a3c[data-c=pub] .a3pin'); await p.waitForTimeout(300);
  // الشريط اللاصق يظهر عند التمرير
  await p.evaluate(() => $('.a3c[data-c=score]').scrollIntoView()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $('.a3sticky').classList.contains('on') && $('.a3sticky b').textContent.length > 2 && $('.a3jump a.cur')), 'sticky summary bar appears on scroll; jump nav tracks the current card');
  await p.evaluate(() => window.scrollTo(0, 0));
  // الأسهم تنتقل بين الجمعيات
  const before = await p.evaluate(() => ADM.aid); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  ok(await p.evaluate((b) => ADM.aid != b, before), 'ArrowLeft moves to the next association');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(900);
  ok(await p.evaluate((b) => ADM.aid == b, before), 'ArrowRight moves back');
  // «جديد منذ زيارتك»: زيارة قديمة ثم حدث جديد
  await p.evaluate((A) => { const M = JSON.parse(localStorage.getItem('asirUI:a360seen') || '{}'); M[A] = '2020-01-01T00:00:00Z'; localStorage.setItem('asirUI:a360seen', JSON.stringify(M)); ADM.a360seen = null; ADM.a360f = null; open360(A); }, A); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => $$('.a3c.new').length >= 1 && $$('.a3jump .a3nd').length >= 1), '«changed since last visit» dots on cards and jump nav');
  await p.evaluate(() => { localStorage.removeItem('asirUI:a360pin'); });
  // طي بطاقة ويبقى بعد إعادة الرسم
  await p.click('.a3c[data-c=contact] .a3ch'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => $('.a3c[data-c=contact]').classList.contains('fold') && $('.a3c[data-c=contact] .a3ch').getAttribute('aria-expanded') == 'false'), 'click folds a card (aria-expanded false)');
  await p.evaluate(() => AM.assoc($('#acontent'))); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $('.a3c[data-c=contact]').classList.contains('fold')), 'fold persists across re-render');
  await p.click('.a3c[data-c=contact] .a3ch');
  // open360 بتبويب قديم يفتح البطاقة المقابلة
  await p.evaluate((A) => open360(A, 'diag'), A); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !$('.a3c[data-c=diag]').classList.contains('fold') && /تقييم جديد|جارٍ|التشخيص/.test($('.a3c[data-c=diag]').textContent)), 'open360(id,"diag") lands on the diagnostic card');
  await p.evaluate((A) => open360(A, 'data'), A); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !$('.a3c[data-c=lic]').classList.contains('fold')), 'old tab "data" maps to licence card');
  await p.evaluate((A) => open360(A, 'tl'), A); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !!$('.a3rail')), 'old tab "tl" maps to the activity rail');
  // التشخيص داخل البطاقة يحمّل فعلاً
  const dg = await p.evaluate(() => $('.a3c[data-c=diag]').textContent);
  ok(/تقييم جديد/.test(dg) && !/جارٍ التحميل/.test(dg), 'diagnostic card loaded (no stuck loader)');
  // ترتيب حسب الدور
  const ro = await p.evaluate((A) => { const r0 = SESSION.role; SESSION.role = 'consult'; open360(A); const o = $$('.a3c').map((c) => c.dataset.c).join(','); SESSION.role = r0; return o; }, A); await p.waitForTimeout(300);
  ok(ro == a360OrderExpected('consult'), 'consultant sees diagnostic & relation first: ' + ro);
  // جمعية سليمة: «لا شيء عاجل» وزر تحرير
  const G = await p.evaluate(() => (DB.filter((o) => !o.closed && o.st == 'ساري' && o.comp >= 60 && (!flagsOf(o.id).length) && o.days > 120 && !(typeof trCase == 'function' && trCase(o.id))).sort((a, b) => b.hs - a.hs)[0] || {}).id);
  if (G) { await p.evaluate((G) => open360(G), G); await p.waitForTimeout(1800);
    const g = await p.evaluate(() => ({ okb: $('.a3need').classList.contains('ok'), t: $('.a3need > b').textContent, pri: $('.a3a .jbtn.pri').textContent }));
    ok(g.okb && g.t == 'لا شيء عاجل' && g.pri == 'تحرير البيانات', 'healthy association: «لا شيء عاجل», default primary'); }
  // علامات التحقق تظهر في بطاقة الجودة وفي شريط التدخل
  const Fid = await p.evaluate(async (A) => { const r = await (await fetch(`/api/associations/${A}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'gov', kind: 'assumed', text: 'اختبار ملف الجمعية' }) })).json(); await flagsLoad(true); return r.id; }, A);
  const Fa = A;
  if (Fa) { await p.evaluate((Fa) => open360(Fa), Fa); await p.waitForTimeout(1800);
    const f = await p.evaluate(() => ({ q: /تحتاج تحقق/.test($('.a3c[data-c=quality] .a3hs').textContent), n: /تحتاج تحقق/.test($('.a3need').textContent) }));
    ok(f.q && f.n, 'flags surface in quality card head and in the needs strip');
    await p.evaluate(([A, id]) => fetch(`/api/associations/${A}/notes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) }), [A, Fid]); }
  // جمعية مغلقة
  const C = await p.evaluate(() => (DB.find((o) => o.closed) || {}).id);
  if (C) { await p.evaluate((C) => open360(C), C); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => /مغلقة نهائياً/.test($('.a3need').textContent) && $$('.a3need li').length == 0), 'closed association: closed banner, no needs'); }
  // الجوال: عمود واحد ولا تمرير أفقي
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); m.on('pageerror', (e) => errs.push('m: ' + e.message));
  await m.goto(BASE + '/'); await m.waitForTimeout(600); await m.evaluate((A) => { go('admin'); setTimeout(() => open360(A), 300); }, A); await m.waitForTimeout(2200);
  const mm = await m.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle($('.a3grid')).gridTemplateColumns.split(' ').length }));
  ok(mm.over <= 0 && mm.cols == 1, 'mobile: one column, no horizontal scroll');
  await m.screenshot({ path: 'tests/out/a360_mobile.png', fullPage: false });
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
