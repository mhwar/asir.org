# المنصة الفعلية — المرحلة 1

البنية: **Cloudflare Worker** واحد يخدم الموقع ولوحة التحكم ويقدّم الواجهة البرمجية، فوق قاعدة **D1** وتخزين **R2**، والدخول عبر **Cloudflare Access** برمز يصل على البريد.

```
المتصفح ──► Cloudflare Access (رمز على البريد) ──► Worker ──► D1 (asir-council)
                                                   │        └─► R2 (asir-council-assets)
                                                   └─► dist/site/index.html + حقن البيانات الحية
```

## الموارد المنشأة

| المورد | الاسم | المعرّف |
|---|---|---|
| قاعدة البيانات D1 | `asir-council` | `83817b3e-4f04-4b32-9017-2691066c2ab2` |
| تخزين R2 | `asir-council-assets` | — |
| Worker | `asir-council` | يُنشأ عند أول نشر |

الحالة الحالية لقاعدة البيانات: الترحيلان `0001_init` و`0002_roles` مطبّقان، و539 جمعية مستوردة (الحقول العامة وتواريخ التراخيص فقط، **بلا أي بيانات تواصل**)، وحساب مدير النظام مسجّل.

## خطوات التشغيل (مرة واحدة)

1. **ربط المستودع بالنشر التلقائي**
   Cloudflare → Workers & Pages → Create → Import a repository → اختر `mhwar/asir.org`.
   - Build command: اتركه فارغاً (الـ `[build]` في `wrangler.toml` يشغّل `python3 build.py --deploy`)
   - Deploy command: `npx wrangler deploy`

   بعدها كل دفع إلى `main` يُنشر تلقائياً على `asir-council.<حسابك>.workers.dev`.

2. **الدخول المؤقت (رمز المعاينة) — مفعّل الآن**
   إلى أن يُضبط Cloudflare Access، تطلب المنصة رمز معاينة. الرمز لا يُحفظ في المستودع؛ يُخزَّن في قاعدة البيانات مُجزّأً (SHA-256 مع ملح)، والجلسة كعكة موقّعة (HMAC) صالحة 7 أيام، و8 محاولات خاطئة خلال 15 دقيقة تُوقف المحاولة من العنوان نفسه. كل دخول ومحاولة فاشلة تُسجَّل.
   لتغيير الرمز: احسب `sha256(salt + ':' + الرمز)` وحدّث `preview_code_hash` في جدول `settings`. لإلغاء كل الجلسات: غيّر `session_key`.
   عند ضبط `ACCESS_TEAM_DOMAIN` و`ACCESS_AUD` يتوقف رمز المعاينة تلقائياً ويصبح الدخول بالبريد.

3. **تفعيل الدخول بالبريد (لاحقاً)**
   Worker `asir-council` → Settings → Domains & Routes → workers.dev → **Enable Cloudflare Access**.
   ثم في Zero Trust → Access → Applications → التطبيق الذي أُنشئ:
   - Policy: **Allow** · Include → **Emails** → بريد مدير النظام المعتمد
   - Login methods: **One-time PIN**
   - انسخ **Application Audience (AUD) Tag**، واسم الفريق من Zero Trust → Settings (مثل `xxxx.cloudflareaccess.com`).

4. **ضبط المتغيرين** في `wrangler.toml` ثم الدفع:
   ```toml
   ACCESS_TEAM_DOMAIN = "xxxx.cloudflareaccess.com"
   ACCESS_AUD = "…"
   ```
   قبل ضبطهما يعمل رمز المعاينة؛ وإن لم يوجد رمز ولا Access يرفض الـ Worker كل الطلبات (مغلق افتراضياً).

## الأمان

- **قفلان:** Access يسمح للبريد المعتمد فقط، والـ Worker يتحقق من توقيع رمز Access ثم من وجود البريد في جدول `users` ونشاط دوره. خطأ في إعداد Access وحده لا يفتح المنصة.
- **SITE_MODE=private:** لا يُقدَّم أي ملف أو بيانات دون دخول. عند فتح الموقع للعامة (المرحلة 2) يصبح `public`: الصفحة و`/api/public/*` للجميع، وبيانات اللوحة تبقى خلف الدخول.
- **التدقيق:** كل إنشاء أو تعديل أو حذف أو دخول يُسجَّل في `audit_log` مع القيمة قبل وبعد.
- **التحقق من المدخلات:** الحقول القابلة للتعديل محددة، والتواريخ والمراجع تُفحص، والحذف منطقي فقط.
- **بيانات التواصل:** جدول `association_contacts` موجود وفارغ، ولا يُعرض في أي واجهة عامة. لا يُملأ إلا بقرار من الفريق.

## الواجهة البرمجية

| الطريقة | المسار | الصلاحية |
|---|---|---|
| GET | `/api/health` | عام |
| GET | `/api/me` | أي مستخدم |
| GET | `/api/lookups` | أي مستخدم |
| GET | `/api/associations?q=&governorate_id=&supervisor_id=&license_state=` | `directory` قراءة |
| GET | `/api/associations/:id` | `directory` قراءة (+ السجل لمن يملك الكتابة) |
| POST | `/api/associations` | `directory` كتابة |
| PATCH | `/api/associations/:id` | `directory` كتابة |
| DELETE | `/api/associations/:id` | `directory` كتابة (حذف منطقي) |
| GET | `/api/audit?entity=&entity_id=` | `roles` |
| GET | `/api/public/associations` · `/api/public/lookups` | عام عند `SITE_MODE=public` |

## إضافة مستخدم أو تفعيل دور لاحقاً

```sql
-- تفعيل دور مؤجل
UPDATE roles SET is_active = 1 WHERE key = 'analyst';
-- إضافة مستخدم
INSERT INTO users (email, name_ar, role_key) VALUES ('name@example.com', 'الاسم', 'analyst');
```
ثم أضف البريد نفسه إلى سياسة Access.

## التطوير المحلي

```bash
npm i
cp .dev.vars.example .dev.vars          # ضع بريدك المعتمد
npm run db:migrate:local && npm run seed && npm run db:seed:local
npx wrangler d1 execute asir-council --local --command "INSERT INTO users(email,name_ar,role_key) VALUES('you@example.com','أنت','admin')"
npm run dev                              # http://127.0.0.1:8787
NODE_PATH=$(npm root -g) node tests/platform.test.cjs
```

## تغيير قاعدة البيانات

كل تغيير في البنية ترحيل جديد مرقّم في `migrations/` (لا يُعدَّل ترحيل مطبّق):
```bash
npx wrangler d1 migrations create asir-council add_gaps
npx wrangler d1 migrations apply asir-council --remote
```
