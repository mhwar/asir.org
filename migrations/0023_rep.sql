-- 0023_rep — ممثل البيانات: الشخص الذي يتابع تحديث بيانات الجمعية مع المجلس
-- من هو (المفوض / المدير التنفيذي / رئيس مجلس الإدارة / شخص آخر) بيان تنظيمي في الملف؛ اسمه وتواصله بيانات شخصية في جدول التواصل
ALTER TABLE association_profiles ADD COLUMN rep_is     TEXT;
ALTER TABLE association_contacts ADD COLUMN rep_name   TEXT;
ALTER TABLE association_contacts ADD COLUMN rep_role   TEXT;
ALTER TABLE association_contacts ADD COLUMN rep_email  TEXT;
ALTER TABLE association_contacts ADD COLUMN rep_mobile TEXT;
