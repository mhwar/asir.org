// هجرات تُشغَّل من داخل العامل بطلب مدير النظام، حين لا يتاح تشغيلها من لوحة D1.
// كل هجرة هنا قابلة للتكرار: الأعمدة الموجودة لا تُضاف مرة أخرى، والباقي تحديثات وإدراجات بلا تكرار.
// تُنفَّذ دفعة واحدة (معاملة واحدة في D1): تنجح كلها أو لا يتغيّر شيء.
import { M0026 } from './m0026.js';
import { fail } from './http.js';
import { audit } from './db.js';

const COUNTS = `SELECT (SELECT count(*) FROM fields WHERE level = 1) AS l1, (SELECT count(*) FROM fields WHERE level = 2) AS l2,
  (SELECT count(*) FROM fields WHERE level = 3) AS l3,
  (SELECT count(*) FROM associations a JOIN fields f ON f.id = a.field_id WHERE f.name_ar = 'خدمات الأشخاص ذوي الإعاقة') AS old_name`;

async function state(env) {
  const cols = (await env.DB.prepare('PRAGMA table_info(fields)').all()).results.map((c) => c.name);
  const c = await env.DB.prepare(COUNTS).first();
  let def = null;
  if (cols.includes('def')) def = (await env.DB.prepare('SELECT count(*) AS n FROM fields WHERE level = 3 AND def IS NOT NULL').first()).n;
  return { cols: cols.filter((x) => ['official', 'def', 'sup_name', 'ord'].includes(x)), ...c, with_def: def, applied: cols.includes('def') && c.l1 === 10 && c.l2 === 34 && c.l3 === 123 && def === 123 && c.old_name === 0 };
}

export async function status0026(env, user) {
  if (user.role !== 'admin') fail(403, 'forbidden', 'لمدير النظام فقط');
  return state(env);
}

export async function run0026(env, req, user) {
  if (user.role !== 'admin') fail(403, 'forbidden', 'لمدير النظام فقط');
  const before = await state(env);
  if (before.applied) return { before, after: before, ran: 0 };
  const stmts = M0026.filter((s) => { const m = s.match(/^ALTER TABLE fields ADD COLUMN (\w+)/); return !(m && before.cols.includes(m[1])); });
  await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
  const after = await state(env);
  await audit(env, req, user.email, 'update', 'fields', 'migration-0026', before, after);
  return { before, after, ran: stmts.length };
}
