-- 0010_trouble — صلاحية «الجمعيات المتعثرة» (المخزن asirTrouble في app_state، للفريق فقط) و«الاستشارات» الرئيسية
INSERT OR IGNORE INTO role_permissions (role_key, module, access) VALUES
  ('analyst', 'trouble', 'write'),
  ('consult', 'chub', 'write');
