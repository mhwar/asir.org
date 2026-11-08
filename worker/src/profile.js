// Full association record for the council: official data + public profile + contacts & leadership.
import { fail } from './http.js';
import { audit, updateAssociation, getAssociation, dataIssues, resolveFlags, FLAG_KINDS } from './db.js';
import { UFIELDS } from './requests.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const PROFILE = { short: 'short_name', about: 'about', web: 'website', social: 'social', ben: 'beneficiaries', progs: 'programs', staff: 'staff_count', vols: 'volunteers_count', volHours: 'vol_hours', phone: 'phone_official', address: 'address', postal: 'postal_code', pobox: 'po_box', donate: 'donate_url', volOpps: 'vol_opps', volYear: 'vol_year', benef: 'beneficiaries_count', assembly: 'last_assembly_on', finYear: 'fin_year', revBand: 'revenue_band',
  execSince: 'exec_since', execType: 'exec_type', volSt: 'vol_status', volRef: 'vol_ref', volLast: 'vol_last_on', ehsanSt: 'ehsan_status', ehsanRef: 'ehsan_ref' };
const CONTACT = { email: 'email', mobile: 'mobile', pres: 'president_name', presEmail: 'president_email', presMobile: 'president_mobile',
  del: 'delegate_name', delEmail: 'delegate_email', delMobile: 'delegate_mobile',
  exec: 'exec_name', execEmail: 'exec_email', execMobile: 'exec_mobile' };
// مجموعات البيانات التي يؤكد الفريق صحتها (تحقق) — تدخل في «سلامة البيانات» بمؤشر الصحة
export const VERIFY_KEYS = ['lic', 'con', 'lead', 'exec', 'board', 'vol', 'ehsan', 'gov', 'all'];
const VERIFY_SRC = ['اتصال', 'زيارة', 'مستند', 'المنصة الرسمية', 'رابط التحديث'];
const V = (k) => (k === 'presMobile' ? UFIELDS.mobile.v : UFIELDS[k].v);

function board(list) {
  if (!Array.isArray(list)) return null;
  const out = list.slice(0, 30).map((m) => ({
    name: UFIELDS.pres.v(m && m.name), role: UFIELDS.short.v(m && m.role),
    email: UFIELDS.email.v(m && m.email), mobile: UFIELDS.mobile.v(m && m.mobile),
  })).filter((m) => m.name);
  return out.length ? JSON.stringify(out) : null;
}

export async function getFull(env, req, user, id, { logReveal = true } = {}) {
  const a = await getAssociation(env, id);
  const [p, c] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM association_profiles WHERE association_id = ?1').bind(id),
    env.DB.prepare('SELECT * FROM association_contacts WHERE association_id = ?1').bind(id),
  ]);
  const pr = p.results[0] || {}, ct = c.results[0] || {};
  const profile = Object.fromEntries(Object.entries(PROFILE).map(([k, col]) => [k, col === 'beneficiaries' ? (pr[col] ? JSON.parse(pr[col]) : []) : (pr[col] ?? '')]));
  try { profile.verified = pr.verified_json ? JSON.parse(pr.verified_json) : {}; } catch { profile.verified = {}; }
  profile.dataVerified = pr.data_verified_on || '';
  profile.updated = pr.updated_at || '';
  profile.logo = pr.logo_key ? `/u-logo/${id}?v=${encodeURIComponent(pr.updated_at || '')}` : '';
  const contacts = Object.fromEntries(Object.entries(CONTACT).map(([k, col]) => [k, ct[col] || '']));
  contacts.board = ct.board_json ? JSON.parse(ct.board_json) : [];
  contacts.consent = !!a.contact_consent;
  const { results: notes } = await env.DB.prepare('SELECT id, field, kind, text, visible, status, created_by, created_at, resolved_by, resolved_at FROM association_notes WHERE association_id = ?1 ORDER BY status, id DESC').bind(id).all();
  const { results: log } = await env.DB.prepare('SELECT id, channel, outcome, summary, next_on, created_by, created_at FROM association_contact_log WHERE association_id = ?1 ORDER BY id DESC LIMIT 100').bind(id).all();
  const checks = dataIssues(a, ct);
  if (logReveal) await audit(env, req, user.email, 'reveal', 'association_contacts', id);
  const ncnp = pr.ncnp_id ? { id: pr.ncnp_id, score: pr.gov_score, year: pr.gov_score_year, cls: pr.ncnp_class, sub: pr.ncnp_subclass, synced: pr.ncnp_synced_at, fax: pr.fax, pending: pr.ncnp_pending ? JSON.parse(pr.ncnp_pending) : [] } : null;
  return { association: a, profile, contacts, notes, checks, log, ncnp };
}

export async function saveFull(env, req, user, id, body) {
  const changed = [];
  if (body.association && Object.keys(body.association).length) {
    const diff = await updateAssociation(env, id, body.association);
    if (Object.keys(diff.after).length) { await audit(env, req, user.email, 'update', 'associations', id, diff.before, diff.after); changed.push(...Object.keys(diff.after)); }
  }
  if (body.profile && Object.keys(body.profile).length) {
    const vals = {};
    for (const [k, v] of Object.entries(body.profile)) {
      if (!(k in PROFILE)) fail(422, 'unknown_field', `حقل غير مسموح: ${k}`);
      const nv = UFIELDS[k].v(v);
      vals[PROFILE[k]] = k === 'ben' ? (nv ? JSON.stringify(nv) : null) : nv;
    }
    const cur = (await env.DB.prepare('SELECT * FROM association_profiles WHERE association_id = ?1').bind(id).first()) || {};
    const cols = Object.keys(vals).filter((c) => (cur[c] ?? null) !== vals[c]);
    if (cols.length) {
      await env.DB.prepare(
        `INSERT INTO association_profiles (association_id, ${cols.join(', ')}) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(', ')})
         ON CONFLICT(association_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = ${NOW}`
      ).bind(id, ...cols.map((c) => vals[c])).run();
      await audit(env, req, user.email, 'update', 'association_profiles', id,
        Object.fromEntries(cols.map((c) => [c, cur[c] ?? null])), Object.fromEntries(cols.map((c) => [c, vals[c]])));
      changed.push(...cols);
    }
  }
  if (body.verify && Array.isArray(body.verify.keys) && body.verify.keys.length) {
    const keys = body.verify.keys.filter((k) => VERIFY_KEYS.includes(k));
    if (!keys.length) fail(422, 'invalid', 'مجموعة بيانات غير معروفة');
    const src = VERIFY_SRC.includes(body.verify.src) ? body.verify.src : 'اتصال';
    const cur = (await env.DB.prepare('SELECT verified_json, data_verified_on FROM association_profiles WHERE association_id = ?1').bind(id).first()) || {};
    let V = {}; try { V = cur.verified_json ? JSON.parse(cur.verified_json) : {}; } catch { V = {}; }
    const today = new Date().toISOString().slice(0, 10);
    const all = keys.includes('all') ? VERIFY_KEYS.filter((k) => k !== 'all') : keys;
    for (const k of all) V[k] = { on: today, by: user.email, src };
    const dv = keys.includes('all') ? today : (cur.data_verified_on || null);
    await env.DB.prepare(`INSERT INTO association_profiles (association_id, verified_json, data_verified_on) VALUES (?1, ?2, ?3)
       ON CONFLICT(association_id) DO UPDATE SET verified_json = excluded.verified_json, data_verified_on = excluded.data_verified_on`).bind(id, JSON.stringify(V), dv).run();
    await audit(env, req, user.email, 'verify', 'association_profiles', id, null, { keys: all, src });
    changed.push('verified_json');
  }
  if (body.contacts && Object.keys(body.contacts).length) {
    const vals = {};
    for (const [k, v] of Object.entries(body.contacts)) {
      if (k === 'board') { vals.board_json = board(v); continue; }
      if (k === 'consent') continue;
      if (!(k in CONTACT)) fail(422, 'unknown_field', `حقل غير مسموح: ${k}`);
      vals[CONTACT[k]] = V(k)(v);
    }
    const cur = (await env.DB.prepare('SELECT * FROM association_contacts WHERE association_id = ?1').bind(id).first()) || {};
    const cols = Object.keys(vals).filter((c) => (cur[c] ?? null) !== vals[c]);
    if (cols.length) {
      await env.DB.prepare(
        `INSERT INTO association_contacts (association_id, ${cols.join(', ')}) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(', ')})
         ON CONFLICT(association_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = ${NOW}`
      ).bind(id, ...cols.map((c) => vals[c])).run();
      // personal values are not copied into the audit log — only which fields changed
      await audit(env, req, user.email, 'update', 'association_contacts', id, null, { fields: cols });
      changed.push(...cols);
    }
    if ('consent' in body.contacts) {
      const want = body.contacts.consent ? 1 : 0;
      const r = await env.DB.prepare(`UPDATE associations SET contact_consent = ?2, contact_consent_at = ${NOW}, updated_at = ${NOW} WHERE id = ?1 AND contact_consent != ?2`).bind(id, want).run();
      if (r.meta.changes) { await audit(env, req, user.email, 'update', 'associations', id, { contact_consent: 1 - want }, { contact_consent: want }); changed.push('contact_consent'); }
    }
  }
  await resolveFlags(env, id, changed.filter((c) => !/_id$|_on$|^name_ar$|^license_no$/.test(c)));
  return { changed };
}

const LOGO_TYPES = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export async function setLogo(env, req, user, id, file) {
  await getAssociation(env, id);
  if (!file) {
    await env.DB.prepare(`UPDATE association_profiles SET logo_key = NULL, updated_at = ${NOW} WHERE association_id = ?1`).bind(id).run();
    await audit(env, req, user.email, 'delete', 'association_profiles', id, null, { logo: null });
    return { logo: '' };
  }
  if (!LOGO_TYPES[file.type]) fail(422, 'invalid', 'نوع الشعار غير مدعوم (PNG أو SVG أو JPG أو WebP)');
  if (file.size > 5 * 1048576) fail(413, 'payload_too_large', 'الشعار أكبر من 5 ميجابايت');
  const rnd = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = `assoc/${id}/${Date.now().toString(36)}-${rnd}/logo.${LOGO_TYPES[file.type]}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await env.DB.prepare(
    `INSERT INTO association_profiles (association_id, logo_key) VALUES (?1, ?2) ON CONFLICT(association_id) DO UPDATE SET logo_key = excluded.logo_key, updated_at = ${NOW}`
  ).bind(id, key).run();
  await audit(env, req, user.email, 'update', 'association_profiles', id, null, { logo_key: key });
  return { logo: `/u-logo/${id}?v=${Date.now()}` };
}

async function listNotes(env, id) {
  const { results } = await env.DB.prepare('SELECT id, field, kind, text, visible, status, created_by, created_at, resolved_by, resolved_at FROM association_notes WHERE association_id = ?1 ORDER BY status, id DESC').bind(id).all();
  return results;
}
export async function addNote(env, req, user, id, body) {
  await getAssociation(env, id);
  const text = String(body.text || '').trim();
  if (text.length < 3 || text.length > 500) fail(422, 'invalid', 'نص الملاحظة بين 3 و500 حرف');
  const field = body.field ? String(body.field).slice(0, 30) : null;
  const kind = body.kind == null || body.kind === '' ? null : String(body.kind);
  if (kind && !FLAG_KINDS.includes(kind)) fail(422, 'invalid', 'نوع العلامة غير معروف');
  if (kind && !field) fail(422, 'invalid', 'العلامة تحتاج حقلاً محدداً');
  // العلامة داخلية دائماً: لا تظهر للجمعية في رابط التحديث
  const visible = kind ? 0 : body.visible === false ? 0 : 1;
  const r = await env.DB.prepare('INSERT INTO association_notes (association_id, field, kind, text, visible, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id')
    .bind(id, field, kind, text, visible, user.email).first();
  await audit(env, req, user.email, 'create', 'association_notes', r.id, null, { association_id: id, field, kind, text });
  return { id: r.id, notes: await listNotes(env, id) };
}
export async function setNote(env, req, user, id, noteId, body) {
  const st = body.status === 'resolved' ? 'resolved' : 'open';
  const r = await env.DB.prepare(
    `UPDATE association_notes SET status = ?3, resolved_by = CASE WHEN ?3 = 'resolved' THEN ?4 END, resolved_at = CASE WHEN ?3 = 'resolved' THEN ${NOW} END WHERE id = ?2 AND association_id = ?1`
  ).bind(id, noteId, st, user.email).run();
  if (!r.meta.changes) fail(404, 'not_found', 'الملاحظة غير موجودة');
  await audit(env, req, user.email, 'update', 'association_notes', noteId, null, { status: st });
  return { ok: true, notes: await listNotes(env, id) };
}

// ─── سجل التواصل مع الجمعية (للفريق) ───
const CH = ['call', 'visit', 'email', 'whatsapp', 'meeting', 'letter', 'other'], OUT = ['responded', 'no_answer', 'promised', 'escalated'];
export async function addLog(env, req, user, id, body) {
  await getAssociation(env, id);
  const channel = CH.includes(body.channel) ? body.channel : 'other', outcome = OUT.includes(body.outcome) ? body.outcome : 'responded';
  const summary = String(body.summary || '').trim().slice(0, 600); if (!summary) fail(422, 'invalid', 'اكتب ملخص التواصل');
  const next = body.next_on && /^\d{4}-\d{2}-\d{2}$/.test(body.next_on) ? body.next_on : null;
  const r = await env.DB.prepare('INSERT INTO association_contact_log (association_id, channel, outcome, summary, next_on, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *')
    .bind(id, channel, outcome, summary, next, user.email).first();
  await audit(env, req, user.email, 'create', 'association_contact_log', r.id, null, { association_id: id, channel, outcome });
  return { data: r };
}
export async function delLog(env, req, user, id, logId) {
  const r = await env.DB.prepare('DELETE FROM association_contact_log WHERE id = ?1 AND association_id = ?2 RETURNING id').bind(logId, id).first();
  if (!r) fail(404, 'not_found', 'السجل غير موجود');
  await audit(env, req, user.email, 'delete', 'association_contact_log', logId, null, { association_id: id });
  return { ok: true };
}

// أرقام التطوع المجمّعة كما أبلغت عنها الجمعيات (بلا بيانات شخصية): إجمالي وحسب المحافظة
export async function volunteeringSummary(env) {
  const { results } = await env.DB.prepare(
    `SELECT g.name_ar AS gov, COUNT(a.id) AS assocs,
            SUM(CASE WHEN p.volunteers_count IS NOT NULL OR p.vol_hours IS NOT NULL THEN 1 ELSE 0 END) AS reported,
            COALESCE(SUM(p.volunteers_count),0) AS vols, COALESCE(SUM(p.vol_hours),0) AS hours, COALESCE(SUM(p.vol_opps),0) AS opps
       FROM associations a JOIN governorates g ON g.id = a.governorate_id
       LEFT JOIN association_profiles p ON p.association_id = a.id
      WHERE a.deleted_at IS NULL GROUP BY g.name_ar ORDER BY hours DESC, vols DESC`).all();
  const { results: yrs } = await env.DB.prepare(
    'SELECT vol_year AS y, COUNT(*) AS n FROM association_profiles WHERE vol_year IS NOT NULL GROUP BY vol_year ORDER BY vol_year DESC').all();
  const t = results.reduce((o, r) => { for (const k of ['assocs', 'reported', 'vols', 'hours', 'opps']) o[k] += r[k] || 0; return o; }, { assocs: 0, reported: 0, vols: 0, hours: 0, opps: 0 });
  return { total: t, byGov: results, years: yrs };
}
