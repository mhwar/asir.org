// 0.83: أنواع المشاريع المرتبطة بأدوات المنصة: قالب لكل نوع (مستفيدون من البيانات، مقياس أثر، مراحل، مخرجات)، أدوات المشروع، الدعم المهني الجماعي، المقترحات.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  await p.evaluate(() => { PROJS = PROJS.filter((x) => !x.__t && x.trType != 'تعثر مالي'); pjSave(); goMod('projects'); }); await p.waitForTimeout(800);
  // 1) الكتالوج
  const cat = await p.evaluate(() => ({ n: Object.keys(PJ_KINDS).length, has: ['data', 'lic', 'trouble', 'board', 'exec', 'fin', 'hr', 'dig', 'custom'].every((k) => PJ_KINDS[k]), tools: Object.values(PJ_KINDS).every((K) => K.tools.every((t) => PJ_TOOLS[t])), who: pjWho('data').length, lic: pjWho('lic').length }));
  ok(cat.n >= 12 && cat.has && cat.tools, 'catalog: 12+ kinds (data, licences, trouble, boards, executives, accountants, HR, digital…) all with valid tools');
  ok(cat.who > 0 && cat.lic > 0, `beneficiary rules compute from platform data (data: ${cat.who}, lic: ${cat.lic})`);
  ok(await p.evaluate(() => !!$('.pjsgp') && $$('.pjsgp .pb>div').length >= 1), 'projects list shows «مشاريع تقترحها بيانات اليوم»');
  // 2) إنشاء مشروع من نوع «تحديث البيانات» مع المستفيدين المقترحين
  await p.evaluate(() => pjCreate({ kind: 'data' })); await p.waitForTimeout(500);
  const d = await p.evaluate(() => ({ on: $('#modal').classList.contains('on'), cards: $$('.pjcw [data-uc=kind]').length, sel: ($('.pjcw [data-uc=kind].on') || {}).dataset.v, sw: !!$('.pjcw [data-usw=inc]'), swOn: ($('.pjcw [data-usw=inc]') || {}).checked, name: $('#pjN').value, est: $('#pjGoE').textContent, info: /مقياس الأثر/.test($('.pjkinfo').textContent) }));
  ok(d.on && d.cards >= 12 && d.sel == 'data' && d.sw && d.swOn && /تحديث البيانات/.test(d.name) && /مستفيد/.test(d.est) && d.info, 'create dialog: kind cards, prefilled name, beneficiaries switch on, impact/expectations info');
  await p.evaluate(() => { $('#pjN').value = 'اختبار تحديث البيانات'; $('#pjO').value = 'سلطان'; }); await p.click('#pjGo'); await p.waitForTimeout(900);
  const c1 = await p.evaluate(() => { const pj = PROJS.find((x) => x.n == 'اختبار تحديث البيانات'); if (pj) pj.__t = 1; const W = pjWho('data').length; return { ok: !!pj, kind: pj && pj.kind, benef: pj ? pj.benef.length : 0, W, phases: pj ? pj.phases.map((f) => f.t) : [], outs: pj ? pj.outs.length : 0, base: pj && pj.base ? pj.base.v : null, open: ADM.mod == 'proj' }; });
  ok(c1.ok && c1.kind == 'data' && c1.benef == c1.W && c1.benef > 0, `project created with ${c1.benef} beneficiaries from the rule`);
  ok(c1.phases.length == 3 && c1.phases[0] == 'حصر وإرسال' && c1.outs == 2 && c1.base != null, 'kind phases/outputs applied and baseline captured');
  ok(c1.open && await p.evaluate(() => /الأثر/.test($('.pjbody').textContent) && $$('.pjbody .pjtb').length == 3 && /كان /.test($('.pjbody .pjimp').textContent) && !!$('#jstick .jback') && !!$('.a3need')), 'project opens as a full page with back link, «ماذا الآن», impact block and 3 kind tools');
  await p.screenshot({ path: 'tests/out/pjkinds.png', fullPage: true });
  // 3) تبويب المستفيدين: عمود القياس والنتيجة
  await p.evaluate(() => { ADM.pjTab = 'bn'; pjOpen(PROJS.find((x) => x.__t).id); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $$('.pjbody thead th').length == 7 && $$('.pjbody tbody tr').length > 0 && /اكتمال/.test($('.pjbody thead').textContent)), 'beneficiaries tab: metric and outcome columns');
  // 4) أداة الحملة من المشروع تربط الحملة به
  await p.evaluate(() => { ADM.pjTab = 'ov'; pjOpen(PROJS.find((x) => x.__t).id); }); await p.waitForTimeout(400);
  await p.evaluate(() => pjTool(PROJS.find((x) => x.__t).id, 'campaign')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && /حملة جديدة/.test($('#modal').textContent) && /اختبار تحديث البيانات/.test($('#cpF [name=n]').value)), 'campaign tool opens the campaign form named after the project');
  await p.evaluate(() => closeAll());
  // 5) الدعم المهني الجماعي: مشروع «رفع كفاءة المحاسبين» بمستفيدين يدويين
  const c2 = await p.evaluate(() => { const ids = DB.filter((o) => !o.closed).slice(0, 3).map((o) => o.id); const pj = pjNew({ n: 'اختبار المحاسبين', kind: 'fin', phases: PJ_KINDS.fin.phases, outs: PJ_KINDS.fin.outs, benef: ids }); pj.__t = 1; PROJS.push(pj); pjSave(); PRO.needs = PRO.needs.filter((n) => !ids.includes(n.aid) || n.area != 2); proSave(); pjTool(pj.id, 'pro'); return ids.length; });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && $$('.pjnw [data-ug]').length == 3 && /3 احتياج/.test($('#pjNGoE').textContent)), 'pro-support tool lists beneficiaries without an open need in the finance area');
  await p.click('#pjNGo'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const pj = PROJS.find((x) => x.n == 'اختبار المحاسبين'); const N = PRO.needs.filter((n) => n.pid == pj.id); return N.length == 3 && N.every((n) => n.area == 2 && n.src == 'project') && pjLinked(pj).needs.length == 3; }), '3 needs created, linked to the project (area: finance)');
  ok(await p.evaluate(() => ADM.mod == 'proj' && /3 احتياج دعم مهني/.test($('.pjbody').textContent)), 'project page lists the linked needs');
  // 6) مجتمع من المشروع يُربط به
  await p.evaluate(() => { const pj = PROJS.find((x) => x.n == 'اختبار المحاسبين'); cmEdit(null, { pid: pj.id, kind: 'program', n: 'دفعة المحاسبين', goal: pj.goal }); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $('#ceF2 [name=n]').value == 'دفعة المحاسبين'), 'community form prefilled from the project');
  await p.evaluate(() => $('#ceF2').requestSubmit()); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const pj = PROJS.find((x) => x.n == 'اختبار المحاسبين'); const c = COMMS.list.find((x) => x.pid == pj.id); if (c) c.__t = 1; return !!c && pjLinked(pj).comms.length == 1; }), 'community created and linked to the project');
  // 7) مشروع التعثر الجماعي يحمل النوع
  const tr = await p.evaluate(() => { const ids = DB.filter((o) => !o.closed).slice(5, 7).map((o) => o.id); TRB.cases = TRB.cases.filter((c) => !ids.includes(c.aid)); ids.forEach((a) => trNew(a, { types: ['تعثر مالي'], sev: 'عالية' })); trSave(); trProject(ids, 'تعثر مالي'); return ids; });
  await p.waitForTimeout(400); await p.click('#trPGo'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const pj = PROJS.find((x) => x.trType == 'تعثر مالي'); if (pj) pj.__t = 1; return !!pj && pj.kind == 'trouble' && pj.phases[0].t == 'تشخيص مشترك' && pjMetric(pj).n == 2; }), 'group trouble project is kind «معالجة التعثر» with its phases and a measurable metric');
  // 8) قائمة المشاريع: فلتر النوع
  await p.evaluate(() => { closeAll(); goMod('projects'); }); await p.waitForTimeout(500);
  await p.evaluate(() => $$('[data-pk]').find((x) => x.dataset.pk == 'fin').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('#acontent tbody tr[data-pj]').length == 1 && /المحاسبين/.test($('#acontent tbody').textContent)), 'kind filter narrows the list');
  // تنظيف
  await p.evaluate((tr) => { ADM.pjK = ''; PROJS = PROJS.filter((x) => !x.__t); pjSave(); PRO.needs = PRO.needs.filter((n) => n.src != 'project'); proSave(); COMMS.list = COMMS.list.filter((c) => !c.__t); cmSave(); TRB.cases = TRB.cases.filter((c) => !tr.includes(c.aid)); trSave(); CAMPS.list = CAMPS.list.filter((c) => !/اختبار/.test(c.n)); SS('asirCamps', CAMPS); }, tr);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
