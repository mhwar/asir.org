-- 0011_wave2 — الموجة الثانية لتبويب الجمعيات: حقول الحجم والحوكمة، سجل التواصل، التنبيهات المجدولة
ALTER TABLE association_profiles ADD COLUMN staff_count        INTEGER;   -- عدد الموظفين
ALTER TABLE association_profiles ADD COLUMN volunteers_count   INTEGER;   -- عدد المتطوعين (آخر سنة)
ALTER TABLE association_profiles ADD COLUMN beneficiaries_count INTEGER;  -- عدد المستفيدين (آخر سنة)
ALTER TABLE association_profiles ADD COLUMN last_assembly_on   TEXT;      -- تاريخ آخر جمعية عمومية
ALTER TABLE association_profiles ADD COLUMN fin_year           INTEGER;   -- آخر سنة مالية اعتُمدت قوائمها
ALTER TABLE association_profiles ADD COLUMN revenue_band       TEXT;      -- شريحة الإيرادات السنوية (نطاق لا رقم)

-- سجل التواصل مع الجمعية (للفريق فقط): مكالمة، زيارة، بريد، واتساب، اجتماع، خطاب
CREATE TABLE association_contact_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL CHECK (channel IN ('call','visit','email','whatsapp','meeting','letter','other')),
  outcome        TEXT NOT NULL DEFAULT 'responded' CHECK (outcome IN ('responded','no_answer','promised','escalated')),
  summary        TEXT NOT NULL,
  next_on        TEXT,                        -- موعد المتابعة التالية (اختياري)
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX ix_clog_assoc ON association_contact_log(association_id, created_at);

-- التنبيهات المجدولة (تُحسب يومياً): انتهاء الترخيص بعد 90/30/7 أيام، منتهٍ منذ أمس، عدم تجاوب 60 يوماً، موعد متابعة حان
CREATE TABLE alerts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  key            TEXT NOT NULL UNIQUE,        -- type:association_id:period  (يمنع التكرار)
  type           TEXT NOT NULL,
  association_id INTEGER REFERENCES associations(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  detail         TEXT,
  due_on         TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  done_at        TEXT,
  done_by        TEXT
);
CREATE INDEX ix_alerts_open ON alerts(done_at, created_at);
