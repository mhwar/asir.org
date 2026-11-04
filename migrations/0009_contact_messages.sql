-- رسائل التواصل وطلبات المساعدة في تأسيس جمعية، من نموذج الموقع العام
CREATE TABLE contact_messages (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('general','consult','founding','partner','suggest')),
  name        TEXT NOT NULL,
  org         TEXT,
  email       TEXT,
  phone       TEXT,
  governorate TEXT,
  details     TEXT,             -- JSON: تفاصيل طلب التأسيس (المجال، عدد المؤسسين، المرحلة…)
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','progress','done','archived')),
  assigned_to TEXT,
  note        TEXT,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT
);
CREATE INDEX ix_msg_status ON contact_messages(status, created_at);
CREATE INDEX ix_msg_ip ON contact_messages(ip_hash, created_at);

-- صندوق الوارد: محرر المحتوى ومنسق الاستشارات
INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('content', 'inbox', 'write'),
  ('consult', 'inbox', 'write');
