-- التطوع الاحترافي «تطوّع بخبرتك»: وحدة pro في لوحة التحكم
-- البيانات في app_state (asirPro)، والطلبات الواردة من الموقع في contact_messages (details._k = expert | need)
INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('consult', 'pro', 'write'),
  ('pm', 'pro', 'read');
