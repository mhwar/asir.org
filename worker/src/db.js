// Data access. All SQL lives here; routes never build SQL strings from input.
import { fail } from './http.js';

export async function audit(env, req, actor, action, entity, entityId, before, after) {
  await env.DB.prepare(
    `INSERT INTO audit_log (actor_email, action, entity, entity_id, before_json, after_json, ip, user_agent)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    actor, action, entity, entityId == null ? null : String(entityId),
    before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after),
    req.headers.get('CF-Connecting-IP'), (req.headers.get('User-Agent') || '').slice(0, 200)
  ).run();
}

export async function lookups(env) {
  const [g, s, f] = await env.DB.batch([
    env.DB.prepare('SELECT id, name_ar AS name, sort FROM governorates ORDER BY sort'),
    env.DB.prepare('SELECT id, name_ar AS name, short_ar AS short, logo_key FROM supervisors ORDER BY sort'),
    env.DB.prepare('SELECT id, parent_id, level, name_ar AS name FROM fields ORDER BY level, id'),
  ]);
  return { governorates: g.results, supervisors: s.results, fields: f.results };
}

// ─── associations ───────────────────────────────────────
const FILTERS = { governorate_id: 'governorate_id = ?', supervisor_id: 'supervisor_id = ?', license_state: 'license_state = ?' };

export async function listAssociations(env, params, view = 'v_admin_associations') {
  const where = [], binds = [];
  for (const [k, clause] of Object.entries(FILTERS)) {
    const v = params.get(k);
    if (v) { where.push(clause); binds.push(k.endsWith('_id') ? Number(v) : v); }
  }
  const q = (params.get('q') || '').trim();
  if (q) { where.push('(name LIKE ? OR license_no = ?)'); binds.push(`%${q}%`, q); }
  const limit = Math.min(Math.max(Number(params.get('limit')) || 1000, 1), 1000);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const sql = `SELECT * FROM ${view}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return results;
}

export async function getAssociation(env, id) {
  const row = await env.DB.prepare('SELECT * FROM v_admin_associations WHERE id = ?1').bind(id).first();
  if (!row) fail(404, 'not_found', 'الجمعية غير موجودة');
  return row;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// field -> validator (returns normalized value or throws)
const EDITABLE = {
  name_ar: (v) => { v = String(v ?? '').trim(); if (v.length < 2 || v.length > 200) fail(422, 'invalid', 'اسم الجمعية غير صالح', { field: 'name_ar' }); return v; },
  unified_no: (v) => { v = String(v ?? '').trim(); if (v && !/^\d{1,20}$/.test(v)) fail(422, 'invalid', 'الرقم الموحد أرقام فقط', { field: 'unified_no' }); return v || null; },
  license_no: (v) => { v = String(v ?? '').trim(); if (!/^\d{1,20}$/.test(v)) fail(422, 'invalid', 'رقم الترخيص أرقام فقط', { field: 'license_no' }); return v; },
  governorate_id: (v) => intRef(v, 'governorate_id'),
  supervisor_id: (v) => intRef(v, 'supervisor_id'),
  field_id: (v) => intRef(v, 'field_id'),
  founded_on: (v) => dateOrNull(v, 'founded_on'),
  license_issued_on: (v) => dateOrNull(v, 'license_issued_on'),
  license_expires_on: (v) => dateOrNull(v, 'license_expires_on'),
  registry_status: (v) => { if (!['مفعل', 'منتهي', 'موقوف'].includes(v)) fail(422, 'invalid', 'حالة السجل غير صالحة', { field: 'registry_status' }); return v; },
  is_published: (v) => (v ? 1 : 0),
  closed_on: (v) => dateOrNull(v, 'closed_on'),
  closure_reason: (v) => { v = String(v ?? '').trim(); if (v.length > 300) fail(422, 'invalid', 'سبب الإغلاق أطول من 300 حرف', { field: 'closure_reason' }); return v || null; },
};
function intRef(v, field) { const n = Number(v); if (!Number.isInteger(n) || n < 1) fail(422, 'invalid', 'قيمة غير صالحة', { field }); return n; }
function dateOrNull(v, field) { if (v == null || v === '') return null; if (!DATE.test(v) || isNaN(Date.parse(v))) fail(422, 'invalid', 'تاريخ غير صالح (YYYY-MM-DD)', { field }); return v; }

function clean(body, { requireAll = false } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!(k in EDITABLE)) fail(422, 'unknown_field', `حقل غير مسموح: ${k}`, { field: k });
    out[k] = EDITABLE[k](v);
  }
  if (requireAll) for (const k of ['name_ar', 'license_no', 'governorate_id', 'supervisor_id', 'field_id'])
    if (!(k in out)) fail(422, 'required', 'حقل مطلوب', { field: k });
  if (!Object.keys(out).length) fail(422, 'empty', 'لا توجد تغييرات');
  return out;
}

async function checkField(env, fieldId) {
  if (fieldId == null) return;
  const f = await env.DB.prepare('SELECT level FROM fields WHERE id = ?1').bind(fieldId).first();
  if (!f || f.level !== 3) fail(422, 'invalid', 'يجب اختيار تصنيف فرعي (المستوى الثالث)', { field: 'field_id' });
}

function sqliteError(e) {
  const m = String(e && e.message || e);
  if (/UNIQUE.*license_no/.test(m)) fail(409, 'duplicate', 'رقم الترخيص مستخدم لجمعية أخرى', { field: 'license_no' });
  if (/FOREIGN KEY/.test(m)) fail(422, 'invalid_ref', 'مرجع غير موجود (محافظة أو جهة أو مجال)');
  throw e;
}

export async function updateAssociation(env, id, body) {
  const before = await env.DB.prepare('SELECT * FROM associations WHERE id = ?1 AND deleted_at IS NULL').bind(id).first();
  if (!before) fail(404, 'not_found', 'الجمعية غير موجودة');
  const patch = clean(body);
  await checkField(env, patch.field_id);
  if (patch.closed_on && !(patch.closure_reason || before.closure_reason)) fail(422, 'required', 'اذكر سبب الإغلاق', { field: 'closure_reason' });
  if ('closed_on' in patch && !patch.closed_on) patch.closure_reason = null;
  const cols = Object.keys(patch);
  try {
    await env.DB.prepare(
      `UPDATE associations SET ${cols.map((c, i) => `${c} = ?${i + 2}`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1`
    ).bind(id, ...cols.map((c) => patch[c])).run();
  } catch (e) { sqliteError(e); }
  const changed = Object.fromEntries(cols.filter((c) => before[c] !== patch[c]).map((c) => [c, before[c]]));
  return { before: changed, after: Object.fromEntries(Object.keys(changed).map((c) => [c, patch[c]])) };
}

export async function createAssociation(env, body) {
  const data = clean(body, { requireAll: true });
  await checkField(env, data.field_id);
  const cols = Object.keys(data);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO associations (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')}) RETURNING id`
    ).bind(...cols.map((c) => data[c])).first();
    return { id: r.id, data };
  } catch (e) { sqliteError(e); }
}

export async function softDeleteAssociation(env, id) {
  const r = await env.DB.prepare(
    `UPDATE associations SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1 AND deleted_at IS NULL`
  ).bind(id).run();
  if (!r.meta.changes) fail(404, 'not_found', 'الجمعية غير موجودة');
}

export async function auditList(env, params) {
  const where = [], binds = [];
  if (params.get('entity')) { where.push('entity = ?'); binds.push(params.get('entity')); }
  if (params.get('entity_id')) { where.push('entity_id = ?'); binds.push(params.get('entity_id')); }
  const limit = Math.min(Math.max(Number(params.get('limit')) || 100, 1), 500);
  const { results } = await env.DB.prepare(
    `SELECT id, at, actor_email, action, entity, entity_id, before_json, after_json FROM audit_log
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`
  ).bind(...binds).all();
  return results;
}

// data-quality checks, recomputed on every load so they disappear once the data is fixed.
// Each issue names the portal field it concerns, so the association can jump straight to it.
const TYPO = /@(gamail|gmial|gmai|gmal|gimai|gmil|gamil|hotmai|hotmil|hotmal|outlock|liv)\.|\.(con|cmo|om)$|@.*@|\+{2,}|^mailto/i;
const BAD_NAME = /^(نقل بيانات|لا يوجد|-|—|\.|0)$/;
const MOBILE_OK = (v) => /^(\+9665\d{8}|05\d{8})$/.test(String(v || '').replace(/[\s-]/g, ''));
export function dataIssues(a, c) {
  const out = [];
  const add = (f, t) => out.push({ f, t });
  if (!a.closed_on) {
    if (!c.mobile) add('mobile', 'جوال الجمعية مفقود');
    else if (!MOBILE_OK(c.mobile)) add('mobile', 'جوال الجمعية بصيغة غير صحيحة');
    if (!c.email) add('email', 'بريد الجمعية مفقود');
    else if (TYPO.test(c.email)) add('email', 'بريد الجمعية يبدو فيه خطأ كتابي');
    if (!c.president_name || BAD_NAME.test(c.president_name.trim())) add('pres', 'اسم رئيس مجلس الإدارة مفقود');
    if (c.president_email && TYPO.test(c.president_email)) add('presEmail', 'بريد الرئيس يبدو فيه خطأ كتابي');
    if (!c.delegate_name || BAD_NAME.test(c.delegate_name.trim())) add('del', 'اسم المفوض مفقود أو غير صحيح');
    if (c.delegate_email && TYPO.test(c.delegate_email)) add('delEmail', 'بريد المفوض يبدو فيه خطأ كتابي');
    if (a.registry_status === 'مفعل' && a.license_state === 'منتهي') add('exp', 'الحالة "مفعل" رغم انتهاء تاريخ الترخيص');
  }
  for (const n of (c.import_notes || '').split('؛ ').filter(Boolean)) {
    if (n.startsWith('بريد الرئيس')) { if (!c.president_email) add('presEmail', n); continue; }
    if (n.startsWith('بريد المفوض')) { if (!c.delegate_email) add('delEmail', n); continue; }
    add(null, n);
  }
  return out;
}

// ─── page payload in the exact shapes the 0.28 front-end expects ─────────
export async function pagePayload(env) {
  const [adm, meta, prof, con, nts] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM v_admin_associations ORDER BY id'),
    env.DB.prepare("SELECT max(updated_at) AS synced FROM associations"),
    env.DB.prepare('SELECT association_id AS id, short_name, about, website, social, beneficiaries, programs, logo_key FROM association_profiles'),
    env.DB.prepare('SELECT * FROM association_contacts'),
    env.DB.prepare("SELECT association_id AS id, text FROM association_notes WHERE status = 'open'"),
  ]);
  const N = {};
  for (const n of nts.results) (N[n.id] = N[n.id] || []).push('ملاحظة المجلس: ' + n.text);
  const C = Object.fromEntries(con.results.map((c) => [c.association_id, c]));
  const P = Object.fromEntries(prof.results.map((p) => [p.id, p]));
  const rows = adm.results;
  // RAW (internal) — 23 columns as in 0.28 (personal columns from association_contacts), then: 23 closed_on, 24 closure_reason, 25 logo url, 26 about
  // personal columns (3, 15-20, 22) stay empty until the contacts decision
  const raw = rows.map((a) => { const c = C[a.id] || {}; return [
    a.id, a.name, a.license_no, a.unified_no || '', a.governorate, a.field_group, a.field_category, a.field_subcategory, a.supervisor,
    a.founded_on || '', a.license_issued_on || '', a.license_expires_on || '', a.days_to_expiry ?? '',
    a.closed_on ? 'مغلقة' : a.registry_status, a.license_state || '',
    c.email || '', c.mobile || '', c.delegate_name || '', c.delegate_email || '', c.president_name || '', c.president_email || '',
    a.contact_consent ? 'نعم' : 'لا', [...dataIssues(a, c).map((x) => x.t), ...(N[a.id] || [])].join('؛ '),
    a.closed_on || '', a.closure_reason || '', P[a.id] && P[a.id].logo_key ? `/u-logo/${a.id}` : '', (P[a.id] && P[a.id].about) || '',
  ]; });
  // public list — published and not closed
  // سياسة الحقول من اللوحة (asirFieldPol): ظهور بيانات التواصل في الموقع — pub دائماً، con بموافقة الجمعية، int أبداً
  let FP = {};
  try { const r = await env.DB.prepare("SELECT value FROM app_state WHERE key = 'asirFieldPol'").first(); if (r) FP = (JSON.parse(r.value).f) || {}; } catch { FP = {}; }
  const vis = (k, d) => (FP[k] && FP[k].v) || d;
  const show = (k, d, a) => { const v = vis(k, d); return v === 'pub' || (v === 'con' && a.contact_consent); };
  const pub = rows.filter((a) => a.is_published && !a.closed_on).map((a) => {
    const p = P[a.id] || {};
    const o = { id: a.id, n: a.name, lic: a.license_no, y: a.founded_on ? Number(a.founded_on.slice(0, 4)) : null,
      sup: a.supervisor, gov: a.governorate, grp: a.field_group, s1: a.field_category, s2: a.field_subcategory };
    if (p.logo_key) o.lg = `/u-logo/${a.id}`;
    if (p.about) o.ab = p.about;
    if (p.short_name) o.sh = p.short_name;
    if (p.website) o.web = p.website;
    if (p.social) o.soc = p.social;
    if (p.programs) o.pr = p.programs;
    if (p.beneficiaries) o.bn = JSON.parse(p.beneficiaries);
    const c = C[a.id] || {};
    if (show('email', 'con', a) && c.email) o.em = c.email;
    if (show('mobile', 'con', a) && c.mobile) o.mo = c.mobile;
    return o;
  });
  return { raw, pub, synced: meta.results[0]?.synced || null };
}
