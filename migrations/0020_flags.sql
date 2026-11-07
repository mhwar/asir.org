-- 0020_flags — علامات «بيانات تحتاج تحقق» على حقل بعينه في ملف الجمعية.
-- تُخزَّن كملاحظات داخلية لها نوع: assumed (قيمة افتراضية مؤقتة)، verify (تحتاج تأكيد)، missing (ناقصة تحتاج بحث)، conflict (تعارض مع مصدر آخر).
-- الملاحظة العادية kind = NULL. تُغلق العلامة يدوياً («تأكدنا منها») أو تلقائياً عند تعديل الحقل نفسه.
ALTER TABLE association_notes ADD COLUMN kind TEXT;
CREATE INDEX ix_notes_flags ON association_notes(status, kind);
