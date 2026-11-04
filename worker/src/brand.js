// شعارات الشركاء والمنصات: تُحفظ في R2 تحت brand/<slug> وتُعرض للعامة من /brand/<slug>.
// الرفع لمن يملك صلاحية «الشركاء»، أو برمز إسقاط مؤقت (settings.brand_drop_hash حتى brand_drop_until)
// يُستخدم لنقل الشعارات الرسمية من مواقع أصحابها مرة واحدة.
import { json, fail } from './http.js';
import { requireUser, can } from './auth.js';
import { audit } from './db.js';

const SLUG = /^[a-z0-9-]{2,40}$/;
const TYPES = { 'image/png': 1, 'image/svg+xml': 1, 'image/jpeg': 1, 'image/webp': 1 };
const MAX = 2 * 1024 * 1024;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Brand-Drop', 'Access-Control-Max-Age': '600' };

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function dropOk(env, token) {
  if (!token || token.length < 24) return false;
  const r = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('brand_drop_hash','brand_drop_until')").all();
  const s = Object.fromEntries(r.results.map((x) => [x.key, x.value]));
  if (!s.brand_drop_hash || !s.brand_drop_until || Date.parse(s.brand_drop_until) < Date.now()) return false;
  return (await sha256(token)) === s.brand_drop_hash;
}

export async function brandApi(req, env, url) {
  const m = url.pathname.match(/^\/api\/brand(?:\/([^/]+))?$/);
  if (!m) return null;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const drop = req.headers.get('X-Brand-Drop');
  let actor;
  if (drop) {
    if (!(await dropOk(env, drop))) return json({ error: { code: 'forbidden', message: 'رمز غير صالح' } }, 403, CORS);
    actor = 'brand-drop';
  } else {
    const user = await requireUser(req, env);
    if (!can(user, 'partners', 'write')) fail(403, 'forbidden', 'لا تملك صلاحية لهذا الإجراء');
    actor = user.email;
  }
  const slug = m[1];
  if (!slug && req.method === 'GET' && !drop) {
    const l = await env.FILES.list({ prefix: 'brand/' });
    return json({ data: l.objects.map((o) => ({ slug: o.key.slice(6), size: o.size, at: o.uploaded })) });
  }
  if (!slug || !SLUG.test(slug)) fail(422, 'invalid', 'اسم الشعار غير صالح');
  if (req.method === 'PUT') {
    const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!TYPES[type]) fail(415, 'unsupported', 'الصيغة غير مدعومة');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX) fail(413, 'payload_too_large', 'حجم الشعار أكبر من 2 ميجابايت');
    await env.FILES.put('brand/' + slug, buf, { httpMetadata: { contentType: type } });
    await audit(env, req, actor, 'update', 'brand', null, null, { slug, type, size: buf.byteLength });
    return json({ ok: true, url: `/brand/${slug}?v=${Date.now()}` }, 200, drop ? CORS : {});
  }
  if (req.method === 'DELETE' && !drop) {
    await env.FILES.delete('brand/' + slug);
    await audit(env, req, actor, 'delete', 'brand', null, { slug }, null);
    return json({ ok: true });
  }
  fail(405, 'method_not_allowed', 'غير مسموح');
}

export async function serveBrand(env, slug) {
  if (!SLUG.test(slug)) return json({ error: { code: 'not_found' } }, 404);
  const o = await env.FILES.get('brand/' + slug);
  if (!o) return json({ error: { code: 'not_found' } }, 404);
  return new Response(o.body, { headers: {
    'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600',
  } });
}
