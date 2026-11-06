// أنماط الزائر (0.61): كل صفحة وحالة تُحسب أنماطها كما تُحسب بالأنماط الكاملة
// على نسخة عامة بلا دخول (VIS، افتراضياً 8789). في الصفحة نفسها وبالحالة نفسها تُقرأ الأنماط المحسوبة لكل عنصر
// (وأشباهه ::before/::after) بأنماط الزائر، ثم تُستبدل الأنماط الكاملة وتُقرأ من جديد: يجب ألا يختلف شيء.
const { chromium } = require('playwright');
const VIS = process.env.VIS || 'http://127.0.0.1:8789';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
const PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'min-height', 'max-width', 'margin-top', 'margin-bottom', 'padding', 'border', 'border-radius', 'box-shadow',
  'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-decoration-line', 'white-space',
  'opacity', 'visibility', 'transform', 'z-index', 'overflow', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'order', 'outline', 'filter', 'cursor', 'content'];

const states = [
  ['الرئيسية', '/', null], ['عن المجلس', '/#/about', null], ['الدليل', '/#/directory', null], ['الأخبار', '/#/news', null],
  ['قصص الأثر', '/#/stories', null], ['الاستشارات', '/#/consult', null], ['المجتمعات', '/#/communities', null],
  ['الهوية', '/#/brand', null], ['الخصوصية', '/#/privacy', null], ['الإتاحة', '/#/accessibility', null], ['التأسيس', '/#/found', null],
  ['صفحة جمعية', '/association/451', null],
  ['درج جمعية', '/#/directory', async (p) => { await p.evaluate(() => document.querySelector('.page.on .as').click()); }],
  ['خبر', '/#/news', async (p) => { const r = await p.$('[data-rd]'); if (r) await r.click(); }],
  ['نافذة استشارة', '/#/consult', async (p) => { const c = await p.$('#ctypes .ct'); if (c) await c.click(); }],
  ['لوحة الإتاحة', '/', async (p) => { const b = await p.$('.a11yb'); if (b) await b.click(); }],
  ['القائمة', '/', async (p) => { const b = await p.$('#burger'); if (b && await b.isVisible()) await b.click(); }],
  ['خريطة الدليل', '/#/directory', async (p) => { const b = await p.$('#dMapBtn'); if (b && await b.isVisible()) await b.click(); }],
  ['أدوات الإتاحة مفعّلة', '/', async (p) => { await p.evaluate(() => { const b = document.querySelector('.a11yb'); b && b.click(); }); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelectorAll('#a11yP button').forEach((x, i) => { if (i < 6) x.click(); })); }],
];
const collect = (props) => { const out = []; void document.body.getBoundingClientRect();
  for (const el of document.querySelectorAll('body *:not(script):not(style):not(link)')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const id = el.tagName + (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.');
    out.push(id + '|' + props.map((k) => cs.getPropertyValue(k)).join('|') + '|' + [r.x + scrollX, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 2) / 2).join(','));
    for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps); if (c.content && c.content !== 'none') out.push(id + ps + '|' + props.map((k) => c.getPropertyValue(k)).join('|')); } }
  return out; };

(async () => {
  const b = await chromium.launch();
  const full = await (await fetch(VIS + '/?full=1')).text();
  const appCss = full.match(/href="(\/assets\/app\.[0-9a-f]{10}\.css)"/)[1];
  const page0 = await (await fetch(VIS + '/')).text();
  ok(/href="\/assets\/pub\.[0-9a-f]{10}\.css"/.test(page0) && !/app\.[0-9a-f]{10}\.css/.test(page0), 'الزائر يحمّل أنماط الموقع العام فقط');
  const sz = async (u) => (await (await fetch(VIS + u)).arrayBuffer()).byteLength;
  const pubCss = page0.match(/href="(\/assets\/pub\.[0-9a-f]{10}\.css)"/)[1];
  const [a, c] = [await sz(appCss), await sz(pubCss)];
  ok(c < a * 0.6, `حجم أنماط الزائر ${Math.round(c / 1024)} ك.ب بدل ${Math.round(a / 1024)}`);
  let total = 0;
  for (const theme of ['light', 'dark']) for (const vp of [{ width: 390, height: 844, n: 'جوال' }, { width: 1366, height: 900, n: 'حاسوب' }]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
    const diffs = [];
    for (const [name, url, act] of states) {
      const p = await ctx.newPage();
      await p.goto(VIS + url, { waitUntil: 'networkidle' });
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}html{scroll-behavior:auto!important}' });
      if (act) await act(p).catch(() => {});
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);  // صور وشعارات تُحمَّل متأخرة تغيّر الارتفاعات
      const A = await p.evaluate(collect, PROPS);
      await p.evaluate((h) => new Promise((r) => { const l = document.querySelector('link[rel=stylesheet][href^="/assets/"]'); l.onload = r; l.href = h; }), appCss);
      await p.waitForTimeout(150);
      const B = await p.evaluate(collect, PROPS);
      total += A.length;
      const bad = A.map((x, i) => [x, B[i] || '']).filter(([x, y]) => x !== y);
      if (A.length !== B.length || bad.length) {
        const [x, y] = bad[0] || ['', ''], xs = x.split('|'), ys = y.split('|');
        diffs.push(`${name}: ${bad.length} عنصر، مثل ${xs[0]} ${xs.map((v, i) => i && v !== ys[i] ? (PROPS[i - 1] || 'الموضع') + '=' + v + ' بدل ' + ys[i] : '').filter(Boolean).slice(0, 2).join(' · ')}`);
      }
      await p.close();
    }
    ok(diffs.length === 0, `${vp.n} · ${theme == 'dark' ? 'ليلي' : 'فاتح'}: ${states.length} حالة بأنماط مطابقة ${diffs.length ? '— ' + diffs.join(' ؛ ') : ''}`);
    await ctx.close();
  }
  ok(total > 20000, `فُحصت أنماط ${total} عنصراً`);
  await b.close();
  console.log(`\n${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
