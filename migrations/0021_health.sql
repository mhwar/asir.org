-- 0021_health — مؤشر الصحة v2: المدير التنفيذي، حالة الجمعية في المنصات (التسجيل ≠ التفعيل)، وتحقق الفريق من البيانات
-- المدير التنفيذي: الاسم والتواصل بيانات شخصية (جدول التواصل)، والتعيين وطبيعة العمل بيانات تنظيمية (الملف)
ALTER TABLE association_contacts ADD COLUMN exec_name   TEXT;
ALTER TABLE association_contacts ADD COLUMN exec_email  TEXT;
ALTER TABLE association_contacts ADD COLUMN exec_mobile TEXT;
ALTER TABLE association_profiles ADD COLUMN exec_since  TEXT;   -- تاريخ التعيين
ALTER TABLE association_profiles ADD COLUMN exec_type   TEXT;   -- متفرغ | غير متفرغ | متطوع | شاغر
-- المنصات: الحالة (غير مسجّلة | مسجّلة غير مفعّلة | مفعّلة) + مرجع الحساب + دليل التفعيل
ALTER TABLE association_profiles ADD COLUMN vol_status   TEXT;  -- المنصة الوطنية للعمل التطوعي
ALTER TABLE association_profiles ADD COLUMN vol_ref      TEXT;
ALTER TABLE association_profiles ADD COLUMN vol_last_on  TEXT;  -- تاريخ آخر فرصة تطوعية منشورة
ALTER TABLE association_profiles ADD COLUMN ehsan_status TEXT;  -- منصة إحسان
ALTER TABLE association_profiles ADD COLUMN ehsan_ref    TEXT;
-- تحقق الفريق: {مفتاح: {on, by, src}} لكل مجموعة بيانات، وتاريخ آخر مراجعة شاملة للملف
ALTER TABLE association_profiles ADD COLUMN verified_json    TEXT;
ALTER TABLE association_profiles ADD COLUMN data_verified_on TEXT;
