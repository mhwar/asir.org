// حزمة الزائر (0.59): الموقع العام يعمل كاملاً بلا كود لوحة التحكم
// يشغَّل على نسخة عامة بلا تسجيل دخول: wrangler dev --var SITE_MODE:public DEV_AUTH_EMAIL:  (VIS، افتراضياً 8789)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VIS = process.env.VIS || 'http://127.0.0.1:8789';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };

(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 390, height: 844, n: 'جوال' }, { width: 1366, height: 900, n: 'حاسوب' }]) {
    const p = await b.newPage({ viewport: vp });
    const errs = [], bad = [], js = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('response', (r) => { const u = r.url(); if (/\/assets\/.*\.js$/.test(u)) js.push(u.split('/').pop()); if (r.status() >= 400 && !/\/brand\/|\/u-logo\//.test(u)) bad.push(r.status() + ' ' + u); });
    await p.goto(VIS + '/', { waitUntil: 'networkidle' });
    ok(js.length === 1 && /^pub\./.test(js[0]), `${vp.n}: الزائر يحمّل حزمة الموقع العام فقط (${js.join(',')})`);
    ok(await p.evaluate(() => typeof renderAdmin === 'undefined' && typeof AM === 'undefined'), `${vp.n}: كود اللوحة غير موجود في الصفحة`);

    const pages = [['', 'الرئيسية'], ['about', 'عن المجلس'], ['directory', 'دليل الجمعيات'], ['news', 'المركز الإعلامي'], ['stories', 'تجارب'], ['consult', 'الاستشارات'],
      ['communities', 'المجتمعات'], ['brand', 'الهوية'], ['privacy', 'الخصوصية'], ['accessibility', 'إمكانية الوصول'], ['found', 'تأسيس'], ['contact', 'تواصل']];
    for (const [r, t] of pages) {
      const before = errs.length;
      await p.evaluate((h) => { location.hash = '#/' + h; }, r); await p.waitForTimeout(350);
      const txt = await p.evaluate(() => (document.querySelector('.page.on') || document.body).innerText.length);
      ok(errs.length === before && txt > 200, `${vp.n}: صفحة ${t} تعمل (${txt} حرفاً)`);
    }
    // الدليل: بحث وفلتر وطرق العرض وفتح جمعية
    await p.evaluate(() => { location.hash = '#/directory'; }); await p.waitForTimeout(300);
    const e0 = errs.length;
    await p.evaluate(() => { const q = document.querySelector('#q2') || document.querySelector('#q'); if (q) { q.value = 'أبها'; q.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p.waitForTimeout(300);
    for (const v of await p.$$eval('#vtabs [data-v]', (x) => x.map((y) => y.dataset.v))) { await p.click(`#vtabs [data-v="${v}"]`).catch(() => {}); await p.waitForTimeout(200); }
    ok(errs.length === e0, `${vp.n}: الدليل: البحث وطرق العرض بلا أخطاء`);
    await p.evaluate(() => { location.hash = '#/directory'; }); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.page.on .as').click()); await p.waitForTimeout(400);
    ok(errs.length === e0 && await p.evaluate(() => document.querySelector('#drawer')?.classList.contains('on')), `${vp.n}: درج الجمعية يفتح من الدليل`);
    const first = await p.evaluate(() => { const a = document.querySelector('#drawer a[href^="#/association/"]'); return a && a.getAttribute('href'); });
    if (first) { await p.evaluate((h) => { location.hash = h; }, first); await p.waitForTimeout(500); }
    ok(!!first && await p.evaluate(() => !!document.querySelector('.page.on h1')), `${vp.n}: صفحة الجمعية تفتح`);
    const share = await p.$('#shareBtn2'); if (share) await share.click().catch(() => {});
    ok(errs.length === e0, `${vp.n}: صفحة الجمعية بلا أخطاء`);
    // الرئيسية: الخريطة وقصص وأخبار
    await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(300);
    const g = await p.$('#miniMap path[role="button"]'); if (g) { await g.hover().catch(() => {}); await g.click().catch(() => {}); await p.waitForTimeout(300); }
    await p.evaluate(() => { location.hash = '#/news'; }); await p.waitForTimeout(300);
    const rd = await p.$('[data-rd], a[href^="#/read/"]'); if (rd) { await rd.click().catch(() => {}); await p.waitForTimeout(400); }
    ok(errs.length === e0, `${vp.n}: الخريطة والأخبار وقراءة خبر بلا أخطاء`);
    // الاستشارات والمجتمعات والفعاليات: فتح النماذج
    await p.evaluate(() => { location.hash = '#/consult'; }); await p.waitForTimeout(300);
    const ct = await p.$('#ctypes .ct'); if (ct) { await ct.click().catch(() => {}); await p.waitForTimeout(300); await p.keyboard.press('Escape'); }
    await p.evaluate(() => { location.hash = '#/communities'; }); await p.waitForTimeout(300);
    const jn = await p.$('#comms .join'); if (jn) { await jn.click().catch(() => {}); await p.waitForTimeout(300); await p.keyboard.press('Escape'); }
    await p.evaluate(() => { location.hash = '#/found'; }); await p.waitForTimeout(300);
    ok(errs.length === e0, `${vp.n}: الاستشارات والمجتمعات والتأسيس بلا أخطاء`);
    // أدوات الإتاحة والمظهر
    const ab = await p.$('.a11yb'); if (ab) { await ab.click().catch(() => {}); await p.waitForTimeout(200); await p.keyboard.press('Escape'); }
    ok(errs.length === e0, `${vp.n}: أدوات الإتاحة بلا أخطاء`);
    await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(1500);
    await p.addScriptTag({ content: AXE });
    const ax = await p.evaluate(async () => (await axe.run(document.querySelector('.page.on') || document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length + ' ' + v.nodes.map((n) => n.html.slice(0, 120) + ' ' + (n.failureSummary || '').slice(-90)).join(' ; ')));
    ok(ax.length === 0, `${vp.n}: axe على الرئيسية ${ax.join(' ')}`);
    ok(errs.length === 0, `${vp.n}: لا أخطاء في الصفحة ${errs.slice(0, 3).join(' | ')}`);
    ok(bad.length === 0, `${vp.n}: لا ملفات مفقودة ${bad.slice(0, 3).join(' | ')}`);
    await p.close();
  }
  // شعارات الجهات المشرفة ملفات تُحفظ
  const p = await b.newPage(); await p.goto(VIS + '/#/directory', { waitUntil: 'networkidle' });
  const sl = await p.evaluate(() => [...document.querySelectorAll('.slogo img')].map((i) => i.getAttribute('src')).slice(0, 1)[0] || Object.values(SUPLOGO)[0]);
  const r = await fetch(VIS + sl);
  ok(/^\/assets\/img\/sup\.[0-9a-f]{10}\.(svg|webp|png)$/.test(sl) && r.status === 200 && /max-age=31536000/.test(r.headers.get('cache-control') || ''), 'شعار الجهة المشرفة ملف مستقل يُحفظ سنة');
  await b.close();
  console.log(`\n${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
