// 0.96: الخطة والأداء + اللجان الفرعية — الاستيراد، الحالة، التحديث، التكاليف حسب الصلاحية (الخادم والواجهة)، اللجان
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
// ملف خطة صغير للاختبار (لا بيانات حقيقية)
const PLAN = { kind: 'asir-plan', v: 1, year: 2026, plan: { vision: 'رؤية اختبار', mission: 'رسالة اختبار',
  P: [{ k: 'P1', t: 'ركيزة أ', c: '#3D5CFF' }, { k: 'P2', t: 'ركيزة ب', c: '#14A37F' }],
  G: [{ k: 'G1', p: 'P1', t: 'هدف 1' }, { k: 'G2', p: 'P2', t: 'هدف 2' }],
  K: [{ k: 'K1', g: 'G1', t: 'عدد اللقاءات', u: 'عدد', tg: 4, q: [1, 1, 1, 1], ow: 'المدير', ac: [null, null, null, null], fr: 'ربعي' },
      { k: 'K2', g: 'G2', t: 'نسبة الرضا', u: '%', tg: 80, q: [70, 75, 80, 80], ow: 'المدير', ac: [null, null, null, null] },
      { k: 'K3', g: 'G2', t: 'مؤشر بلا مستهدف', u: 'عدد', tg: null, q: null, ow: 'المدير', ac: [null, null, null, null] }],
  I: [{ k: 'I1', t: 'مبادرة أولى', d: 'وصف', kp: ['K1'], ow: 'المدير', cost: 15000, m: [3, 6], st: 'لم تُحدَّث', pr: null, ms: ['معلم 1', 'معلم 2'] },
      { k: 'I2', t: 'مبادرة ثانية', d: 'وصف', kp: [], ow: 'المنسق', cost: null, m: [9], st: 'لم تُحدَّث', pr: null, ms: [] }],
  ISS: [{ sv: 'عالية', cat: 'الاتساق', t: 'ملاحظة اختبار', ex: ['مثال'], fix: 'إصلاح' }] },
  subc: [{ id: 1, n: 'أبها', govs: ['أبها'], mem: [], meet: [] }, { id: 2, n: 'بارق والمجاردة', govs: ['بارق', 'المجاردة'], mem: [], meet: [] }] };
(async () => {
  // 1) الخادم: من يرى التكاليف (منطق state.js مباشرة على قاعدة وهمية)
  const st = await import(path.resolve(__dirname, '../worker/src/state.js'));
  const row = { key: 'asirPlan', value: JSON.stringify({ v: 1, plan: PLAN.plan }), version: 3, updated_by: 'a', updated_at: 'x' };
  const env = { DB: { prepare: () => ({ all: async () => ({ results: [row, { key: 'asirSubc', value: '{"v":1,"list":[]}', version: 1 }] }) }) } };
  const U = (perms) => ({ email: 'x@y', perms: new Map(Object.entries(perms)) });
  const rd = async (u) => { const s = await st.readState(env, u); return s.asirPlan ? JSON.parse(s.asirPlan.value) : null };
  const adm = await rd(U({ '*': 'write' })), chair = await rd(U({ '*': 'read' })), analyst = await rd(U({ directory: 'write' })), vis = await rd(null);
  ok(adm.plan.I[0].cost == 15000 && !adm.noCost && chair.plan.I[0].cost == 15000, 'server: admin and board (chair, read-all) get costs');
  ok(analyst && analyst.noCost && !('cost' in analyst.plan.I[0]) && analyst.plan.K.length == 3, 'server: other team members get the plan without costs');
  ok(vis === null && !(await st.readState(env, null)).asirSubc, 'server: visitors get neither the plan nor the subcommittees');
  let denied = false; try { await st.writeState(env, U({ '*': 'read' }), 'asirPlan', { value: '{}', version: 3 }) } catch (e) { denied = e.status == 403 || /صلاحية/.test(e.message) }
  ok(denied, 'server: read-only board cannot write the plan');

  // 2) الواجهة
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/plan'); await W(p, 2500);
  ok(await p.evaluate(() => { const g = $('.jgrp[data-gk=gov]'); return !!g && !!g.querySelector('[data-m=plan]') && !!g.querySelector('[data-m=subc]') }), 'nav: plan + subcommittees under «شؤون المجلس»');
  const f = path.join(os.tmpdir(), 'asir-plan-test.json'); fs.writeFileSync(f, JSON.stringify(PLAN));
  await p.evaluate(() => { window.__noConfirm = true; PLN = null; SBC = null; ADM.pl.tab = 'ov'; ADM.pl.pil = ADM.pl.st = ADM.pl.ks = ''; goMod('plan') }); await W(p);
  ok(await p.evaluate(() => !!$('#plImp') && /لم تُستورد/.test($('.dvempty').textContent)), 'empty state offers import');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#plImp')]); await fc.setFiles(f); await W(p, 1200);
  const o = await p.evaluate(() => ({ tabs: $$('[data-pltab]').length, k: $$('.anks .ank').length, pil: $$('.plpil').length, saved: JSON.parse(localStorage.getItem('asirPlan')).plan.K.length, subc: JSON.parse(localStorage.getItem('asirSubc')).list.length }));
  ok(o.tabs == 5 && o.k == 4 && o.pil == 2 && o.saved == 3 && o.subc == 2, 'import: plan + subcommittees saved; overview with KPIs and pillars ' + JSON.stringify(o));
  // المؤشرات: تسجيل قراءة يغيّر الحالة
  await p.click('[data-pltab=k]'); await W(p);
  ok(await p.evaluate(() => $$('#plK tbody tr').map((r) => r.querySelector('.pill2').textContent).join() == 'لم يُقس بعد,لم يُقس بعد,بلا مستهدف'), 'KPIs start unmeasured / no target');
  await p.click('[data-plr=K1]'); await W(p); await p.fill('[data-q="0"]', '1'); await p.fill('[data-q="1"]', '0'); await p.click('#plRgo'); await W(p, 500);
  await p.click('[data-plr=K2]'); await W(p); await p.fill('[data-q="0"]', '72'); await p.click('#plRgo'); await W(p, 500);
  const k = await p.evaluate(() => $$('#plK tbody tr').map((r) => r.querySelector('.pill2').textContent));
  ok(k[0] == 'في خطر' && k[1] == 'على المسار', 'counts: 1 of 2 expected → at risk; %: 72 vs Q1 70 → on track ' + JSON.stringify(k));
  // المبادرات: التكلفة لمدير النظام، التحديث يُسجَّل
  await p.click('[data-pltab=i]'); await W(p);
  ok(await p.evaluate(() => $$('#plI th').some((t) => t.textContent.includes('التكلفة')) && $('#plI tbody tr').textContent.includes('15,000')), 'admin sees the cost column');
  await p.click('#plI tbody tr[data-pli=I1]'); await W(p);
  await p.check('[data-ms="0"]'); await p.selectOption('#plSt', 'قيد التنفيذ'); await p.fill('#plNt', 'انعقد اللقاء الأول'); await p.click('#plIgo'); await W(p, 500);
  const i1 = await p.evaluate(() => { const x = PLN.plan.I.find((i) => i.k == 'I1'); return { st: x.st, pr: x.pr, done: x.done, log: x.log.length && x.log[0].t } });
  ok(i1.st == 'قيد التنفيذ' && i1.pr == 50 && i1.done.join() == '0' && /انعقد/.test(i1.log), 'initiative update: status, progress from milestones, log ' + JSON.stringify(i1));
  for (const l of ['gantt', 'board']) { await p.click(`[data-pllay=${l}]`); await W(p) }
  ok(await p.evaluate(() => $$('.plkc').length >= 2 && !!$('.plkd[data-pli=I1]')), 'timeline and by-status layouts');
  await p.click('[data-pllay=table]'); await W(p);
  // نسخة الفريق بلا تكاليف: لا عمود تكلفة، ولا تعديل
  await p.evaluate(() => { PLN = Object.assign({}, PLN, { noCost: true }); goMod('plan') }); await W(p);
  ok(await p.evaluate(() => !$$('#plI th').some((t) => t.textContent.includes('التكلفة')) && !$('#plImp') && /لمدير النظام ومجلس الإدارة/.test($('.jcard').textContent)), 'team copy: no costs, read-only');
  await p.evaluate(() => { PLN = LS('asirPlan', null); goMod('plan') }); await W(p);
  // الخريطة والملاحظات
  await p.click('[data-pltab=map]'); await W(p);
  ok(await p.evaluate(() => $$('.plcol').length == 2 && !!$('.plil[data-pli=I1]')), 'strategy map: pillars → goals → KPIs → initiatives');
  // 3) اللجان الفرعية
  await p.evaluate(() => goMod('subc')); await W(p, 500);
  const s0 = await p.evaluate(() => ({ rows: $$('#scT tbody tr').length, st: $('#scT tbody tr .pill2').textContent, na: +$('#scT tbody tr td:nth-child(2)').textContent, want: DB.filter((o) => !o.closed && o.gov == 'أبها').length }));
  ok(s0.rows == 2 && s0.st == 'تحتاج تفعيل' && s0.na == s0.want, 'subcommittees list with association counts ' + JSON.stringify(s0));
  await p.click('#scT tr[data-sc="1"]'); await W(p);
  await p.click('#scMemAdd'); await W(p); await p.fill('[data-f=n]', 'عبدالله محمد الاختبار'); await p.selectOption('[data-f=r]', 'رئيس اللجنة'); await p.click('#scGo'); await W(p, 400);
  await p.click('#scMeetAdd'); await W(p); await p.fill('[data-f=s]', 'مراجعة احتياجات الجمعيات'); await p.click('#scGo'); await W(p, 400);
  const s1 = await p.evaluate(() => ({ st: $('#scT tbody tr .pill2').textContent, mem: SBC.list[0].mem.length, meet: SBC.list[0].meet.length, masked: !!$('#modal .pllog .masked') }));
  ok(s1.st == 'نشطة' && s1.mem == 1 && s1.meet == 1 && s1.masked, 'member + meeting → «نشطة»; member names masked by default ' + JSON.stringify(s1));
  await p.click('#modal [data-scg]'); await W(p, 500);
  ok(await p.evaluate(() => ADM.mod == 'directory' && ADM.dir.gov == 'أبها'), 'link opens the governorate in the register');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
