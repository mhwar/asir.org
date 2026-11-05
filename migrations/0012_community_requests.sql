-- 0.44: نوعان جديدان في رسائل الموقع: طلب انضمام لمجتمع (join) وتسجيل في فعالية (evreg)
-- SQLite لا يسمح بتعديل CHECK، فنعيد بناء الجدول مع الحفاظ على البيانات.
CREATE TABLE contact_messages_new (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('general','consult','founding','partner','suggest','join','evreg')),
  name        TEXT NOT NULL,
  org         TEXT,
  email       TEXT,
  phone       TEXT,
  governorate TEXT,
  details     TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','progress','done','archived')),
  assigned_to TEXT,
  note        TEXT,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT
);
INSERT INTO contact_messages_new SELECT id, kind, name, org, email, phone, governorate, details, message, status, assigned_to, note, ip_hash, created_at, updated_at FROM contact_messages;
DROP TABLE contact_messages;
ALTER TABLE contact_messages_new RENAME TO contact_messages;
CREATE INDEX ix_msg_status ON contact_messages(status, created_at);
CREATE INDEX ix_msg_ip ON contact_messages(ip_hash, created_at);
CREATE INDEX ix_msg_kind ON contact_messages(kind, status);
