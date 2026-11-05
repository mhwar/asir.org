// ملفات الحوكمة في R2: صور أعضاء مجلس الإدارة (عامة) ووثائق المجلس (عامة أو داخلية).
// البيانات الوصفية (الاسم، الفئة، الدورة…) تُحفظ في app_state (asirDocs / asirBoard2) من اللوحة؛ هنا الملفات فقط.
import { fail } from './http.js';
import { audit } from './db.js';

const DOC_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx' };
const IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const rnd = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
const KEY_RE = /^(public\/(board|docs)|docs)\/[a-z0-9]+-[a-f0-9]{12}\.(pdf|png|jpg|webp|docx|xlsx|pptx)$/;

async function readForm(req, maxMb) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > maxMb * 1048576) fail(413, 'payload_too_large', `الحد ${maxMb} ميجابايت`);
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) fail(422, 'invalid', 'لم يُرفق ملف');
  if (file.size > maxMb * 1048576) fail(413, 'payload_too_large', `الحد ${maxMb} ميجابايت`);
  return { form, file };
}

/** صورة عضو: تُحفظ عامة دائماً (تظهر في الموقع). اللوحة تقصّها وتحوّلها webp قبل الرفع. */
export async function uploadBoardPhoto(env, req, user) {
  const { file } = await readForm(req, 4);
  const ext = IMG_TYPES[file.type]; if (!ext) fail(422, 'invalid', 'الصورة يجب أن تكون PNG أو JPG أو WebP');
  const key = `public/board/p${Date.now().toString(36)}-${rnd()}.${ext}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=86400' } });
  await audit(env, req, user.email, 'create', 'board_photos', key, null, { size: file.size });
  return { key, url: '/files/' + key, size: file.size };
}

/** وثيقة: vis=public → مسار عام يُقرأ بلا دخول، غير ذلك داخلي يتطلب صلاحية board. */
export async function uploadDoc(env, req, user) {
  const { form, file } = await readForm(req, 20);
  const ext = DOC_TYPES[file.type]; if (!ext) fail(422, 'invalid', 'نوع الملف غير مدعوم (PDF, Word, Excel, PowerPoint, صور)');
  const pub = form.get('vis') === 'public';
  const key = `${pub ? 'public/docs' : 'docs'}/d${Date.now().toString(36)}-${rnd()}.${ext}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type, contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(String(file.name || 'document'))}` }, customMetadata: { name: String(file.name || '').slice(0, 160) } });
  await audit(env, req, user.email, 'create', 'documents', key, null, { name: String(file.name || '').slice(0, 160), size: file.size, vis: pub ? 'public' : 'internal' });
  return { key, url: docUrl(key), size: file.size, type: file.type, name: String(file.name || '').slice(0, 160) };
}

export const docUrl = (key) => (key.startsWith('public/') ? '/files/' + key : '/api/docs/file/' + key);

/** تغيير الظهور = نقل الملف بين المسار العام والداخلي. */
export async function setDocVis(env, req, user, body) {
  const key = String(body.key || ''), pub = body.vis === 'public';
  if (!KEY_RE.test(key) || key.startsWith('public/board')) fail(404, 'not_found', 'الملف غير موجود');
  const isPub = key.startsWith('public/');
  if (isPub === pub) return { key, url: docUrl(key) };
  const o = await env.FILES.get(key); if (!o) fail(404, 'not_found', 'الملف غير موجود');
  const nk = pub ? key.replace(/^docs\//, 'public/docs/') : key.replace(/^public\/docs\//, 'docs/');
  await env.FILES.put(nk, o.body, { httpMetadata: o.httpMetadata, customMetadata: o.customMetadata });
  await env.FILES.delete(key);
  await audit(env, req, user.email, 'update', 'documents', key, { vis: isPub ? 'public' : 'internal' }, { vis: pub ? 'public' : 'internal', key: nk });
  return { key: nk, url: docUrl(nk) };
}

export async function deleteFile(env, req, user, key) {
  if (!KEY_RE.test(key)) fail(404, 'not_found', 'الملف غير موجود');
  await env.FILES.delete(key);
  await audit(env, req, user.email, 'delete', key.includes('/board/') ? 'board_photos' : 'documents', key);
  return { ok: true };
}

const headers = (o, download) => ({
  'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
  'Content-Disposition': download ? 'attachment' : (o.httpMetadata?.contentDisposition || 'inline'),
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
});

/** /files/public/... — بلا دخول (صور المجلس والوثائق العامة فقط). */
export async function servePublic(env, key, download) {
  if (!KEY_RE.test(key) || !key.startsWith('public/')) return null;
  const o = await env.FILES.get(key); if (!o) return null;
  return new Response(o.body, { headers: { ...headers(o, download), 'Cache-Control': 'public, max-age=600' } });
}

/** /api/docs/file/docs/... — داخلي، يتطلب صلاحية board. */
export async function serveInternal(env, key, download) {
  if (!KEY_RE.test(key) || key.startsWith('public/')) fail(404, 'not_found', 'الملف غير موجود');
  const o = await env.FILES.get(key); if (!o) fail(404, 'not_found', 'الملف غير موجود');
  return new Response(o.body, { headers: { ...headers(o, download), 'Cache-Control': 'private, max-age=300' } });
}
