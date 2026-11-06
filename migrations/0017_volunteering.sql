-- 0017_volunteering — أرقام التطوع كما تبلغ عنها الجمعية من حسابها في المنصة الوطنية للعمل التطوعي
ALTER TABLE association_profiles ADD COLUMN vol_hours INTEGER;  -- ساعات التطوع خلال السنة
ALTER TABLE association_profiles ADD COLUMN vol_opps  INTEGER;  -- الفرص التطوعية المطروحة خلال السنة
ALTER TABLE association_profiles ADD COLUMN vol_year  INTEGER;  -- السنة التي تخصها الأرقام
