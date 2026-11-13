// يولّد migrations/0024_kb.sql من data/kb_seed.mjs (يُشغَّل مرة عند إنشاء الترحيل؛ التعديلات اللاحقة من اللوحة)
import { KB_SEED, KB_COLLECTIONS } from '../data/kb_seed.mjs';
import { writeFileSync } from 'node:fs';
const q = (v) => v == null || v === '' ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
let sql = `-- 0024_kb — المكتبة المعرفية: مراجع (أنظمة ولوائح وقواعد وأدلة ونماذج) قابلة للإدارة من اللوحة
-- kb_collections: مصدر كل مجموعة مراجع (مثل المكتبة المعرفية لمجلس الجمعيات الأهلية) لنسبة العمل إلى صاحبه
CREATE TABLE IF NOT EXISTS kb_collections (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, publisher TEXT, note TEXT, published_on TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
-- kb_items: مرجع واحد. kind نوعه، cat موضوعه، parent النظام الذي تتبعه اللائحة، url الرابط المعتمد (url_ok=0 يحتاج تحقق)،
-- src_url الرابط كما ورد في المصدر الأصلي، links (JSON) الأدوات التي يظهر فيها داخل المنصة، audience public|team، status published|draft|archived
CREATE TABLE IF NOT EXISTS kb_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, cat TEXT NOT NULL, title TEXT NOT NULL,
  issuer TEXT, ref TEXT, summary TEXT, url TEXT, url_ok INTEGER NOT NULL DEFAULT 1, src_url TEXT,
  parent TEXT, amended_on TEXT, note TEXT, tags TEXT, links TEXT,
  audience TEXT NOT NULL DEFAULT 'public', status TEXT NOT NULL DEFAULT 'published',
  collection_id TEXT REFERENCES kb_collections(id), sort INTEGER NOT NULL DEFAULT 0, reviewed_on TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), updated_by TEXT);
CREATE INDEX IF NOT EXISTS kb_items_cat ON kb_items(cat, status);
`;
for (const c of KB_COLLECTIONS) sql += `INSERT OR IGNORE INTO kb_collections (id, title, publisher, note, published_on) VALUES (${[c.id, c.title, c.publisher, c.note, c.published_on].map(q).join(', ')});\n`;
KB_SEED.forEach((x, i) => {
  sql += `INSERT OR IGNORE INTO kb_items (id, kind, cat, title, issuer, ref, summary, url, url_ok, src_url, parent, amended_on, note, links, collection_id, sort, reviewed_on) VALUES (${[x.id, x.kind, x.cat, x.title, x.issuer, x.ref, x.summary, x.url, x.urlOk === 0 ? 0 : 1, x.src, x.parent, x.amended, x.note, JSON.stringify(x.links || {}), x.collection || 'ccsa-2025', (i + 1) * 10, '2026-11-13'].map(q).join(', ')});\n`;
});
writeFileSync(new URL('../migrations/0024_kb.sql', import.meta.url), sql);
console.log('items', KB_SEED.length);
