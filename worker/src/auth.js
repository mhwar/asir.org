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

// ─── preview passcode (interim, until Cloudflare Access is set up) ─────────
// settings: preview_code_hash = sha256(salt + ':' + code) hex, preview_salt, session_key (hex), preview_user_email
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const eq = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const sha256 = async (t) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
async function hmac(keyHex, msg) {
  const k = await crypto.subtle.importKey('raw', fromHex(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}

let pvCache = { at: 0, v: null };
async function previewConfig(env) {
  if (Date.now() - pvCache.at < 60_000) return pvCache.v;
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('preview_code_hash','preview_salt','session_key','preview_user_email')"
  ).all();
  const m = Object.fromEntries(results.map((r) => [r.key, r.value]));
  const v = m.preview_code_hash && m.preview_salt && m.session_key && m.preview_user_email ? m : null;
  pvCache = { at: Date.now(), v };
  return v;
}

/** 'dev' | 'access' | 'preview' | 'none' */
export async function authMode(env) {
  if (env.ENVIRONMENT === 'dev' && env.DEV_AUTH_EMAIL) return 'dev';
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) return 'access';
  return (await previewConfig(env)) ? 'preview' : 'none';
}

const PV_COOKIE = 'asir_pv', PV_DAYS = 7;

export async function previewLogin(req, env) {
  const pv = await previewConfig(env);
  if (!pv || (await authMode(env)) !== 'preview') fail(404, 'not_found', 'غير متاح');
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const r = await env.DB.prepare(
    "SELECT count(*) AS n FROM audit_log WHERE action = 'login_failed' AND ip = ?1 AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')"
  ).bind(ip).first();
  if (r.n >= 8) return { ok: false, status: 429, message: 'محاولات كثيرة. حاول بعد 15 دقيقة.' };
  const form = await req.formData();
  const code = String(form.get('code') || '').trim();
  if (!code || !eq(await sha256(pv.preview_salt + ':' + code), pv.preview_code_hash)) {
    await env.DB.prepare("INSERT INTO audit_log (actor_email, action, entity, ip, user_agent) VALUES ('anonymous','login_failed','preview',?1,?2)")
      .bind(ip, (req.headers.get('User-Agent') || '').slice(0, 200)).run();
    return { ok: false, status: 401, message: 'رمز المعاينة غير صحيح.' };
  }
  const exp = Math.floor(Date.now() / 1000) + PV_DAYS * 86400;
  const sig = await hmac(pv.session_key, `pv.${exp}`);
  return { ok: true, cookie: `${PV_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PV_DAYS * 86400}` };
}
export const previewLogoutCookie = `${PV_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

async function emailFromRequest(req, env) {
  const mode = await authMode(env);
  // Local development only: wrangler dev with ENVIRONMENT=dev and DEV_AUTH_EMAIL set in .dev.vars
  if (mode === 'dev') return { email: env.DEV_AUTH_EMAIL.toLowerCase(), mode };
  if (mode === 'access') {
    const token = req.headers.get('Cf-Access-Jwt-Assertion') || cookie(req, 'CF_Authorization');
    return { email: token ? await verifyAccessJwt(token, env) : null, mode };
  }
  if (mode === 'preview') {
    const pv = await previewConfig(env);
    const c = cookie(req, PV_COOKIE);
    if (!c) return { email: null, mode };
    const [exp, sig] = c.split('.');
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return { email: null, mode };
    return { email: eq(await hmac(pv.session_key, `pv.${exp}`), sig) ? pv.preview_user_email.toLowerCase() : null, mode };
  }
  fail(503, 'auth_not_configured', 'لم يُضبط الدخول بعد');
}

/** Returns { id, email, name, role, roleName, perms: Map(module -> 'read'|'write') } or throws 401/403. */
export async function requireUser(req, env) {
  const { email, mode } = await emailFromRequest(req, env);
  if (!email) fail(401, 'unauthenticated', 'يلزم تسجيل الدخول');
  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.name_ar AS name, u.role_key AS role, r.name_ar AS roleName, u.governorate_id, u.last_login_at
       FROM users u JOIN roles r ON r.key = u.role_key
      WHERE u.email = ?1 COLLATE NOCASE AND u.is_active = 1 AND r.is_active = 1`
  ).bind(email).first();
  if (!user) fail(403, 'not_allowed', 'هذا البريد غير مصرّح له بالدخول');
  const { results } = await env.DB.prepare('SELECT module, access FROM role_permissions WHERE role_key = ?1').bind(user.role).all();
  user.perms = new Map(results.map((r) => [r.module, r.access]));
  user.authMode = mode;
  return user;
}

export function can(user, module, access = 'read') {
  const a = user.perms.get(module) || user.perms.get('*');
  return access === 'read' ? !!a : a === 'write';
}

export function requirePerm(user, module, access = 'read') {
  if (!can(user, module, access)) fail(403, 'forbidden', 'لا تملك صلاحية لهذا الإجراء');
}
