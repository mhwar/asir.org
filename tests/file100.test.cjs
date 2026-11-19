// 1.00: إعادة هيكلة ملف الجمعية — نظرة عامة أولاً، إجراءات مرتبة في شريط واحد، النطاق ضمن «البيانات» ومحسوب في درجتها،
// قوائم متابعة مشتركة وفلترها في السجل، تسجيل تواصل ورسائل جاهزة من الرأس، والسجل الكامل تبويباً.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  const id = await p.evaluate(() => DB.find((o) => /آباء/.test(o.n)).id);
  await p.evaluate((id) => open360(id), id); await W(p, 2000);
  ok(await p.evaluate(() => $$('.a3tabs [role=tab] b').map((x) => x.textContent).join('|') == 'نظرة عامة|البيانات|الفاعلية|العلاقة|السجل' && $('.a3tabs .on b').textContent == 'نظرة عامة'), 'five tabs, the file opens on «نظرة عامة»');
  ok(await p.evaluate(() => !!$('.a3ovn') && !!$('.a3ovf') && $$('.a3ovd').length == 3 && !!$('.a3ovl')), 'overview: needs, file at a glance, three dimensions, latest activity');
  ok(await p.evaluate(() => /النطاق الجغرافي/.test($('.a3ovf').textContent) && /لم يُحدَّد/.test($('.a3ovf').textContent) && !!$('.a360m .a3mk')), 'missing scope is marked in the header and the overview with what to do');
  ok(await p.evaluate(() => { const t = $('.a3bar').textContent; return ['تسجيل تواصل', 'رسالة جاهزة', 'رابط تحديث', 'تحرير البيانات', 'إضافة إلى', 'المزيد'].every((x) => t.includes(x)) }), 'one action bar: contact, message, update link, edit, add to, more');
  // النطاق ضمن البيانات ومحسوب
  ok(await p.evaluate((id) => { const h = hsOf(DBI[id]); return h.parts.some((x) => x.k == 'd_scope' && x.dim == 'data') && h.comp <= 100 && h.data <= 100 }, id), 'scope is a data indicator (weights normalised to 100)');
  await p.click('.a360m .a3mk'); await W(p, 800);
  ok(await p.evaluate(() => $('.a3tabs .on b').textContent == 'البيانات' && !!$('.a3c[data-c=scope]') && $$('.a3jump [data-a3j]').length >= 5), 'clicking the mark opens «البيانات» at the scope card, with a section jump bar');
  // تسجيل تواصل
  await p.evaluate((id) => a360LogDlg(id), id); await W(p);
  await p.fill('#clD [name=summary]', 'اختبار 1.00'); await p.click('#clDGo'); await W(p, 1500);
  ok(await p.evaluate(() => !$('#modal').classList.contains('on')), 'logging a contact from the header closes the dialog');
  // رسالة جاهزة: القالب الافتراضي «طلب تحديد النطاق» عند غيابه
  await p.evaluate((id) => a360Msg(id), id); await W(p);
  ok(await p.evaluate(() => /المحافظات التي تقدّمون فيها/.test($('#msgT').value) && !!$('#msgC')), 'ready message defaults to «طلب تحديد النطاق» for a file without scope; nothing is sent automatically');
  await p.evaluate(() => closeAll()); await W(p);
  // القوائم
  await p.evaluate((id) => a360Lists(id), id); await W(p);
  const LN = 'قائمة اختبار ' + Date.now(); await p.fill('#lsN', LN); await p.click('#lsGo'); await W(p, 1200);
  ok(await p.evaluate(([id, LN]) => LISTS.list.some((l) => l.n == LN && l.ids.includes(id)) && /قائمة|قوائم/.test($('.a360t').textContent) && !$('#modal').classList.contains('on'), [id, LN]), 'association added to a new shared list; header shows it');
  const lid = await p.evaluate((LN) => LISTS.list.find((l) => l.n == LN).id, LN);
  ok(await p.evaluate((lid) => dirList({ lst: lid }).length == 1 && dirList({ sc: 'none' }).length > 0, lid), 'directory filters: by list and by «النطاق: لم يُحدَّد»');
  // السجل
  await p.evaluate(() => a360Tab('log')); await W(p, 600);
  ok(await p.evaluate(() => !!$('.a3body .a3rail #clF') && /اختبار 1.00/.test($('.a3body .a3rail').textContent)), '«السجل» tab holds the composer and the full feed, including the new contact');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('1'); await W(p, 400);
  ok(await p.evaluate(() => $('.a3tabs .on b').textContent == 'نظرة عامة'), 'key 1 → overview');
  await p.setViewportSize({ width: 390, height: 844 }); await W(p, 400);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'no horizontal overflow on mobile');
  // تنظيف
  await p.evaluate((lid) => { LISTS.list = LISTS.list.filter((l) => l.id != lid); listsSave() }, lid); await W(p, 1500);
  await p.evaluate(async (id) => { const f = (await api(`/api/associations/${id}/full`)).data; const x = f.log.find((l) => l.summary == 'اختبار 1.00'); if (x) await api(`/api/associations/${id}/contact-log/${x.id}`, { method: 'DELETE' }) }, id);
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
