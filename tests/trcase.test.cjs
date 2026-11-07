// 0.82: إدارة حالة التعثر صفحةً كاملة: المسار بمراحل وشروط، التشخيص بالأدلة، الخطة، التدخلات المرتبطة بالأدوات، الإغلاق بالنتيجة والدرس، أنماط التعثر ومشروع معالجة جماعي.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  // حالة نظيفة: جمعيتان ساريتان بلا حالات، ولا مشاريع معالجة سابقة
  const [A, B] = await p.evaluate(() => { TRB.cases = []; trSave(); PROJS = PROJS.filter((x) => !x.trType); pjSave(); const L = DB.filter((o) => !o.closed && o.st == 'ساري').slice(0, 2).map((o) => o.id); return L; });
  // 1) تسجيل حالة من ملف الجمعية ثم فتحها: صفحة كاملة لا قائمة جانبية
  await p.evaluate((A) => { trNew(A, { src: 'team', types: ['ضعف الحوكمة أو مجلس الإدارة', 'انقطاع التواصل وعدم التجاوب'], sev: 'عالية', det: 'لم يُعقد اجتماع للمجلس منذ عام' }); trSave(); trOpen(A); }, A); await p.waitForTimeout(900);
  const pg = await p.evaluate(() => ({ mod: ADM.mod, drawer: $('#adrawer').classList.contains('on'), back: ($('#jstick .jback button') || {}).textContent, pipe: $$('.trpipe>div').length, cur: ($('.trpipe .cur b') || {}).textContent, head: !!$('.a3h.trh'), need: !!$('.a3need'), rail: !!$('.a3rail'), pri: ($('.a3a .jbtn.pri') || {}).textContent, dark: !!$('#adrawer.trw') }));
  ok(pg.mod == 'trcase' && !pg.drawer && !pg.dark, 'trOpen opens a full page, not the old drawer');
  ok(/العودة إلى الجمعيات المتعثرة/.test(pg.back), 'header back link returns to the trouble list');
  ok(pg.pipe == 6 && pg.cur == 'رصد' && pg.head && pg.need && pg.rail, 'page: 6-stage pipeline at «رصد», identity header, «ماذا الآن», case rail');
  ok(/الانتقال إلى تشخيص/.test(pg.pri), 'primary is contextual: «الانتقال إلى تشخيص» at «رصد»');
  await p.screenshot({ path: 'tests/out/trcase.png', fullPage: true });
  // 2) بوابة المرحلة: لا انتقال بلا سبب جذري
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate((A) => trCase(A).stage == 'diag', A), '«رصد» → «تشخيص» is free');
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate((A) => trCase(A).stage == 'diag', A), 'advance blocked without a root cause');
  await p.fill('#trCause', 'غادر المفوض ولم يُعيَّن بديل، والبريد المسجّل لا يُفتح'); await p.click('#trCauseSave'); await p.waitForTimeout(500);
  ok(await p.evaluate((A) => trCase(A).cause.length > 10 && /السبب مسجّل/.test($('[data-c=diag] .a3hs').textContent), A), 'root cause saved and shown in the diagnosis header');
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate((A) => trCase(A).stage == 'plan', A), 'with a cause the case advances to «خطة معالجة»');
  // 3) الخطة: هدف بمهلة ومسؤول
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(200);
  ok(await p.evaluate((A) => trCase(A).stage == 'plan', A), 'cannot leave the plan without an objective');
  await p.fill('#trPlanF [name=t]', 'تعيين مفوض جديد وتحديث بيانات التواصل'); await p.fill('#trPlanF [name=owner]', 'أحمد'); await p.fill('#trPlanF [name=due]', '2026-12-15'); await p.click('#trPlanF button'); await p.waitForTimeout(500);
  ok(await p.evaluate((A) => { const c = trCase(A); return c.plan.length == 1 && c.owner == 'أحمد' && $$('.trplan li').length == 1; }, A), 'objective added, first owner becomes case owner');
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate((A) => trCase(A).stage == 'act', A), 'advances to «تنفيذ التدخلات»');
  // 4) التدخلات: نافذة بالمكوّنات تفتح أداة المنصة وتسجّل التدخل
  await p.evaluate((A) => trIntAdd(A, 'update'), A); await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ on: $('#modal').classList.contains('on'), cards: $$('.triw [data-uc=k]').length, sel: ($('.triw [data-uc=k].on') || {}).dataset.v }));
  ok(d.on && d.cards == 9 && d.sel == 'update', 'intervention dialog: 9 tool-linked kinds, preselected');
  await p.fill('#trId', '2026-11-20'); await p.click('#trIGo'); await p.waitForTimeout(700);
  const i1 = await p.evaluate((A) => { const c = trCase(A); return { n: c.ints.length, st: c.ints[0].st, next: c.next, link: $('#modal').classList.contains('on') && !!$('#modal .uiw') }; }, A);
  ok(i1.n == 1 && i1.st == 'planned' && i1.next == '2026-11-20' && i1.link, 'update-link intervention logged (planned), next follow-up set, link dialog opened');
  await p.evaluate(() => closeAll()); await p.waitForTimeout(200);
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(200);
  ok(await p.evaluate((A) => trCase(A).stage == 'act', A), 'cannot verify before one intervention is done');
  await p.evaluate(() => { window.prompt = () => 'أرسلت الجمعية بياناتها المحدّثة'; });
  await p.evaluate((A) => trIntDone(A, trCase(A).ints[0].id), A); await p.waitForTimeout(500);
  ok(await p.evaluate((A) => { const c = trCase(A); return c.ints[0].st == 'done' && c.next == '' && $$('.trints>div.done').length == 1; }, A), 'intervention marked done with outcome; follow-up cleared');
  await p.evaluate((A) => trAdvance(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate((A) => trCase(A).stage == 'verify' && /إغلاق الحالة/.test($('.a3a .jbtn.pri').textContent), A), 'at «تحقق» the primary becomes «إغلاق الحالة»');
  // 5) الإغلاق: نتيجة + ملاحظة + درس
  await p.evaluate((A) => trClose(A), A); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $$('.trcw [data-uc=out]').length == 3 && $$('.trcw .trev label').length >= 2), 'close dialog: 3 outcomes and evidence checklist');
  await p.click('#trCGo'); await p.waitForTimeout(200);
  ok(await p.evaluate((A) => trCase(A) && trCase(A).stage == 'verify', A), 'close refused without a note');
  await p.fill('#trCn', 'تحقق الفريق ميدانياً من تعيين المفوض'); await p.fill('#trLs', 'الجمعيات بلا مفوض تتأخر في التحديث؛ يُطلب التعيين أولاً'); await p.click('#trCGo'); await p.waitForTimeout(700);
  const cl = await p.evaluate((A) => { const c = TRB.cases.find((x) => x.aid == A); return { st: c.st, stage: c.stage, out: c.outcome, les: c.lessons, open: !!trCase(A), reopen: !!$$('.a3need .jbtn').find((b) => /إعادة فتح/.test(b.textContent)) }; }, A);
  ok(cl.st == 'resolved' && cl.stage == 'done' && cl.out == 'resolved' && cl.les.length > 5 && !cl.open && cl.reopen, 'closed as «عولجت» with a lesson; page offers reopen');
  // 6) أنماط التعثر ومشروع معالجة جماعي
  await p.evaluate(([A, B]) => { trNew(A, { src: 'team', types: ['تعثر مالي'], sev: 'متوسطة' }); trNew(B, { src: 'team', types: ['تعثر مالي'], sev: 'عالية' }); trSave(); goMod('trouble'); }, [A, B]); await p.waitForTimeout(700);
  const pat = await p.evaluate(() => { const g = $$('.trpat .pb>div').find((d) => d.querySelector('b').textContent == 'تعثر مالي'); return { panel: !!$('.trpat'), g: !!g, n: g ? g.querySelector('small').textContent : '', btn: g ? g.querySelectorAll('.r .jbtn')[1].textContent : '' }; });
  ok(pat.panel && pat.g && /^2 جمعية/.test(pat.n) && /مشروع معالجة جماعي/.test(pat.btn), 'trouble list shows «أنماط التعثر» grouping open cases by type');
  await p.evaluate(() => $$('.trpat .pb>div').find((d) => d.querySelector('b').textContent == 'تعثر مالي').querySelectorAll('.r .jbtn')[1].click()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && !!$('#trPn') && /معالجة: تعثر مالي/.test($('#trPn').value)), 'group project dialog proposes a named project');
  await p.click('#trPGo'); await p.waitForTimeout(700);
  const pj = await p.evaluate(([A, B]) => { const p = PROJS.find((x) => x.trType == 'تعثر مالي'); return { ok: !!p, benef: p ? p.benef.length : 0, ints: [A, B].every((a) => trCase(a).ints.some((i) => i.k == 'project' && i.ref == p.id)), stage: trCase(A).stage, lbl: ($$('.trpat .pb>div').find((d) => d.querySelector('b').textContent == 'تعثر مالي').querySelector('.pjl') || {}).textContent }; }, [A, B]);
  ok(pj.ok && pj.benef == 2 && pj.ints && pj.stage == 'plan' && /2\/2/.test(pj.lbl), 'project created with both associations as beneficiaries, intervention logged in each case, pattern shows 2/2');
  // 7) الوصول من ملف الجمعية والعنوان
  await p.evaluate((A) => open360(A), A); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!$$('.a3need .jbtn').find((b) => /فتح الحالة/.test(b.textContent))), 'association page still offers «فتح الحالة»');
  await p.evaluate((A) => trOpen(A), A); await p.waitForTimeout(600);
  ok(await p.evaluate((A) => location.hash.includes('trcase-' + A), A), 'case page has its own URL (trcase-<id>)');
  await p.evaluate(() => go('admin/trcase-' + ADM.taid)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => ADM.mod == 'trcase' && !!$('.trpipe')), 'deep link restores the case page');
  // تنظيف
  await p.evaluate(() => { TRB.cases = []; trSave(); PROJS = PROJS.filter((x) => !x.trType); pjSave(); });
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
