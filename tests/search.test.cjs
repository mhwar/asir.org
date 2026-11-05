// البحث الشامل (Ctrl+K و /)، قائمة الحساب، شريط الجوال، والرئيسية المجمّعة (0.57)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const W = (p, ms) => p.waitForTimeout(ms || 300);
const AX = async (p, sel) => { if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE }); return p.evaluate((sel) => axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then((x) => x.violations.map((v) => v.id + ':' + v.nodes.length)), sel) };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { window.__noConfirm = true; try { if (!sessionStorage.getItem('t0')) { sessionStorage.setItem('t0', 1); localStorage.removeItem('asirCmdRecent'); localStorage.removeItem('asirSaved') } } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/home'); await W(p, 2200);
  // الرئيسية: بحث كبير + شرائح المحفوظة + إجراءات مجمّعة
  const h = await p.evaluate(() => ({ srch: !!$('.hsrch'), chips: $$('.hchips button').length, groups: $$('.hmg .hgrp').length, rows: $$('.hmg .hrow').length, acts: homeActs().length, inGroup: homeActs().every((a) => a.g) }));
  ok(h.srch && h.chips >= 2 && h.groups >= 2 && h.rows == h.acts && h.inGroup, 'home: big search, saved-page chips, every action shown once inside a topic group ' + JSON.stringify(h));
  // Ctrl+K
  await p.keyboard.press('Control+k'); await W(p);
  const o = await p.evaluate(() => ({ open: !!$('#cmdk'), role: $('#cmdk [role=dialog]').getAttribute('aria-modal'), focus: document.activeElement.id, empty: $$('#cmdl [role=option]').length }));
  ok(o.open && o.role == 'true' && o.focus == 'cmdq' && o.empty > 0, 'Ctrl+K opens the search dialog with focus in the field and suggestions before typing');
  const ax1 = await AX(p, '#cmdk'); ok(ax1.length == 0, ax1.join(',') + ' search dialog has no WCAG A/AA violations');
  const name = await p.evaluate(() => DB.find((o) => o.n.length > 10).n);
  await p.keyboard.type(name.slice(0, 9)); await W(p);
  const r = await p.evaluate((n) => ({ first: ($('#cmdl [aria-selected=true] b') || {}).textContent, grp: $$('#cmdl .cmdk-g').map((g) => g.textContent), ad: $('#cmdq').getAttribute('aria-activedescendant') }), name);
  ok(r.grp.includes('الجمعيات') && r.ad == 'cmo0', 'typing finds associations, first result is selected ' + JSON.stringify(r.grp));
  // تطبيع العربية: همزات وتاء مربوطة
  await p.fill('#cmdq', 'ابها'); await W(p, 200);
  const n1 = await p.evaluate(() => $$('#cmdl [role=option]').length);
  await p.fill('#cmdq', 'أبها'); await W(p, 200);
  ok(n1 > 0 && n1 == (await p.evaluate(() => $$('#cmdl [role=option]').length)), 'Arabic normalisation: «ابها» and «أبها» give the same results');
  const lic = await p.evaluate(() => String(DB.find((o) => o.lic).lic));
  await p.fill('#cmdq', lic); await W(p, 200);
  ok(await p.evaluate(() => ($('#cmdl [role=option] b') || {}).textContent.length > 0), 'search by licence number');
  await p.fill('#cmdq', name); await W(p, 200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await W(p, 700);
  ok(await p.evaluate((n) => !$('#cmdk') && $('#adrawer').classList.contains('on') && $('#adrawer').textContent.includes(n), name), 'Enter opens the association record');
  await p.evaluate(() => closeAll()); await W(p, 300);
  // «/» والأخيرة
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('/'); await W(p);
  ok(await p.evaluate((n) => !!$('#cmdk') && $$('#cmdl .cmdk-g')[0].textContent == 'الأخيرة' && $('#cmdl [role=option] b').textContent == n, name), '«/» opens search and recent items come first');
  await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => !$('#cmdk')), 'Esc closes the search');
  // إجراء من البحث
  await p.keyboard.press('Control+k'); await p.keyboard.type('شراكة جديدة'); await W(p, 200); await p.keyboard.press('Enter'); await W(p, 900);
  ok(await p.evaluate(() => ADM.mod == 'partners' && $('#modal').classList.contains('on') && !!$('#ptF')), 'actions run from search (new partnership opens its form)');
  await p.evaluate(() => closeAll()); await W(p, 200);
  // قائمة الحساب
  await p.click('.jav'); await W(p);
  const u = await p.evaluate(() => ({ exp: $('.jav').getAttribute('aria-expanded'), tag: $('.jav').tagName, items: $$('#jum [data-um]').map((x) => x.dataset.um), seg: $$('#jum [role=radio]').length, inMenu: !!document.activeElement.closest('#jum') }));
  ok(u.tag == 'BUTTON' && u.exp == 'true' && u.seg == 3 && ['priv', 'a11y', 'search', 'perms', 'keys', 'site', 'out'].every((k) => u.items.includes(k)) && u.inMenu, 'account menu is a real button with theme, privacy, accessibility, search, permissions, shortcuts, site, sign-out');
  const ax2 = await AX(p, '#jum'); ok(ax2.length == 0, ax2.join(',') + ' account menu has no WCAG A/AA violations');
  await p.click('#jum [data-up=dark]'); await W(p, 200);
  ok(await p.evaluate(() => document.documentElement.dataset.theme == 'dark' && $('#jum [data-up=dark]').getAttribute('aria-checked') == 'true'), 'theme can be changed from the menu');
  await p.click('#jum [data-up=system]'); await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => !$('#jum') && document.activeElement.classList.contains('jav')), 'Esc closes the menu and returns focus to the avatar');
  await p.click('.jav'); await p.click('#jum [data-um=perms]'); await W(p, 400);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && /صلاحياتي/.test($('#modal').textContent) && $$('#modal .mperm span').length > 10), '«صلاحياتي» lists every section with read/edit');
  await p.evaluate(() => closeAll());
  // الصفحات المحفوظة تبقى بعد إعادة التحميل
  await p.evaluate(() => { goMod('partners') }); await W(p, 300); await p.click('#bmk'); await W(p, 200);
  await p.reload(); await W(p, 2200); await p.evaluate(() => goMod('home')); await W(p, 300);
  ok(await p.evaluate(() => ADM.saved.includes('partners') && $$('.hchips button').some((x) => x.textContent.includes('الشراكات'))), 'saved pages persist after reload and show as chips');
  // التأجيل في خطة البناء
  ok(await p.evaluate(() => { const ph = ROAD.find((x) => x.k == 'ph7'); return ph && ph.items.some((i) => i[0] == 'dpo' && rmSt(i) == 'later') && RDST.later }), 'data-protection officer naming is in the plan as «مؤجل»');
  // الجوال
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.addInitScript(() => { window.__noConfirm = true });
  const q = await m.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(BASE + '/#/admin/home'); await W(q, 2200);
  const t = await q.evaluate(() => { const r = $('.jav').getBoundingClientRect(), vis = (s) => { const e = $(s); return e && getComputedStyle(e).display != 'none' }; return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), priv: vis('#privtg'), a11y: vis('.jtop .a11yb'), globe: vis('.jtop .jglobe'), srch: vis('.jsrch'), over: document.documentElement.scrollWidth > innerWidth } });
  ok(t.w == 36 && t.h == 36 && t.left >= 4 && !t.priv && !t.a11y && !t.globe && t.srch && !t.over, 'mobile top bar: round 36px avatar, search icon, extras moved into the account menu ' + JSON.stringify(t));
  await q.tap('.jsrch'); await W(q);
  const fm = await q.evaluate(() => { const r = $('.cmdk-b').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vh: innerHeight } });
  ok(fm.w == 390 && Math.abs(fm.h - fm.vh) <= 1, 'mobile: search opens full screen');
  await q.evaluate(() => cmdClose()); await q.tap('.jav'); await W(q);
  ok(await q.evaluate(() => { const r = $('#jum').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && !!$('#jum [data-um=priv]') && !!$('#jum [data-um=a11y]') }), 'mobile: account menu fits the screen and holds privacy + accessibility');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
