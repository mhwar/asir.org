// روابط الدخول الشخصية، والأدوار المقترحة، وصفحة الخصوصية وطلبات أصحاب البيانات، وسحب الورقة السفلية (0.56)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const W = (p, ms) => p.waitForTimeout(ms || 400);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(() => { window.__noConfirm = true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/users'); await W(p, 1800);
  // الأدوار المقترحة موجودة ومفعّلة
  const roles = await p.evaluate(async () => (await (await fetch('/api/roles')).json()).data.filter((r) => ['chair', 'finance', 'pm', 'media', 'committee'].includes(r.key) && r.active).map((r) => r.key));
  ok(roles.length == 5, 'suggested roles for positions exist and are active: ' + roles.join(','));
  // مستخدم اختبار بدور مدير مشاريع
  const uid = await p.evaluate(async () => {
    const e = 'pm.test@example.org';
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, name: 'مدير مشاريع اختبار', role: 'pm' }) });
    const u = (await (await fetch('/api/users')).json()).data.find((x) => x.email == e);
    if (!u.active) await fetch('/api/users/' + u.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
    ADM.gv.users = null; ADM.gv.links = null; AM.users($('#acontent')); return u.id });
  await W(p, 900);
  ok(await p.evaluate(() => !!$('#kPanel') && $$('[data-kn]').length > 0), 'users page shows login-links panel and a "login link" button per active user');
  await p.click(`[data-kn="${uid}"]`); await W(p, 300);
  await p.fill('#kF input[name=label]', 'جوال العمل'); await p.selectOption('#kF select[name=days]', '7');
  await p.click('#kF .btn'); await W(p, 700);
  const url = await p.evaluate(() => $('#kUrl') && $('#kUrl').value);
  ok(/\/k\/[A-Za-z0-9_-]{32}$/.test(url || ''), 'link created and shown once in the modal');
  const stored = await p.evaluate(async () => (await (await fetch('/api/login-links')).json()).data[0]);
  ok(stored && stored.label == 'جوال العمل' && stored.state == 'active' && !('token' in stored) && !JSON.stringify(stored).includes(url.split('/k/')[1]), 'list never returns the link itself (hash only)');
  // الدخول بالرابط في متصفح جديد
  const c2 = await b.newContext(); const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(url); await W(q, 300);
  ok(await q.evaluate(() => /رابط دخول شخصي/.test(document.body.textContent) && !!document.querySelector('form[method=post] button')), 'opening the link shows a confirm page (no login on GET, so link previews cannot sign in)');
  await q.click('button'); await W(q, 1600);
  const me = await q.evaluate(async () => (await (await fetch('/api/me')).json()));
  ok(me.email == 'pm.test@example.org' && me.role == 'pm', 'after "دخول" the session belongs to the link owner with his role');
  const ck = (await c2.cookies()).find((c) => c.name == 'asir_k');
  ok(ck && ck.httpOnly && ck.secure && ck.sameSite == 'Lax', 'session cookie is HttpOnly, Secure, SameSite=Lax');
  const nav = await q.evaluate(() => ({ roles: can('roles'), pjW: canW('projects'), ptR: can('partners'), ptW: canW('partners') }));
  ok(nav.roles === false && nav.pjW === true && nav.ptR === true && nav.ptW === false, 'dashboard permissions follow the role (projects: write, partners: read only, users & roles: none)');
  await q.evaluate(() => goMod('partners')); await W(q, 600);
  const ro = await q.evaluate(() => ({ mod: ADM.mod, h: $('.jph h1') && $('.jph h1').textContent, pri: !!$('.jph .acts2 .jbtn.pri') }));
  ok(/اطلاع فقط/.test(ro.h || '') && !ro.pri, JSON.stringify(ro) + ' read-only section is labelled «اطلاع فقط» and its add button is hidden');
  // رابط غير صالح
  const q2 = await c2.newPage(); await q2.goto(BASE + '/k/' + 'A'.repeat(32)); await q2.click('button'); await W(q2, 400);
  ok(await q2.evaluate(() => /غير صالح/.test(document.body.textContent)), 'an unknown link is refused with a clear message');
  // الإلغاء يوقف الجلسة فوراً
  await p.evaluate(() => { closeAll(); ADM.gv.users = null; ADM.gv.links = null; AM.users($('#acontent')) }); await W(p, 900);
  await p.click(`[data-kr="${stored.id}"]`); await W(p, 900);
  const me2 = await q.evaluate(async () => (await (await fetch('/api/me')).json()));
  ok(me2.email != 'pm.test@example.org', 'revoking the link ends that session immediately');
  const au = await p.evaluate(async () => (await (await fetch('/api/audit?entity=login_links')).json()).data.filter((a) => a.entity == 'login_links').map((a) => a.action));
  ok(['create', 'login', 'revoke'].every((x) => au.includes(x)), 'create, login and revoke are recorded in the audit log');
  // صفحة الخصوصية
  await p.goto(BASE + '/#/privacy'); await W(p, 900);
  const pv = await p.evaluate(() => ({ h: $('#privacyPage h1') && $('#privacyPage h1').textContent, sec: $$('#privacyPage .a11yh2').length, toc: $$('#privacyPage .pvtoc a').length, foot: !!document.querySelector('footer a[href="#/privacy"]'), form: !!$('#pvF') }));
  ok(/الخصوصية/.test(pv.h || '') && pv.sec >= 9 && pv.toc == 9 && pv.foot && pv.form, 'privacy page: 9 sections, contents links, footer link, request form');
  await p.fill('#pvF input[name=name]', 'صاحب بيانات اختبار'); await p.fill('#pvF input[name=email]', 'dsr@example.org');
  await p.selectOption('#pvF select[name=req]', 'correct'); await p.fill('#pvF textarea[name=message]', 'تصحيح رقم الجوال المسجل لجمعيتنا');
  await p.click('#pvF .btn'); await W(p, 900);
  ok(await p.evaluate(() => !!$('#pvForm .cfdone')), 'data-subject request submitted');
  const msg = await p.evaluate(async () => (await (await fetch('/api/messages')).json()).data.find((m) => m.kind == 'privacy' && m.name == 'صاحب بيانات اختبار'));
  ok(msg && msg.details && msg.details.req == 'correct', 'request reaches the inbox as «طلب خصوصية» with its type');
  await p.evaluate(() => goMod('inbox')); await W(p, 300);
  await p.evaluate(async (id) => { ADM.inbox.rows = null; await inboxLoad(); ADM.inbox.k = 'privacy'; ADM.inbox.f = 'all'; ADM.inbox.open = id; renderAdmin() }, msg.id); await W(p, 600);
  ok(await p.evaluate(() => /مهلة الرد النظامية/.test($('#acontent').textContent) && /تصحيح بيانات/.test($('#acontent').textContent)), 'inbox shows request type and the 30-day response deadline');
  // سحب الورقة السفلية للإغلاق (جوال باللمس)
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await c3.addInitScript(() => { window.__noConfirm = true });
  const m = await c3.newPage(); m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(BASE + '/#/admin/partners'); await W(m, 1800);
  await m.evaluate(() => ptNew()); await W(m, 400);
  const sw = await m.evaluate(async () => {
    const md = $('#modal'), h = md.querySelector('h3') || md;
    const T = (y) => new Touch({ identifier: 1, target: h, clientX: 195, clientY: y });
    h.dispatchEvent(new TouchEvent('touchstart', { touches: [T(420)], bubbles: true }));
    h.dispatchEvent(new TouchEvent('touchmove', { touches: [T(480)], bubbles: true }));
    const mid = md.style.transform;
    h.dispatchEvent(new TouchEvent('touchmove', { touches: [T(600)], bubbles: true }));
    h.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T(600)], bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    return { mid, closed: !md.classList.contains('on') } });
  ok(/translateY\(60px\)/.test(sw.mid) && sw.closed, 'mobile sheet follows the finger and closes when dragged down');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
