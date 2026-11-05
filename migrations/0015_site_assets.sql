-- ملفات صغيرة مرخّصة تُخدم من الموقع ولا تُرفع إلى المستودع العام (مثل خط الهوية Avenir Arabic من Monotype).
-- تُضاف الملفات مباشرة في قاعدة البيانات، والـ Worker يخدمها على /fonts/<الاسم> مع تخزين مؤقت طويل.
CREATE TABLE IF NOT EXISTS site_assets (
  path TEXT PRIMARY KEY,           -- مثل /fonts/AvenirArabic-Medium.woff2
  mime TEXT NOT NULL,
  data TEXT NOT NULL,              -- base64
  sha TEXT NOT NULL,               -- أول 10 خانات من SHA-256 (للتحقق وETag)
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
