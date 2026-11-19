-- 0025_scope — النطاق الجغرافي للجمعية: المقر (governorate_id) يبقى كما هو، ويُضاف أين تقدّم الجمعية خدماتها فعلاً
-- إضافة فقط: لا تُمس أي بيانات قائمة. الجمعيات التي لم تحدد نطاقها تبقى «لم يُحدَّد».
ALTER TABLE association_profiles ADD COLUMN scope_type TEXT;   -- hq | govs | region | national
ALTER TABLE association_profiles ADD COLUMN scope_govs TEXT;   -- JSON: محافظات النطاق عدا المقر (عند govs فقط)
ALTER TABLE association_profiles ADD COLUMN branches   TEXT;   -- فروع أو مكاتب أخرى (نص قصير)
