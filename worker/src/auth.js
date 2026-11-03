// Authentication: Cloudflare Access (email one-time PIN) verified here, then the
// email is matched against the `users` table. Access is the front door; this
// check is the second lock, so a misconfigured Access policy still lets no one in.
import { fail } from './http.js';

let certCache = { at: 0, team: '', keys: [] };

const b64urlToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

function cookie(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

async function accessKeys(team) {
  if (certCache.team === team && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) fail(503, 'access_certs', 'تعذّر التحقق من خدمة الدخول');
  const { keys } = await r.json();
  certCache = { at: Date.now(), team, keys };
  return keys;
}

export async function verifyAccessJwt(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = b64urlJson(h), payload = b64urlJson(p);
  if (header.alg !== 'RS256') return null;
  const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (payload.exp && payload.exp < now) return null;
  if (payload.iss && payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  return payload.email ? String(payload.email).toLowerCase() : null;
}

async function emailFromRequest(req, env) {
  // Local development only: wrangler dev with ENVIRONMENT=dev and DEV_AUTH_EMAIL set in .dev.vars
  if (env.ENVIRONMENT === 'dev' && env.DEV_AUTH_EMAIL) return env.DEV_AUTH_EMAIL.toLowerCase();
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) fail(503, 'auth_not_configured', 'لم يُضبط الدخول بعد (ACCESS_TEAM_DOMAIN / ACCESS_AUD)');
  const token = req.headers.get('Cf-Access-Jwt-Assertion') || cookie(req, 'CF_Authorization');
  return token ? verifyAccessJwt(token, env) : null;
}

/** Returns { id, email, name, role, roleName, perms: Map(module -> 'read'|'write') } or throws 401/403. */
export async function requireUser(req, env) {
  const email = await emailFromRequest(req, env);
  if (!email) fail(401, 'unauthenticated', 'يلزم تسجيل الدخول');
  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.name_ar AS name, u.role_key AS role, r.name_ar AS roleName, u.governorate_id, u.last_login_at
       FROM users u JOIN roles r ON r.key = u.role_key
      WHERE u.email = ?1 COLLATE NOCASE AND u.is_active = 1 AND r.is_active = 1`
  ).bind(email).first();
  if (!user) fail(403, 'not_allowed', 'هذا البريد غير مصرّح له بالدخول');
  const { results } = await env.DB.prepare('SELECT module, access FROM role_permissions WHERE role_key = ?1').bind(user.role).all();
  user.perms = new Map(results.map((r) => [r.module, r.access]));
  return user;
}

export function can(user, module, access = 'read') {
  const a = user.perms.get(module) || user.perms.get('*');
  return access === 'read' ? !!a : a === 'write';
}

export function requirePerm(user, module, access = 'read') {
  if (!can(user, module, access)) fail(403, 'forbidden', 'لا تملك صلاحية لهذا الإجراء');
}
