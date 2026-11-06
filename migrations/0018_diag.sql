-- 0018_diag — التشخيص المؤسسي للجمعيات: تقييم ذاتي برابط، وميداني (برابط للخبير أو من حساب الفريق)، ومكتبي
CREATE TABLE assessments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('self','field','desk')),
  tool           TEXT NOT NULL,                      -- إصدار أداة التشخيص
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','submitted','approved','cancelled')),
  answers        TEXT NOT NULL DEFAULT '{}',          -- {عبارة: {v: 0-3|na, note, src}}
  info           TEXT NOT NULL DEFAULT '{}',          -- صفة المعبّئ، الزيارة، الموافقة على التسجيل، الأسئلة المفتوحة، ملاحظات المحاور (بلا بيانات شخصية)
  scores         TEXT,                                -- {total, axes, gaps, cov}
  token_hash     TEXT UNIQUE,
  pin_hash       TEXT,
  expires_at     TEXT,
  opens          INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT,
  submitted_at   TEXT,
  approved_by    TEXT,
  approved_at    TEXT,
  review_note    TEXT
);
CREATE INDEX idx_assessments_assoc ON assessments(association_id, status);
CREATE TABLE assessment_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  axis          TEXT,
  key           TEXT NOT NULL,
  name          TEXT,
  type          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  kind          TEXT,                                 -- audio | image | doc
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_assessment_files ON assessment_files(assessment_id);
INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('consult', 'diag', 'write'), ('analyst', 'diag', 'write'), ('pm', 'diag', 'read');
