// مجلس الجمعيات الأهلية بعسير — Worker: API + serving the site with live data.
//
// Phase 1 (SITE_MODE=private): every request requires an allowed user.
// Phase 2 (SITE_MODE=public): the site and /api/public/* open to everyone; the
// dashboard data and /api/* stay behind login.
import { json, errorResponse, fail, readJson, withHeaders } from './http.js';
import { requireUser, requirePerm, can } from './auth.js';
import * as db from './db.js';

const MARK = (name) => [`/*@${name}*/`, '/*@END*/'];

function inject(html, name, value) {
  const [open, close] = MARK(name);
  const a = html.indexOf(open);
  if (a < 0) return html;
  const b = html.indexOf(close, a + open.length);
  if (b < 0) return html;
  return html.slice(0, a + open.length) + value + html.slice(b);
}
const safeJson = (v) => JSON.stringify(v).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

async function servePage(req, env, user) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/', req.url), { headers: req.headers }));
  if (!asset.ok) return asset;
  let html = await asset.text();
  const { raw, pub, synced } = await db.pagePayload(env);
  html = inject(html, 'PUB', safeJson(pub));
  if (user) {
    html = inject(html, 'RAW', safeJson(raw));
    html = inject(html, 'SESSION', safeJson({
      email: user.email, name: user.name, role: user.role, roleName: user.roleName,
      source: 'd1', synced, env: env.ENVIRONMENT || 'production',
    }));
  } else {
    html = inject(html, 'RAW', '[]');
  }
  return withHeaders(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
}

async function noteLogin(req, env, user) {
  // one login entry per 12h per user keeps the audit log readable
  const last = user.last_login_at ? Date.parse(user.last_login_at) : 0;
  if (Date.now() - last < 12 * 3600_000) return;
  await env.DB.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1").bind(user.id).run();
  await db.audit(env, req, user.email, 'login', 'users', user.id);
}

function deniedPage(err) {
  const msg = err.status === 403 ? 'هذا البريد غير مصرّح له بالدخول إلى المنصة.' : 'يلزم تسجيل الدخول.';
  return withHeaders(new Response(
    `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>الدخول</title>
<body style="font-family:system-ui,Tahoma,sans-serif;display:grid;place-items:center;min-height:90vh;background:#F6F7F9;color:#1E2A3A">
<div style="background:#fff;padding:32px 36px;border-radius:14px;box-shadow:0 2px 14px #0001;max-width:420px;text-align:center">
<h2 style="margin:0 0 10px">مجلس الجمعيات الأهلية بعسير</h2><p>${msg}</p>
<p style="color:#667"><a href="/cdn-cgi/access/logout">الدخول ببريد آخر</a></p></div></body></html>`,
    { status: err.status || 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
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

  // Everything below requires an allowed user
  const user = await requireUser(req, env);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) {
    // CSRF guard: state-changing calls must come from our own origin
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) fail(403, 'bad_origin', 'مصدر الطلب غير مسموح');
  }

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

  if (path === '/api/audit' && m === 'GET') {
    requirePerm(user, 'roles');
    return json({ data: await db.auditList(env, url.searchParams) });
  }

  fail(404, 'not_found', 'المسار غير موجود');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, env, url);

      const isPage = url.pathname === '/' || url.pathname === '/index.html';
      if (env.SITE_MODE === 'public') {
        if (!isPage) return withHeaders(await env.ASSETS.fetch(req));
        let user = null;
        try { user = await requireUser(req, env); } catch { /* visitor */ }
        return await servePage(req, env, user);
      }

      // private mode: nothing is served without an allowed user
      let user;
      try { user = await requireUser(req, env); } catch (e) { return deniedPage(e); }
      if (!isPage) return withHeaders(await env.ASSETS.fetch(req));
      await noteLogin(req, env, user);
      return await servePage(req, env, user);
    } catch (err) {
      return errorResponse(err);
    }
  },
};
