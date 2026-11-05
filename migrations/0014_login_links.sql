-- 0014 (0.56) — روابط الدخول الشخصية، وأدوار مقترحة للمناصب (تُفعَّل وتُعدَّل صلاحياتها من «الأدوار والصلاحيات»).
CREATE TABLE IF NOT EXISTS login_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,          -- SHA-256 للرابط؛ الرابط نفسه لا يُخزَّن
  label TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_links_user ON login_links(user_id);

INSERT OR IGNORE INTO roles (key, name_ar, description_ar, is_active) VALUES
  ('chair', 'الرئيس ونائبه', 'اطلاع على كل الأقسام، واعتماد القرارات والحوكمة والسياسات', 1),
  ('finance', 'المالية', 'المشاريع وميزانياتها والتقارير، واطلاع على الشراكات والقرارات', 1),
  ('pm', 'مدير مشاريع', 'المشاريع والقرارات والتقويم، واطلاع على الشراكات والمجتمعات', 1),
  ('media', 'الإعلام', 'المركز الإعلامي والحملات والنشر، واطلاع على الشراكات والتقارير', 1),
  ('committee', 'عضو لجنة', 'المجتمعات والفعاليات، واطلاع على القرارات والمشاريع والتقارير', 1);

INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('chair', '*', 'read'), ('chair', 'decisions', 'write'), ('chair', 'board', 'write'), ('chair', 'policy', 'write'), ('chair', 'docs', 'write'),
  ('finance', 'home', 'read'), ('finance', 'overview', 'read'), ('finance', 'projects', 'write'), ('finance', 'reports', 'write'),
  ('finance', 'partners', 'read'), ('finance', 'decisions', 'read'), ('finance', 'docs', 'read'), ('finance', 'calendar', 'read'),
  ('pm', 'home', 'read'), ('pm', 'overview', 'read'), ('pm', 'projects', 'write'), ('pm', 'decisions', 'write'), ('pm', 'calendar', 'write'),
  ('pm', 'partners', 'read'), ('pm', 'communities', 'read'), ('pm', 'reports', 'read'), ('pm', 'campaigns', 'read'),
  ('media', 'home', 'read'), ('media', 'overview', 'read'), ('media', 'content', 'write'), ('media', 'mops', 'write'), ('media', 'mset', 'write'),
  ('media', 'campaigns', 'write'), ('media', 'partners', 'read'), ('media', 'reports', 'read'), ('media', 'calendar', 'read'),
  ('committee', 'home', 'read'), ('committee', 'overview', 'read'), ('committee', 'communities', 'write'), ('committee', 'decisions', 'read'),
  ('committee', 'projects', 'read'), ('committee', 'reports', 'read'), ('committee', 'calendar', 'read');
