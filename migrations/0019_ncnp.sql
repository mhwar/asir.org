-- 0019_ncnp — بيانات من دليل الكيانات في المركز الوطني لتنمية القطاع غير الربحي (es.ncnp.gov.sa)
-- تُعبّأ في الحقول الفارغة فقط، وتُعلَّم «بانتظار تأكيد الجمعية» حتى يُعتمد أول طلب تحديث بعدها.
ALTER TABLE association_profiles ADD COLUMN phone_official TEXT;     -- الهاتف الرسمي (قد يكون أرضياً)
ALTER TABLE association_profiles ADD COLUMN address        TEXT;     -- العنوان كما في السجل الوطني
ALTER TABLE association_profiles ADD COLUMN postal_code    TEXT;
ALTER TABLE association_profiles ADD COLUMN po_box         TEXT;
ALTER TABLE association_profiles ADD COLUMN fax            TEXT;
ALTER TABLE association_profiles ADD COLUMN donate_url     TEXT;     -- موقع التبرعات
ALTER TABLE association_profiles ADD COLUMN gov_score      REAL;     -- درجة الحوكمة المنشورة (%)
ALTER TABLE association_profiles ADD COLUMN gov_score_year INTEGER;
ALTER TABLE association_profiles ADD COLUMN ncnp_id        INTEGER;  -- رقم الكيان في دليل المركز الوطني
ALTER TABLE association_profiles ADD COLUMN ncnp_class     TEXT;     -- التصنيف النوعي
ALTER TABLE association_profiles ADD COLUMN ncnp_subclass  TEXT;     -- التصنيف الفرعي الأول
ALTER TABLE association_profiles ADD COLUMN ncnp_synced_at TEXT;
ALTER TABLE association_profiles ADD COLUMN ncnp_pending   TEXT;     -- JSON: الحقول المعبّأة من السجل الوطني بانتظار تأكيد الجمعية
