// التشخيص المؤسسي: تقييم ذاتي برابط للجمعية، وتقييم ميداني برابط للخبير الزائر أو من حساب الفريق، وتعبئة مكتبية من بيانات اللوحة.
// المسار: مسودة/أُرسل ← عُبّئ (submitted) ← اعتُمد (approved) أو أُلغي. الدرجة تُحسب في الخادم عند الإرسال والاعتماد.
import { fail } from './http.js';
import { audit } from './db.js';
import { sha256, newToken, b64url, sign, eqs, NOW } from './requests.js';
import { TOOL, score } from './diagtool.js';

const KINDS = ['self', 'field', 'desk'];
const KIND_L = { self: 'تقييم ذاتي', field: 'تقييم ميداني', desk: 'تعبئة مكتبية' };
const VALS = [0, 1, 2, 3, 'na'];
const ITEMS = Object.fromEntries(TOOL.axes.flatMap((a) => a.items.map((it) => [it.id, it])));
const AXIDS = TOOL.axes.map((a) => a.id);
const s = (v, max) => { v = String(v ?? '').trim(); return v ? v.slice(0, max) : ''; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_TYPES = {
  'audio/webm': ['audio', 'webm'], 'audio/ogg': ['audio', 'ogg'], 'audio/mp4': ['audio', 'm4a'], 'audio/x-m4a': ['audio', 'm4a'], 'audio/aac': ['audio', 'aac'],
  'audio/mpeg': ['audio', 'mp3'], 'audio/wav': ['audio', 'wav'], 'audio/x-wav': ['audio', 'wav'],
  'image/png': ['image', 'png'], 'image/jpeg': ['image', 'jpg'], 'image/webp': ['image', 'webp'], 'application/pdf': ['doc', 'pdf'],
};
const MAX_FILES = 30;

export const tool = () => TOOL;

function cleanAnswers(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, x] of Object.entries(raw)) {
    if (!ITEMS[k] || !x || typeof x !== 'object') continue;
    // «لا ينطبق» متاح فقط للعبارات التي قد لا تنطبق على كل جمعية (na)، كي لا تُرفع الدرجة بإسقاط العبارات
    const v = x.v === 'na' && !ITEMS[k].na ? null : x.v;
    const a = {};
    if (VALS.includes(v)) a.v = v;
    const note = s(x.note, 600); if (note) a.note = note;
    if (x.src === 'desk' && a.v != null) a.src = 'desk';
    if (Object.keys(a).length) out[k] = a;
  }
  return out;
}
function cleanInfo(raw, kind) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const i = {};
  if (TOOL.roles.includes(raw.role)) i.role = raw.role;
  if (kind !== 'self') {
    if (DATE.test(raw.visit_on || '')) i.visit_on = raw.visit_on;
    const att = s(raw.attendees, 300); if (att) i.attendees = att;
    const who = s(raw.assessor, 120); if (who) i.assessor = who;
  }
  i.consent = !!raw.consent;
  const open = {};
  for (const q of TOOL.open) { const t = s(raw.open && raw.open[q.id], 1500); if (t) open[q.id] = t; }
  if (Object.keys(open).length) i.open = open;
  const an = {};
  for (const id of AXIDS) { const t = s(raw.axisNotes && raw.axisNotes[id], 1000); if (t) an[id] = t; }
  if (Object.keys(an).length) i.axisNotes = an;
  return i;
}
const parse = (r) => r && ({
  ...r, answers: JSON.parse(r.answers || '{}'), info: JSON.parse(r.info || '{}'), scores: r.scores ? JSON.parse(r.scores) : null,
  token_hash: undefined, pin_hash: undefined, has_pin: !!r.pin_hash, has_link: !!r.token_hash,
  link_state: !r.token_hash ? null : r.status === 'cancelled' ? 'revoked' : r.expires_at && r.expires_at < new Date().toISOString() ? 'expired' : 'active',
});

async function row(env, id) {
  const r = await env.DB.prepare(
    `SELECT s.*, a.name_ar AS association, g.name_ar AS gov FROM assessments s JOIN associations a ON a.id = s.association_id
       JOIN governorates g ON g.id = a.governorate_id WHERE s.id = ?1`).bind(id).first();
  if (!r) fail(404, 'not_found', 'التقييم غير موجود');
  return r;
}
async function files(env, id) {
  const { results } = await env.DB.prepare('SELECT id, axis, name, type, size, kind, created_by, created_at FROM assessment_files WHERE assessment_id = ?1 ORDER BY id').bind(id).all();
  return results;
}

// ─── الفريق ──────────────────────────────────────────────
export async function listFor(env, aid) {
  const { results } = await env.DB.prepare(
    `SELECT s.*, (SELECT count(*) FROM assessment_files f WHERE f.assessment_id = s.id) AS nfiles FROM assessments s
      WHERE s.association_id = ?1 ORDER BY s.id DESC`).bind(aid).all();
  return results.map(parse);
}

export async function create(env, req, user, aid, body, origin) {
  const kind = KINDS.includes(body.kind) ? body.kind : fail(422, 'invalid', 'نوع التقييم غير معروف');
  const a = await env.DB.prepare('SELECT id, name_ar FROM associations WHERE id = ?1 AND deleted_at IS NULL').bind(aid).first();
  if (!a) fail(404, 'not_found', 'الجمعية غير موجودة');
  const link = kind === 'self' || (kind === 'field' && !!body.link);
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const info = cleanInfo(body.info, kind);
  if (kind === 'field' && !link && !info.assessor) info.assessor = user.name || user.email;
  let token = null, pin = null;
  if (link) {
    // رابط تقييم ذاتي واحد فعّال للجمعية: الأقدم غير المُرسَل يُلغى
    if (kind === 'self') await env.DB.prepare(`UPDATE assessments SET status = 'cancelled', updated_at = ${NOW} WHERE association_id = ?1 AND kind = 'self' AND status IN ('draft','sent')`).bind(aid).run();
    token = newToken();
    pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
  }
  const r = await env.DB.prepare(
    `INSERT INTO assessments (association_id, kind, tool, status, info, token_hash, pin_hash, expires_at, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ${link ? `strftime('%Y-%m-%dT%H:%M:%SZ','now', ?8)` : 'NULL'}, ?9) RETURNING id`
  ).bind(aid, kind, TOOL.v, link ? 'sent' : 'draft', JSON.stringify(info), token ? await sha256(token) : null, token ? await sha256(token + ':' + pin) : null, `+${days} days`, user.email).first();
  await audit(env, req, user.email, 'create', 'assessments', r.id, null, { association_id: aid, kind, link });
  return { id: r.id, association: a.name_ar, kind, days, url: token ? `${origin}/d/${token}` : `${origin}/d/t/${r.id}`, pin };
}

export async function relink(env, req, user, id, body, origin) {
  const r = await row(env, id);
  if (!r.token_hash) fail(409, 'no_link', 'هذا التقييم يُعبّأ من حساب الفريق');
  if (['approved', 'cancelled', 'submitted'].includes(r.status)) fail(409, 'closed', 'لا يمكن تجديد رابط تقييم مُرسل أو معتمد أو ملغى');
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const token = newToken(), pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
  await env.DB.prepare(`UPDATE assessments SET token_hash = ?2, pin_hash = ?3, expires_at = strftime('%Y-%m-%dT%H:%M:%SZ','now', ?4), updated_at = ${NOW} WHERE id = ?1`)
    .bind(id, await sha256(token), await sha256(token + ':' + pin), `+${days} days`).run();
  await audit(env, req, user.email, 'update', 'assessments', id, null, { relink: days });
  return { id, association: r.association, kind: r.kind, days, url: `${origin}/d/${token}`, pin };
}

export async function get(env, id) {
  const r = parse(await row(env, id));
  return { ...r, files: await files(env, id), kindLabel: KIND_L[r.kind] };
}

export async function save(env, req, actor, r, body) {
  if (!['draft', 'sent'].includes(r.status)) fail(409, 'closed', 'التقييم أُرسل ولا يمكن تعديله');
  const answers = cleanAnswers(body.answers);
  const info = cleanInfo(body.info, r.kind);
  const old = JSON.parse(r.info || '{}');
  if (old.assessor && !info.assessor) info.assessor = old.assessor;
  await env.DB.prepare(`UPDATE assessments SET answers = ?2, info = ?3, scores = ?4, updated_at = ${NOW} WHERE id = ?1`)
    .bind(r.id, JSON.stringify(answers), JSON.stringify(info), JSON.stringify(score(TOOL, answers))).run();
  return { ok: true, scores: score(TOOL, answers) };
}

export async function submit(env, req, actor, r) {
  if (!['draft', 'sent'].includes(r.status)) fail(409, 'closed', 'التقييم أُرسل مسبقاً');
  const answers = JSON.parse(r.answers || '{}'), info = JSON.parse(r.info || '{}');
  const sc = score(TOOL, answers);
  // الذاتي يُكمل كل العبارات (مع «لا ينطبق»)؛ الميداني والمكتبي يُقبل جزئياً ويظهر بنسبة تغطيته
  if (r.kind === 'self' && sc.cov < 100) fail(422, 'incomplete', `بقيت عبارات بلا إجابة (اكتمل ${sc.cov}%)`);
  if (r.kind !== 'self' && sc.cov < 30) fail(422, 'incomplete', 'أجب عن 30% من العبارات على الأقل قبل الإرسال');
  if (r.kind === 'self' && !info.role) fail(422, 'invalid', 'اختر صفة من يعبّئ التقييم');
  if (r.kind === 'self' && !(info.open && info.open.top)) fail(422, 'invalid', 'اكتب أكبر التحديات في الصفحة الأخيرة');
  await env.DB.prepare(`UPDATE assessments SET status = 'submitted', scores = ?2, submitted_at = ${NOW}, updated_at = ${NOW} WHERE id = ?1 AND status IN ('draft','sent')`)
    .bind(r.id, JSON.stringify(sc)).run();
  await audit(env, req, actor, 'update', 'assessments', r.id, null, { submit: true, total: sc.total, cov: sc.cov });
  return { ok: true, scores: sc };
}

export async function review(env, req, user, id, body) {
  const r = await row(env, id);
  const note = s(body.note, 1000) || null;
  if (body.decision === 'approve') {
    if (r.status !== 'submitted') fail(409, 'invalid_state', 'يُعتمد التقييم بعد إرساله');
    const sc = score(TOOL, JSON.parse(r.answers || '{}'));
    await env.DB.prepare(`UPDATE assessments SET status = 'approved', scores = ?2, approved_by = ?3, approved_at = ${NOW}, review_note = ?4, updated_at = ${NOW} WHERE id = ?1`)
      .bind(id, JSON.stringify(sc), user.email, note).run();
  } else if (body.decision === 'reopen') {
    if (r.status !== 'submitted') fail(409, 'invalid_state', 'يُعاد للتعديل ما أُرسل فقط');
    await env.DB.prepare(`UPDATE assessments SET status = ?2, submitted_at = NULL, review_note = ?3, updated_at = ${NOW} WHERE id = ?1`)
      .bind(id, r.token_hash ? 'sent' : 'draft', note).run();
  } else if (body.decision === 'cancel') {
    if (r.status === 'approved') fail(409, 'invalid_state', 'لا يُلغى تقييم معتمد');
    await env.DB.prepare(`UPDATE assessments SET status = 'cancelled', review_note = ?2, updated_at = ${NOW} WHERE id = ?1`).bind(id, note).run();
  } else fail(422, 'invalid', 'قرار غير معروف');
  await audit(env, req, user.email, 'update', 'assessments', id, { status: r.status }, { decision: body.decision });
  return get(env, id);
}

// التعبئة المكتبية: اقتراحات من بيانات اللوحة تُعلَّم «من البيانات» ويمكن للمقيّم تعديلها
export async function prefill(env, aid) {
  const a = await env.DB.prepare(
    `SELECT a.license_expires_on AS exp, p.last_assembly_on AS assembly, p.fin_year AS finYear, p.volunteers_count AS vols, p.vol_hours AS volHours, p.website AS web, p.social
       FROM associations a LEFT JOIN association_profiles p ON p.association_id = a.id WHERE a.id = ?1`).bind(aid).first();
  if (!a) fail(404, 'not_found', 'الجمعية غير موجودة');
  const out = {}, now = new Date(), Y = now.getUTCFullYear();
  if (a.exp) {
    const d = (Date.parse(a.exp) - now) / 864e5;
    out.g5 = { v: d < 0 ? 0 : d < 90 ? 2 : 3, note: `من بيانات اللوحة: ${d < 0 ? 'انتهى الترخيص في' : 'ينتهي الترخيص في'} ${a.exp}`, src: 'desk' };
  }
  if (a.assembly) {
    const m = (now - Date.parse(a.assembly)) / (864e5 * 30.4);
    out.g1 = { v: m <= 15 ? 3 : m <= 27 ? 1 : 0, note: `من بيانات اللوحة: آخر جمعية عمومية ${a.assembly}`, src: 'desk' };
  }
  if (a.finYear) out.f1 = { v: a.finYear >= Y - 1 ? 3 : a.finYear === Y - 2 ? 1 : 0, note: `من بيانات اللوحة: آخر قوائم مالية معتمدة لسنة ${a.finYear}`, src: 'desk' };
  if (a.vols > 0 || a.volHours > 0) out.h5 = { v: 2, note: `من بيانات اللوحة: ${a.vols ? a.vols + ' متطوعاً' : ''}${a.vols && a.volHours ? '، ' : ''}${a.volHours ? a.volHours + ' ساعة' : ''}`, src: 'desk' };
  if (a.web || a.social) out.c2 = { v: 2, note: 'من بيانات اللوحة: للجمعية موقع أو حساب مسجّل (يُتحقق من انتظام التحديث)', src: 'desk' };
  return out;
}

// ─── الملفات (تسجيلات صوتية وصور ومستندات) ─────────────────
export async function addFile(env, req, actor, r, form) {
  if (!['draft', 'sent'].includes(r.status)) fail(409, 'closed', 'التقييم أُرسل ولا تُضاف إليه ملفات');
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) fail(422, 'invalid', 'لا يوجد ملف');
  const type = String(file.type || '').split(';')[0].trim().toLowerCase();
  const t = FILE_TYPES[type];
  if (!t) fail(422, 'invalid', 'نوع الملف غير مدعوم (صوت، صورة، PDF)');
  const max = t[0] === 'audio' ? 25 : 10;
  if (file.size > max * 1048576) fail(413, 'payload_too_large', `الحد ${max} ميجابايت`);
  const n = await env.DB.prepare('SELECT count(*) AS n FROM assessment_files WHERE assessment_id = ?1').bind(r.id).first();
  if (n.n >= MAX_FILES) fail(422, 'too_many', `الحد ${MAX_FILES} ملفاً للتقييم`);
  const axis = AXIDS.includes(form.get('axis')) ? form.get('axis') : null;
  const key = `diag/${r.association_id}/${r.id}/${Date.now().toString(36)}-${b64url(crypto.getRandomValues(new Uint8Array(6)))}.${t[1]}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: type } });
  const name = s(file.name, 120) || (t[0] === 'audio' ? 'تسجيل صوتي' : 'ملف');
  const f = await env.DB.prepare('INSERT INTO assessment_files (assessment_id, axis, key, name, type, size, kind, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id, axis, name, type, size, kind, created_at')
    .bind(r.id, axis, key, name, type, file.size, t[0], actor).first();
  await audit(env, req, actor, 'create', 'assessment_files', f.id, null, { assessment_id: r.id, kind: t[0], size: file.size });
  return f;
}
export async function delFile(env, req, actor, r, fid) {
  if (!['draft', 'sent'].includes(r.status)) fail(409, 'closed', 'التقييم أُرسل ولا تُحذف ملفاته');
  const f = await env.DB.prepare('SELECT key FROM assessment_files WHERE id = ?1 AND assessment_id = ?2').bind(fid, r.id).first();
  if (!f) fail(404, 'not_found', 'الملف غير موجود');
  await env.FILES.delete(f.key);
  await env.DB.prepare('DELETE FROM assessment_files WHERE id = ?1').bind(fid).run();
  await audit(env, req, actor, 'delete', 'assessment_files', fid, null, { assessment_id: r.id });
  return { ok: true };
}
export async function serveFile(env, r, fid) {
  const f = await env.DB.prepare('SELECT key, type, name FROM assessment_files WHERE id = ?1 AND assessment_id = ?2').bind(fid, r.id).first();
  if (!f) fail(404, 'not_found', 'الملف غير موجود');
  const o = await env.FILES.get(f.key);
  if (!o) fail(404, 'not_found', 'الملف غير موجود');
  return new Response(o.body, { headers: { 'Content-Type': f.type, 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff' } });
}

// ─── ملخص القطاع: آخر حالة لكل جمعية، وخريطة الفجوات من آخر تقييم معتمد ─────
export async function summary(env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.association_id AS aid, s.kind, s.status, s.scores, s.created_at, s.submitted_at, s.approved_at, s.expires_at, s.opens, (s.token_hash IS NOT NULL) AS has_link,
            a.name_ar AS n, g.name_ar AS gov
       FROM assessments s JOIN associations a ON a.id = s.association_id JOIN governorates g ON g.id = a.governorate_id
      WHERE s.status != 'cancelled' AND a.deleted_at IS NULL ORDER BY s.id`).all();
  const by = {};
  for (const r of results) {
    const o = by[r.aid] || (by[r.aid] = { aid: r.aid, n: r.n, gov: r.gov, last: null, appr: null, pend: 0, sent: 0 });
    const x = { id: r.id, kind: r.kind, status: r.status, at: r.approved_at || r.submitted_at || r.created_at, exp: r.expires_at, opens: r.opens, sc: r.scores ? JSON.parse(r.scores) : null };
    o.last = x;
    if (r.status === 'approved' && (!o.appr || x.at >= o.appr.at || (x.kind === 'field' && o.appr.kind !== 'field' && x.at.slice(0, 7) === o.appr.at.slice(0, 7)))) o.appr = x;
    if (r.status === 'submitted') o.pend++;
    if (r.status === 'sent' && r.expires_at > new Date().toISOString()) o.sent++;
  }
  const L = Object.values(by);
  const appr = L.filter((o) => o.appr && o.appr.sc);
  const heat = {}, gapsN = {};
  for (const o of appr) {
    const h = heat[o.gov] || (heat[o.gov] = { n: 0, ax: {} });
    h.n++;
    for (const a of o.appr.sc.axes) if (a.s != null) { const c = h.ax[a.id] || (h.ax[a.id] = [0, 0]); c[0] += a.s; c[1]++; }
    for (const g of o.appr.sc.gaps) gapsN[g.id] = (gapsN[g.id] || 0) + 1;
  }
  const axAvg = Object.fromEntries(AXIDS.map((id) => { let t = 0, n = 0; for (const o of appr) { const a = o.appr.sc.axes.find((x) => x.id === id); if (a && a.s != null) { t += a.s; n++; } } return [id, n ? Math.round(t / n) : null]; }));
  return {
    list: L,
    heat: Object.fromEntries(Object.entries(heat).map(([g, h]) => [g, { n: h.n, ax: Object.fromEntries(Object.entries(h.ax).map(([k, [t, n]]) => [k, Math.round(t / n)])) }])),
    axAvg,
    gaps: Object.entries(gapsN).map(([id, n]) => ({ id, n, pct: Math.round((n * 100) / appr.length) })).sort((p, q) => q.n - p.n).slice(0, 12),
    counts: { assessed: appr.length, pending: L.reduce((t, o) => t + o.pend, 0), sent: L.reduce((t, o) => t + o.sent, 0), avg: appr.length ? Math.round(appr.reduce((t, o) => t + (o.appr.sc.total || 0), 0) / appr.length) : null },
  };
}

// ─── الرابط (بلا حساب: الرابط مع رمز الدخول هو الاعتماد) ───────────
const DCOOKIE = 'asir_d', DHOURS = 12;
export async function resolve(env, req, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || '')) return null;
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const bad = await env.DB.prepare(`SELECT count(*) AS n FROM audit_log WHERE action = 'link_invalid' AND ip = ?1 AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 minutes')`).bind(ip).first();
  if (bad.n >= 20) fail(429, 'rate_limited', 'محاولات كثيرة. حاول لاحقاً.');
  const r = await env.DB.prepare(
    `SELECT s.*, a.name_ar AS association, g.name_ar AS gov FROM assessments s JOIN associations a ON a.id = s.association_id JOIN governorates g ON g.id = a.governorate_id
      WHERE s.token_hash = ?1 AND s.status != 'cancelled' AND s.expires_at > ${NOW}`).bind(await sha256(token)).first();
  if (!r) { await env.DB.prepare("INSERT INTO audit_log (actor_email, action, entity, ip) VALUES ('anonymous','link_invalid','assessments',?1)").bind(ip).run(); return null; }
  return r;
}
export async function pinOk(env, req, r) {
  if (!r.pin_hash) return true;
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)asir_d=([^;]+)/);
  if (!m) return false;
  const [id, exp, sig] = m[1].split('.');
  if (Number(id) !== r.id || !exp || Number(exp) < Date.now() / 1000 || !sig) return false;
  return eqs(await sign(env, `d.${id}.${exp}`), sig);
}
export async function verifyPin(env, req, r, token) {
  const f = await env.DB.prepare(`SELECT count(*) AS n FROM audit_log WHERE action = 'pin_failed' AND entity = 'assessments' AND entity_id = ?1 AND at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 minutes')`).bind(String(r.id)).first();
  if (f.n >= 5) return { ok: false, locked: true, message: 'أُوقف الدخول مؤقتاً بعد 5 محاولات خاطئة. حاول بعد 30 دقيقة أو اطلب رمزاً جديداً من المجلس.' };
  const pin = String((await req.formData()).get('pin') || '').replace(/\D/g, '');
  if (pin.length !== 6 || !eqs(await sha256(token + ':' + pin), r.pin_hash)) {
    await env.DB.prepare("INSERT INTO audit_log (actor_email, action, entity, entity_id, ip) VALUES ('anonymous','pin_failed','assessments',?1,?2)").bind(String(r.id), req.headers.get('CF-Connecting-IP')).run();
    const left = 4 - f.n;
    return { ok: false, message: left > 0 ? `رمز الدخول غير صحيح. متبقٍ ${left} ${left > 2 ? 'محاولات' : 'محاولة'}.` : 'رمز الدخول غير صحيح.' };
  }
  const exp = Math.floor(Date.now() / 1000) + DHOURS * 3600;
  return { ok: true, cookie: `${DCOOKIE}=${r.id}.${exp}.${await sign(env, `d.${r.id}.${exp}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DHOURS * 3600}` };
}
export async function opened(env, r) { await env.DB.prepare(`UPDATE assessments SET opens = opens + 1, last_opened_at = ${NOW} WHERE id = ?1`).bind(r.id).run(); }

// ما تراه الصفحة: للرابط بياناته فقط، وللفريق كذلك ملاحظة المراجعة
export async function pageState(env, r, who) {
  const p = parse(r);
  const st = {
    id: p.id, kind: p.kind, kindLabel: KIND_L[p.kind], status: p.status, association: p.association, gov: p.gov,
    answers: p.answers, info: p.info, scores: p.scores, expires: p.expires_at, updated: p.updated_at, files: await files(env, p.id),
    note: p.status === 'sent' || p.status === 'draft' || p.status === 'approved' ? p.review_note : null, tool: TOOL, who,
  };
  if (who === 'team') st.prefill = p.kind !== 'self' && ['draft'].includes(p.status) ? await prefill(env, p.association_id) : null;
  return st;
}

// إرسال روابط تقييم ذاتي لعدة جمعيات دفعة واحدة (يُصدَّر الناتج ملفاً يرسل منه الفريق كل رابط لجمعيته)
export async function bulk(env, req, user, body, origin) {
  const ids = [...new Set((body.association_ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) fail(422, 'invalid', 'اختر جمعية واحدة على الأقل');
  if (ids.length > 600) fail(422, 'invalid', 'الحد الأقصى 600 رابط في المرة');
  const out = [];
  for (const id of ids) {
    const r = await create(env, req, user, id, { kind: 'self', days: body.days }, origin);
    const g = await env.DB.prepare('SELECT a.license_no AS lic, g.name_ar AS gov FROM associations a JOIN governorates g ON g.id = a.governorate_id WHERE a.id = ?1').bind(id).first();
    out.push({ association_id: id, name: r.association, lic: g && g.lic, gov: g && g.gov, url: r.url, pin: r.pin });
  }
  return { days: Math.min(Math.max(Number(body.days) || 30, 1), 90), links: out };
}
