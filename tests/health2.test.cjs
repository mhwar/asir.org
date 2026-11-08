// 0.87: مؤشر الصحة v2 — بعدان (سلامة البيانات / التفعيل)، التسجيل ≠ التفعيل، المدير التنفيذي، تحقق الفريق، المنهجية، درجة الثقة.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', (e) => errs.push(e.message));
  const boot = async () => { await p.goto(BASE + '/'); await p.waitForTimeout(800); await p.evaluate(() => go('admin')); await p.waitForTimeout(900); };
  await boot();
  const id = await p.evaluate(() => DB.filter((o) => !o.closed && o.st == 'ساري')[7].id);
  // 1) النموذج: الأوزان والبعدان
  const m = await p.evaluate(() => ({ d: HS_IND.filter((i) => i.dim == 'data').reduce((t, i) => t + i.w, 0), a: HS_IND.filter((i) => i.dim == 'act').reduce((t, i) => t + i.w, 0), n: HS_IND.length, how: HS_IND.every((i) => i.how && i.src) }));
  ok(m.d == 100 && m.a == 100 && m.how, `two dimensions each weighted to 100 (${m.n} indicators, each with method and source)`);
  // 2) التسجيل مقابل التفعيل: نفس الحقل يغيّر بعداً مختلفاً
  const reg = await p.evaluate((id) => { const o = DBI[id], x0 = { ...o.hx }; const run = (hx) => { o.hx = { ...x0, ...hx }; const h = hsOf(o); const g = (k) => h.parts.find((p) => p.k == k); return { data: h.data, act: h.actS, conf: h.conf, plat: g('d_plat').r, vol: g('a_vol') }; };
    const U = run({ vs: '', es: '', vl: '', vy: null, vo: null, vh: null }), R = run({ vs: 'مسجّلة غير مفعّلة', vl: '' }), A = run({ vs: 'مفعّلة', vl: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }), O = run({ vs: 'مفعّلة', vl: '2023-01-01', vy: 2023, vo: 3 }); o.hx = x0; return { U, R, A, O }; }, id);
  ok(reg.U.vol.st == 'unk' && reg.R.vol.r == .3 && reg.A.vol.r == 1 && reg.O.vol.r == .5, 'volunteer platform: unknown / registered 30% / active 100% / active long ago 50%');
  ok(reg.R.plat > reg.U.plat && reg.R.data > reg.U.data && reg.A.act > reg.R.act, 'recording the status raises data integrity; activation raises the activation dimension');
  ok(reg.R.conf > reg.U.conf, `knowing the status raises confidence (${reg.U.conf}% → ${reg.R.conf}%)`);
  // 3) غير معروف = قيمة محايدة في التفعيل، صفر في البيانات
  const neu = await p.evaluate((id) => { const h = hsOf(DBI[id]); const A = h.parts.filter((p) => p.dim == 'act'), K = A.filter((p) => p.st != 'unk'); const exp = Math.round(K.reduce((t, p) => t + p.r * p.w, 0) + HS_NEUTRAL * A.filter((p) => p.st == 'unk').reduce((t, p) => t + p.w, 0)); return { act: h.actS, exp, s: h.s, calc: Math.round(h.data * .4 + h.actS * .6), dunk: h.parts.filter((p) => p.dim == 'data' && p.st == 'unk').length }; }, id);
  ok(neu.act == neu.exp && neu.s == neu.calc && neu.dunk == 0, `index = 40% data + 60% activation, unknown activation counted neutral (${neu.s})`);
  // 4) حفظ المدير التنفيذي والمنصات عبر الخادم ثم إعادة التحميل
  const sv = await p.evaluate(async (id) => { try { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { execType: 'متفرغ', execSince: '2025-02-01', volSt: 'مفعّلة', volLast: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), ehsanSt: 'مسجّلة غير مفعّلة' }, contacts: { exec: 'مدير اختبار', execEmail: 'ed@example.org' } }) }); const f = await recFull(id); return { t: f.profile.execType, v: f.profile.volSt, e: f.contacts.exec } } catch (e) { return { err: e.message } } }, id);
  ok(sv.t == 'متفرغ' && sv.v == 'مفعّلة' && sv.e == 'مدير اختبار', 'executive director and platform status saved on the server' + (sv.err ? ' ' + sv.err : ''));
  const bad = await p.evaluate(async (id) => { try { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { volSt: 'نشطة جداً' } }) }); return 'accepted' } catch (e) { return e.message } }, id);
  ok(bad != 'accepted', 'unknown platform status rejected by the server');
  await boot();
  const after = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o), g = (k) => h.parts.find((p) => p.k == k); return { ex: o.hx.ex, exT: o.hx.exT, lead: g('d_lead').why, exec: g('a_exec').r, vol: g('a_vol').r, don: g('a_don').r, pii: JSON.stringify(o.hx).includes('مدير اختبار') || JSON.stringify(o.hx).includes('ed@example') }; }, id);
  ok(after.ex == 1 && after.exT == 'متفرغ' && after.exec == 1 && after.vol == 1 && after.don == .4, 'dashboard payload carries the new facts; indicators reflect them');
  ok(!after.pii, 'payload facts carry no executive name or email (only presence)');
  // 5) تحقق الفريق
  await p.evaluate((id) => hsVerify(id), id); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && $$('#modal [data-ug]').length == 8 && $$('#modal [data-uc=src]').length == 5), 'verify dialog: 8 data groups and 5 sources');
  await p.evaluate(() => { const s = $('#modal [data-usw=all]'); s.click() }); await p.waitForTimeout(300); await p.click('#hsVGo'); await p.waitForTimeout(900);
  const vf = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o); return { dv: o.hx.dv, ver: Object.keys(o.hx.ver || {}).length, r: h.parts.find((p) => p.k == 'd_ver').r }; }, id);
  ok(vf.dv && vf.ver >= 8 && vf.r == 1, 'full review recorded: all groups verified, «التحقق والحداثة» complete');
  // 6) البطاقة والمنهجية
  await p.evaluate((id) => { open360(id); setTimeout(() => { a360Tab('dev'); const c = $('#a3-score'); if (c && c.classList.contains('fold')) a360Toggle('score') }, 400) }, id); await p.waitForTimeout(1600);
  const card = await p.evaluate(() => ({ g: $$('#a3-score .hsg').length, i: $$('#a3-score .hsi').length, conf: /ثقة/.test($('#a3-score .hsfx').textContent), how: !!$('#a3-score .hsfx .lnk'), vf: /تحقق الفريق من/.test($('#a3-score .hsvf').textContent) }));
  ok(card.g == 2 && card.i == 16 && card.conf && card.how && card.vf, 'health card: two dimension groups, 16 indicators, confidence, method link, verification line');
  await p.evaluate(() => hsMethod()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('.hsmw .hsmt tbody tr').length == 16 && /مسجّلة/.test($('.hsmw').textContent) && /درجة الثقة/.test($('.hsmw').textContent)), 'method dialog explains all 16 indicators, registered vs active, and confidence');
  await p.evaluate(() => closeAll());
  // 7) نموذج التعديل والبوابة
  await p.evaluate((id) => recEdit(id, 'plat'), id); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!$('[data-rp=plat] [name="p.volSt"]') && !!$('[name="c.exec"]') && !!$('[name="p.execType"]') && $('[name="p.volSt"]').value == 'مفعّلة' && $('[name="c.exec"]').value == 'مدير اختبار'), 'edit form: platforms section and executive director fields, prefilled');
  await p.evaluate(() => closeAll());
  ok(await p.evaluate(() => ['exec', 'execType', 'execSince', 'volSt', 'volRef', 'volLast', 'ehsanSt'].every((k) => PF.some((f) => f.k == k)) && PSEC.some((x) => x[0] == 'plat')), 'update link form asks for executive director and platform status');
  // 8) تقرير الصحة
  const rp = await p.evaluate(() => { const R = rBuild('health'); return R.sections.map((s) => s.id) });
  ok(['dims', 'axes', 'axes2', 'vol'].every((k) => rp.includes(k)), 'health report: dimensions, both indicator groups, registered vs active');
  // تنظيف
  await p.evaluate(async (id) => { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { execType: '', execSince: '', volSt: '', volLast: '', ehsanSt: '' }, contacts: { exec: '', execEmail: '' } }) }) }, id);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
