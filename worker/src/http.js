// HTTP helpers: JSON responses, errors, security headers.

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function withHeaders(res, extra = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra },
  });
}

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const fail = (status, code, message, details) => { throw new HttpError(status, code, message, details); };

export function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  console.error(err);
  return json({ error: { code: 'internal', message: 'حدث خطأ غير متوقع' } }, 500);
}

export async function readJson(req, maxBytes = 64 * 1024) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > maxBytes) fail(413, 'payload_too_large', 'حجم الطلب أكبر من المسموح');
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'payload_too_large', 'حجم الطلب أكبر من المسموح');
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, 'bad_json', 'صيغة JSON غير صحيحة'); }
}
