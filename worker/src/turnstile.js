// Cloudflare Turnstile: تحقق من أن مرسل النماذج العامة ليس برنامجاً آلياً، دون اختبار يحلّه الزائر غالباً.
// يعمل فقط متى وُجد السرّان TURNSTILE_SITE_KEY و TURNSTILE_SECRET (يُضافان من لوحة Cloudflare › Worker › Settings › Variables and Secrets).
// بدونهما يبقى النموذج كما هو (حد الرسائل لكل عنوان + حقل الفخ).
import { fail } from './http.js';

export const enabled = (env) => !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

/** وسم يُحقن في الصفحة ليعرف الكود أن التحقق مفعّل */
export const meta = (env) => (enabled(env) ? `<meta name="ts-key" content="${String(env.TURNSTILE_SITE_KEY).replace(/[^\w-]/g, '')}">` : '');

/** يعيد 'ok' أو 'skip' (غير مفعّل) أو 'unverified' (تعذّر الوصول لخدمة التحقق)، ويرفض الرمز الناقص أو المرفوض */
export async function verify(env, req, token) {
  if (!enabled(env)) return 'skip';
  if (!token || typeof token !== 'string' || token.length > 2048) fail(403, 'captcha', 'تعذّر التحقق من الإرسال. أعد المحاولة.');
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = req.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  let r;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    r = await res.json();
  } catch {
    // خدمة التحقق غير متاحة: لا نوقف نماذج المجلس، ويبقى حد الرسائل لكل عنوان قائماً، ويُعلَّم الطلب
    return 'unverified';
  }
  if (!r || !r.success) fail(403, 'captcha', 'تعذّر التحقق من الإرسال. أعد المحاولة.');
  return 'ok';
}
