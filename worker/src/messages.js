// رسائل التواصل وطلبات تأسيس الجمعيات: إرسال عام بحد للمعدل، وصندوق وارد لفريق المجلس.
import { fail } from './http.js';
import { audit } from './db.js';

const KINDS = ['general', 'consult', 'founding', 'partner', 'suggest', 'join', 'evreg'];
// أنواع تُخزَّن في details._k دون تعديل قيد الجدول (طلبات الخصوصية من صفحة سياسة الخصوصية)
const SUBKINDS = ['privacy'];
const outKind = (m, d) => (d && SUBKINDS.includes(d._k) ? d._k : m.kind);
const STATUSES = ['new', 'progress', 'done', 'archived'];
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

async function ipHash(req) {
  const ip = req.headers.get('CF-Connecting-IP') || '0';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('msg:' + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function submitMessage(env, req, body) {
  if (body && body.website) return { ok: true }; // حقل فخ للروبوتات
  const sub = SUBKINDS.includes(body.kind) ? body.kind : null;
  const kind = KINDS.includes(body.kind) ? body.kind : 'general';
  const name = clip(body.name, 120), message = clip(body.message, 3000);
  const email = clip(body.email, 160), phone = clip(body.phone, 30);
  if (!name || name.length < 2) fail(422, 'invalid', 'اكتب الاسم');
  if (!message || message.length < 5) fail(422, 'invalid', 'اكتب نص الرسالة');
  if (!email && !phone) fail(422, 'invalid', 'اكتب البريد أو رقم الجوال للتواصل معك');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail(422, 'invalid', 'صيغة البريد غير صحيحة');
  if (phone && !/^[0-9+\s-]{9,16}$/.test(phone)) fail(422, 'invalid', 'صيغة الجوال غير صحيحة');
  let details = null;
  if (body.details && typeof body.details === 'object') details = JSON.stringify(sub ? { ...body.details, _k: sub } : body.details).slice(0, 4000);
  else if (sub) details = JSON.stringify({ _k: sub });
  const ih = await ipHash(req);
  const recent = await env.DB.prepare("SELECT COUNT(*) n FROM contact_messages WHERE ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hour')").bind(ih).first();
  if (recent.n >= 5) fail(429, 'rate_limited', 'أرسلت عدة رسائل خلال وقت قصير، حاول بعد قليل');
  const r = await env.DB.prepare(
    'INSERT INTO contact_messages (kind, name, org, email, phone, governorate, details, message, ip_hash) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) RETURNING id'
  ).bind(kind, name, clip(body.org, 160), email, phone, clip(body.governorate, 40), details, message, ih).first();
  return { ok: true, id: r.id };
}

export async function listCommunityRequests(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, kind, name, org, email, phone, governorate, details, message, status, note, created_at, updated_at FROM contact_messages WHERE kind IN ('join','evreg') ORDER BY (status = 'new') DESC, id DESC LIMIT 1000"
  ).all();
  return results.map((m) => ({ ...m, details: m.details ? JSON.parse(m.details) : null }));
}

export async function listMessages(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, kind, name, org, email, phone, governorate, details, message, status, assigned_to, note, created_at, updated_at FROM contact_messages ORDER BY (status = \'new\') DESC, id DESC LIMIT 500'
  ).all();
  return results.map((m) => { const d = m.details ? JSON.parse(m.details) : null; return { ...m, kind: outKind(m, d), details: d }; });
}

export async function updateMessage(env, req, user, id, body) {
  const sets = [], binds = [];
  if (body.status != null) { if (!STATUSES.includes(body.status)) fail(422, 'invalid', 'حالة غير معروفة'); sets.push('status = ?'); binds.push(body.status); }
  if (body.note !== undefined) { sets.push('note = ?'); binds.push(clip(body.note, 1000)); }
  if (body.assigned_to !== undefined) { sets.push('assigned_to = ?'); binds.push(clip(body.assigned_to, 160)); }
  if (!sets.length) fail(422, 'invalid', 'لا توجد تغييرات');
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  const r = await env.DB.prepare(`UPDATE contact_messages SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run();
  if (!r.meta.changes) fail(404, 'not_found', 'الرسالة غير موجودة');
  await audit(env, req, user.email, 'update', 'contact_messages', id, null, body);
  return { ok: true };
}
