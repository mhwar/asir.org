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
  ok(m.d == 100 && m.a == 100 && m.e == 100 && m.how && m.g, `three dimensions each weighted to 100 (${m.n} indicators; every data group has an owner)`);
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
  ok(await p.evaluate(() => $$('#modal [data-ug]').length == 9 && $$('#modal [data-uc=src]').length == 5 && $('#modal [data-ug=con]').checked), 'verify dialog: 9 data groups, 5 sources, opened from a group preselects it');
  await p.evaluate(() => { $('#modal [data-usw=all]').click() }); await p.waitForTimeout(300); await p.click('#hsVGo'); await p.waitForTimeout(900);
  const vf = await p.evaluate((id) => { const o = DBI[id], h = hsOf(o); return { n: Object.keys(o.hx.ver || {}).length, okAll: h.parts.filter((p) => p.dim == 'data' && p.r > 0).every((p) => p.relOk), rel: h.rel }; }, id);
  ok(vf.n >= 9 && vf.okAll && vf.rel >= 80, `full review: all 9 groups verified, reliability ${vf.rel}%`);
  // 7) صفحة الجمعية: ثلاثة تبويبات بدرجاتها
  await p.evaluate((id) => open360(id), id); await p.waitForTimeout(1500);
  const pg = await p.evaluate(() => ({ tabs: $$('.a3tabs [role=tab]').map((t) => t.textContent.trim().slice(0, 9)), sc: $$('.a3tabs .a3ts').length, on: $('.a3tabs [aria-selected=true]').textContent, mini: $$('.a3mini button').length, cards: $$('.a3grid .a3c').map((c) => c.dataset.c) }));
  ok(pg.tabs.length == 3 && pg.sc == 3 && pg.mini == 2, `three tabs each with its score; header shows effectiveness plus data and relation (${pg.tabs.join(' | ')})`);
  ok(/الفاعلية/.test(pg.on) && ['score', 'trouble', 'req', 'diag'].every((k) => pg.cards.includes(k)), 'admin opens on «الفاعلية»: effectiveness, trouble, requirements, diagnosis');
  await p.evaluate(() => a360Tab('data')); await p.waitForTimeout(400);
  const dt = await p.evaluate(() => { const c = $('#a3-dprof'); if (c && c.classList.contains('fold')) a360Toggle('dprof'); return { cards: $$('.a3grid .a3c').map((c) => c.dataset.c), items: $$('#a3-dprof .hsi').length, rl: $$('#a3-dprof .hsrl').length, hd: /الاكتمال/.test($('#a3-dprof .hshd').textContent) && /الموثوقية/.test($('#a3-dprof .hshd').textContent) }; });
  ok(['dprof', 'lic', 'contact', 'quality', 'pub'].every((k) => dt.cards.includes(k)) && dt.items == 8 && dt.rl > 0 && dt.hd, 'data tab: completeness & reliability card with 8 groups, each with its source; licence, contact, quality, public profile');
  await p.evaluate(() => a360Tab('rel')); await p.waitForTimeout(400);
  ok(await p.evaluate(() => ['eng', 'rel', 'eco'].every((k) => $$('.a3grid .a3c').some((c) => c.dataset.c == k)) && $$('#a3-eng .hsi').length == 3), 'relation tab: engagement score (3 indicators), contact log and links, ecosystem');
  // 8) نافذة الدرجات تنقل إلى التبويب
  await p.evaluate((id) => hsPeek(id, $('.hspk')), id); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $$('#hsPk .hspr').length == 3), 'score popover: three rows (effectiveness, data, relation)');
  await p.evaluate(() => $$('#hsPk .hspr')[1].click()); await p.waitForTimeout(600);
  ok(await p.evaluate(() => /البيانات/.test($('.a3tabs [aria-selected=true]').textContent)), 'clicking the data row opens the data tab');
  // 9) التخصيص: نقل بطاقة إلى تبويب آخر وإخفاء أخرى
  await p.evaluate(() => { uiMemSet('a360lay', { req: 'data', eco: 'hide' }); a360Tab('data') }); await p.waitForTimeout(400);
  const lay = await p.evaluate(() => { const d = $$('.a3grid .a3c').map((c) => c.dataset.c); a360Tab('rel'); const r = $$('.a3grid .a3c').map((c) => c.dataset.c); return { d, r }; });
  ok(lay.d.includes('req') && !lay.r.includes('eco'), 'layout is customisable: a card moved to another tab, another hidden');
  await p.evaluate(() => a360Layout()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('.a3lay .uiseg').length == A360_CARDS.length), 'layout dialog lists every card with tab choices');
  await p.evaluate(() => { closeAll(); uiMemSet('a360lay', {}) });
  // 10) التعثر: إنذارات الفاعلية تقود إلى حالة بأنواعها
  const ex = await p.evaluate(() => { const o = DB.find((x) => !x.closed && x.st == 'منتهي' && !trCase(x.id)); return o && o.id; });
  if (ex) {
    await p.evaluate((i) => { open360(i); setTimeout(() => { a360Tab('eff'); const c = $('#a3-trouble'); if (c && c.classList.contains('fold')) a360Toggle('trouble') }, 400) }, ex); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => /ترخيص منتهي/.test($('#a3-trouble .a3tw').textContent) && !!$('#a3-trouble .a3ta button')), 'expired licence shows as a trouble warning with «open a case with these types»');
    ok(await p.evaluate((i) => { const h = hsOf(DBI[i]); return h.s <= 39 && h.cap && h.band[1] == 'حرجة' && !!$('#a3-score .hscap'); }, ex), 'governing requirement: expired licence caps effectiveness at 39 (critical) and says why');
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
