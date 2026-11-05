-- 0.45: مزامنة صلاحيات الأدوار مع وحدات اللوحة الحالية (الوحدات التي أُضيفت منذ 0.28)
INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('content', 'inbox', 'write'), ('content', 'comm', 'write'),
  ('consult', 'chub', 'write'), ('consult', 'inbox', 'write'),
  ('analyst', 'alerts', 'write'), ('analyst', 'trouble', 'write'), ('analyst', 'assoc', 'read'), ('analyst', 'policy', 'read'), ('analyst', 'audit', 'read');
-- حذف وحدات لم تعد موجودة
DELETE FROM role_permissions WHERE module IN ('mset_old');
