-- 0006_board_members — أعضاء مجلس إدارة الجمعية (داخلي، ضمن بيانات التواصل والقيادة)
-- JSON: [{ "name": "", "role": "", "email": "", "mobile": "" }]
ALTER TABLE association_contacts ADD COLUMN board_json TEXT;
ALTER TABLE association_contacts ADD COLUMN president_mobile TEXT;
