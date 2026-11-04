-- 0003_app_state — بيانات الفريق المشتركة لكل وحدة (النواقص، المتابعة، القرارات، الشراكات، المجلس، الأثر)
-- مستند JSON لكل وحدة مع رقم إصدار لمنع الكتابة فوق تعديل عضو آخر (optimistic concurrency).
-- كل حفظ يُسجَّل في audit_log. تُفكَّك الوحدة إلى جداول مستقلة عندما تحتاج استعلامات أو تقارير خاصة بها.
CREATE TABLE app_state (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
