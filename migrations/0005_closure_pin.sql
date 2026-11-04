-- 0005_closure_pin — إغلاق الجمعية نهائياً، ورمز دخول لكل رابط تحديث

-- الإغلاق النهائي: يُسجَّل بتاريخه وسببه، وتُستبعد الجمعية من الموقع العام وتبقى في اللوحة بعلامة «مغلقة»
ALTER TABLE associations ADD COLUMN closed_on TEXT;
ALTER TABLE associations ADD COLUMN closure_reason TEXT;

-- رمز دخول من 6 أرقام لكل رابط (يُحفظ مُجزّأً). الروابط القديمة بلا رمز تبقى تعمل حتى انتهائها
ALTER TABLE update_links ADD COLUMN pin_hash TEXT;

DROP VIEW v_public_associations;
CREATE VIEW v_public_associations AS
SELECT a.id, a.name_ar AS name, a.license_no,
       CAST(substr(a.founded_on, 1, 4) AS INTEGER) AS founded_year,
       g.name_ar AS governorate, s.name_ar AS supervisor,
       f1.name_ar AS field_group, f2.name_ar AS field_category, f3.name_ar AS field_subcategory
FROM associations a
JOIN governorates g ON g.id  = a.governorate_id
JOIN supervisors  s ON s.id  = a.supervisor_id
JOIN fields      f3 ON f3.id = a.field_id
JOIN fields      f2 ON f2.id = f3.parent_id
JOIN fields      f1 ON f1.id = f2.parent_id
WHERE a.is_published = 1 AND a.deleted_at IS NULL AND a.closed_on IS NULL;

DROP VIEW v_admin_associations;
CREATE VIEW v_admin_associations AS
SELECT a.id, a.name_ar AS name, a.license_no, a.unified_no,
       a.governorate_id, g.name_ar AS governorate,
       a.supervisor_id,  s.name_ar AS supervisor,
       a.field_id, f1.name_ar AS field_group, f2.name_ar AS field_category, f3.name_ar AS field_subcategory,
       a.founded_on, a.license_issued_on, a.license_expires_on,
       CAST(julianday(a.license_expires_on) - julianday('now') AS INTEGER) AS days_to_expiry,
       CASE WHEN a.closed_on IS NOT NULL THEN 'مغلقة'
            WHEN a.license_expires_on IS NULL THEN NULL
            WHEN julianday(a.license_expires_on) < julianday('now') THEN 'منتهي'
            WHEN julianday(a.license_expires_on) - julianday('now') <= 90 THEN 'ينتهي خلال 90 يوماً'
            ELSE 'ساري' END AS license_state,
       a.registry_status, a.is_published, a.contact_consent,
       a.closed_on, a.closure_reason,
       a.created_at, a.updated_at
FROM associations a
JOIN governorates g ON g.id  = a.governorate_id
JOIN supervisors  s ON s.id  = a.supervisor_id
JOIN fields      f3 ON f3.id = a.field_id
JOIN fields      f2 ON f2.id = f3.parent_id
JOIN fields      f1 ON f1.id = f2.parent_id
WHERE a.deleted_at IS NULL;
