-- 0002_roles — الأدوار وصلاحياتها. مدير النظام وحده مفعّل الآن؛ البقية تُفعَّل تدريجياً بتحديث is_active.

INSERT INTO roles (key, name_ar, description_ar, is_active) VALUES
  ('admin', 'مدير النظام', 'كل الصلاحيات', 1),
  ('content', 'محرر المحتوى', 'المحتوى والمجتمعات والحملات', 0),
  ('consult', 'منسق الاستشارات', 'الطلبات والمستشارين والمواعيد', 0),
  ('analyst', 'محلل البيانات', 'الدليل والتحليلات', 0);

INSERT INTO role_permissions (role_key, module, access) VALUES
  ('admin', '*', 'write');

-- الأدوار المؤجلة (مطابقة لنموذج 0.28)
INSERT INTO role_permissions (role_key, module, access) VALUES
  ('content', 'home', 'write'),
  ('content', 'overview', 'write'),
  ('content', 'content', 'write'),
  ('content', 'campaigns', 'write'),
  ('content', 'communities', 'write'),
  ('content', 'mops', 'write'),
  ('content', 'mset', 'write'),
  ('content', 'board', 'write'),
  ('content', 'partners', 'write'),
  ('content', 'projects', 'write'),
  ('content', 'reports', 'write'),
  ('content', 'launch', 'write'),
  ('content', 'gaps', 'write'),
  ('content', 'plan', 'write'),
  ('consult', 'home', 'write'),
  ('consult', 'overview', 'write'),
  ('consult', 'consults', 'write'),
  ('consult', 'calendar', 'write'),
  ('consult', 'consultants', 'write'),
  ('consult', 'capps', 'write'),
  ('consult', 'cset', 'write'),
  ('consult', 'directory', 'write'),
  ('consult', 'reports', 'write'),
  ('consult', 'launch', 'write'),
  ('consult', 'gaps', 'write'),
  ('consult', 'plan', 'write'),
  ('analyst', 'home', 'write'),
  ('analyst', 'overview', 'write'),
  ('analyst', 'directory', 'read'),
  ('analyst', 'bysup', 'read'),
  ('analyst', 'bygov', 'read'),
  ('analyst', 'analytics', 'write'),
  ('analyst', 'decisions', 'write'),
  ('analyst', 'reports', 'write'),
  ('analyst', 'licenses', 'read'),
  ('analyst', 'quality', 'write'),
  ('analyst', 'updates', 'write'),
  ('analyst', 'campaigns', 'write'),
  ('analyst', 'partners', 'write'),
  ('analyst', 'projects', 'write'),
  ('analyst', 'launch', 'write'),
  ('analyst', 'plan', 'write');

INSERT INTO settings (key, value) VALUES
  ('site_mode', 'private'),
  ('schema_phase', '1');
