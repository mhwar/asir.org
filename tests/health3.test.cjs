// 0.89: ثلاث درجات منفصلة (البيانات/الفاعلية/التفاعل) وتبويبات ملف الجمعية المبنية عليها.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', (e) => errs.push(e.message));
  const boot = async () => { await p.goto(BASE + '/'); await p.waitForTimeout(800); await p.evaluate(() => go('admin')); await p.waitForTimeout(900); };
  await boot();
  const id = await p.evaluate(() => DB.filter((o) => !o.closed && o.st == 'ساري')[9].id);
  // 1) النموذج
  const m = await p.evaluate(() => { const W = (d) => HS_IND.filter((i) => i.dim == d).reduce((t, i) => t + i.w, 0); return { d: W('data'), a: W('act'), e: W('eng'), how: HS_IND.every((i) => i.how && i.src), g: HS_IND.filter((i) => i.dim == 'data').every((i) => HS_GRP[i.g]), n: HS_IND.length }; });
  ok(m.d == 110 && m.a == 100 && m.e == 100 && m.how && m.g, `three dimensions (data 110 raw incl. scope since 1.00, normalised to 100) (${m.n} indicators; every data group has an owner)`);
  // 2) التسجيل مقابل التفعيل
  const reg = await p.evaluate((id) => { const o = DBI[id], x0 = { ...o.hx }; const run = (hx) => { o.hx = { ...x0, ...hx }; const h = hsOf(o); const g = (k) => h.parts.find((p) => p.k == k); return { data: h.data, s: h.s, conf: h.conf, plat: g('d_plat').r, vol: g('a_vol') }; };
    const U = run({ vs: '', es: '', vl: '', vy: null, vo: null, vh: null }), R = run({ vs: 'مسجّلة غير مفعّلة', vl: '' }), A = run({ vs: 'مفعّلة', vl: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }), O = run({ vs: 'مفعّلة', vl: '2023-01-01', vy: 2023, vo: 3 }); o.hx = x0; return { U, R, A, O }; }, id);
  ok(reg.U.vol.st == 'unk' && reg.R.vol.r == .3 && reg.A.vol.r == 1 && reg.O.vol.r == .5, 'volunteer platform: unknown / registered 30% / active 100% / active long ago 50%');
  ok(reg.R.plat > reg.U.plat && reg.R.data > reg.U.data && reg.A.s > reg.R.s && reg.R.conf > reg.U.conf, `recording the status raises the data score; activation raises effectiveness; knowing raises confidence (${reg.U.conf}% → ${reg.R.conf}%)`);
  // 3) الفاعلية مستقلة عن البيانات، وغير المعروف محايد
  const neu = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o); const A = h.parts.filter((p) => p.dim == 'act'); const exp = Math.round(A.filter((p) => p.st != 'unk').reduce((t, p) => t + p.r * p.w, 0) + HS_NEUTRAL * A.filter((p) => p.st == 'unk').reduce((t, p) => t + p.w, 0));
    const x0 = o.hx; o.hx = { ...x0, ab: 1, pg: 1, bn: 50 }; const h1 = hsOf(o); o.hx = { ...x0, ab: 0, pg: 0, bn: null }; const h2 = hsOf(o); o.hx = x0; return { s: h.s, exp, act: h.actS, dunk: h.parts.filter((p) => p.dim == 'data' && p.st == 'unk').length, s1: h1.s, s2: h2.s, d1: h1.data, d2: h2.data }; }, id);
  ok(neu.s == neu.exp && neu.s == neu.act && neu.dunk == 0, `headline = effectiveness, unknown counted neutral (${neu.s}); missing data is zero, never «unknown»`);
  ok(neu.s2 == neu.s1 && neu.d2 < neu.d1, `removing the about text, programs and beneficiaries lowers the data score (${neu.d1} → ${neu.d2}) and leaves effectiveness unchanged`);
  // 4) الموثوقية
  const rel = await p.evaluate((id) => { const o = DBI[id], x0 = JSON.parse(JSON.stringify(o.hx || {})); const today = new Date().toISOString().slice(0, 10); const run = (ver, fl) => { o.hx = { ...x0, ver }; o.flagsN = fl; const h = hsOf(o); const c = h.parts.find((p) => p.k == 'd_con'); return { rel: c.rel, ok: c.relOk, data: h.data, conf: h.conf, q: h.q.f }; };
    const N = run({}, 0), V = run({ con: { on: today, src: 'زيارة' } }, 0), C = run({ con: { on: today, src: 'اتصال' } }, 0), Old = run({ con: { on: '2023-01-01', src: 'زيارة' } }, 0), F = run({}, 2); o.hx = x0; delete o.flagsN; return { N, V, C, Old, F }; }, id);
  ok(rel.V.rel == 1 && rel.V.ok && rel.C.rel == .85 && rel.Old.rel <= .7 && rel.N.rel <= .7, `reliability by source: visit 100%, call 85%, old check ${Math.round(rel.Old.rel * 100)}%, unverified ${Math.round(rel.N.rel * 100)}%`);
  ok(rel.V.data >= rel.N.data && rel.F.data < rel.N.data && rel.F.q < 1 && rel.F.conf < rel.N.conf, 'verification raises the data score; flags lower data and confidence');
  // 5) الخادم: المدير التنفيذي والمنصات
  const sv = await p.evaluate(async (id) => { try { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { execType: 'متفرغ', volSt: 'مفعّلة', volLast: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), ehsanSt: 'مسجّلة غير مفعّلة' }, contacts: { exec: 'مدير اختبار' } }) }); const f = await recFull(id); return { t: f.profile.execType, v: f.profile.volSt }; } catch (e) { return { err: e.message }; } }, id);
  ok(sv.t == 'متفرغ' && sv.v == 'مفعّلة', 'executive director and platform status saved on the server' + (sv.err ? ' ' + sv.err : ''));
  await boot();
  const after = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o), g = (k) => h.parts.find((p) => p.k == k); return { exec: g('a_exec').r, dexec: g('d_exec').r, vol: g('a_vol').r, keys: ['ab', 'pg', 'bn'].every((k) => k in o.hx), pii: JSON.stringify(o.hx).includes('مدير اختبار') }; }, id);
  ok(after.exec == 1 && after.dexec == 1 && after.vol == 1 && after.keys && !after.pii, 'payload carries the new facts (incl. profile presence) without names; indicators reflect them');
  // 6) تحقق الفريق
  await p.evaluate((id) => hsVerify(id, 'con'), id); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('#modal [data-ug]').length == 10 && $$('#modal [data-uc=src]').length == 5 && $('#modal [data-ug=con]').checked), 'verify dialog: 10 data groups (incl. scope), 5 sources, opened from a group preselects it');
  await p.evaluate(() => { $('#modal [data-usw=all]').click() }); await p.waitForTimeout(300); await p.click('#hsVGo'); await p.waitForTimeout(900);
  const vf = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o); return { n: Object.keys(o.hx.ver || {}).length, okAll: h.parts.filter((p) => p.dim == 'data' && p.r > 0).every((p) => p.relOk), rel: h.rel }; }, id);
  ok(vf.n >= 10 && vf.okAll && vf.rel >= 80, `full review: all 9 groups verified, reliability ${vf.rel}%`);
  // 7) صفحة الجمعية الموحّدة (1.10): جودة البيانات ومؤشر الجمعية، والبيانات بجدولها، والتقييم بمحاوره
  await p.evaluate((id) => open360(id), id); await p.waitForTimeout(1500);
  const pg = await p.evaluate(() => { const R = (t) => { ADM.a5tab = t; ADM.a6aud = 1; AM.assoc($('#acontent')) }; R('data'); const data = !!$('#a5data .a5t'); R('eval'); const ax = $$('.a5axw [data-a5ax]').length; R('rel'); const rel = !!$('#a5rel'); R('data'); return { nums: $$('.a6tabs [data-a6tab] span').length >= 2 ? 2 : 0, data, ax, rel } });
  ok(pg.nums == 2 && pg.data && pg.ax == 5 && pg.rel, 'unified file: data quality + index, data table, five evaluation axes, relation');
  ok(await p.evaluate((id) => { const h = hsOf(DBI[id]), X = a5Index(DBI[id], h, trCase(id)); const r = X.ax.find((a) => a.k == 'rel'); return r.rows.map((q) => q.k).join() == 'r_resp,r_eng,r_upd' && X.ax.find((a) => a.k == 'data').s == h.data }, id), 'axes reuse the existing indicators (relation: response, engagement, updates; data axis = data quality)');
  // 8) الانتقال من الأسماء القديمة
  await p.evaluate(() => a360Tab('data')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => Math.abs(document.getElementById('a5data').getBoundingClientRect().top) < 200), 'a360Tab("data") scrolls to the data section');
  // 10) التعثر: إنذارات الفاعلية تقود إلى حالة بأنواعها
  const ex = await p.evaluate(() => { const o = DB.find((x) => !x.closed && x.st == 'منتهي' && !trCase(x.id)); return o && o.id; });
  if (ex) {
    await p.evaluate((i) => open360(i), ex); await p.waitForTimeout(1500);
    ok(await p.evaluate((i) => { const h = hsOf(DBI[i]), X = a5Index(DBI[i], h, null); return h.s <= 39 && h.cap && X.s <= 39 && X.why.some((w) => /39/.test(w[0])) }, ex), 'governing requirement: expired licence caps both indices at 39 and says why');
    await p.evaluate((i) => trFlag(i, ['ترخيص منتهي', 'نقص الكوادر']), ex); await p.waitForTimeout(400);
    ok(await p.evaluate(() => $$('#trF [name=ty]:checked').map((x) => x.value).join() == 'ترخيص منتهي,نقص الكوادر'), 'case form opens with the warned types preselected');
    await p.evaluate(() => closeAll());
  } else ok(true, 'no expired association without a case (skipped)');
  // 11) المنهجية والتقرير
  await p.evaluate(() => hsMethod('data')); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('.hsmw .hsmt tbody tr').length == HS_IND.length + 7 && ['#hsm-act', '#hsm-data', '#hsm-eng'].every((s) => $(s))), 'method dialog: three sections, every indicator, and the reliability table');
  await p.evaluate(() => closeAll());
  const rp = await p.evaluate(() => rBuild('health').sections.map((s) => s.id));
  ok(['dims', 'axes', 'axes2', 'vol'].every((k) => rp.includes(k)), 'health report: three scores, effectiveness indicators, data groups, platforms');
  await p.evaluate(async (id) => { await api(`/api/associations/${id}/full`, { method: 'PUT', body: JSON.stringify({ profile: { execType: '', volSt: '', volLast: '', ehsanSt: '' }, contacts: { exec: '' } }) }) }, id);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
