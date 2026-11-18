// 0.93: هيكل القائمة الجانبية الجديد — كل صفحة لها مكان، والروابط والصلاحيات كما هي، والطي يُحفظ، والرئيسية الجديدة
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const W = (p, ms) => p.waitForTimeout(ms || 400);
// مفاتيح الصفحات قبل 0.93 — يجب أن تبقى كلها (الروابط #/admin/<مفتاح> لا تتغير)
const OLD = ['home','overview','updates','quality','alerts','directory','assoc','trouble','trcase','diag','analytics','bysup','bygov','decisions','dec','reports','inbox','content','campaigns','camp','chub','consults','capps','calendar','consultants','cset','pro','need','eng','partners','pt','projects','proj','communities','comm','mops','ev','mset','board','docs','policy','compliance','users','roles','settings','audit','apps','uikit','launch','gaps'];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(() => { window.__noConfirm = true; try { if (!sessionStorage.getItem('n0')) { sessionStorage.setItem('n0', 1); localStorage.removeItem('asirSide'); localStorage.removeItem('asirHomeW') } } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/home'); await W(p, 2200);
  const r = await p.evaluate((OLD) => {
    const keys = MODS.map((m) => m[0]);
    const missing = OLD.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !OLD.includes(k));
    // كل صفحة رئيسية (غير التفاصيل) لها زر في القائمة، أو تصل إليها من أبيها
    const noPlace = MODS.filter((m) => !RECPAGES[m[0]] && !document.querySelector(`.jside [data-m="${m[0]}"]`) && !(CTSUB[m[0]] && document.querySelector('.jside [data-ct]')) && modParent(m[0]) == m[0]).map((m) => m[0]);
    const children = MODS.filter((m) => modParent(m[0]) != m[0] && !RECPAGES[m[0]]).filter((m) => !document.querySelector(`.jside [data-m="${modParent(m[0])}"]`)).map((m) => m[0]);
    return { missing, extra, noPlace, children, groups: NAV.map((g) => g.k).join(), tmp: isTmp('launch') && isTmp('gaps') && !isTmp('users') };
  }, OLD);
  ok(!r.missing.length && !r.extra.length, 'all page keys kept (links unchanged) ' + JSON.stringify([r.missing, r.extra]));
  ok(!r.noPlace.length && !r.children.length, 'every page has a place in the sidebar ' + JSON.stringify([r.noPlace, r.children]));
  ok(r.groups == 'home,data,prog,rel,know,insight,gov,sys' && r.tmp, 'groups in the new order, launch pages still temporary ' + r.groups);
  // عناوين فرعية، و«قريباً» للمدير
  const s1 = await p.evaluate(() => ({ sg: [...document.querySelectorAll('.jgrp[data-gk=data] .jnis h6.jsg')].map((h) => h.textContent).join('|'), soon: document.querySelectorAll('.jgrp[data-gk=gov] .jnis .jni.soon').length, acc: !!document.querySelector('.jside .jfoot .jav.jacc'), top: !document.querySelector('.jtop .jav') && !document.querySelector('.jtop .jlogo') }));
  ok(s1.sg == 'السجل|البيانات|المتابعة والتطوير' && s1.soon == 4 && s1.acc && s1.top, 'sub-headers, soon items for admin, account card in the sidebar footer ' + JSON.stringify(s1));
  // صفحات المحتوى من القائمة
  await p.evaluate(() => { document.querySelector('.jgrp[data-gk=know] .jnis [data-ct=kb]').click() }); await W(p, 500);
  ok(await p.evaluate(() => ADM.mod == 'content' && ADM.content == 'kb' && $('.jph h1').textContent.includes('المكتبة المعرفية') && $('.jside .jnis [data-ct=kb]').classList.contains('on')), 'content pages open from the sidebar with their own title');
  // التثبيت من العنوان
  await p.evaluate(() => goMod('partners')); await W(p, 300);
  await p.click('#bmk'); await W(p, 200);
  ok(await p.evaluate(() => ADM.saved.includes('partners') && !!document.querySelector('.jside .jpins [data-m=partners]') && $('#bmk').getAttribute('aria-pressed') == 'true'), 'pin from the title appears under «المثبّتة»');
  await p.click('#bmk'); await W(p, 200);
  // الطي: الزر ومفتاح [ ويُحفظ
  await p.click('#jcolb'); await W(p, 200);
  ok(await p.evaluate(() => $('.j').classList.contains('noside') && localStorage.getItem('asirSide') == 'false'), 'collapse button folds the sidebar and saves the choice');
  await p.keyboard.press('['); await W(p, 200);
  ok(await p.evaluate(() => !$('.j').classList.contains('noside')), '[ toggles the sidebar');
  await p.reload(); await W(p, 2000);
  ok(await p.evaluate(() => !$('.j').classList.contains('noside')), 'choice survives reload');
  // الرئيسية
  await p.evaluate(() => goMod('home')); await W(p, 400);
  const h = await p.evaluate(() => ({ srch: !!$('.hsrch'), kpi: $$('.hk>button').length, rows: $$('.hmg .hrow').length, acts: homeActs().length, urg: homeActs().filter((a) => a.u).length, ag: !!$('#hag'), fe: !!$('#hfe'), topSearch: !!$('.jtop #jsq') }));
  ok(h.srch && h.kpi >= 4 && h.rows == h.acts && h.ag && h.fe && !h.topSearch, 'home: search bar (not duplicated in the top bar), KPIs, all follow-ups, this week, activity ' + JSON.stringify(h));
  await p.evaluate(() => $('[data-hf=u]').click()); await W(p, 200);
  ok(await p.evaluate(() => $$('.hmg .hrow').length == homeActs().filter((a) => a.u).length), 'urgent filter');
  await p.evaluate(() => { const c = $('[data-hw=feed]'); c.checked = false; c.dispatchEvent(new Event('change')) }); await W(p, 200);
  ok(await p.evaluate(() => !$('#hfe') && JSON.parse(localStorage.getItem('asirHomeW')).feed === 0), 'home widgets can be hidden and the choice is saved');
  await p.evaluate(() => { localStorage.removeItem('asirHomeW'); ADM.hf = 'all' });
  // الأدوار: محرر المحتوى لا يرى إلا ما يحق له
  const role = await p.evaluate(() => { const old = ADM.role, oldS = SESSION && SESSION.perms; if (SESSION) SESSION.perms = null; ADM.role = 'content'; goMod('home'); const v = [...document.querySelectorAll('.jside [data-m]')].map((b) => b.dataset.m).filter((m) => !can(m)); const soon = document.querySelectorAll('.jni.soon').length; ADM.role = old; if (SESSION) SESSION.perms = oldS; goMod('home'); return { v, soon } });
  ok(!role.v.length && role.soon == 0, 'a role sees only allowed pages, soon items hidden for non-admins ' + JSON.stringify(role));
  // تابلت: القائمة مطوية تلقائياً عند أول زيارة
  const tb = await b.newContext({ viewport: { width: 1000, height: 800 } });
  const t = await tb.newPage(); t.on('pageerror', (e) => errs.push(e.message));
  await t.goto(BASE + '/#/admin/directory'); await W(t, 2000);
  ok(await t.evaluate(() => $('.j').classList.contains('noside') && getComputedStyle($('.jside')).display != 'none'), 'tablet: sidebar starts as an icon rail');
  // جوال
  const mb = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const q = await mb.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(BASE + '/#/admin/directory'); await W(q, 2000);
  ok(await q.evaluate(() => $('.jcard').getBoundingClientRect().width >= innerWidth - 40), 'mobile: page card takes the full width');
  await q.tap('.jmenu'); await W(q, 400);
  const m = await q.evaluate(() => { const r = $('.jside').getBoundingClientRect(); return { open: $('.j').classList.contains('mnav'), x: r.right <= innerWidth + 1 && r.left >= 0, close: getComputedStyle($('.jsh .jx')).display != 'none', over: document.documentElement.scrollWidth > innerWidth } });
  ok(m.open && m.x && m.close && !m.over, 'mobile: drawer opens with a close button, no horizontal scroll ' + JSON.stringify(m));
  await q.evaluate(() => document.querySelector('.jside .jnis [data-m=trouble]').click()); await W(q, 400);
  ok(await q.evaluate(() => ADM.mod == 'trouble' && !$('.j').classList.contains('mnav')), 'mobile: choosing a page closes the drawer');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
