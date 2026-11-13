// المكتبة المعرفية (0.91): مراجع الأنظمة واللوائح والقواعد والأدلة، تُدار من اللوحة وتُعرض في الموقع وداخل الأدوات.
// القراءة العامة لا تحتاج دخولاً (محتوى تشريعي عام)؛ الكتابة لصلاحية «المحتوى».
import { fail } from './http.js';
import { audit } from './db.js';

export const KB_CATS = ['sector', 'gov', 'hr', 'funds', 'tax', 'data', 'council'];
export const KB_KINDS = ['law', 'exreg', 'reg', 'rules', 'guide', 'template', 'article'];
const AUD = ['public', 'team'], STATUS = ['published', 'draft', 'archived'];
const LINK_KEYS = ['tr', 'pj', 'pf', 'hs'];
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const URL_RE = /^https:\/\/[^\s<>"']{4,600}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const txt = (v, n) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, n) : null; };
const row = (r) => ({ id: r.id, kind: r.kind, cat: r.cat, title: r.title, issuer: r.issuer, ref: r.ref, summary: r.summary, url: r.url, urlOk: !!r.url_ok, src: r.src_url,
  parent: r.parent, amended: r.amended_on, note: r.note, tags: r.tags ? JSON.parse(r.tags) : [], links: r.links ? JSON.parse(r.links) : {},
  audience: r.audience, status: r.status, collection: r.collection_id, sort: r.sort, reviewed: r.reviewed_on, updated: r.updated_at });

export async function listKb(env, team) {
  const where = team ? '' : "WHERE status = 'published' AND audience = 'public'";
  const { results } = await env.DB.prepare(`SELECT * FROM kb_items ${where} ORDER BY sort, title`).all();
  const cols = (await env.DB.prepare('SELECT id, title, publisher, note, published_on FROM kb_collections ORDER BY published_on').all()).results;
  return { items: results.map((r) => { const o = row(r); if (!team) { delete o.src; delete o.status; delete o.audience; } return o; }), collections: cols };
}

function clean(b, isNew) {
  const o = {};
  if (isNew) { if (!ID_RE.test(String(b.id || ''))) fail(422, 'invalid', 'المعرّف: حروف إنجليزية صغيرة وأرقام وشرطة'); o.id = b.id; }
  if ('title' in b || isNew) { o.title = txt(b.title, 200); if (!o.title) fail(422, 'invalid', 'العنوان مطلوب'); }
  if ('kind' in b || isNew) { if (!KB_KINDS.includes(b.kind)) fail(422, 'invalid', 'نوع غير معروف'); o.kind = b.kind; }
  if ('cat' in b || isNew) { if (!KB_CATS.includes(b.cat)) fail(422, 'invalid', 'موضوع غير معروف'); o.cat = b.cat; }
  for (const [k, c, n] of [['issuer', 'issuer', 120], ['ref', 'ref', 80], ['summary', 'summary', 400], ['note', 'note', 400]]) if (k in b) o[c] = txt(b[k], n);
  if ('url' in b) { const u = txt(b.url, 600); if (u && !URL_RE.test(u)) fail(422, 'invalid', 'الرابط يجب أن يبدأ بـ https://'); o.url = u; }
  if ('src' in b) { const u = txt(b.src, 600); if (u && !URL_RE.test(u)) fail(422, 'invalid', 'رابط المصدر الأصلي غير صالح'); o.src_url = u; }
  if ('urlOk' in b) o.url_ok = b.urlOk ? 1 : 0;
  if ('parent' in b) { const p = txt(b.parent, 40); if (p && !ID_RE.test(p)) fail(422, 'invalid', 'المرجع الأصل غير صالح'); o.parent = p; }
  for (const [k, c] of [['amended', 'amended_on'], ['reviewed', 'reviewed_on']]) if (k in b) { const d = txt(b[k], 10); if (d && !DATE_RE.test(d)) fail(422, 'invalid', 'تاريخ غير صالح'); o[c] = d; }
  if ('tags' in b) o.tags = JSON.stringify((Array.isArray(b.tags) ? b.tags : []).map((t) => txt(t, 40)).filter(Boolean).slice(0, 12));
  if ('links' in b) { const L = {}; for (const k of LINK_KEYS) { const a = b.links && b.links[k]; if (Array.isArray(a) && a.length) L[k] = a.map((x) => txt(x, 80)).filter(Boolean).slice(0, 20); } o.links = JSON.stringify(L); }
  if ('audience' in b) { if (!AUD.includes(b.audience)) fail(422, 'invalid', 'جمهور غير معروف'); o.audience = b.audience; }
  if ('status' in b) { if (!STATUS.includes(b.status)) fail(422, 'invalid', 'حالة غير معروفة'); o.status = b.status; }
  if ('collection' in b) o.collection_id = txt(b.collection, 40);
  if ('sort' in b) o.sort = Math.max(0, Math.min(99999, Number(b.sort) || 0));
  return o;
}

export async function saveKb(env, req, user, id, body) {
  const isNew = !id;
  if (isNew && body && body.id && await env.DB.prepare('SELECT 1 FROM kb_items WHERE id = ?1').bind(body.id).first()) fail(409, 'exists', 'المعرّف مستخدم');
  const before = isNew ? null : await env.DB.prepare('SELECT * FROM kb_items WHERE id = ?1').bind(id).first();
  if (!isNew && !before) fail(404, 'not_found', 'المرجع غير موجود');
  const o = clean(body || {}, isNew);
  if (o.collection_id && !(await env.DB.prepare('SELECT 1 FROM kb_collections WHERE id = ?1').bind(o.collection_id).first())) fail(422, 'invalid', 'مجموعة غير معروفة');
  const cols = Object.keys(o); if (!cols.length) fail(422, 'invalid', 'لا تعديلات');
  if (isNew) {
    if (!('collection_id' in o)) { o.collection_id = 'asir'; cols.push('collection_id'); }
    if (!('sort' in o)) { o.sort = ((await env.DB.prepare('SELECT MAX(sort) m FROM kb_items').first()).m || 0) + 10; cols.push('sort'); }
    await env.DB.prepare(`INSERT INTO kb_items (${cols.join(', ')}, updated_by) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')}, ?${cols.length + 1})`).bind(...cols.map((c) => o[c]), user.email).run();
  } else {
    await env.DB.prepare(`UPDATE kb_items SET ${cols.map((c, i) => `${c} = ?${i + 2}`).join(', ')}, updated_at = ${NOW}, updated_by = ?${cols.length + 2} WHERE id = ?1`).bind(id, ...cols.map((c) => o[c]), user.email).run();
  }
  const key = isNew ? o.id : id;
  await audit(env, req, user.email, isNew ? 'create' : 'update', 'kb_items', key, before ? Object.fromEntries(cols.map((c) => [c, before[c]])) : null, o);
  return row(await env.DB.prepare('SELECT * FROM kb_items WHERE id = ?1').bind(key).first());
}
