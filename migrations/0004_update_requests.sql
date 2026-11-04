-- 0004_update_requests — تحديث بيانات الجمعيات عبر رابط آمن لكل جمعية، ومراجعة المجلس قبل الاعتماد
--
-- المسار: المجلس يُنشئ رابطاً للجمعية ← الجمعية تفتحه وتعدّل في البوابة ← يُحفظ طلباً «بانتظار المراجعة»
--        ← المجلس يراجع الفروقات حقلاً حقلاً ويعتمد أو يرفض ← المعتمد فقط يُكتب في بيانات الجمعية.

-- الملف التعريفي للجمعية (عام): ما تصف به الجمعية نفسها في صفحتها
CREATE TABLE association_profiles (
  association_id INTEGER PRIMARY KEY REFERENCES associations(id) ON DELETE CASCADE,
  short_name     TEXT,
  about          TEXT,
  website        TEXT,
  social         TEXT,
  beneficiaries  TEXT,          -- JSON array
  programs       TEXT,
  logo_key       TEXT,          -- R2 key
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- روابط التحديث: يُحفظ تجزئة الرمز فقط، والرمز نفسه يظهر مرة واحدة عند الإنشاء
CREATE TABLE update_links (
  id             INTEGER PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  token_hash     TEXT    NOT NULL UNIQUE,
  created_by     TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at     TEXT    NOT NULL,
  revoked_at     TEXT,
  last_opened_at TEXT,
  opens          INTEGER NOT NULL DEFAULT 0,
  submissions    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_links_assoc ON update_links(association_id);

CREATE TABLE update_requests (
  id              INTEGER PRIMARY KEY,
  association_id  INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  link_id         INTEGER REFERENCES update_links(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','partial','rejected')),
  changes         TEXT NOT NULL,            -- JSON { field: { old, new } }
  files           TEXT,                     -- JSON { field: { key, name, type, size } }
  submitter_name  TEXT,
  submitter_role  TEXT,
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  review_note     TEXT,
  applied         TEXT                      -- JSON array of applied fields
);
CREATE INDEX ix_req_status ON update_requests(status, created_at);
CREATE INDEX ix_req_assoc  ON update_requests(association_id);

-- جمع بيانات التواصل والقيادة الشخصية معطّل حتى يقرر الفريق تخزينها
INSERT INTO settings (key, value) VALUES ('collect_personal', '0');

-- جوال المفوض (موجود في نموذج البوابة)
ALTER TABLE association_contacts ADD COLUMN delegate_mobile TEXT;
