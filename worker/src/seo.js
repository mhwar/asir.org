// محركات البحث والمشاركة: robots.txt وخريطة الموقع وروابط نظيفة لكل صفحة عامة،
// ووسوم العنوان والوصف وcanonical وOpen Graph وبيانات JSON-LD تُحقن في الصفحة.
// في الوضع الخاص (private) يبقى كل شيء خارج الفهرسة.

const NAME = 'مجلس الجمعيات الأهلية بمنطقة عسير';
const DESC = 'دليل الجمعيات الأهلية في منطقة عسير، والفعاليات والبرامج، والاستشارات، والشراكات، والحوكمة.';

// المسار النظيف ← مسار الواجهة (hash) والعنوان والوصف
export const PAGES = {
  '/': { r: '', t: NAME, d: DESC },
  '/about': { r: 'about', t: 'عن المجلس والحوكمة', d: 'رؤية مجلس الجمعيات الأهلية بمنطقة عسير ورسالته، ومجلس الإدارة، والأنظمة واللجان والتقارير.' },
  '/directory': { r: 'directory', t: 'دليل الجمعيات الأهلية في عسير', d: 'ابحث في الجمعيات الأهلية المرخّصة في منطقة عسير حسب المحافظة والمجال، مع رقم الترخيص وبيانات التواصل المنشورة.' },
  '/news': { r: 'news', t: 'المركز الإعلامي', d: 'أخبار المجلس وفعالياته واتفاقياته وشراكاته.' },
  '/stories': { r: 'stories', t: 'تجارب مميزة من جمعيات عسير', d: 'قصص أثر من الجمعيات الأهلية في منطقة عسير.' },
  '/consult': { r: 'consult', t: 'الاستشارات', d: 'احجز استشارة من مستشاري المجلس للجمعيات الأهلية في منطقة عسير.' },
  '/communities': { r: 'communities', t: 'المجتمعات المهنية والتخصصية', d: 'مجتمعات مهنية تجمع العاملين في الجمعيات الأهلية حسب التخصص.' },
  '/brand': { r: 'brand', t: 'الهوية البصرية والشعار', d: 'شعار المجلس وألوان الهوية وقواعد الاستخدام، للتنزيل.' },
  '/privacy': { r: 'privacy', t: 'سياسة الخصوصية وحماية البيانات', d: 'كيف يجمع المجلس البيانات الشخصية ويحميها، وحقوق أصحاب البيانات.' },
  '/accessibility': { r: 'accessibility', t: 'بيان إمكانية الوصول', d: 'التزام المجلس بإتاحة الموقع للجميع، وأدوات الإتاحة، وطريقة الإبلاغ عن مشكلة.' },
};
const ASSOC = /^\/association\/([\w-]{1,40})\/?$/;
const isPublic = (env) => env.SITE_MODE === 'public';
const origin = (env, url) => (env.SITE_URL || url.origin).replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

/** هل المسار صفحة عامة يخدمها الموقع؟ يعيد { page, lic } أو null */
export function matchPage(pathname) {
  const p = pathname === '/index.html' ? '/' : pathname.replace(/\/$/, '') || '/';
  if (PAGES[p]) return { page: PAGES[p], path: p };
  const m = pathname.match(ASSOC);
  if (m) return { page: null, path: `/association/${m[1]}`, lic: decodeURIComponent(m[1]) };
  return null;
}

export function robots(env, url) {
  const body = isPublic(env)
    ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nDisallow: /k/\nDisallow: /u/\nDisallow: /files/\n\nSitemap: ${origin(env, url)}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

export function sitemap(env, url, pub) {
  if (!isPublic(env)) return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  const o = origin(env, url);
  const u = (loc, pri) => `<url><loc>${esc(o + loc)}</loc><priority>${pri}</priority></url>`;
  const rows = [
    ...Object.keys(PAGES).map((p) => u(p, p === '/' ? '1.0' : p === '/directory' ? '0.9' : '0.6')),
    ...pub.filter((a) => a.lic).map((a) => u(`/association/${encodeURIComponent(a.lic)}`, '0.5')),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

/** وسوم الصفحة: { title, head } — head يُحقن مكان <!--@SEO--> */
export function head(env, url, match, pub) {
  const o = origin(env, url);
  let t = NAME, d = DESC, path = match ? match.path : '/', type = 'website';
  const org = { '@type': 'NGO', '@id': `${o}/#org`, name: NAME, url: `${o}/`, logo: `${o}/brand-kit/asir-council-logo.png`,
    email: 'info.ase@ccsa.org.sa', areaServed: { '@type': 'AdministrativeArea', name: 'منطقة عسير' } };
  const graph = [org, { '@type': 'WebSite', '@id': `${o}/#site`, name: NAME, url: `${o}/`, inLanguage: 'ar', publisher: { '@id': `${o}/#org` } }];
  if (match && match.page && match.path !== '/') { t = `${match.page.t} — ${NAME}`; d = match.page.d; }
  if (match && match.lic) {
    const a = pub.find((x) => String(x.lic) === match.lic);
    if (a) {
      t = `${a.n} — ${a.gov || 'عسير'} | ${NAME}`;
      d = (a.ab || `${a.n}، جمعية أهلية مرخّصة برقم ${a.lic} في ${a.gov || 'منطقة عسير'}${a.s1 ? `، في مجال ${a.s1}` : ''}.`).slice(0, 300);
      type = 'profile';
      const n = { '@type': 'NGO', name: a.n, url: `${o}${path}`, identifier: String(a.lic), areaServed: a.gov || 'منطقة عسير', memberOf: { '@id': `${o}/#org` } };
      if (a.y) n.foundingDate = String(a.y);
      if (a.web) n.sameAs = [a.web];
      if (a.lg) n.logo = `${o}${a.lg}`;
      if (a.ab) n.description = a.ab.slice(0, 500);
      graph.push(n);
    } else { t = `جمعية غير موجودة — ${NAME}`; }
  }
  const img = `${o}/pwa/og.png`;
  const robotsMeta = isPublic(env) ? 'index,follow' : 'noindex,nofollow';
  const h = [
    `<link rel="canonical" href="${esc(o + path)}">`,
    `<meta name="robots" content="${robotsMeta}">`,
    `<meta property="og:site_name" content="${esc(NAME)}">`,
    `<meta property="og:url" content="${esc(o + path)}">`,
    `<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(NAME)}">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t)}"><meta name="twitter:description" content="${esc(d)}"><meta name="twitter:image" content="${esc(img)}">`,
    ld({ '@context': 'https://schema.org', '@graph': graph }),
  ].join('');
  return { title: t, desc: d, type, head: h };
}

/** يطبّق الوسوم على HTML الصفحة */
export function apply(html, s) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(s.desc)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(s.title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(s.desc)}$2`);
  html = html.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${s.type}$2`);
  return html.replace('<!--@SEO-->', s.head);
}
