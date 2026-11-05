// Shared team state per dashboard module, stored as versioned JSON documents.
import { fail } from './http.js';
import { can } from './auth.js';

// key -> { module: permission module, public: shown on the public site }
export const STATE_KEYS = {
  asirGaps:      { module: 'gaps' },
  asirSegNotes:  { module: 'bysup' },
  asirDec:       { module: 'decisions' },
  asirDecX:      { module: 'decisions' },
  asirProjects:  { module: 'projects' },               // المشاريع (مراحل، شركاء، ميزانية، مستفيدون)
  asirComms:     { module: 'communities', public: true }, // تعريف المجتمعات وأرقامها — بلا أسماء
  asirCommMem:   { module: 'communities' },            // أعضاء المجتمعات والترشيحات — للفريق فقط
  asirEvents:    { module: 'mops', public: true },     // الفعاليات والبرامج — بلا بيانات المسجلين
  asirCamps:     { module: 'campaigns' },              // الحملات (أرقام الجمعيات فقط، بلا بيانات شخصية)
  asirAPart:     { module: 'partners' },
  asirPartners:  { module: 'partners', public: true },
  asirBoard2:    { module: 'board', public: true },
  asirTerms:     { module: 'board', public: true },    // دورات مجلس الإدارة
  asirDocs:      { module: 'board', public: true, pub: (v) => ({ ...v, list: (v.list || []).filter((d) => d.vis === 'public') }) }, // الوثائق: العامة فقط بلا دخول
  asirImpact:    { module: 'board', public: true },
  asirLaunchOff: { module: 'launch' },
  asirContent:   { module: 'content', public: true },
  asirCtypes:    { module: 'cset', public: true },     // مجالات الاستشارة (تظهر في صفحة الحجز)
  asirTrouble:   { module: 'trouble' },                // الجمعيات المتعثرة — للفريق فقط
  asirRpSnaps:   { module: 'reports' },                // لقطات المؤشرات الدورية (أرقام مجمّعة فقط)
};
const MAX_BYTES = 256 * 1024;

export async function readState(env, user) {
  const { results } = await env.DB.prepare('SELECT key, value, version, updated_by, updated_at FROM app_state').all();
  const out = {};
  for (const r of results) {
    const spec = STATE_KEYS[r.key];
    if (!spec) continue;
    if (user ? can(user, spec.module) : spec.public) {
      let value = r.value;
      if (!user && spec.pub) { try { value = JSON.stringify(spec.pub(JSON.parse(r.value))); } catch { value = r.value; } }
      out[r.key] = { value, version: r.version, by: user ? r.updated_by : undefined, at: r.updated_at };
    }
  }
  return out;
}

export async function writeState(env, user, key, body) {
  const spec = STATE_KEYS[key];
  if (!spec) fail(404, 'unknown_key', 'وحدة غير معروفة');
  if (!can(user, spec.module, 'write')) fail(403, 'forbidden', 'لا تملك صلاحية لهذا الإجراء');
  const value = body && body.value;
  if (typeof value !== 'string') fail(422, 'invalid', 'القيمة يجب أن تكون نص JSON');
  if (value.length > MAX_BYTES) fail(413, 'payload_too_large', 'حجم البيانات أكبر من المسموح');
  try { JSON.parse(value); } catch { fail(422, 'invalid', 'صيغة JSON غير صحيحة'); }
  const expected = Number(body.version) || 0;

  const cur = await env.DB.prepare('SELECT value, version FROM app_state WHERE key = ?1').bind(key).first();
  if (cur && cur.value === value) return { version: cur.version, before: null, unchanged: true };
  if ((cur ? cur.version : 0) !== expected)
    fail(409, 'conflict', 'عدّل عضو آخر هذا القسم بعد آخر تحميل', { current: { version: cur ? cur.version : 0 } });

  // conditional write: succeeds only if nobody saved in between
  const r = cur
    ? await env.DB.prepare(
        `UPDATE app_state SET value = ?2, version = version + 1, updated_by = ?3, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
          WHERE key = ?1 AND version = ?4`).bind(key, value, user.email, expected).run()
    : await env.DB.prepare(
        `INSERT INTO app_state (key, value, version, updated_by) VALUES (?1, ?2, 1, ?3) ON CONFLICT(key) DO NOTHING`
      ).bind(key, value, user.email).run();
  if (!r.meta.changes) fail(409, 'conflict', 'عدّل عضو آخر هذا القسم بعد آخر تحميل', { current: { version: expected + 1 } });
  return { version: expected + 1, before: cur ? cur.value : null };
}
