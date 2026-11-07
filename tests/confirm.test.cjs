// 0.76: نافذة التأكيد الموحّدة، نموذج التحرير (زر يسمّي العدد + علامات التحقق)، التأكيد بالكتابة للعمليات الكبيرة، بطاقات نموذج «اطلب دعماً».
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PUB = process.env.PUB || 'http://127.0.0.1:8789';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  // 1) التأكيد: سؤال عنواناً، والأثر أسطراً، وزر يسمّي الفعل
  let r = p.evaluate(() => ask('حذف القرار نهائياً؟')); await p.waitForTimeout(200);
  const a1 = await p.evaluate(() => ({ t: $('#askT').textContent, ok: $('#askd [data-a="1"]').textContent, dang: $('#askd [data-a="1"]').classList.contains('dang'), un: ($('#askd .askun') || {}).textContent, foc: document.activeElement.dataset.a }));
  ok(a1.t == 'حذف القرار نهائياً؟' && a1.ok == 'حذف القرار' && a1.dang, 'title = question, button names the action: ' + a1.ok);
  ok(a1.un == 'لا يمكن التراجع' && a1.foc == '0', '«لا يمكن التراجع» shown, focus on cancel for danger');
  await p.keyboard.press('Escape'); ok((await r) === false, 'Escape cancels');
  r = p.evaluate(() => ask('إيقاف المهمة؟ يبقى سجلها وساعاتها، ويمكن استئنافها لاحقاً.', { ok: 'إيقاف', danger: 1 })); await p.waitForTimeout(200);
  const a2 = await p.evaluate(() => ({ notes: $$('#askM .uin').length, un: $('#askd .askun').textContent }));
  ok(a2.notes >= 1 && a2.un == 'يمكن التراجع لاحقاً', 'consequence lines + «يمكن التراجع لاحقاً»');
  await p.screenshot({ path: 'tests/out/confirm_undo.png' });
  await p.click('#askd [data-a="1"]'); ok((await r) === true, 'confirm resolves true');
  r = p.evaluate(() => ask('إلغاء هذا الرابط؟ لن تتمكن الجمعية من استخدامه.')); await p.waitForTimeout(200);
  ok(await p.evaluate(() => $('#askd [data-a="1"]').textContent == 'إلغاء هذا الرابط'), 'derived label «إلغاء هذا الرابط»');
  await p.click('#askd [data-a="0"]'); await r;
  r = p.evaluate(() => ask('دمج 4 سجلات؟', { typed: '4' })); await p.waitForTimeout(200);
  ok(await p.evaluate(() => $('#askd [data-a="1"]').disabled), 'typed confirmation: button disabled until typed');
  await p.fill('#askTy', '4'); ok(await p.evaluate(() => !$('#askd [data-a="1"]').disabled), 'typing the value enables it');
  await p.click('#askd [data-a="1"]'); ok((await r) === true, 'typed confirm resolves');
  // 2) روابط لكل الجمعيات: كتابة العدد داخل نافذة الروابط
  await p.evaluate(() => updLink(DB.filter((o) => !o.closed).map((o) => o.id), true)); await p.waitForTimeout(300);
  const lk = await p.evaluate(() => ({ ty: !!$('#lkTy'), dis: $('#lkGo').disabled, n: DB.filter((o) => !o.closed).length }));
  ok(lk.ty && lk.dis, 'bulk ≥100 links require typing the count (' + lk.n + ')');
  await p.fill('#lkTy', String(lk.n)); ok(await p.evaluate(() => !$('#lkGo').disabled), 'count typed → enabled');
  await p.evaluate(() => closeAll());
  // 3) نموذج التحرير: زر الحفظ يسمّي العدد، وخانات العلامات مميّزة
  const A = 34;
  const nid = await p.evaluate(async (A) => (await (await fetch(`/api/associations/${A}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'founded', kind: 'missing', text: 'تاريخ التأسيس غير معروف' }) })).json()).id, A);
  await p.evaluate(async () => { await flagsLoad(true); });
  await p.evaluate((A) => recEdit(A), A); await p.waitForTimeout(1200);
  const e1 = await p.evaluate(() => ({ dis: $('#recSave').disabled, lbl: $('#recSave').textContent, flg: $$('#recF .flgin').length, ban: !!$('.recflg'), sec: ($('.recnav button.on') || {}).dataset?.rs }));
  ok(e1.dis && e1.lbl == 'حفظ التعديلات', 'save disabled with no changes');
  ok(e1.flg == 1 && e1.ban && e1.sec == 'gen', 'flagged field highlighted, banner, opens on its section');
  await p.screenshot({ path: 'tests/out/confirm_edit.png' });
  await p.fill('#recF [name="p.short"]', 'اختبار'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => $('#recSave').textContent == 'حفظ التعديل' && !$('#recSave').disabled), 'one change → «حفظ التعديل»');
  const nd = '2014-03-' + String(10 + Math.floor(Math.random() * 18)); const curD = await p.$eval('#recF [name="a.founded_on"]', (e) => e.value); await p.fill('#recF [name="a.founded_on"]', nd == curD ? '2014-02-01' : nd); await p.dispatchEvent('#recF [name="a.founded_on"]', 'change'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => $('#recSave').textContent == 'حفظ التعديلين'), 'two changes → «حفظ التعديلين»');
  await p.click('#recSave'); await p.waitForTimeout(1200);
  const left = await p.evaluate(async (A) => (await (await fetch('/api/flags')).json()).data.filter((f) => f.aid == A && f.field == 'founded').length, A);
  ok(left == 0, 'saving the founded date auto-resolved its flag');
  await p.evaluate(async (A) => { await fetch('/api/associations/' + A + '/full', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { short: '' } }) }); }, A);
  // 4) نموذج «اطلب دعماً» العام: بطاقات الصيغة ومقطع الوقت
  const v = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); v.on('pageerror', (e) => errs.push('pub: ' + e.message));
  await v.goto(PUB + '/pro'); await v.waitForTimeout(900);
  await v.evaluate(() => proNeedForm({})); await v.waitForTimeout(400);
  const f1 = await v.evaluate(() => ({ cards: $$('#xpN [data-uc=fmt]').length, seg: $$('#xpN [data-us=urg]').length, fmt: $('#xpN [name=fmt]').value, urg: $('#xpN [name=urg]').value }));
  ok(f1.cards == 4 && f1.seg == 3 && f1.urg == 'خلال شهر', 'public form: 4 format cards + 3 urgency options');
  await v.click('#xpN [data-uc=fmt][data-v=t]'); await v.click('#xpN [data-us=urg][data-v="غير مستعجل"]');
  const f2 = await v.evaluate(() => ({ fmt: new FormData($('#xpN')).get('fmt'), urg: new FormData($('#xpN')).get('urg'), on: $('#xpN [data-uc=fmt].on').dataset.v }));
  ok(f2.fmt == 't' && f2.urg == 'غير مستعجل' && f2.on == 't', 'choices land in the form data');
  ok((await v.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'no horizontal scroll on mobile');
  await v.screenshot({ path: 'tests/out/confirm_pubform.png', fullPage: true });
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
