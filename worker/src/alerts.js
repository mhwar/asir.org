// التنبيهات المجدولة — تُحسب يومياً (Cron) أو عند الطلب من المدير، وتُخزَّن في جدول alerts بمفتاح يمنع التكرار.
// الأنواع: lic90 / lic30 / lic7 (ينتهي الترخيص بعد n يوم)، expired (انتهى أمس)، noresp (رابط تحديث بلا إرسال منذ 60 يوماً)،
// followup (حان موعد متابعة مسجّل في سجل التواصل)، assembly (آخر جمعية عمومية قبل أكثر من 15 شهراً).
import { fail } from './http.js';
import { audit } from './db.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const TITLES = {
  lic90: (a) => [`ينتهي ترخيص «${a.n}» بعد 90 يوماً`, 'أرسل تذكيراً مبكراً بالتجديد'],
  lic30: (a) => [`ينتهي ترخيص «${a.n}» بعد 30 يوماً`, 'تذكير ثانٍ ومتابعة هاتفية إن لزم'],
  lic7:  (a) => [`ينتهي ترخيص «${a.n}» خلال أسبوع`, 'تواصل عاجل: التجديد قبل الانتهاء'],
  expired: (a) => [`انتهى ترخيص «${a.n}»`, 'افتح حالة متابعة في «الجمعيات المتعثرة»'],
  noresp: (a) => [`«${a.n}» لم تُرسل تحديث البيانات منذ 60 يوماً`, 'أُرسل رابط التحديث ولم يُكمل — تواصل هاتفي للمساعدة'],
  followup: (a) => [`موعد متابعة «${a.n}» اليوم`, 'مسجّل في سجل التواصل'],
  assembly: (a) => [`«${a.n}»: آخر جمعية عمومية قبل أكثر من 15 شهراً`, 'تذكير بعقد الجمعية العمومية السنوية'],
};

export async function computeAlerts(env, { actor = 'cron' } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const push = (type, a, period, due) => { const [title, detail] = TITLES[type](a); rows.push({ key: `${type}:${a.id}:${period}`, type, association_id: a.id, title, detail, due_on: due || null }); };

  // 1) الترخيص: مواعيد 90/30/7 أيام، وانتهى أمس
  const { results: L } = await env.DB.prepare(
    `SELECT id, name_ar AS n, license_expires_on AS exp, CAST(julianday(license_expires_on) - julianday(?1) AS INTEGER) AS d
       FROM associations WHERE deleted_at IS NULL AND closed_on IS NULL AND license_expires_on IS NOT NULL
        AND julianday(license_expires_on) - julianday(?1) BETWEEN -1 AND 90`).bind(today).all();
  for (const a of L) {
    if (a.d === 90) push('lic90', a, a.exp, a.exp);
    else if (a.d === 30) push('lic30', a, a.exp, a.exp);
    else if (a.d === 7) push('lic7', a, a.exp, a.exp);
    else if (a.d === -1) push('expired', a, a.exp, a.exp);
  }
  // 2) عدم التجاوب: رابط تحديث عمره ≥60 يوماً بلا إرسال، ولا طلب تحديث منذ إنشائه
  const { results: N } = await env.DB.prepare(
    `SELECT a.id, a.name_ar AS n, MIN(l.created_at) AS first
       FROM update_links l JOIN associations a ON a.id = l.association_id
      WHERE a.deleted_at IS NULL AND a.closed_on IS NULL AND l.revoked_at IS NULL AND l.submissions = 0
        AND julianday(?1) - julianday(l.created_at) >= 60
        AND NOT EXISTS (SELECT 1 FROM update_requests r WHERE r.association_id = a.id AND r.created_at >= l.created_at)
      GROUP BY a.id`).bind(today).all();
  for (const a of N) push('noresp', a, String(a.first).slice(0, 7), today);
  // 3) موعد متابعة حان اليوم (أو فات ولم يُسجَّل تواصل بعده)
  const { results: F } = await env.DB.prepare(
    `SELECT c.id AS cid, a.id, a.name_ar AS n, c.next_on FROM association_contact_log c JOIN associations a ON a.id = c.association_id
      WHERE c.next_on IS NOT NULL AND c.next_on <= ?1
        AND NOT EXISTS (SELECT 1 FROM association_contact_log c2 WHERE c2.association_id = c.association_id AND c2.id > c.id)`).bind(today).all();
  for (const a of F) push('followup', a, String(a.cid), a.next_on);
  // 4) الجمعية العمومية: مسجّلة وأقدم من 15 شهراً
  const { results: G } = await env.DB.prepare(
    `SELECT a.id, a.name_ar AS n, p.last_assembly_on AS la FROM association_profiles p JOIN associations a ON a.id = p.association_id
      WHERE a.deleted_at IS NULL AND a.closed_on IS NULL AND p.last_assembly_on IS NOT NULL AND julianday(?1) - julianday(p.last_assembly_on) > 456`).bind(today).all();
  for (const a of G) push('assembly', a, String(a.la), null);

  let created = 0;
  for (const r of rows) {
    const x = await env.DB.prepare('INSERT OR IGNORE INTO alerts (key, type, association_id, title, detail, due_on) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(r.key, r.type, r.association_id, r.title, r.detail, r.due_on).run();
    created += x.meta.changes || 0;
  }
  await env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('alerts_last_run', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(new Date().toISOString()).run().catch(() => {});
  return { checked: rows.length, created, actor };
}

export async function listAlerts(env, q) {
  const all = q.get('all') === '1';
  const { results } = await env.DB.prepare(
    `SELECT a.*, s.name_ar AS association_name FROM alerts a LEFT JOIN associations s ON s.id = a.association_id
      ${all ? '' : 'WHERE a.done_at IS NULL'} ORDER BY a.done_at IS NOT NULL, a.created_at DESC LIMIT 300`).all();
  const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'alerts_last_run'").first().catch(() => null);
  return { data: results, last_run: last ? last.value : null };
}

export async function doneAlert(env, req, user, id, undo) {
  const r = await env.DB.prepare(undo ? 'UPDATE alerts SET done_at = NULL, done_by = NULL WHERE id = ?1 RETURNING *' : `UPDATE alerts SET done_at = ${NOW}, done_by = ?2 WHERE id = ?1 RETURNING *`)
    .bind(...(undo ? [id] : [id, user.email])).first();
  if (!r) fail(404, 'not_found', 'التنبيه غير موجود');
  await audit(env, req, user.email, undo ? 'reopen' : 'done', 'alerts', id);
  return { data: r };
}
