-- 0007_import_notes — ملاحظات جودة من ملف المجلس الأصلي (مثل عناوين test.com التي أُزيلت عند الاستيراد)
ALTER TABLE association_contacts ADD COLUMN import_notes TEXT;
