-- 0008_association_notes — ملاحظات المجلس على بيانات كل جمعية
-- تظهر للجمعية في رابط التحديث مع ملاحظات الجودة المحسوبة، وتُغلق تلقائياً عند اعتماد تصحيح الحقل المرتبط بها
CREATE TABLE association_notes (
  id             INTEGER PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  field          TEXT,                         -- مفتاح حقل البوابة (email, pres, about, logo ...) أو NULL لملاحظة عامة
  text           TEXT NOT NULL,
  visible        INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),   -- 1 = تظهر للجمعية في رابط التحديث
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  resolved_by    TEXT,
  resolved_at    TEXT
);
CREATE INDEX ix_notes_assoc ON association_notes(association_id, status);
