// محركات البحث والمشاركة والخطوط المستضافة (0.58)
// يشغَّل على نسختين: الخاصة (BASE، افتراضياً 8787) والعامة (PUB، افتراضياً 8788 مع SITE_MODE=public)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PUB = process.env.PUB || 'http://127.0.0.1:8788';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
const get = async (u) => { const r = await fetch(u, { redirect: 'manual' }); return { s: r.status, h: r.headers, t: await r.text() }; };

(async () => {
  // الوضع الخاص: لا فهرسة
  let r = await get(BASE + '/robots.txt');
  ok(/Disallow: \/\n/.test(r.t) && !/Sitemap/.test(r.t), 'الخاص: robots يمنع الزحف');
  r = await get(BASE + '/');
  ok((r.h.get('x-robots-tag') || '').includes('noindex'), 'الخاص: ترويسة X-Robots-Tag noindex');
  ok(/<meta name="robots" content="noindex,nofollow">/.test(r.t), 'الخاص: وسم robots noindex');
  ok((await get(BASE + '/sitemap.xml')).s === 404, 'الخاص: لا خريطة موقع');

  // الوضع العام
  r = await get(PUB + '/robots.txt');
  ok(/Allow: \//.test(r.t) && /Disallow: \/api\//.test(r.t) && /Disallow: \/k\//.test(r.t) && /Sitemap: .*\/sitemap\.xml/.test(r.t), 'العام: robots يسمح ويستثني الواجهات والروابط الشخصية');
  r = await get(PUB + '/sitemap.xml');
  const locs = [...r.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(r.s === 200 && locs.length > 100, `العام: خريطة الموقع (${locs.length} رابطاً)`);
  ok(locs.some((u) => /\/directory$/.test(u)) && locs.some((u) => /\/association\//.test(u)), 'الخريطة تضم الدليل وصفحات الجمعيات');
  ok(!locs.some((u) => /\/(api|k|u|auth)\//.test(u)), 'الخريطة بلا مسارات خاصة');

  const home = await get(PUB + '/');
  ok(!/noindex/.test(home.t) && !home.h.get('x-robots-tag'), 'العام: الصفحة قابلة للفهرسة');
  ok(/<link rel="canonical" href="[^"]+\/">/.test(home.t), 'canonical للرئيسية');
  ok(/og:image" content="[^"]+\/pwa\/og\.png"/.test(home.t) && /twitter:card" content="summary_large_image"/.test(home.t), 'صورة المشاركة ووسوم X');
  const ld = JSON.parse(home.t.match(/application\/ld\+json">(.*?)<\/script>/)[1]);
  ok(ld['@graph'].some((x) => x['@type'] === 'NGO' && x.name.includes('عسير')), 'بيانات المنظمة JSON-LD');
  ok((await fetch(PUB + '/pwa/og.png')).headers.get('content-type') === 'image/png', 'صورة المشاركة متاحة');

  const dir = await get(PUB + '/directory');
  ok(dir.s === 200 && /<title>دليل الجمعيات الأهلية في عسير — /.test(dir.t) && /canonical" href="[^"]+\/directory"/.test(dir.t), 'رابط نظيف للدليل بعنوان خاص');
  const al = locs.find((u) => /\/association\//.test(u));
  const ap = await get(PUB + new URL(al).pathname);
  const lic = decodeURIComponent(al.split('/association/')[1]);
  ok(ap.s === 200 && /<title>[^<]+ \| مجلس الجمعيات/.test(ap.t) && ap.t.includes('"identifier":"' + lic + '"'), 'صفحة الجمعية: عنوان ووصف خاصان');
  ok((await get(PUB + '/association/no-such-assoc')).s === 404, 'جمعية غير موجودة ← 404');

  // الخطوط داخل الموقع، بلا جهات خارجية
  ok(!/fonts\.googleapis|fonts\.gstatic/.test(home.t), 'لا طلب إلى Google Fonts');
  const f = await fetch(PUB + '/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2');
  ok(f.status === 200 && /max-age=31536000/.test(f.headers.get('cache-control') || ''), 'ملف الخط يُخدم ويُحفظ سنة');

  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const ext = []; p.on('request', (q) => { const h = new URL(q.url()).host; if (!/127\.0\.0\.1|localhost/.test(h)) ext.push(h); });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(PUB + new URL(al).pathname, { waitUntil: 'networkidle' });
  ok(await p.evaluate(() => !!document.querySelector('.page.on h1')?.textContent.trim()), 'الرابط النظيف يفتح صفحة الجمعية');
  const fonts = await p.evaluate(async () => { await document.fonts.ready; return { av5: document.fonts.check('500 16px "Avenir Arabic"', 'عسير'), av8: document.fonts.check('800 16px "Avenir Arabic"', 'عسير'),
    used: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ' ' + f.weight), body: getComputedStyle(document.body).fontFamily.split(',')[0] }; });
  ok(fonts.av5 && fonts.av8 && /Avenir Arabic/.test(fonts.body) && fonts.used.some((x) => /^Avenir Arabic/.test(x)), 'خط الهوية Avenir Arabic محمّل (Medium وHeavy): ' + fonts.used.join(', '));
  ok(!fonts.used.some((x) => /IBM Plex/.test(x)), 'الخط الاحتياطي لا يُنزَّل ما دام خط الهوية يغطي النص');
  await p.evaluate(() => { location.hash = '#/about'; }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => /عن المجلس/.test(document.querySelector('.page.on h1')?.textContent || '')), 'التنقل الداخلي يعمل من رابط نظيف');
  await p.goto(PUB + '/directory', { waitUntil: 'networkidle' });
  ok(await p.evaluate(() => [...document.querySelectorAll('#vtabs button')].every((x) => x.hasAttribute('aria-pressed')) && document.querySelector('#vtabs').getAttribute('role') === 'group'), 'أزرار طريقة العرض بحالة ضغط');
  ok(await p.evaluate(() => !!document.querySelector('#fSort2').getAttribute('aria-label') && !!document.querySelector('#dfOpen').getAttribute('aria-label')), 'أسماء الأزرار والقوائم على الجوال');
  ok(await p.evaluate(() => document.querySelectorAll('footer h5').length === 0 && document.querySelectorAll('footer h2.fh5').length === 3), 'عناوين التذييل بترتيب صحيح');
  ok([...new Set(ext)].length === 0, 'لا طلبات لجهات خارجية: ' + [...new Set(ext)].join(','));
  ok(errs.length === 0, 'بلا أخطاء في الصفحة ' + errs.join(' | '));
  await b.close();
  console.log(`\n${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
