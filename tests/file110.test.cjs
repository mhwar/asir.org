// 1.10: ملف الجمعية الموحّد — صفحة واحدة: رأس (الوضع + جودة البيانات + مؤشر الجمعية + علامة «يحتاج تدخلاً»)،
// البيانات (واجهات + جدول واحد + أربع حالات + طلب جماعي + تأكيد بالمصدر)، تقييم الجمعية (خمسة محاور + مخاطر)، العلاقة والنشاط.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  const id = await p.evaluate(() => DB.find((o) => /آباء/.test(o.n)).id);
  await p.evaluate((id) => open360(id), id); await W(p, 2500);
  ok(await p.evaluate(() => !$('.a3tabs') && !!$('#a5data') && !!$('#a5eval') && !!$('#a5rel')), 'one page: data, evaluation, relation sections; no tabs');
  ok(await p.evaluate(() => /الوضع:/.test($('.a5st').textContent) && /أهم خطوة الآن/.test($('.a5st').textContent)), 'status sentence with the next step');
  ok(await p.evaluate(() => $$('.a5num').length == 2 && /%/.test($('.a5num.dq b').textContent) && !!$('.a5num.ix').title), 'two numbers (data quality, association index) with definitions');
  // العلامة
  await p.click('#a5flag'); await W(p);
  ok(await p.evaluate(() => !!$('.a5pop') && $$('.a5pop .a5pi').length >= 1 && !!$('.a5pop .jbtn.pri')), '«يحتاج تدخلاً» flag opens a popover with actions');
  await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => !$('.a5pop')), 'Escape closes it');
  // البيانات
  ok(await p.evaluate(() => $$('.a5vt button').length == 7 && $$('.a5ff button').length >= 5), 'seven data views and four status filters');
  ok(await p.evaluate(() => $$('#a5data .a5t tbody .pill2').every((x) => ['مؤكد', 'غير مؤكد', 'ناقص', 'يحتاج مراجعة'].includes(x.textContent))), 'only four statuses');
  await p.click('[data-a5v=lead]'); await W(p);
  ok(await p.evaluate(() => $('.a5vt .on').textContent.includes('القيادة') && /أعضاء مجلس الإدارة/.test($('#a5data').textContent)), 'leadership view with board members table');
  await p.click('[data-a5v=place]'); await W(p);
  ok(await p.evaluate(() => !!$('.a5ins [data-sct]')), 'scope editor inside «النطاق والتواصل»');
  // التحديد الجماعي
  await p.click('[data-a5sv]'); await W(p);
  const n = await p.evaluate(() => Object.keys(ADM.a5sel).length);
  ok(n > 0 && await p.evaluate(() => !!$('[data-a5req]') && /حددت/.test($('.a5bk').textContent)), 'select all missing in the view → «طلبها من الجمعية برابط واحد» (' + n + ')');
  await p.click('[data-a5clr]'); await W(p);
  // التأكيد بالمصدر
  const un = await p.evaluate(() => { ADM.a5v = 'all'; ADM.a5f = 'un'; AM.assoc($('#acontent')); return $$('[data-a5a]').length });
  if (un) { await p.evaluate(() => $$('[data-a5a]')[0].click()); await W(p); ok(await p.evaluate(() => !!$('.a5cf') && $$('input[name=a5cf]').length == 4), 'confirm opens an inline «كيف تأكدت؟» row with four sources') }
  // التقييم
  ok(await p.evaluate(() => $$('.a5axw > table > tbody > tr').length == 5 && !!$('.a5ix b')), 'evaluation: index with five axes');
  ok(await p.evaluate((id) => { const o = DBI[id], h = hsOf(o), X = a5Index(o, h, trCase(o.id)); return X.s >= 0 && X.s <= 100 && X.ax.reduce((t, a) => t + a.w, 0) == 100 }, id), 'axes weights sum to 100 and index in range');
  await p.click('[data-a5ax=comp]'); await W(p);
  ok(await p.evaluate(() => !!$('.a5axd') && $$('.a5axd tbody tr').length >= 2), 'axis opens its indicators table');
  // العلاقة
  ok(await p.evaluate(() => $$('#a5rel .a5kp > div').length == 6 && $$('#a5rel .a5t tbody tr').length >= 1), 'relation: six facts and the activity table');
  // الانتقال القديم
  await p.evaluate((id) => open360(id, 'diag'), id); await W(p, 1200);
  ok(await p.evaluate(() => ADM.a5ax == 'gov'), 'old link open360(id,"diag") lands on evaluation with governance open');
  // اللقطة تحمل المؤشرين
  ok(await p.evaluate((id) => { const s = hsSnapOf(DBI[id]); return s && s.s != null && s.ix != null }, id), 'snapshot stores old and new index together');
  // الجوال
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { ADM.a5f = 'all'; AM.assoc($('#acontent')) }); await W(p, 500);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && getComputedStyle($('.a5cards')).display == 'flex' && getComputedStyle($('.a5mb')).display == 'flex'), 'mobile: cards instead of tables, bottom action bar, no overflow');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
