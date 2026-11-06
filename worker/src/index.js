// مجلس الجمعيات الأهلية بعسير — Worker: API + serving the site with live data.
//
// Phase 1 (SITE_MODE=private): every request requires an allowed user.
// Phase 2 (SITE_MODE=public): the site and /api/public/* open to everyone; the
// dashboard data and /api/* stay behind login.
import { json, errorResponse, fail, readJson, withHeaders } from './http.js';
import * as keys from './keys.js';
import { requireUser, requirePerm, can, authMode, previewLogin, previewLogoutCookie } from './auth.js';
import * as db from './db.js';
import { readState, writeState } from './state.js';
import * as rq from './requests.js';
import * as pf from './profile.js';
import { brandApi, serveBrand } from './brand.js';
import * as msg from './messages.js';
import * as al from './alerts.js';
import * as adm from './admin.js';
import * as dc from './docs.js';
import * as seo from './seo.js';
import * as ts from './turnstile.js';

const MARK = (name) => [`/*@${name}*/`, '/*@END*/'];

// ملفات البناء ببصمة المحتوى (/assets/app.<بصمة>.js …) لا تتغير أبداً: تُحفظ سنة في جهاز المستخدم.
// في الوضع الخاص تبقى خاصة بالمتصفح (private) لأنها خلف تسجيل الدخول.
const FINGERPRINT = /^\/assets\/(?:img\/)?[\w-]+\.[0-9a-f]{10}\.(?:js|css|jpg|png|webp|svg)$/;
const FONT = /^\/fonts\/[\w.-]+\.woff2$/;
function assetCache(url, env) {
  if (!FINGERPRINT.test(url.pathname) && !FONT.test(url.pathname)) return {};
  return { 'Cache-Control': `${env.SITE_MODE === 'public' ? 'public' : 'private'}, max-age=31536000, immutable` };
}

// خط الهوية (Monotype، مرخّص للمجلس) لا يُرفع صريحاً للمستودع العام: الملفان مشفّران AES-GCM داخل الـ Worker
// والمفتاح في D1 (site_assets، path = 'key:fonts'). يمكن أيضاً وضع الملف صريحاً في site_assets بمساره.
import encMedium from '../enc/AvenirArabic-Medium.woff2.enc';
import encHeavy from '../enc/AvenirArabic-Heavy.woff2.enc';
const ENC = { '/fonts/AvenirArabic-Medium.woff2': [encMedium, 'AvenirArabic-Medium.woff2'], '/fonts/AvenirArabic-Heavy.woff2': [encHeavy, 'AvenirArabic-Heavy.woff2'] };
const SITE_ASSET = /^\/fonts\/AvenirArabic-[\w-]+\.woff2$/;
const hexBytes = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
async function siteAsset(env, path) {
  const r = await env.DB.prepare('SELECT mime, data, sha FROM site_assets WHERE path = ?1').bind(path).first().catch(() => null);
  if (r) return { body: Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)), mime: r.mime, tag: r.sha };
  const e = ENC[path];
  if (!e) return null;
  const k = await env.DB.prepare("SELECT data FROM site_assets WHERE path = 'key:fonts'").first().catch(() => null);
  if (!k) return null;
  const buf = new Uint8Array(e[0]), key = await crypto.subtle.importKey('raw', hexBytes(k.data.trim()), 'AES-GCM', false, ['decrypt']);
  const body = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12), additionalData: new TextEncoder().encode(e[1]) }, key, buf.slice(12)));
  return { body, mime: 'font/woff2', tag: path.split('/').pop() };
}
async function serveSiteAsset(req, env, url) {
  const cache = caches.default, ck = new Request(url.origin + url.pathname);
  const hit = env.SITE_MODE === 'public' && await cache.match(ck).catch(() => null);
  if (hit) return hit;
  const a = await siteAsset(env, url.pathname).catch(() => null);
  if (!a) return withHeaders(await env.ASSETS.fetch(req), assetCache(url, env));
  const res = withHeaders(new Response(a.body, { headers: { 'Content-Type': a.mime, ETag: `"${a.tag}"`,
    'Cache-Control': `${env.SITE_MODE === 'public' ? 'public' : 'private'}, max-age=31536000, immutable` } }));
  if (env.SITE_MODE === 'public') await cache.put(ck, res.clone()).catch(() => {});
  return res;
}

function inject(html, name, value) {
  const [open, close] = MARK(name);
  const a = html.indexOf(open);
  if (a < 0) return html;
  const b = html.indexOf(close, a + open.length);
  if (b < 0) return html;
  return html.slice(0, a + open.length) + value + html.slice(b);
}
const safeJson = (v) => JSON.stringify(v).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
// البيانات الكبيرة تُحقن نصاً يُقرأ بـ JSON.parse: أسرع بكثير في المتصفح من قراءة كائن JavaScript بالحجم نفسه
const bigJson = (v) => `JSON.parse(${safeJson(JSON.stringify(v))})`;

async function servePage(req, env, user, match) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/', req.url), { headers: req.headers }));
  if (!asset.ok) return asset;
  let html = await asset.text();
  const { raw, pub, synced } = await db.pagePayload(env);
  const url = new URL(req.url);
  const meta = seo.head(env, url, match || seo.matchPage('/'), pub);
  html = seo.apply(html, meta).replace('</head>', ts.meta(env) + '</head>');
  const missing = match && match.lic && !pub.some((x) => String(x.lic) === match.lic);
  html = inject(html, 'PUB', bigJson(pub));
  html = inject(html, 'STATE', bigJson(await readState(env, user)));
  if (user) {
    html = inject(html, 'RAW', bigJson(raw));
    html = inject(html, 'SESSION', safeJson({
      email: user.email, name: user.name, role: user.role, roleName: user.roleName,
      source: 'd1', synced, env: env.ENVIRONMENT || 'production', authMode: user.authMode,
      perms: Object.fromEntries(user.perms), settings: await adm.getSettings(env).then((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, v.value]))).catch(() => ({})),
    }));
  } else {
    html = inject(html, 'RAW', '[]');
  }
  if (!user && !new URL(req.url).searchParams.has('full')) {
    // الزائر يأخذ حزمة الموقع العام فقط (بلا كود لوحة التحكم)؛ الفريق والبوابة يأخذان الحزمة الكاملة
    html = html.replace(/<script src="(\/assets\/app\.[0-9a-f]{10}\.js)" data-pub="(\/assets\/pub\.[0-9a-f]{10}\.js)"><\/script>/, '<script src="$2"></script>');
    html = html.replace(/<link rel="stylesheet" href="(\/assets\/app\.[0-9a-f]{10}\.css)" data-pub="(\/assets\/pub\.[0-9a-f]{10}\.css)">/, '<link rel="stylesheet" href="$2">');
  }
  const h = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  if (env.SITE_MODE !== 'public') h['X-Robots-Tag'] = 'noindex, nofollow';
  return withHeaders(new Response(html, { status: missing ? 404 : 200, headers: h }));
}

async function servePortal(req, env, token) {
  const link = await rq.resolveLink(env, req, token);
  if (!link) return shell(`<h1>مجلس الجمعيات الأهلية بعسير</h1><p>رابط التحديث غير صالح أو انتهت مدته.</p><p>تواصل مع فريق المجلس لإرسال رابط جديد.</p>`, 404);
  if (req.method === 'POST') {
    const r = await rq.verifyPin(env, req, link, token);
    if (!r.ok) return pinForm(r.message, r.locked ? 429 : 401);
    return withHeaders(new Response(null, { status: 303, headers: { Location: `/u/${token}`, 'Set-Cookie': r.cookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }));
  }
  if (!(await rq.pinOk(env, req, link))) return pinForm();
  const asset = await env.ASSETS.fetch(new Request(new URL('/', req.url), { headers: req.headers }));
  let html = await asset.text();
  // public directory fields only (what the public site will show); internal data stays out
  const { pub } = await db.pagePayload(env);
  html = inject(html, 'PUB', bigJson(pub));
  html = inject(html, 'RAW', '[]');
  html = inject(html, 'STATE', bigJson(await readState(env, null)));
  html = inject(html, 'PORTAL', safeJson({ token, ...(await rq.portalPayload(env, link)) }));
  return withHeaders(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }));
}

async function noteLogin(req, env, user) {
  // one login entry per 12h per user keeps the audit log readable
  const last = user.last_login_at ? Date.parse(user.last_login_at) : 0;
  if (Date.now() - last < 12 * 3600_000) return;
  await env.DB.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1").bind(user.id).run();
  await db.audit(env, req, user.email, 'login', 'users', user.id);
}

const shell = (body, status = 200, extra = {}) => withHeaders(new Response(
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>مجلس الجمعيات الأهلية بعسير — الدخول</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#F4F6FA;color:#13205B}
.c{background:#fff;padding:32px 28px;border-radius:18px;box-shadow:0 10px 40px -12px #13205B33;width:min(400px,calc(100vw - 32px));box-sizing:border-box;text-align:center}
h1{font-size:19px;margin:0 0 6px}p{color:#5B6478;font-size:14px;line-height:1.7;margin:0 0 18px}
input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #D7DCE6;border-radius:12px;font-size:18px;text-align:center;letter-spacing:2px}
button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#13205B;color:#fff;font-size:15px;font-weight:600}
.e{color:#B42318;font-size:13px;margin-top:10px}.n{font-size:12px;color:#8A93A6;margin-top:18px}a{color:#13205B}</style>
<body><div class="c">${body}</div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra } }));

function previewForm(msg = '', status = 401) {
  return shell(`<h1>مجلس الجمعيات الأهلية بعسير</h1><p>نسخة معاينة لفريق المجلس. أدخل رمز المعاينة.</p>
<form method="post" action="/auth/preview"><input name="code" type="password" autocomplete="current-password" inputmode="text" required autofocus aria-label="رمز المعاينة">
<button type="submit">دخول</button></form>${msg ? `<div class="e">${msg}</div>` : ''}<div class="n">لديك رابط دخول خاص؟ افتحه مباشرة.<br>للفريق فقط — لا يُنشر</div>`, status);
}

function pinForm(msg = '', status = 200) {
  return shell(`<h1>تحديث بيانات الجمعية</h1><p>أدخل رمز الدخول المكوّن من 6 أرقام، المرسل لكم مع الرابط من مجلس الجمعيات الأهلية بعسير.</p>
<form method="post"><input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" required autofocus aria-label="رمز الدخول" placeholder="••••••">
<button type="submit">متابعة</button></form>${msg ? `<div class="e">${msg}</div>` : ''}<div class="n">لم يصلكم الرمز؟ تواصلوا مع فريق المجلس.</div>`, status, { 'Referrer-Policy': 'no-referrer' });
}

function keyPage(msg = '', status = 200) {
  return shell(`<h1>مجلس الجمعيات الأهلية بعسير</h1><p>رابط دخول شخصي إلى منصة فريق المجلس. لا تشاركه مع أحد؛ كل دخول به يُسجَّل باسمك.</p>
<form method="post"><button type="submit">دخول إلى المنصة</button></form>${msg ? `<div class="e">${msg}</div>` : ''}<div class="n">للفريق فقط — لا يُنشر</div>`, status, { 'Referrer-Policy': 'no-referrer' });
}

async function serveKey(req, env, url, t) {
  if (req.method !== 'POST') return keyPage();
  const origin = req.headers.get('Origin');
  if (origin && origin !== url.origin) return keyPage('مصدر الطلب غير مسموح.', 403);
  const r = await keys.redeem(env, req, t);
  if (!r.ok) return keyPage(r.message, r.status);
  return withHeaders(new Response(null, { status: 303, headers: { Location: '/#admin', 'Set-Cookie': r.cookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }));
}

async function deniedPage(err, env) {
  if (err.status === 401 && (await authMode(env)) === 'preview') return previewForm();
  const msg = err.status === 403 ? 'هذا البريد غير مصرّح له بالدخول إلى المنصة.' : err.status === 503 ? 'المنصة قيد الإعداد.' : 'يلزم تسجيل الدخول. افتح رابط الدخول الخاص بك المرسل من مدير النظام في المجلس.';
  return shell(`<h1>مجلس الجمعيات الأهلية بعسير</h1><p>${msg}</p>${err.status === 403 ? '<p><a href="/cdn-cgi/access/logout">الدخول ببريد آخر</a></p>' : ''}`, err.status || 401);
}

async function authRoutes(req, env, url) {
  if (url.pathname === '/auth/preview' && req.method === 'POST') {
    const r = await previewLogin(req, env);
    if (!r.ok) return previewForm(r.message, r.status);
    return withHeaders(new Response(null, { status: 303, headers: { Location: '/#admin', 'Set-Cookie': r.cookie, 'Cache-Control': 'no-store' } }));
  }
  if (url.pathname === '/auth/logout') {
    const to = (await authMode(env)) === 'access' ? '/cdn-cgi/access/logout' : '/';
    const h = new Headers({ Location: to, 'Cache-Control': 'no-store' });
    h.append('Set-Cookie', previewLogoutCookie); h.append('Set-Cookie', keys.linkLogoutCookie);
    return withHeaders(new Response(null, { status: 303, headers: h }));
  }
  return null;
}

const idFrom = (s) => { const n = Number(s); if (!Number.isInteger(n) || n < 1) fail(400, 'bad_id', 'معرّف غير صالح'); return n; };

async function api(req, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  if (path === '/api/health') {
    const r = await env.DB.prepare('SELECT count(*) AS n FROM associations WHERE deleted_at IS NULL').first();
    return json({ ok: true, associations: r.n, mode: env.SITE_MODE || 'private' });
  }

  // Public read API (only exposed without login when SITE_MODE=public)
  if (path === '/api/public/associations' && m === 'GET') {
    if (env.SITE_MODE !== 'public') await requireUser(req, env);
    return json({ data: await db.listAssociations(env, url.searchParams, 'v_public_associations') }, 200, { 'Cache-Control': 'public, max-age=300' });
  }
  if (path === '/api/public/lookups' && m === 'GET') {
    if (env.SITE_MODE !== 'public') await requireUser(req, env);
    return json(await db.lookups(env), 200, { 'Cache-Control': 'public, max-age=3600' });
  }

  // Contact form / founding help: open to visitors, rate-limited, honeypot-guarded
  if (path === '/api/public/contact' && m === 'POST') {
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) fail(403, 'bad_origin', 'مصدر الطلب غير مسموح');
    const body = await readJson(req);
    const v = await ts.verify(env, req, body && body.ts);
    if (v === 'unverified' && body) body.details = { ...(body.details && typeof body.details === 'object' ? body.details : {}), _ts: 'unverified' };
    return json(await msg.submitMessage(env, req, body), 201);
  }

  // Association update link (no account: the link itself is the credential)
  const um = path.match(/^\/api\/u\/([A-Za-z0-9_-]{20,64})$/);
  if (um && m === 'POST') {
    const link = await rq.resolveLink(env, req, um[1]);
    if (!link) fail(404, 'invalid_link', 'رابط التحديث غير صالح أو انتهت مدته');
    if (!(await rq.pinOk(env, req, link))) fail(401, 'pin_required', 'انتهت الجلسة. أعد فتح الرابط وأدخل رمز الدخول.');
    return json(await rq.submitRequest(env, req, link), 201);
  }

  // Everything below requires an allowed user
  const user = await requireUser(req, env);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    // CSRF guard: state-changing calls must come from our own origin
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) fail(403, 'bad_origin', 'مصدر الطلب غير مسموح');
  }

  if (path === '/api/community-requests' && m === 'GET') { requirePerm(user, 'communities'); return json({ data: await msg.listCommunityRequests(env) }); }
  const crm = path.match(/^\/api\/community-requests\/(\d+)$/);
  if (crm && m === 'PATCH') {
    requirePerm(user, 'communities', 'write');
    const row = await env.DB.prepare("SELECT kind FROM contact_messages WHERE id = ?1").bind(Number(crm[1])).first();
    if (!row || !['join', 'evreg'].includes(row.kind)) fail(404, 'not_found', 'الطلب غير موجود');
    return json(await msg.updateMessage(env, req, user, idFrom(crm[1]), await readJson(req)));
  }
  if (path === '/api/messages' && m === 'GET') { requirePerm(user, 'inbox'); return json({ data: await msg.listMessages(env) }); }
  // التطوع الاحترافي: طلبات الخبراء والجمعيات الواردة من الموقع، لمن يملك وحدة pro ولو لم يملك صندوق الوارد
  if (path === '/api/pro/inbox' && m === 'GET') { requirePerm(user, 'pro'); return json({ data: await msg.listMessages(env, ['expert', 'need']) }); }
  const pm = path.match(/^\/api\/pro\/inbox\/(\d+)$/);
  if (pm && m === 'PATCH') {
    requirePerm(user, 'pro', 'write');
    const one = (await msg.listMessages(env, ['expert', 'need'])).find((x) => x.id === idFrom(pm[1]));
    if (!one) fail(404, 'not_found', 'الطلب غير موجود');
    return json(await msg.updateMessage(env, req, user, one.id, await readJson(req)));
  }
  const mm = path.match(/^\/api\/messages\/(\d+)$/);
  if (mm && m === 'PATCH') { requirePerm(user, 'inbox', 'write'); return json(await msg.updateMessage(env, req, user, idFrom(mm[1]), await readJson(req))); }

  if (path === '/api/me') return json({ email: user.email, name: user.name, role: user.role, roleName: user.roleName, permissions: Object.fromEntries(user.perms) });
  if (path === '/api/lookups') return json(await db.lookups(env));

  if (path === '/api/associations') {
    if (m === 'GET') { requirePerm(user, 'directory'); return json({ data: await db.listAssociations(env, url.searchParams) }); }
    if (m === 'POST') {
      requirePerm(user, 'directory', 'write');
      const { id, data } = await db.createAssociation(env, await readJson(req));
      await db.audit(env, req, user.email, 'create', 'associations', id, null, data);
      return json({ data: await db.getAssociation(env, id) }, 201);
    }
  }
  const nm = path.match(/^\/api\/associations\/(\d+)\/notes(?:\/(\d+))?$/);
  if (nm) {
    requirePerm(user, 'directory', 'write');
    if (m === 'POST' && !nm[2]) return json(await pf.addNote(env, req, user, idFrom(nm[1]), await readJson(req)), 201);
    if (m === 'PATCH' && nm[2]) return json(await pf.setNote(env, req, user, idFrom(nm[1]), idFrom(nm[2]), await readJson(req)));
  }
  const cl = path.match(/^\/api\/associations\/(\d+)\/contact-log(?:\/(\d+))?$/);
  if (cl) {
    requirePerm(user, 'directory', 'write');
    if (m === 'POST' && !cl[2]) return json(await pf.addLog(env, req, user, idFrom(cl[1]), await readJson(req)), 201);
    if (m === 'DELETE' && cl[2]) return json(await pf.delLog(env, req, user, idFrom(cl[1]), idFrom(cl[2])));
  }
  if (path === '/api/alerts' && m === 'GET') { requirePerm(user, 'directory'); return json(await al.listAlerts(env, url.searchParams)); }
  if (path === '/api/alerts/run' && m === 'POST') { requirePerm(user, 'directory', 'write'); return json(await al.computeAlerts(env, { actor: user.email })); }
  const alm = path.match(/^\/api\/alerts\/(\d+)\/(done|undo)$/);
  if (alm && m === 'POST') { requirePerm(user, 'directory', 'write'); return json(await al.doneAlert(env, req, user, idFrom(alm[1]), alm[2] === 'undo')); }
  const fm = path.match(/^\/api\/associations\/(\d+)\/(full|logo)$/);
  if (fm) {
    const id = idFrom(fm[1]);
    if (fm[2] === 'full' && m === 'GET') { requirePerm(user, 'directory', 'write'); return json({ data: await pf.getFull(env, req, user, id) }); }
    if (fm[2] === 'full' && m === 'PUT') { requirePerm(user, 'directory', 'write'); const r = await pf.saveFull(env, req, user, id, await readJson(req)); return json({ ...r, data: await pf.getFull(env, req, user, id, { logReveal: false }) }); }
    if (fm[2] === 'logo' && m === 'POST') { requirePerm(user, 'directory', 'write'); const f = (await req.formData()).get('logo'); return json(await pf.setLogo(env, req, user, id, f && typeof f !== 'string' ? f : null)); }
    if (fm[2] === 'logo' && m === 'DELETE') { requirePerm(user, 'directory', 'write'); return json(await pf.setLogo(env, req, user, id, null)); }
  }
  const am = path.match(/^\/api\/associations\/(\d+)$/);
  if (am) {
    const id = idFrom(am[1]);
    if (m === 'GET') {
      requirePerm(user, 'directory');
      const row = await db.getAssociation(env, id);
      const history = can(user, 'directory', 'write') ? await db.auditList(env, new URLSearchParams({ entity: 'associations', entity_id: String(id), limit: '50' })) : [];
      return json({ data: row, history });
    }
    if (m === 'PATCH') {
      requirePerm(user, 'directory', 'write');
      const diff = await db.updateAssociation(env, id, await readJson(req));
      if (Object.keys(diff.after).length) await db.audit(env, req, user.email, 'update', 'associations', id, diff.before, diff.after);
      return json({ data: await db.getAssociation(env, id), changed: Object.keys(diff.after) });
    }
    if (m === 'DELETE') {
      requirePerm(user, 'directory', 'write');
      await db.softDeleteAssociation(env, id);
      await db.audit(env, req, user.email, 'delete', 'associations', id);
      return json({ ok: true });
    }
  }

  if (path === '/api/state' && m === 'GET') return json({ data: await readState(env, user) });
  const sm = path.match(/^\/api\/state\/([A-Za-z0-9]+)$/);
  if (sm && m === 'PUT') {
    const body = await readJson(req, 300 * 1024);
    const r = await writeState(env, user, sm[1], body);
    if (!r.unchanged) {
      const cap = (v) => (v && v.length > 100_000 ? v.slice(0, 100_000) : v);
      await env.DB.prepare(
        `INSERT INTO audit_log (actor_email, action, entity, entity_id, before_json, after_json, ip, user_agent) VALUES (?1,'update','app_state',?2,?3,?4,?5,?6)`
      ).bind(user.email, sm[1], cap(r.before), cap(body.value), req.headers.get('CF-Connecting-IP'), (req.headers.get('User-Agent') || '').slice(0, 200)).run();
    }
    return json({ version: r.version });
  }

  // update links & requests (module: updates)
  if (path === '/api/update-links') {
    if (m === 'GET') { requirePerm(user, 'updates'); return json({ data: await rq.listLinks(env, url.searchParams) }); }
    if (m === 'POST') { requirePerm(user, 'updates', 'write'); return json(await rq.createLinks(env, req, user, await readJson(req)), 201); }
  }
  const lm = path.match(/^\/api\/update-links\/(\d+)\/revoke$/);
  if (lm && m === 'POST') { requirePerm(user, 'updates', 'write'); await rq.revokeLink(env, req, user, idFrom(lm[1])); return json({ ok: true }); }
  if (path === '/api/update-requests' && m === 'GET') { requirePerm(user, 'updates'); return json({ data: await rq.listRequests(env, url.searchParams) }); }
  const rm = path.match(/^\/api\/update-requests\/(\d+)(\/review)?$/);
  if (rm && m === 'GET' && !rm[2]) { requirePerm(user, 'updates'); return json({ data: await rq.getRequest(env, idFrom(rm[1])) }); }
  if (rm && m === 'POST' && rm[2]) { requirePerm(user, 'updates', 'write'); return json(await rq.reviewRequest(env, req, user, idFrom(rm[1]), await readJson(req))); }
  if (path.startsWith('/api/files/') && m === 'GET') { requirePerm(user, 'updates'); return withHeaders(await rq.serveFile(env, decodeURIComponent(path.slice(11)))); }

  // ─── الإعدادات والمستخدمون والأدوار (صلاحية roles) ───
  if (path === '/api/users' && m === 'GET') { requirePerm(user, 'roles'); return json({ data: await adm.listUsers(env) }); }
  if (path === '/api/users' && m === 'POST') { requirePerm(user, 'roles', 'write'); return json(await adm.createUser(env, req, user, await readJson(req)), 201); }
  const usm = path.match(/^\/api\/users\/(\d+)$/);
  if (usm && m === 'PATCH') { requirePerm(user, 'roles', 'write'); return json(await adm.updateUser(env, req, user, idFrom(usm[1]), await readJson(req))); }
  if (path === '/api/login-links' && m === 'GET') { requirePerm(user, 'roles'); return json({ data: await keys.listLinks(env) }); }
  if (path === '/api/login-links' && m === 'POST') { requirePerm(user, 'roles', 'write'); return json(await keys.createLink(env, req, user, await readJson(req)), 201); }
  const klm = path.match(/^\/api\/login-links\/(\d+)$/);
  if (klm && m === 'DELETE') { requirePerm(user, 'roles', 'write'); return json(await keys.revokeLink(env, req, user, idFrom(klm[1]))); }
  if (path === '/api/roles' && m === 'GET') { requirePerm(user, 'roles'); return json({ data: await adm.listRoles(env), modules: adm.MODULES }); }
  if (path === '/api/roles' && m === 'POST') { requirePerm(user, 'roles', 'write'); return json(await adm.createRole(env, req, user, await readJson(req)), 201); }
  const rlm = path.match(/^\/api\/roles\/([a-z0-9_]+)$/);
  if (rlm && m === 'PATCH') { requirePerm(user, 'roles', 'write'); return json(await adm.updateRole(env, req, user, rlm[1], await readJson(req))); }
  if (path === '/api/settings' && m === 'GET') { requirePerm(user, 'roles'); return json({ data: await adm.getSettings(env) }); }
  if (path === '/api/settings' && m === 'PATCH') { requirePerm(user, 'roles', 'write'); return json(await adm.setSettings(env, req, user, await readJson(req))); }
  // ─── ملفات الحوكمة: صور المجلس والوثائق ───
  if (path === '/api/board/photo' && m === 'POST') { requirePerm(user, 'board', 'write'); return json(await dc.uploadBoardPhoto(env, req, user), 201); }
  if (path === '/api/docs' && m === 'POST') { requirePerm(user, 'board', 'write'); return json(await dc.uploadDoc(env, req, user), 201); }
  if (path === '/api/docs/vis' && m === 'PATCH') { requirePerm(user, 'board', 'write'); return json(await dc.setDocVis(env, req, user, await readJson(req))); }
  if (path === '/api/docs/delete' && m === 'POST') { requirePerm(user, 'board', 'write'); return json(await dc.deleteFile(env, req, user, String((await readJson(req)).key || ''))); }
  if (path.startsWith('/api/docs/file/') && m === 'GET') { requirePerm(user, 'board'); return withHeaders(await dc.serveInternal(env, decodeURIComponent(path.slice(15)), url.searchParams.has('dl'))); }
  // تسجيل عمليات التصدير والتنزيل التي تتم في المتصفح (من صدّر ماذا وبأي صيغة) في سجل التدقيق
  if (path === '/api/audit/export' && m === 'POST') {
    const b = await readJson(req); const fmt = String(b.fmt || '').slice(0, 10); const what = String(b.what || '').slice(0, 160);
    if (!/^(xlsx|csv|pdf|print)$/.test(fmt) || !what) fail(400, 'bad_request', 'بيانات التصدير ناقصة');
    await db.audit(env, req, user.email, 'export', 'export', null, null, { what, fmt, rows: Math.max(0, Math.min(1e6, Number(b.rows) || 0)), personal: !!b.personal });
    return json({ ok: true }, 201);
  }
  if (path === '/api/audit' && m === 'GET') {
    requirePerm(user, 'roles');
    return json({ data: await db.auditList(env, url.searchParams) });
  }

  fail(404, 'not_found', 'المسار غير موجود');
}

export default {
  // Cron يومي (wrangler.toml → [triggers]): يحسب التنبيهات ويخزّنها
  async scheduled(event, env, ctx) { ctx.waitUntil(al.computeAlerts(env).catch((e) => console.error('alerts', e))); },
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/brand')) { const r = await brandApi(req, env, url); if (r) return r; }
      if (url.pathname.startsWith('/api/')) return await api(req, env, url);
      if (url.pathname.startsWith('/auth/')) return (await authRoutes(req, env, url)) || json({ error: { code: 'not_found' } }, 404);
      const km = url.pathname.match(/^\/k\/([A-Za-z0-9_-]{20,64})\/?$/);
      if (km) return await serveKey(req, env, url, km[1]);
      const pm = url.pathname.match(/^\/u\/([A-Za-z0-9_-]{20,64})\/?$/);
      if (pm) return await servePortal(req, env, pm[1]);
      const bm = url.pathname.match(/^\/brand\/([a-z0-9-]+)$/);
      if (bm) return withHeaders(await serveBrand(env, bm[1]));
      const lg = url.pathname.match(/^\/u-logo\/(\d+)$/);
      if (lg) { const k = await rq.logoKey(env, Number(lg[1])); if (!k) return json({ error: { code: 'not_found' } }, 404); return withHeaders(await rq.serveFile(env, k)); }
      if (url.pathname.startsWith('/files/public/')) { const r = await dc.servePublic(env, decodeURIComponent(url.pathname.slice(7)), url.searchParams.has('dl')); if (r) return withHeaders(r); return json({ error: { code: 'not_found' } }, 404); }
      if (url.pathname === '/robots.txt') return seo.robots(env, url);
      if (url.pathname === '/sitemap.xml') return seo.sitemap(env, url, env.SITE_MODE === 'public' ? (await db.pagePayload(env)).pub : []);

      const match = seo.matchPage(url.pathname);
      const isPage = !!match;
      if (env.SITE_MODE === 'public') {
        if (SITE_ASSET.test(url.pathname)) return await serveSiteAsset(req, env, url);
        if (!isPage) return withHeaders(await env.ASSETS.fetch(req), assetCache(url, env));
        let user = null;
        try { user = await requireUser(req, env); } catch { /* visitor */ }
        return await servePage(req, env, user, match);
      }

      // private mode: nothing is served without an allowed user
      let user;
      try { user = await requireUser(req, env); } catch (e) { return await deniedPage(e, env); }
      if (SITE_ASSET.test(url.pathname)) return await serveSiteAsset(req, env, url);
      if (!isPage) return withHeaders(await env.ASSETS.fetch(req), assetCache(url, env));
      await noteLogin(req, env, user);
      return await servePage(req, env, user, match);
    } catch (err) {
      return errorResponse(err);
    }
  },
};
