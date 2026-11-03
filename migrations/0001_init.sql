-- 0001_init — المرحلة 1: الجداول المرجعية، الجمعيات، الوصول، سجل التدقيق
-- قاعدة: كل حقل له مستوى ظهور واحد. الواجهة العامة تقرأ من v_public_associations فقط.
-- التواريخ نصوص ISO-8601 (YYYY-MM-DD أو YYYY-MM-DDTHH:MM:SSZ) بالتوقيت العالمي.

-- ─── الجداول المرجعية (عام) ───────────────────────────────
CREATE TABLE governorates (
  id          INTEGER PRIMARY KEY,
  name_ar     TEXT    NOT NULL UNIQUE,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE supervisors (
  id          INTEGER PRIMARY KEY,
  name_ar     TEXT    NOT NULL UNIQUE,
  short_ar    TEXT,
  logo_key    TEXT,                                  -- مفتاح الملف في R2 (لاحقاً)
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- مجالات العمل بثلاثة مستويات: 1 = المجموعة، 2 = التصنيف، 3 = التصنيف الفرعي
CREATE TABLE fields (
  id          INTEGER PRIMARY KEY,
  parent_id   INTEGER REFERENCES fields(id),
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  name_ar     TEXT    NOT NULL,
  UNIQUE (parent_id, name_ar),
  CHECK ((level = 1 AND parent_id IS NULL) OR (level > 1 AND parent_id IS NOT NULL))
);
CREATE UNIQUE INDEX ux_fields_root ON fields(name_ar) WHERE parent_id IS NULL;

-- ─── الجمعيات ────────────────────────────────────────────
CREATE TABLE associations (
  id                 INTEGER PRIMARY KEY,
  name_ar            TEXT    NOT NULL,
  license_no         TEXT    NOT NULL UNIQUE,
  unified_no         TEXT,                                          -- داخلي
  governorate_id     INTEGER NOT NULL REFERENCES governorates(id),
  supervisor_id      INTEGER NOT NULL REFERENCES supervisors(id),
  field_id           INTEGER NOT NULL REFERENCES fields(id),        -- المستوى 3
  founded_on         TEXT,
  license_issued_on  TEXT,                                          -- داخلي
  license_expires_on TEXT,                                          -- داخلي
  registry_status    TEXT    NOT NULL DEFAULT 'مفعل' CHECK (registry_status IN ('مفعل','منتهي','موقوف')),
  is_published       INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0,1)),
  contact_consent    INTEGER NOT NULL DEFAULT 0 CHECK (contact_consent IN (0,1)),
  contact_consent_at TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  deleted_at         TEXT                                           -- حذف منطقي
);
CREATE INDEX ix_assoc_gov   ON associations(governorate_id);
CREATE INDEX ix_assoc_sup   ON associations(supervisor_id);
CREATE INDEX ix_assoc_field ON associations(field_id);
CREATE INDEX ix_assoc_exp   ON associations(license_expires_on);

-- بيانات التواصل: جدول منفصل عمداً، داخلي أو بموافقة الجمعية.
-- يبقى فارغاً حتى يقرر الفريق تخزين البيانات الشخصية (انظر خطة الانتقال).
CREATE TABLE association_contacts (
  association_id   INTEGER PRIMARY KEY REFERENCES associations(id) ON DELETE CASCADE,
  email            TEXT,
  mobile           TEXT,
  delegate_name    TEXT,
  delegate_email   TEXT,
  president_name   TEXT,
  president_email  TEXT,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── الوصول ──────────────────────────────────────────────
CREATE TABLE roles (
  key            TEXT PRIMARY KEY,
  name_ar        TEXT NOT NULL,
  description_ar TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

-- module = اسم الوحدة أو '*' لكل الوحدات؛ write تتضمن read
CREATE TABLE role_permissions (
  role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  module   TEXT NOT NULL,
  access   TEXT NOT NULL CHECK (access IN ('read','write')),
  PRIMARY KEY (role_key, module)
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name_ar        TEXT,
  role_key       TEXT NOT NULL REFERENCES roles(key),
  governorate_id INTEGER REFERENCES governorates(id),   -- نطاق لأدوار المحافظات لاحقاً
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── التدقيق والإعدادات ─────────────────────────────────
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,          -- login | create | update | delete | reveal | export | import
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX ix_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX ix_audit_at     ON audit_log(at);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── العروض ─────────────────────────────────────────────
CREATE VIEW v_public_associations AS
SELECT a.id,
       a.name_ar                              AS name,
       a.license_no,
       CAST(substr(a.founded_on, 1, 4) AS INTEGER) AS founded_year,
       g.name_ar                              AS governorate,
       s.name_ar                              AS supervisor,
       f1.name_ar                             AS field_group,
       f2.name_ar                             AS field_category,
       f3.name_ar                             AS field_subcategory
FROM associations a
JOIN governorates g ON g.id  = a.governorate_id
JOIN supervisors  s ON s.id  = a.supervisor_id
JOIN fields      f3 ON f3.id = a.field_id
JOIN fields      f2 ON f2.id = f3.parent_id
JOIN fields      f1 ON f1.id = f2.parent_id
WHERE a.is_published = 1 AND a.deleted_at IS NULL;

CREATE VIEW v_admin_associations AS
SELECT a.id, a.name_ar AS name, a.license_no, a.unified_no,
       a.governorate_id, g.name_ar AS governorate,
       a.supervisor_id,  s.name_ar AS supervisor,
       a.field_id, f1.name_ar AS field_group, f2.name_ar AS field_category, f3.name_ar AS field_subcategory,
       a.founded_on, a.license_issued_on, a.license_expires_on,
       CAST(julianday(a.license_expires_on) - julianday('now') AS INTEGER) AS days_to_expiry,
       CASE WHEN a.license_expires_on IS NULL THEN NULL
            WHEN julianday(a.license_expires_on) < julianday('now') THEN 'منتهي'
            WHEN julianday(a.license_expires_on) - julianday('now') <= 90 THEN 'ينتهي خلال 90 يوماً'
            ELSE 'ساري' END AS license_state,
       a.registry_status, a.is_published, a.contact_consent,
       a.created_at, a.updated_at
FROM associations a
JOIN governorates g ON g.id  = a.governorate_id
JOIN supervisors  s ON s.id  = a.supervisor_id
JOIN fields      f3 ON f3.id = a.field_id
JOIN fields      f2 ON f2.id = f3.parent_id
JOIN fields      f1 ON f1.id = f2.parent_id
WHERE a.deleted_at IS NULL;
