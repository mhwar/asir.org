// الإعدادات والمستخدمون والأدوار: إدارة فعلية من اللوحة (صلاحية roles). كل تغيير يُسجَّل في audit_log.
import { fail } from './http.js';
import { audit } from './db.js';

const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// الوحدات التي تقبل صلاحية (مطابقة لمفاتيح القائمة في اللوحة)
export const MODULES = ['home', 'overview', 'updates', 'quality', 'alerts', 'directory', 'licenses', 'trouble', 'analytics', 'bysup', 'bygov', 'decisions', 'reports', 'inbox', 'content', 'campaigns', 'chub', 'consults', 'capps', 'calendar', 'consultants', 'cset', 'partners', 'projects', 'communities', 'mops', 'mset', 'board', 'policy', 'audit', 'roles', 'users', 'settings', 'apps', 'launch', 'gaps', 'demo', 'plan'];

// الإعدادات القابلة للتعديل من اللوحة فقط (المفاتيح الحساسة لا تُقرأ ولا تُكتب من هنا)
export const SETTINGS = {
  site_mode:        { l: 'وضع الموقع', t: 'select', opts: ['private', 'public'], d: 'private' },
  collect_personal: { l: 'قبول البيانات الشخصية من بوابة التحديث', t: 'bool', d: '0' },
  council_email:    { l: 'بريد المجلس الرسمي', t: 'email', d: '' },
  council_phone:    { l: 'هاتف المجلس', t: 'text', d: '' },
  reveal_roles:     { l: 'الأدوار التي يحق لها إظهار البيانات الشخصية', t: 'roles', d: 'admin' },
  export_roles:     { l: 'الأدوار التي يحق لها التصدير', t: 'roles', d: 'admin,analyst' },
  session_days:     { l: 'مدة جلسة الدخول (أيام)', t: 'int', d: '7' },
  alerts_email:     { l: 'بريد يصله ملخص التنبيهات اليومي', t: 'email', d: '' },
};

// ─── المستخدمون ───
export async function listUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name_ar AS name, u.role_key AS role, r.name_ar AS roleName, u.is_active AS active, u.last_login_at AS lastLogin, u.created_at AS at
       FROM users u JOIN roles r ON r.key = u.role_key ORDER BY u.is_active DESC, u.id`
  ).all();
  return results;
}

async function adminsLeft(env, exceptId) {
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role_key = 'admin' AND is_active = 1 AND id != ?1").bind(exceptId || 0).first();
  return r.n;
}

export async function createUser(env, req, user, body) {
  const email = clip(body.email, 160)?.toLowerCase(), name = clip(body.name, 120), role = clip(body.role, 40) || 'content';
  if (!email || !EMAIL.test(email)) fail(422, 'invalid', 'صيغة البريد غير صحيحة');
  const rk = await env.DB.prepare('SELECT key FROM roles WHERE key = ?1').bind(role).first();
  if (!rk) fail(422, 'invalid', 'دور غير معروف');
  const dup = await env.DB.prepare('SELECT id FROM users WHERE email = ?1 COLLATE NOCASE').bind(email).first();
  if (dup) fail(409, 'exists', 'هذا البريد مسجّل مسبقاً');
  const r = await env.DB.prepare('INSERT INTO users (email, name_ar, role_key, is_active) VALUES (?1, ?2, ?3, 1) RETURNING id').bind(email, name, role).first();
  await audit(env, req, user.email, 'create', 'users', r.id, null, { email, name, role });
  return { id: r.id };
}

export async function updateUser(env, req, user, id, body) {
  const cur = await env.DB.prepare('SELECT id, email, name_ar, role_key, is_active FROM users WHERE id = ?1').bind(id).first();
  if (!cur) fail(404, 'not_found', 'المستخدم غير موجود');
  const sets = [], binds = [], after = {};
  if (body.name !== undefined) { sets.push('name_ar = ?'); binds.push(clip(body.name, 120)); after.name = clip(body.name, 120); }
  if (body.role !== undefined) {
    if (cur.id === user.id) fail(422, 'self', 'لا يمكنك تغيير دورك بنفسك');
    const rk = await env.DB.prepare('SELECT key FROM roles WHERE key = ?1').bind(body.role).first();
    if (!rk) fail(422, 'invalid', 'دور غير معروف');
    if (cur.role_key === 'admin' && body.role !== 'admin' && (await adminsLeft(env, cur.id)) === 0) fail(422, 'last_admin', 'لا يمكن إزالة آخر مدير نظام');
    sets.push('role_key = ?'); binds.push(body.role); after.role = body.role;
  }
  if (body.active !== undefined) {
    const a = body.active ? 1 : 0;
    if (cur.id === user.id && !a) fail(422, 'self', 'لا يمكنك تعطيل حسابك بنفسك');
    if (!a && cur.role_key === 'admin' && (await adminsLeft(env, cur.id)) === 0) fail(422, 'last_admin', 'لا يمكن تعطيل آخر مدير نظام');
    sets.push('is_active = ?'); binds.push(a); after.active = a;
  }
  if (!sets.length) fail(422, 'invalid', 'لا تغيير');
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  binds.push(id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?${binds.length}`).bind(...binds).run();
  await audit(env, req, user.email, 'update', 'users', id, { name: cur.name_ar, role: cur.role_key, active: cur.is_active }, after);
  return { ok: true };
}

// ─── الأدوار والصلاحيات ───
export async function listRoles(env) {
  const roles = (await env.DB.prepare('SELECT key, name_ar AS name, description_ar AS desc, is_active AS active FROM roles ORDER BY rowid').all()).results;
  const perms = (await env.DB.prepare('SELECT role_key, module, access FROM role_permissions').all()).results;
  const counts = (await env.DB.prepare('SELECT role_key, COUNT(*) n FROM users WHERE is_active = 1 GROUP BY role_key').all()).results;
  return roles.map((r) => ({ ...r, users: (counts.find((c) => c.role_key === r.key) || {}).n || 0, perms: Object.fromEntries(perms.filter((p) => p.role_key === r.key).map((p) => [p.module, p.access])) }));
}

export async function updateRole(env, req, user, key, body) {
  const role = await env.DB.prepare('SELECT key, name_ar, description_ar, is_active FROM roles WHERE key = ?1').bind(key).first();
  if (!role) fail(404, 'not_found', 'الدور غير موجود');
  const before = { name: role.name_ar, desc: role.description_ar, active: role.is_active };
  const after = {};
  if (body.name !== undefined || body.desc !== undefined) {
    await env.DB.prepare('UPDATE roles SET name_ar = COALESCE(?2, name_ar), description_ar = COALESCE(?3, description_ar) WHERE key = ?1').bind(key, clip(body.name, 80), clip(body.desc, 200)).run();
    after.name = clip(body.name, 80); after.desc = clip(body.desc, 200);
  }
  if (body.active !== undefined) {
    if (key === 'admin' && !body.active) fail(422, 'invalid', 'لا يمكن تعطيل دور مدير النظام');
    await env.DB.prepare('UPDATE roles SET is_active = ?2 WHERE key = ?1').bind(key, body.active ? 1 : 0).run();
    after.active = body.active ? 1 : 0;
  }
  if (body.perms && typeof body.perms === 'object') {
    if (key === 'admin') fail(422, 'invalid', 'صلاحيات مدير النظام ثابتة');
    const rows = Object.entries(body.perms).filter(([m, a]) => MODULES.includes(m) && ['read', 'write'].includes(a));
    const stmts = [env.DB.prepare('DELETE FROM role_permissions WHERE role_key = ?1').bind(key)];
    for (const [m, a] of rows) stmts.push(env.DB.prepare('INSERT INTO role_permissions (role_key, module, access) VALUES (?1, ?2, ?3)').bind(key, m, a));
    await env.DB.batch(stmts);
    after.perms = Object.fromEntries(rows);
  }
  await audit(env, req, user.email, 'update', 'roles', key, before, after);
  return { ok: true };
}

export async function createRole(env, req, user, body) {
  const key = clip(body.key, 32)?.toLowerCase().replace(/[^a-z0-9_]/g, ''), name = clip(body.name, 80);
  if (!key || key.length < 3 || !name) fail(422, 'invalid', 'المفتاح (حروف لاتينية) والاسم مطلوبان');
  const dup = await env.DB.prepare('SELECT key FROM roles WHERE key = ?1').bind(key).first();
  if (dup) fail(409, 'exists', 'المفتاح مستخدم');
  await env.DB.prepare('INSERT INTO roles (key, name_ar, description_ar, is_active) VALUES (?1, ?2, ?3, 1)').bind(key, name, clip(body.desc, 200)).run();
  await audit(env, req, user.email, 'create', 'roles', key, null, { name });
  return { key };
}

// ─── الإعدادات ───
export async function getSettings(env) {
  const keys = Object.keys(SETTINGS);
  const { results } = await env.DB.prepare(`SELECT key, value, updated_at FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).bind(...keys).all();
  const out = {};
  for (const k of keys) { const r = results.find((x) => x.key === k); out[k] = { value: r ? r.value : SETTINGS[k].d, at: r ? r.updated_at : null, ...SETTINGS[k] }; }
  // حالة الدخول (قراءة فقط)
  const pv = await env.DB.prepare("SELECT COUNT(*) n FROM settings WHERE key = 'preview_code_hash'").first();
  out._auth = { access: !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD), preview: pv.n > 0 };
  return out;
}

export async function setSettings(env, req, user, body) {
  const changes = body && body.values; if (!changes || typeof changes !== 'object') fail(422, 'invalid', 'لا قيم');
  const before = await getSettings(env), after = {};
  for (const [k, v0] of Object.entries(changes)) {
    const S = SETTINGS[k]; if (!S) fail(422, 'invalid', 'إعداد غير معروف: ' + k);
    let v = String(v0 ?? '').trim();
    if (S.t === 'select' && !S.opts.includes(v)) fail(422, 'invalid', 'قيمة غير مسموحة لـ' + S.l);
    if (S.t === 'bool') v = v === '1' || v === 'true' ? '1' : '0';
    if (S.t === 'int') { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 90) fail(422, 'invalid', S.l + ': رقم بين 1 و90'); v = String(n); }
    if (S.t === 'email' && v && !EMAIL.test(v)) fail(422, 'invalid', S.l + ': صيغة بريد غير صحيحة');
    if (S.t === 'roles') v = v.split(',').map((s) => s.trim()).filter(Boolean).join(',');
    if (k === 'reveal_roles' || k === 'export_roles') { if (!v.split(',').includes('admin')) v = ['admin', ...v.split(',').filter(Boolean)].join(','); }
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ','now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(k, v).run();
    after[k] = v;
  }
  await audit(env, req, user.email, 'update', 'settings', null, Object.fromEntries(Object.keys(after).map((k) => [k, before[k].value])), after);
  return { ok: true };
}
