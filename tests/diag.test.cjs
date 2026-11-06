// v0.69: التشخيص المؤسسي — رابط الجمعية (ذاتي)، رابط الخبير الزائر (ميداني بتسجيل ومرفقات)، تعبئة الفريق، المراجعة والاعتماد،
// الفجوات إلى احتياجات وحالات تعثر، وحدة القطاع، الأمان، الوصول، والجوال. ومرور ملفات البناء لحامل الرابط في الوضع الخاص.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ANON = process.env.ANON || 'http://127.0.0.1:8790'; // وضع خاص بلا دخول للفريق (اختياري)
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
const axe = async (p, sel) => { if (!(await p.evaluate(() => typeof axe !== 'undefined'))) await p.addScriptTag({ content: AXE }); return p.evaluate(async (s) => (await axe.run(s ? document.querySelector(s) : document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length), sel); };

(async () => {
  const b = await chromium.launch();
  const t = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; t.on('pageerror', (e) => errs.push('team: ' + e.message));
  await t.goto(BASE + '/#/admin', { waitUntil: 'networkidle' }); await t.waitForTimeout(800);
  const aid = await t.evaluate(() => { window.__noConfirm = 1; const o = DB.find((o) => !o.closed && !TRB.cases.some((c) => c.aid == o.id) && !PRO.needs.some((n) => n.aid == o.id)); return o.id; });
  await t.evaluate((id) => { ADM.dg = {}; open360(id, 'diag'); }, aid); await t.waitForTimeout(1200);
  ok(await t.evaluate(() => /التشخيص المؤسسي/.test(document.querySelector('#acontent').textContent) && document.querySelectorAll('.dgacts .jbtn').length >= 4), 'تبويب «التشخيص» في ملف الجمعية بأزراره الأربعة');
  ok((await axe(t, '#acontent')).length === 0, 'axe على تبويب التشخيص ' + (await axe(t, '#acontent')).join(' '));

  // ── 1. رابط تقييم ذاتي ──
  await t.click('.dgacts .jbtn.pri'); await t.waitForTimeout(900);
  const link = await t.evaluate(() => ({ url: document.querySelector('.dgshare input').value, pin: document.querySelector('.dgshare .pinbox b').textContent, wa: document.querySelector('.dgshare a[href*="wa.me"]').href }));
  ok(/\/d\/[A-Za-z0-9_-]{20,}$/.test(link.url) && /^\d{6}$/.test(link.pin), 'نافذة الإرسال: رابط ورمز من 6 أرقام');
  ok(/wa\.me\/\d*\?text=/.test(link.wa) && decodeURIComponent(link.wa).includes(link.url) && !decodeURIComponent(link.wa).includes(link.pin), 'رسالة واتساب فيها الرابط دون الرمز');

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const v = await ctx.newPage();
  const verr = []; v.on('pageerror', (e) => verr.push(e.message));
  await v.goto(link.url); ok(/رمز الدخول/.test(await v.textContent('body')), 'الرابط يطلب رمز الدخول');
  await v.fill('[name=pin]', '000000'); await v.click('button'); ok(/غير صحيح/.test(await v.textContent('body')), 'رمز خاطئ يُرفض');
  const tokenApi = link.url.replace('/d/', '/api/d/');
  ok((await v.request.get(tokenApi)).status() === 401, 'واجهة الرابط تتطلب الرمز');
  await v.fill('[name=pin]', link.pin); await v.click('button'); await v.waitForLoadState('networkidle');
  ok(/أهلاً بكم/.test(await v.textContent('h1')), 'صفحة الترحيب بعد الرمز');
  ok((await v.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'لا تمرير أفقي على الجوال');
  ok((await axe(v)).length === 0, 'axe على صفحة الترحيب ' + (await axe(v)).join(' '));
  await v.click('[data-role="المدير التنفيذي"]'); await v.click('#next'); await v.waitForTimeout(300);
  ok(await v.evaluate(() => document.querySelectorAll('fieldset.q').length === 6), 'المحور الأول: 6 عبارات بأزرار اختيار');
  ok((await axe(v)).length === 0, 'axe على شاشة المحور ' + (await axe(v)).join(' '));
  // إجابات: الحوكمة ضعيفة (أصفار حرجة)، والباقي متدرج
  let axi = 0;
  for (;;) {
    const ids = await v.$$eval('fieldset.q', (a) => a.map((f) => f.id.slice(2)));
    if (!ids.length) break;
    for (let i = 0; i < ids.length; i++) { const val = axi === 0 ? (i < 2 ? 0 : 1) : (i + axi) % 4; await v.click(`fieldset#q-${ids[i]} input[value="${val}"]`); }
    if (axi === 0) { await v.click('[data-nt="g1"]'); await v.fill('#n-g1', 'آخر جمعية عمومية قبل ثلاث سنوات'); await v.fill('[data-axn="gov"]', 'صعوبة اكتمال النصاب'); }
    if (axi === 1) { await v.waitForTimeout(1300); await v.reload(); await v.waitForTimeout(500); await v.evaluate(() => document.querySelector('[data-s="2"]').click()); await v.waitForTimeout(300);
      ok(await v.evaluate(() => document.querySelectorAll('fieldset.q input:checked').length === 5), 'الحفظ التلقائي: الإجابات باقية بعد إعادة التحميل'); }
    axi++; await v.click('#next'); await v.waitForTimeout(250);
  }
  ok(axi === 10, 'عشرة محاور مُجابة (' + axi + ')');
  await v.fill('[data-op="top"]', 'ضعف انتظام الجمعية العمومية، وقلة الموارد، ونقص الكوادر'); await v.click('#next'); await v.waitForTimeout(1300);
  ok(await v.evaluate(() => /مكتمل ✓/.test(document.body.textContent) && !document.querySelector('#send').disabled), 'شاشة المراجعة: مكتمل وزر الإرسال متاح');
  await v.click('#send'); await v.waitForTimeout(400); ok(/أكّد/.test(await v.textContent('#toast')), 'الإرسال يتطلب تأكيد الصحة');
  await v.check('#conf'); await v.click('#send'); await v.waitForTimeout(1200);
  ok(/وصل التقييم/.test(await v.textContent('h1')) && (await v.$$('.radar')).length === 1, 'شكر وقراءة أولية بمخطط');
  ok((await axe(v)).length === 0, 'axe على شاشة النتيجة ' + (await axe(v)).join(' '));
  ok((await v.evaluate((u) => fetch(u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"answers":{}}' }).then((r) => r.status), tokenApi)) === 409, 'لا تعديل بعد الإرسال');
  ok(!verr.length, 'صفحة الجمعية بلا أخطاء ' + verr.join(' | '));

  // ── 2. المراجعة والاعتماد والفجوات ──
  await t.keyboard.press('Escape'); await t.evaluate((id) => { ADM.dg = {}; ADM.dgSum = null; AM.assoc(document.querySelector('#acontent')); }, aid); await t.waitForTimeout(1200);
  ok(await t.evaluate(() => !!document.querySelector('.dgpend') && /ضعف انتظام/.test(document.querySelector('.dgpend').textContent)), 'التقييم الوارد يظهر «بانتظار المراجعة» مع أكبر التحديات');
  await t.evaluate(() => [...document.querySelectorAll('.dgpend .jbtn')].find((b) => b.textContent == 'اعتماد').click()); await t.waitForTimeout(300);
  await t.fill('#dgR [name=note]', 'نوصي بالمرافقة في الحوكمة'); await t.click('#dgR .btn.p'); await t.waitForTimeout(1500);
  const res = await t.evaluate(() => ({ bars: document.querySelectorAll('.dgbar').length, gaps: document.querySelectorAll('.dggap').length, crit: [...document.querySelectorAll('.dggap .pill2')].filter((x) => x.textContent == 'حرجة').length }));
  ok(res.bars === 10 && res.gaps > 0 && res.crit >= 1, 'النتيجة المعتمدة: 10 محاور وفجوات منها حرجة ' + JSON.stringify(res));
  await t.click('.dggap .jbtn.pri'); await t.waitForTimeout(500);
  const nd = await t.evaluate((id) => { const n = PRO.needs.find((x) => x.aid == id && x.src == 'diag'); return n && { area: n.area, fmt: n.fmt, dg: n.dg }; }, aid);
  ok(nd && nd.area === 0 && nd.dg, 'الفجوة تتحول احتياجاً في مجال الحوكمة ' + JSON.stringify(nd));
  ok(await t.evaluate(() => [...document.querySelectorAll('.dggap .jbtn')].some((b) => b.textContent == 'احتياج قائم')), 'الفجوة تُعلَّم «احتياج قائم»');
  await t.evaluate(() => [...document.querySelectorAll('.dggap .jbtn')].find((b) => b.textContent == 'فتح حالة تعثر').click()); await t.waitForTimeout(500);
  ok(await t.evaluate((id) => TRB.cases.some((c) => c.aid == id && c.types.includes('ضعف الحوكمة أو مجلس الإدارة')), aid), 'الفجوة الحرجة تفتح حالة تعثر بنوعها');
  await v.reload(); await v.waitForTimeout(500);
  ok(/التقرير|المعتمد/.test(await v.textContent('h1')) && /نوصي بالمرافقة/.test(await v.textContent('body')), 'الجمعية ترى التقرير المعتمد وملاحظة المجلس عبر رابطها');

  // ── 3. رابط الخبير الزائر: موافقة، تسجيل صوتي (ملف)، صورة، إرسال جزئي ──
  const f = await t.evaluate(async (id) => (await (await fetch('/api/associations/' + id + '/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'field', link: true, info: { assessor: 'خبير تجربة' } }) })).json()), aid);
  const ectx = await b.newContext({ viewport: { width: 390, height: 844 } }); const e = await ectx.newPage(); const eerr = []; e.on('pageerror', (x) => eerr.push(x.message));
  await e.goto(f.url); await e.fill('[name=pin]', f.pin); await e.click('button'); await e.waitForLoadState('networkidle');
  ok(/تقييم ميداني/.test(await e.textContent('h1')) && (await e.inputValue('#iAss')) === 'خبير تجربة', 'الخبير يرى بيانات الزيارة واسمه');
  await e.fill('#iDate', '2026-11-05'); await e.fill('#iAtt', 'المدير التنفيذي، المحاسب'); await e.check('#iCons'); await e.click('#next'); await e.waitForTimeout(300);
  for (const id of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) await e.click(`fieldset#q-${id} input[value="2"]`);
  const up = await e.evaluate(async (base) => { const fd = new FormData(); fd.append('file', new Blob([new Uint8Array(2048)], { type: 'audio/webm' }), 'تسجيل.webm'); fd.append('axis', 'gov'); const r = await fetch(base + '/files', { method: 'POST', body: fd }); return { s: r.status, j: await r.json() }; }, f.url.replace('/d/', '/api/d/'));
  ok(up.s === 201 && up.j.kind === 'audio', 'رفع تسجيل صوتي للمحور');
  const bad = await e.evaluate(async (base) => { const fd = new FormData(); fd.append('file', new Blob(['<script>'], { type: 'text/html' }), 'x.html'); return (await fetch(base + '/files', { method: 'POST', body: fd })).status; }, f.url.replace('/d/', '/api/d/'));
  ok(bad === 422, 'نوع ملف غير مدعوم يُرفض');
  await e.setInputFiles('[data-ax="gov"] [data-up]', { name: 'صورة.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') }); await e.waitForTimeout(900);
  await e.waitForTimeout(1300); await e.reload(); await e.waitForTimeout(500); await e.evaluate(() => document.querySelector('[data-s="1"]').click()); await e.waitForTimeout(300);
  ok(await e.evaluate(() => document.querySelectorAll('.files li').length === 2 && !!document.querySelector('.files audio')), 'المرفقات تظهر مع مشغّل الصوت');
  const other = await e.evaluate((u) => fetch(u).then((r) => r.status), f.url.replace('/d/', '/api/d/') + '/files/' + (up.j.id - 100000)); ok(other === 404, 'لا وصول لملفات تقييم آخر (' + other + ')');
  const own = await e.evaluate((u) => fetch(u).then((r) => r.status + ' ' + r.headers.get('content-type')), f.url.replace('/d/', '/api/d/') + '/files/' + up.j.id); ok(/^200 audio\/webm/.test(own), 'تشغيل التسجيل من الرابط (' + own + ')');
  for (let k = 0; k < 4; k++) { await e.click('#next'); await e.waitForTimeout(200); const ids = await e.$$eval('fieldset.q', (a) => a.map((x) => x.id.slice(2))); for (const id of ids) await e.click(`fieldset#q-${id} input[value="${k % 4}"]`); }
  await e.evaluate(() => document.querySelector('[data-s="12"]').click()); await e.waitForTimeout(1300);
  ok(await e.evaluate(() => !document.querySelector('#send').disabled), 'الميداني يُرسل جزئياً بعد 30%');
  await e.check('#conf'); await e.click('#send'); await e.waitForTimeout(1200);
  ok(/وصل التقييم/.test(await e.textContent('h1')), 'إرسال التقييم الميداني');
  ok(!eerr.length, 'صفحة الخبير بلا أخطاء ' + eerr.join(' | '));

  // ── 4. تعبئة الفريق من حسابه (مكتبية بمقترحات من البيانات) ──
  await t.evaluate((id) => fetch('/api/associations/' + id + '/full', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { finYear: String(new Date().getFullYear() - 1), assembly: new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10) } }) }), aid);
  const d = await t.evaluate(async (id) => (await (await fetch('/api/associations/' + id + '/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'desk' }) })).json()), aid);
  const tp = await b.newPage(); await tp.goto(d.url, { waitUntil: 'networkidle' });
  ok(/تعبئة مكتبية/.test(await tp.textContent('h1')), 'صفحة التعبئة المكتبية للفريق');
  await tp.click('#next'); await tp.waitForTimeout(300);
  ok(await tp.evaluate(() => document.querySelector('#q-g1 .src') && document.querySelector('#q-g1 input[value="3"]').checked && document.querySelector('#q-f1') == null), 'مقترح «من بيانات اللوحة» للجمعية العمومية (3)');
  ok((await tp.evaluate((u) => fetch(u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: { g1: { v: 3, src: 'desk' }, r1: { v: 'na' }, r4: { v: 'na' } } }) }).then((r) => r.ok), d.url.replace('/d/t/', '/api/assessments/'))), 'الحفظ من حساب الفريق');
  const na = await t.evaluate(async (id) => (await (await fetch('/api/assessments/' + id)).json()).data.answers, d.id);
  ok(!na.r1 && na.r4 && na.r4.v === 'na', '«لا ينطبق» مقبول للعبارات التي تسمح به فقط');
  await tp.close();
  ok((await t.evaluate(async (id) => (await fetch('/api/assessments/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"answers":{}}' })).status, f.id)) === 409, 'الفريق لا يعدّل ما يعبّئه حامل الرابط');

  // ── 5. وحدة القطاع ──
  await t.evaluate(() => { ADM.dgSum = null; ADM.dgv = null; goMod('diag'); }); await t.waitForTimeout(1500);
  ok(await t.evaluate(() => /جمعيات مُشخَّصة/.test(document.body.textContent) && !!document.querySelector('.dgheat') && document.querySelectorAll('.dgcm').length > 0), 'نظرة عامة: مؤشرات وخريطة الفجوات وأكثر الفجوات شيوعاً');
  ok(await t.evaluate(() => { const b = [...document.querySelectorAll('.jni')].find((x) => /التشخيص المؤسسي/.test(x.textContent)); return b && /[1-9]/.test((b.querySelector(".bd") || {}).textContent || ""); }), 'شارة «بانتظار المراجعة» في القائمة الجانبية');
  ok((await axe(t, '#acontent')).length === 0, 'axe على وحدة التشخيص ' + (await axe(t, '#acontent')).join(' '));
  await t.click('[data-dgt="list"]'); await t.waitForTimeout(400);
  ok(await t.evaluate(() => document.querySelectorAll('[data-dgs]').length > 0 && /بانتظار المراجعة/.test(document.querySelector('.jtable').textContent)), 'قائمة الجمعيات بحالاتها وتحديد للإرسال الجماعي');
  const bulk = await t.evaluate(async (ids) => { const r = await fetch('/api/diag/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ association_ids: ids }) }); return { s: r.status, j: await r.json() }; }, await t.evaluate(() => DB.filter((o) => !o.closed).slice(-2).map((o) => o.id)));
  ok(bulk.s === 201 && bulk.j.links.length === 2 && bulk.j.links.every((l) => /^\d{6}$/.test(l.pin)), 'الإرسال الجماعي: رابط ورمز لكل جمعية');
  await t.click('[data-dgt="tool"]'); await t.waitForTimeout(300);
  ok(await t.evaluate(() => document.querySelectorAll('.dgtool').length === 10), 'تبويب الأداة يعرض المحاور العشرة');

  // ── 6. الزائر لا يصل ──
  const anon = await (await b.newContext()).newPage();
  for (const u of ['/api/diag/summary', '/api/associations/' + aid + '/assessments', '/api/assessments/' + d.id]) { const st = (await anon.request.get(BASE.replace('8787', '8789') + u)).status(); ok(st === 401 || st === 403, 'محمي للزائر ' + u + ' (' + st + ')'); }
  ok(!errs.length, 'اللوحة بلا أخطاء ' + errs.join(' | '));

  // ── 7. حامل الرابط في الوضع الخاص يحمّل الخط (مرور ملفات البناء) ──
  try {
    const p = await (await b.newContext()).newPage();
    const s2 = await t.evaluate(async (id) => (await (await fetch('/api/associations/' + id + '/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'self' }) })).json()), (await t.evaluate(() => DB.filter((o) => !o.closed).slice(-3)[0].id)));
    const before = (await p.request.get(ANON + '/fonts/AvenirArabic-Medium.woff2')).status();
    await p.goto(s2.url.replace(BASE, ANON)); await p.fill('[name=pin]', s2.pin); await p.click('button'); await p.waitForLoadState('networkidle');
    const after = await p.evaluate(() => fetch('/fonts/AvenirArabic-Medium.woff2').then((r) => r.status));
    const js = await p.evaluate(() => fetch('/assets/x.js').then((r) => r.status));
    ok(before === 401 && after === 200, 'الوضع الخاص: الخط محجوب قبل فتح الرابط ومتاح بعده (' + before + '→' + after + ')');
    ok(js !== 401, 'ملفات البناء تمر لحامل الرابط (' + js + ')');
  } catch (x) { console.log('(تخطّي اختبار الوضع الخاص: ' + x.message.split('\n')[0] + ')'); }

  console.log(pass + ' ok, ' + fail + ' fail'); await b.close(); process.exit(fail ? 1 : 0);
})();
