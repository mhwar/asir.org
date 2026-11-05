// Full association record for the council: official data + public profile + contacts & leadership.
import { fail } from './http.js';
import { audit, updateAssociation, getAssociation, dataIssues } from './db.js';
import { UFIELDS } from './requests.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const PROFILE = { short: 'short_name', about: 'about', web: 'website', social: 'social', ben: 'beneficiaries', progs: 'programs', staff: 'staff_count', vols: 'volunteers_count', benef: 'beneficiaries_count', assembly: 'last_assembly_on', finYear: 'fin_year', revBand: 'revenue_band' };
const CONTACT = { email: 'email', mobile: 'mobile', pres: 'president_name', presEmail: 'president_email', presMobile: 'president_mobile',
  del: 'delegate_name', delEmail: 'delegate_email', delMobile: 'delegate_mobile' };
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
  profile.logo = pr.logo_key ? `/u-logo/${id}?v=${encodeURIComponent(pr.updated_at || '')}` : '';
  const contacts = Object.fromEntries(Object.entries(CONTACT).map(([k, col]) => [k, ct[col] || '']));
  contacts.board = ct.board_json ? JSON.parse(ct.board_json) : [];
  contacts.consent = !!a.contact_consent;
  const { results: notes } = await env.DB.prepare('SELECT id, field, text, visible, status, created_by, created_at, resolved_by, resolved_at FROM association_notes WHERE association_id = ?1 ORDER BY status, id DESC').bind(id).all();
  const { results: log } = await env.DB.prepare('SELECT id, channel, outcome, summary, next_on, created_by, created_at FROM association_contact_log WHERE association_id = ?1 ORDER BY id DESC LIMIT 100').bind(id).all();
  const checks = dataIssues(a, ct);
  if (logReveal) await audit(env, req, user.email, 'reveal', 'association_contacts', id);
  return { association: a, profile, contacts, notes, checks, log };
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
  const { results } = await env.DB.prepare('SELECT id, field, text, visible, status, created_by, created_at, resolved_by, resolved_at FROM association_notes WHERE association_id = ?1 ORDER BY status, id DESC').bind(id).all();
  return results;
}
export async function addNote(env, req, user, id, body) {
  await getAssociation(env, id);
  const text = String(body.text || '').trim();
  if (text.length < 3 || text.length > 500) fail(422, 'invalid', 'نص الملاحظة بين 3 و500 حرف');
  const field = body.field ? String(body.field).slice(0, 30) : null;
  const r = await env.DB.prepare('INSERT INTO association_notes (association_id, field, text, visible, created_by) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id')
    .bind(id, field, text, body.visible === false ? 0 : 1, user.email).first();
  await audit(env, req, user.email, 'create', 'association_notes', r.id, null, { association_id: id, field, text });
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
