// روابط الدخول الشخصية (مرحلة مؤقتة قبل Cloudflare Access): لكل صاحب صلاحية رابط خاص
// مرتبط بحسابه (بريده ودوره). الرابط يظهر مرة واحدة عند إنشائه، ويُخزَّن منه بصمته فقط
// (SHA-256). فتحه ثم الضغط على «دخول» يضع جلسة موقّعة (HMAC) تُفحص مع كل طلب، فإلغاء
// الرابط أو تعطيل الحساب يوقف الدخول فوراً. كل إنشاء وإلغاء ودخول يُسجَّل في سجل التدقيق.
import { fail } from './http.js';
import { audit } from './db.js';

export const K_COOKIE = 'asir_k';
const DAYS = [7, 30, 90, 180];

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const sha256 = async (t) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const eq = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
async function hmac(keyHex, msg) {
  const k = await crypto.subtle.importKey('raw', fromHex(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}
function token() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function cookie(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

// الجدول يُنشأ عند أول استخدام أيضاً (الترحيل 0014 يطابقه)، فلا يتعطل الإنتاج إن تأخر تطبيق الترحيل
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT,
    uses INTEGER NOT NULL DEFAULT 0)`).run();
  ready = true;
}

let skCache = null;
async function sessionKey(env) {
  if (skCache) return skCache;
  let r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'session_key'").first();
  if (!r) {
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('session_key', ?1)").bind(hex(crypto.getRandomValues(new Uint8Array(32)))).run();
    r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'session_key'").first();
  }
  skCache = r.value;
  return skCache;
}
async function sessionDays(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'session_days'").first().catch(() => null);
  const n = Number(r && r.value);
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : 7;
}

// ─── إدارة الروابط (صلاحية roles) ───
export async function listLinks(env) {
  await ensure(env);
  const { results } = await env.DB.prepare(
    `SELECT k.id, k.user_id AS userId, k.label, k.created_by AS createdBy, k.created_at AS at, k.expires_at AS expires,
            k.revoked_at AS revoked, k.last_used_at AS lastUsed, k.uses, u.name_ar AS name, u.email, u.role_key AS role
       FROM login_links k JOIN users u ON u.id = k.user_id ORDER BY k.revoked_at IS NOT NULL, k.id DESC LIMIT 500`
  ).all();
  const now = nowIso();
  return results.map((r) => ({ ...r, state: r.revoked ? 'revoked' : r.expires < now ? 'expired' : 'active' }));
}

export async function createLink(env, req, actor, body) {
  await ensure(env);
  const userId = Number(body.userId);
  const u = await env.DB.prepare('SELECT id, email, name_ar, is_active FROM users WHERE id = ?1').bind(userId || 0).first();
  if (!u) fail(404, 'not_found', 'المستخدم غير موجود');
  if (!u.is_active) fail(422, 'inactive', 'الحساب معطّل؛ فعّله أولاً');
  const days = DAYS.includes(Number(body.days)) ? Number(body.days) : 30;
  const label = clip(body.label, 80);
  const t = token();
  const expires = new Date(Date.now() + days * 86400_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const r = await env.DB.prepare('INSERT INTO login_links (user_id, token_hash, label, created_by, expires_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id')
    .bind(u.id, await sha256(t), label, actor.email, expires).first();
  await audit(env, req, actor.email, 'create', 'login_links', r.id, null, { user: u.email, label, days, expires });
  const origin = new URL(req.url).origin;
  return { id: r.id, url: `${origin}/k/${t}`, expires };
}

export async function revokeLink(env, req, actor, id) {
  await ensure(env);
  const k = await env.DB.prepare('SELECT k.id, k.revoked_at, u.email FROM login_links k JOIN users u ON u.id = k.user_id WHERE k.id = ?1').bind(id).first();
  if (!k) fail(404, 'not_found', 'الرابط غير موجود');
  if (k.revoked_at) return { ok: true };
  await env.DB.prepare('UPDATE login_links SET revoked_at = ?2 WHERE id = ?1').bind(id, nowIso()).run();
  await audit(env, req, actor.email, 'revoke', 'login_links', id, null, { user: k.email });
  return { ok: true };
}

// ─── الدخول بالرابط ───
const ACTIVE = `FROM login_links k JOIN users u ON u.id = k.user_id JOIN roles r ON r.key = u.role_key
  WHERE k.revoked_at IS NULL AND k.expires_at > ?2 AND u.is_active = 1 AND r.is_active = 1`;

export async function redeem(env, req, t) {
  await ensure(env);
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const f = await env.DB.prepare(
    "SELECT count(*) AS n FROM audit_log WHERE action = 'login_failed' AND entity = 'login_link' AND ip = ?1 AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')"
  ).bind(ip).first();
  if (f.n >= 8) return { ok: false, status: 429, message: 'محاولات كثيرة. حاول بعد 15 دقيقة.' };
  const now = nowIso();
  const k = /^[A-Za-z0-9_-]{24,64}$/.test(t)
    ? await env.DB.prepare(`SELECT k.id, k.expires_at, u.email ${ACTIVE} AND k.token_hash = ?1`).bind(await sha256(t), now).first()
    : null;
  if (!k) {
    await env.DB.prepare("INSERT INTO audit_log (actor_email, action, entity, ip, user_agent) VALUES ('anonymous','login_failed','login_link',?1,?2)")
      .bind(ip, (req.headers.get('User-Agent') || '').slice(0, 200)).run();
    return { ok: false, status: 404, message: 'رابط الدخول غير صالح، أو انتهت مدته، أو أُلغي. اطلب رابطاً جديداً من مدير النظام.' };
  }
  await env.DB.prepare('UPDATE login_links SET last_used_at = ?2, uses = uses + 1 WHERE id = ?1').bind(k.id, now).run();
  await env.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE email = ?1 COLLATE NOCASE").bind(k.email, now).run();
  await audit(env, req, k.email, 'login', 'login_links', k.id);
  const maxAge = Math.max(60, Math.min((await sessionDays(env)) * 86400, Math.floor((Date.parse(k.expires_at) - Date.now()) / 1000)));
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const sig = await hmac(await sessionKey(env), `k.${k.id}.${exp}`);
  return { ok: true, cookie: `${K_COOKIE}=${k.id}.${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}` };
}

/** البريد المرتبط بجلسة الرابط إن كانت صالحة، وإلا null. */
export async function emailFromLinkCookie(req, env) {
  const c = cookie(req, K_COOKIE);
  if (!c) return null;
  const [id, exp, sig] = c.split('.');
  if (!/^\d+$/.test(id || '') || !/^\d+$/.test(exp || '') || !sig || Number(exp) < Date.now() / 1000) return null;
  const sk = await env.DB.prepare("SELECT value FROM settings WHERE key = 'session_key'").first();
  if (!sk || !eq(await hmac(sk.value, `k.${id}.${exp}`), sig)) return null;
  try {
    const r = await env.DB.prepare(`SELECT u.email ${ACTIVE} AND k.id = ?1`).bind(Number(id), nowIso()).first();
    return r ? r.email.toLowerCase() : null;
  } catch { return null; }
}

export const linkLogoutCookie = `${K_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
