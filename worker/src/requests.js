// Association update links + update requests + council review.
import { fail } from './http.js';
import { audit, updateAssociation } from './db.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (t) => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ─── field catalogue (server is the authority on what an association may submit) ───
const txt = (max) => (v) => { v = String(v ?? '').trim(); if (v.length > max) fail(422, 'invalid', `النص أطول من ${max} حرفاً`); return v || null; };
const date = (v) => { if (!v) return null; if (!DATE.test(v) || isNaN(Date.parse(v))) fail(422, 'invalid', 'تاريخ غير صالح'); return v; };
const email = (v) => { v = String(v ?? '').trim(); if (!v) return null; if (/@test\.com$/i.test(v) || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) fail(422, 'invalid', 'بريد غير صالح'); return v.toLowerCase(); };
const mobile = (v) => { v = String(v ?? '').replace(/[\s-]/g, ''); if (!v) return null; if (!/^(05\d{8}|\+9665\d{8})$/.test(v)) fail(422, 'invalid', 'رقم الجوال بصيغة 05xxxxxxxx'); return v; };
const url = (v) => { v = String(v ?? '').trim(); if (!v) return null; if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(v) || v.length > 200) fail(422, 'invalid', 'رابط غير صالح (يبدأ بـ https://)'); return v; };
const list = (v) => { const a = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : []; return a.length ? a : null; };

export const UFIELDS = {
  short:     { l: 'الاسم المختصر', kind: 'profile', col: 'short_name', v: txt(80) },
  about:     { l: 'نبذة عن الجمعية', kind: 'profile', col: 'about', v: txt(400) },
  web:       { l: 'الموقع الإلكتروني', kind: 'profile', col: 'website', v: url },
  social:    { l: 'حساب X أو انستقرام', kind: 'profile', col: 'social', v: txt(100) },
  ben:       { l: 'الفئات المستفيدة', kind: 'profile', col: 'beneficiaries', v: list, json: true },
  progs:     { l: 'أبرز البرامج والخدمات', kind: 'profile', col: 'programs', v: txt(1500) },
  logo:      { l: 'شعار الجمعية', kind: 'profile', col: 'logo_key', file: { max: 5, types: ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'] } },
  founded:   { l: 'تاريخ التأسيس', kind: 'assoc', col: 'founded_on', v: date },
  gov:       { l: 'المحافظة', kind: 'assoc', col: 'governorate_id', v: txt(40), gov: true },
  grp:       { l: 'المجال الرئيسي', kind: 'note', v: txt(80) },
  s1:        { l: 'التصنيف الفرعي', kind: 'note', v: txt(120) },
  exp:       { l: 'تاريخ انتهاء الترخيص', kind: 'assoc', col: 'license_expires_on', v: date },
  licFile:   { l: 'صورة الترخيص الساري', kind: 'doc', file: { max: 10, types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] } },
  // personal — accepted only when settings.collect_personal = '1'
  email:     { l: 'البريد الرسمي للجمعية', kind: 'contact', col: 'email', v: email, personal: true },
  mobile:    { l: 'جوال الجمعية', kind: 'contact', col: 'mobile', v: mobile, personal: true },
  consent:   { l: 'موافقة نشر التواصل', kind: 'assoc', col: 'contact_consent', v: (x) => (x ? 1 : 0), personal: true },
  pres:      { l: 'اسم رئيس مجلس الإدارة', kind: 'contact', col: 'president_name', v: txt(120), personal: true },
  presEmail: { l: 'بريد الرئيس', kind: 'contact', col: 'president_email', v: email, personal: true },
  del:       { l: 'اسم المفوض', kind: 'contact', col: 'delegate_name', v: txt(120), personal: true },
  delEmail:  { l: 'بريد المفوض', kind: 'contact', col: 'delegate_email', v: email, personal: true },
  delMobile: { l: 'جوال المفوض', kind: 'contact', col: 'delegate_mobile', v: mobile, personal: true },
};

export async function collectPersonal(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'collect_personal'").first();
  return r && r.value === '1';
}

// current values of an association, in portal field keys
export async function currentValues(env, id, withPersonal) {
  const a = await env.DB.prepare(
    `SELECT a.id, a.name_ar AS n, a.license_no AS lic, g.name_ar AS gov, f1.name_ar AS grp, f2.name_ar AS s1,
            a.founded_on AS founded, a.license_expires_on AS exp, a.contact_consent AS consent,
            p.short_name AS short, p.about, p.website AS web, p.social, p.beneficiaries AS ben, p.programs AS progs, p.logo_key AS logo
       FROM associations a JOIN governorates g ON g.id = a.governorate_id
       JOIN fields f3 ON f3.id = a.field_id JOIN fields f2 ON f2.id = f3.parent_id JOIN fields f1 ON f1.id = f2.parent_id
       LEFT JOIN association_profiles p ON p.association_id = a.id
      WHERE a.id = ?1 AND a.deleted_at IS NULL`).bind(id).first();
  if (!a) fail(404, 'not_found', 'الجمعية غير موجودة');
  a.ben = a.ben ? JSON.parse(a.ben) : [];
  a.consent = !!a.consent;
  if (withPersonal) {
    const c = await env.DB.prepare('SELECT * FROM association_contacts WHERE association_id = ?1').bind(id).first();
    for (const [k, f] of Object.entries(UFIELDS)) if (f.kind === 'contact') a[k] = c ? c[f.col] : null;
  }
  return a;
}

// ─── links ───────────────────────────────────────────────
export async function createLinks(env, req, user, body) {
  const ids = [...new Set((body.association_ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) fail(422, 'invalid', 'اختر جمعية واحدة على الأقل');
  if (ids.length > 600) fail(422, 'invalid', 'الحد الأقصى 600 رابط في المرة');
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const origin = new URL(req.url).origin;
  const rows = [];
  const stmts = [];
  const { results: names } = await env.DB.prepare(
    `SELECT a.id, a.name_ar AS name, a.license_no AS lic, g.name_ar AS gov FROM associations a JOIN governorates g ON g.id = a.governorate_id
      WHERE a.deleted_at IS NULL AND a.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  for (const a of names) {
    const token = newToken();
    stmts.push(env.DB.prepare(
      `INSERT INTO update_links (association_id, token_hash, created_by, expires_at) VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ','now', ?4))`
    ).bind(a.id, await sha256(token), user.email, `+${days} days`));
    rows.push({ association_id: a.id, name: a.name, lic: a.lic, gov: a.gov, url: `${origin}/u/${token}` });
  }
  if (body.replace !== false) // one active link per association: revoke older ones
    stmts.unshift(env.DB.prepare(`UPDATE update_links SET revoked_at = ${NOW} WHERE revoked_at IS NULL AND association_id IN (${names.map(() => '?').join(',')})`).bind(...names.map((a) => a.id)));
  for (let i = 0; i < stmts.length; i += 90) await env.DB.batch(stmts.slice(i, i + 90));
  await audit(env, req, user.email, 'create', 'update_links', null, null, { count: rows.length, days });
  return { days, links: rows };
}

export async function listLinks(env, params) {
  const id = Number(params.get('association_id')) || null;
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.association_id, a.name_ar AS name, l.created_by, l.created_at, l.expires_at, l.revoked_at, l.last_opened_at, l.opens, l.submissions,
            CASE WHEN l.revoked_at IS NOT NULL THEN 'revoked' WHEN l.expires_at < ${NOW} THEN 'expired' ELSE 'active' END AS state
       FROM update_links l JOIN associations a ON a.id = l.association_id
      ${id ? 'WHERE l.association_id = ?1' : ''} ORDER BY l.id DESC LIMIT 1000`).bind(...(id ? [id] : [])).all();
  return results;
}

export async function revokeLink(env, req, user, id) {
  const r = await env.DB.prepare(`UPDATE update_links SET revoked_at = ${NOW} WHERE id = ?1 AND revoked_at IS NULL`).bind(id).run();
  if (!r.meta.changes) fail(404, 'not_found', 'الرابط غير موجود أو ملغى');
  await audit(env, req, user.email, 'delete', 'update_links', id);
}

export async function resolveLink(env, req, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || '')) return null;
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const bad = await env.DB.prepare(
    `SELECT count(*) AS n FROM audit_log WHERE action = 'link_invalid' AND ip = ?1 AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')`).bind(ip).first();
  if (bad.n >= 20) fail(429, 'rate_limited', 'محاولات كثيرة. حاول لاحقاً.');
  const l = await env.DB.prepare(
    `SELECT id, association_id, expires_at FROM update_links WHERE token_hash = ?1 AND revoked_at IS NULL AND expires_at > ${NOW}`
  ).bind(await sha256(token)).first();
  if (!l) {
    await env.DB.prepare("INSERT INTO audit_log (actor_email, action, entity, ip) VALUES ('anonymous','link_invalid','update_links',?1)").bind(ip).run();
    return null;
  }
  return l;
}

export async function portalPayload(env, link) {
  await env.DB.prepare(`UPDATE update_links SET opens = opens + 1, last_opened_at = ${NOW} WHERE id = ?1`).bind(link.id).run();
  const personal = await collectPersonal(env);
  const cur = await currentValues(env, link.association_id, personal);
  if (cur.logo) cur.logo = `/u-logo/${link.association_id}`;
  const { results } = await env.DB.prepare(
    "SELECT changes FROM update_requests WHERE association_id = ?1 AND status = 'pending'").bind(link.association_id).all();
  const pending = [...new Set(results.flatMap((r) => Object.keys(JSON.parse(r.changes))))];
  const { results: govs } = await env.DB.prepare('SELECT name_ar AS n FROM governorates ORDER BY sort').all();
  return { a: cur, pending, personal, expires: link.expires_at, govs: govs.map((g) => g.n) };
}

// ─── submission (multipart: data = JSON, submitter_name, submitter_role, note, files logo / licFile) ───
export async function submitRequest(env, req, link) {
  const form = await req.formData();
  let data;
  try { data = JSON.parse(form.get('data') || '{}'); } catch { fail(400, 'bad_json', 'صيغة غير صحيحة'); }
  const personal = await collectPersonal(env);
  const cur = await currentValues(env, link.association_id, personal);
  const changes = {};
  for (const [k, raw] of Object.entries(data)) {
    const f = UFIELDS[k];
    if (!f || f.file) continue;
    if (f.personal && !personal) continue;
    const nv = f.v(raw);
    const ov = k === 'consent' ? (cur.consent ? 1 : 0) : cur[k] ?? null;
    if (JSON.stringify(nv ?? null) !== JSON.stringify(f.json ? (ov && ov.length ? ov : null) : ov)) changes[k] = { old: ov, new: nv };
  }
  if (changes.gov) {
    const g = await env.DB.prepare('SELECT id FROM governorates WHERE name_ar = ?1').bind(changes.gov.new).first();
    if (!g) fail(422, 'invalid', 'محافظة غير معروفة');
  }
  const files = {};
  const prefix = `requests/${link.association_id}/${Date.now().toString(36)}-${b64url(crypto.getRandomValues(new Uint8Array(6)))}`;
  for (const [k, f] of Object.entries(UFIELDS)) {
    if (!f.file) continue;
    const file = form.get(k);
    if (!file || typeof file === 'string' || !file.size) continue;
    if (!f.file.types.includes(file.type)) fail(422, 'invalid', `نوع ملف غير مدعوم: ${f.l}`);
    if (file.size > f.file.max * 1048576) fail(413, 'payload_too_large', `${f.l}: الحد ${f.file.max} ميجابايت`);
    const ext = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }[file.type];
    const key = `${prefix}/${k}.${ext}`;
    await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    files[k] = { key, name: String(file.name || '').slice(0, 120), type: file.type, size: file.size };
    changes[k] = { old: k === 'logo' ? cur.logo || null : null, new: key };
  }
  if (!Object.keys(changes).length) fail(422, 'empty', 'لا توجد تعديلات جديدة');
  const who = txt(120)(form.get('submitter_name')), role = txt(80)(form.get('submitter_role')), note = txt(600)(form.get('note'));
  const r = await env.DB.prepare(
    `INSERT INTO update_requests (association_id, link_id, changes, files, submitter_name, submitter_role, note) VALUES (?1,?2,?3,?4,?5,?6,?7) RETURNING id`
  ).bind(link.association_id, link.id, JSON.stringify(changes), Object.keys(files).length ? JSON.stringify(files) : null, who, role, note).first();
  await env.DB.prepare('UPDATE update_links SET submissions = submissions + 1 WHERE id = ?1').bind(link.id).run();
  await audit(env, req, 'link:' + link.id, 'create', 'update_requests', r.id, null, { association_id: link.association_id, fields: Object.keys(changes) });
  return { id: r.id, fields: Object.keys(changes) };
}

// ─── council side ────────────────────────────────────────
export async function listRequests(env, params) {
  const st = params.get('status');
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.association_id, a.name_ar AS name, a.license_no AS lic, g.name_ar AS gov, r.status, r.changes, r.submitter_name, r.submitter_role,
            r.created_at, r.reviewed_by, r.reviewed_at
       FROM update_requests r JOIN associations a ON a.id = r.association_id JOIN governorates g ON g.id = a.governorate_id
      ${st ? 'WHERE r.status = ?1' : ''} ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC LIMIT 500`).bind(...(st ? [st] : [])).all();
  return results.map((r) => ({ ...r, fields: Object.keys(JSON.parse(r.changes)).map((k) => (UFIELDS[k] || { l: k }).l), changes: undefined }));
}

export async function getRequest(env, id) {
  const r = await env.DB.prepare(
    `SELECT r.*, a.name_ar AS name, a.license_no AS lic, g.name_ar AS gov FROM update_requests r
       JOIN associations a ON a.id = r.association_id JOIN governorates g ON g.id = a.governorate_id WHERE r.id = ?1`).bind(id).first();
  if (!r) fail(404, 'not_found', 'الطلب غير موجود');
  const changes = JSON.parse(r.changes);
  const items = Object.entries(changes).map(([k, c]) => {
    const f = UFIELDS[k] || { l: k };
    const isFile = !!f.file;
    return { k, l: f.l, kind: f.kind, personal: !!f.personal, file: isFile,
      old: isFile ? (c.old ? '/api/files/' + c.old : null) : c.old,
      new: isFile ? '/api/files/' + c.new : c.new };
  });
  return { ...r, changes: undefined, files: undefined, items, applied: r.applied ? JSON.parse(r.applied) : null };
}

export async function reviewRequest(env, req, user, id, body) {
  const r = await env.DB.prepare('SELECT * FROM update_requests WHERE id = ?1').bind(id).first();
  if (!r) fail(404, 'not_found', 'الطلب غير موجود');
  if (r.status !== 'pending') fail(409, 'already_reviewed', 'تمت مراجعة هذا الطلب مسبقاً');
  const changes = JSON.parse(r.changes);
  const apply = body.decision === 'reject' ? [] : [...new Set(body.apply || [])].filter((k) => k in changes);
  const note = txt(600)(body.note);

  const assocPatch = {}, profile = {}, contact = {};
  for (const k of apply) {
    const f = UFIELDS[k], v = changes[k].new;
    if (!f) continue;
    if (f.kind === 'assoc') {
      if (f.gov) {
        const g = await env.DB.prepare('SELECT id FROM governorates WHERE name_ar = ?1').bind(v).first();
        if (!g) fail(422, 'invalid', 'محافظة غير معروفة');
        assocPatch.governorate_id = g.id;
      } else if (k === 'consent') {
        await env.DB.prepare(`UPDATE associations SET contact_consent = ?2, contact_consent_at = ${NOW}, updated_at = ${NOW} WHERE id = ?1`).bind(r.association_id, v ? 1 : 0).run();
      } else assocPatch[f.col] = v;
    } else if (f.kind === 'profile') profile[f.col] = f.json ? JSON.stringify(v) : v;
    else if (f.kind === 'contact') contact[f.col] = v;
  }
  // classification is chosen by the reviewer (level-3 field id), not typed by the association
  if (body.field_id) assocPatch.field_id = Number(body.field_id);

  if (Object.keys(assocPatch).length) {
    const diff = await updateAssociation(env, r.association_id, assocPatch);
    if (Object.keys(diff.after).length) await audit(env, req, user.email, 'update', 'associations', r.association_id, diff.before, { ...diff.after, via_request: id });
  }
  if (Object.keys(profile).length) {
    const cols = Object.keys(profile);
    await env.DB.prepare(
      `INSERT INTO association_profiles (association_id, ${cols.join(', ')}) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(', ')})
       ON CONFLICT(association_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = ${NOW}`
    ).bind(r.association_id, ...cols.map((c) => profile[c])).run();
    await audit(env, req, user.email, 'update', 'association_profiles', r.association_id, null, { fields: cols, via_request: id });
  }
  if (Object.keys(contact).length) {
    if (!(await collectPersonal(env))) fail(409, 'personal_disabled', 'حفظ البيانات الشخصية غير مفعّل');
    const cols = Object.keys(contact);
    await env.DB.prepare(
      `INSERT INTO association_contacts (association_id, ${cols.join(', ')}) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(', ')})
       ON CONFLICT(association_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = ${NOW}`
    ).bind(r.association_id, ...cols.map((c) => contact[c])).run();
    await audit(env, req, user.email, 'update', 'association_contacts', r.association_id, null, { fields: cols, via_request: id });
  }
  const all = Object.keys(changes).length;
  const status = !apply.length ? 'rejected' : apply.length === all ? 'approved' : 'partial';
  await env.DB.prepare(
    `UPDATE update_requests SET status = ?2, reviewed_by = ?3, reviewed_at = ${NOW}, review_note = ?4, applied = ?5 WHERE id = ?1 AND status = 'pending'`
  ).bind(id, status, user.email, note, JSON.stringify(apply)).run();
  await audit(env, req, user.email, 'review', 'update_requests', id, null, { status, applied: apply, field_id: body.field_id || null });
  return { status, applied: apply };
}

export async function serveFile(env, key, { download = false } = {}) {
  if (!/^requests\/\d+\/[A-Za-z0-9_-]+\/[A-Za-z]+\.(png|svg|jpg|webp|pdf)$/.test(key)) fail(404, 'not_found', 'الملف غير موجود');
  const o = await env.FILES.get(key);
  if (!o) fail(404, 'not_found', 'الملف غير موجود');
  return new Response(o.body, { headers: {
    'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300',
    ...(download ? { 'Content-Disposition': 'attachment' } : {}),
  } });
}

export async function logoKey(env, associationId) {
  const r = await env.DB.prepare('SELECT logo_key FROM association_profiles WHERE association_id = ?1').bind(associationId).first();
  return r && r.logo_key;
}
