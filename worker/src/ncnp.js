// استيراد بيانات دليل الكيانات في المركز الوطني لتنمية القطاع غير الربحي (es.ncnp.gov.sa).
// القاعدة: لا يُكتب فوق قيمة موجودة. ما يُعبّأ في حقل فارغ يُعلَّم في ncnp_pending «بانتظار تأكيد الجمعية»
// حتى تؤكّده عبر رابط التحديث أو يُعتمد لها طلب تحديث. درجة الحوكمة والتصنيف بيانات مرجعية تُحدَّث كل مزامنة.
// لا تُجمع أسماء أعضاء مجلس الإدارة أو أي بيانات شخصية من الدليل.
import { fail } from './http.js';
import { audit } from './db.js';
import { UFIELDS } from './requests.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";
// مفتاح الحقل في نموذج التحديث ← [الجدول، العمود]
const FILL = {
  web: ['p', 'website'], donate: ['p', 'donate_url'], phone: ['p', 'phone_official'], address: ['p', 'address'],
  postal: ['p', 'postal_code'], pobox: ['p', 'po_box'], email: ['c', 'email'], mobile: ['c', 'mobile'],
};
const clean = (k, v) => { try { const x = UFIELDS[k].v(v); return x == null || x === '' ? null : x; } catch { return null; } };
export const normName = (s) => String(s || '')
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/(ال)?جمعيه/g, '').replace(/(^|\s)ال/g, '$1').replace(/[^ء-ي0-9]/g, '');
const href = (u) => { u = String(u || '').trim(); if (!u) return null; return /^https?:\/\//i.test(u) ? u : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u) ? 'https://' + u : null; };
const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');

// row: {id, no, name, sup, cls, sub, web, donate, email, phone, fax, addr, zip, pob, gov, govYear}
function mapRow(r) {
  const ph = digits(r.phone), mob = /^05\d{8}$/.test(ph) ? ph : /^9665\d{8}$/.test(ph) ? '0' + ph.slice(3) : null;
  const vals = {
    web: clean('web', href(r.web)), donate: clean('donate', href(r.donate) && href(r.donate) !== href(r.web) ? href(r.donate) : null),
    phone: clean('phone', ph), address: clean('address', r.addr), postal: clean('postal', digits(r.zip) || null),
    pobox: clean('pobox', digits(r.pob) || null), email: clean('email', String(r.email || '').trim().toLowerCase()), mobile: mob && clean('mobile', mob),
  };
  const fax = digits(r.fax);
  return { vals, fax: fax.length >= 7 ? fax.slice(0, 15) : null };
}

export async function importNcnp(env, req, user, body) {
  const rows = Array.isArray(body && body.rows) ? body.rows.slice(0, 2000) : null;
  if (!rows || !rows.length) fail(422, 'invalid', 'لا توجد سجلات');
  const dry = !!body.dry;
  const { results: ours } = await env.DB.prepare(
    `SELECT a.id, a.name_ar, a.license_no, s.name_ar AS sup, p.association_id AS hasP, p.website, p.donate_url, p.phone_official, p.address, p.postal_code, p.po_box, p.ncnp_pending,
            c.association_id AS hasC, c.email, c.mobile
       FROM associations a LEFT JOIN supervisors s ON s.id = a.supervisor_id
       LEFT JOIN association_profiles p ON p.association_id = a.id LEFT JOIN association_contacts c ON c.association_id = a.id
      WHERE a.deleted_at IS NULL`).all();
  const byLic = new Map(ours.map((o) => [String(o.license_no).replace(/^0+/, ''), o]));
  const byName = new Map(); ours.forEach((o) => { const k = normName(o.name_ar); byName.set(k, byName.has(k) ? null : o); });
  const used = new Set(), stmts = [], rep = {
    total: rows.length, matched: 0, byLicense: 0, byName: 0, unmatched: [], nameDiff: [], licDiff: [], supDiff: [], filled: {}, assocTouched: 0, govScores: 0,
  };
  Object.keys(FILL).forEach((k) => (rep.filled[k] = 0));
  for (const r of rows) {
    const lic = digits(r.no).replace(/^0+/, '');
    let o = lic && byLic.get(lic), how = 'license';
    if (!o || used.has(o.id)) { o = byName.get(normName(r.name)); how = 'name'; }
    if (!o || used.has(o.id)) { rep.unmatched.push({ ncnp: r.id, no: r.no, name: r.name }); continue; }
    used.add(o.id); rep.matched++; how === 'license' ? rep.byLicense++ : rep.byName++;
    if (normName(o.name_ar) !== normName(r.name)) rep.nameDiff.push({ id: o.id, ours: o.name_ar, ncnp: r.name, lic: o.license_no, how });
    if (how === 'name') rep.licDiff.push({ id: o.id, name: o.name_ar, ours: o.license_no, ncnp: r.no });
    if (r.sup && o.sup && r.sup.replace(/\s/g, '') !== o.sup.replace(/\s/g, '')) rep.supDiff.push({ id: o.id, ours: o.sup, ncnp: r.sup });
    const { vals, fax } = mapRow(r), pend = new Set(o.ncnp_pending ? JSON.parse(o.ncnp_pending) : []), setP = {}, setC = {};
    for (const [k, [t, col]] of Object.entries(FILL)) {
      const v = vals[k]; if (!v) continue;
      if (o[col] != null && String(o[col]).trim() !== '') continue; // لا نكتب فوق قيمة موجودة
      (t === 'p' ? setP : setC)[col] = v; pend.add(k); rep.filled[k]++;
    }
    const gov = Number.isFinite(+r.gov) && r.gov !== null && r.gov !== '' ? Math.round(+r.gov * 100) / 100 : null;
    if (gov != null) rep.govScores++;
    if (Object.keys(setP).length || Object.keys(setC).length) rep.assocTouched++;
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO association_profiles (association_id) VALUES (?1)').bind(o.id));
    const cols = Object.keys(setP), b = [o.id, gov, Number(r.govYear) || null, Number(r.id) || null, String(r.cls || '').slice(0, 200) || null, String(r.sub || '').slice(0, 120) || null, fax, pend.size ? JSON.stringify([...pend]) : null, ...cols.map((c) => setP[c])];
    stmts.push(env.DB.prepare(`UPDATE association_profiles SET gov_score = ?2, gov_score_year = ?3, ncnp_id = ?4, ncnp_class = ?5, ncnp_subclass = ?6,
        fax = COALESCE(NULLIF(fax,''), ?7), ncnp_pending = ?8, ncnp_synced_at = ${NOW}${cols.map((c, i) => `, ${c} = ?${9 + i}`).join('')}, updated_at = ${NOW}
        WHERE association_id = ?1`).bind(...b));
    if (Object.keys(setC).length) {
      const cc = Object.keys(setC);
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO association_contacts (association_id) VALUES (?1)').bind(o.id));
      stmts.push(env.DB.prepare(`UPDATE association_contacts SET ${cc.map((c, i) => `${c} = ?${2 + i}`).join(', ')}, updated_at = ${NOW} WHERE association_id = ?1`).bind(o.id, ...cc.map((c) => setC[c])));
    }
  }
  rep.notInNcnp = ours.filter((o) => !used.has(o.id)).map((o) => ({ id: o.id, name: o.name_ar, lic: o.license_no }));
  rep.filledTotal = Object.values(rep.filled).reduce((a, b) => a + b, 0);
  if (!dry) {
    for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
    await audit(env, req, user.email, 'import', 'ncnp', null, null, { total: rep.total, matched: rep.matched, filled: rep.filled, filledTotal: rep.filledTotal, govScores: rep.govScores });
  }
  return { dry, ...rep };
}
