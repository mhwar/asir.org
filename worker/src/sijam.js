// منجزات سجام (منصة مجلس الجمعيات الأهلية): جلب ما نُشر علناً لمنطقة عسير وحفظه في asirSijam للفريق.
// لا يُنشر في الموقع العام. ما حُذف من سجام يبقى محفوظاً بعلامة gone ولا يُمسح.
import { fail } from './http.js';

const SRC = 'https://sijam.ccsa.org.sa/api/public/achievements';
const cut = (s, n) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim().slice(0, n));
const list = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return v ? [String(v)] : []; } };

function pick(x) {
  const o = {
    id: Number(x.id), t: cut(x.title, 200), d: cut(x.description, 600), cat: cut(x.categoryName, 60), city: cut(x.city, 40),
    date: String(x.completionDate || '').slice(0, 10), ver: String(x.verifiedAt || '').slice(0, 10),
    sid: Number(x.associationId) || 0, sn: cut(x.associationName, 160), sc: cut(x.associationSubCouncilName, 120),
    ben: Number(x.directBeneficiaries) || 0, iben: Number(x.indirectBeneficiaries) || 0, vol: Number(x.volunteers) || 0, vh: Number(x.volunteerHours) || 0,
    bc: cut(x.beneficiaryCategory, 80),
    imp: list(x.impacts).map((s) => cut(typeof s === 'object' && s ? (s.title || s.text || s.name || '') : s, 200)).filter(Boolean).slice(0, 5),
    doc: /^https?:\/\//.test(String(x.documentationLink || '')) ? cut(x.documentationLink, 300) : '',
    img: (Array.isArray(x.files) ? x.files : []).filter((f) => f && /^image\//.test(f.contentType || '')).length,
  };
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] === 0 || (Array.isArray(o[k]) && !o[k].length)) delete o[k];
  return o;
}

async function fetchAsir() {
  const out = []; let page = 1, total = 0;
  do {
    let r;
    try {
      r = await fetch(SRC, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ page, limit: 50, regions: ['منطقة عسير'] }), signal: AbortSignal.timeout(10000) });
    } catch { fail(502, 'upstream', 'تعذّر الوصول إلى منصة سجام'); }
    if (!r.ok) fail(502, 'upstream', `منصة سجام لم تستجب (${r.status})`);
    const j = await r.json().catch(() => null);
    // رد غير متوقع (صفحة صيانة، تغيّر الشكل) يوقف المزامنة ولا يُعلّم شيئاً بأنه اختفى
    if (!j || !Array.isArray(j.items) || !Number.isFinite(Number(j.totalCount))) fail(502, 'upstream', 'رد منصة سجام بصيغة غير متوقعة؛ لم يتغيّر شيء');
    total = Number(j.totalCount);
    out.push(...j.items.filter((x) => x && typeof x === 'object'));
    if (!j.items.length) break;
    page++;
  } while (out.length < total && page <= 40);
  if (out.length < total) fail(502, 'upstream', `جُلب ${out.length} من ${total} فقط من سجام؛ لم يتغيّر شيء`);
  const uniq = new Map(); out.map(pick).filter((x) => x.id && x.t).forEach((x) => uniq.set(x.id, x));
  return { total, items: [...uniq.values()] };
}

const MAX = 250 * 1024;
const bytes = (s) => new TextEncoder().encode(s).length;
async function readCur(env) {
  const cur = await env.DB.prepare('SELECT value, version FROM app_state WHERE key = ?1').bind('asirSijam').first();
  let prev = {}; try { prev = cur ? JSON.parse(cur.value) : {}; } catch { prev = {}; }
  if (!prev || typeof prev !== 'object') prev = {};
  if (!Array.isArray(prev.items)) prev.items = [];
  if (!prev.map || typeof prev.map !== 'object' || Array.isArray(prev.map)) prev.map = {};
  delete prev.by;
  return { cur, prev };
}
// كتابة مشروطة بالإصدار: لا تمحو حفظاً وقع بين القراءة والكتابة
async function write(env, user, cur, value) {
  if (bytes(value) > MAX) fail(413, 'payload_too_large', 'منجزات سجام أكبر من المساحة المتاحة');
  const r = cur
    ? await env.DB.prepare(`UPDATE app_state SET value = ?2, version = version + 1, updated_by = ?3, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE key = ?1 AND version = ?4`).bind('asirSijam', value, user.email, cur.version).run()
    : await env.DB.prepare(`INSERT INTO app_state (key, value, version, updated_by) VALUES (?1, ?2, 1, ?3) ON CONFLICT(key) DO NOTHING`).bind('asirSijam', value, user.email).run();
  if (!r.meta.changes) fail(409, 'conflict', 'حفظ عضو آخر منجزات سجام للتو؛ أعد المحاولة');
  return cur ? cur.version + 1 : 1;
}

export async function sync(env, user) {
  const pre = await readCur(env);
  if (pre.prev.at && Date.now() - Date.parse(pre.prev.at) < 60 * 1000) fail(429, 'too_soon', 'جرت مزامنة قبل أقل من دقيقة');
  const { total, items } = await fetchAsir();
  const { cur, prev } = await readCur(env);
  const now = new Date().toISOString(), ids = new Set(items.map((x) => x.id)), old = new Map(prev.items.filter((x) => x && x.id).map((x) => [x.id, x]));
  const kept = [...old.values()].filter((x) => !ids.has(x.id)).map((x) => ({ ...x, gone: x.gone || now.slice(0, 10) }));
  const merged = [...items.map((x) => ({ ...x, at: (old.get(x.id) || {}).at || now.slice(0, 10) })), ...kept];
  const value = JSON.stringify({ v: 1, at: now, total, items: merged, map: prev.map });
  const ver = await write(env, user, cur, value);
  return { total, fetched: items.length, added: items.filter((x) => !old.has(x.id)).length, gone: kept.length, value, version: ver };
}

// مطابقة جمعيات سجام بالسجل: تُحدَّث وحدها، فلا يُرسل العميل المنجزات كاملة
export async function setMap(env, user, body) {
  const inMap = body && body.map;
  if (!inMap || typeof inMap !== 'object' || Array.isArray(inMap)) fail(422, 'invalid', 'المطابقة غير صالحة');
  const map = {};
  for (const [k, v] of Object.entries(inMap)) {
    if (!/^\d{1,9}$/.test(k)) continue;
    if (v === null || v === '') continue;
    const n = Number(v); if (Number.isInteger(n) && n >= 0 && n < 1e9) map[k] = n;
  }
  const { cur, prev } = await readCur(env);
  const value = JSON.stringify({ ...prev, map });
  const ver = await write(env, user, cur, value);
  return { map, value, version: ver };
}
