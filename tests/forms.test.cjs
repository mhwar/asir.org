// 0.77: نماذج الوحدات (قرار، مشروع، شراكة، مجتمع، فعالية…) بالشريط السفلي الموحّد، ونموذج «انضم خبيراً» بالمقاطع.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PUB = process.env.PUB || 'http://127.0.0.1:8789';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(600);
  // قرار جديد: نموذج إنشاء
  await p.evaluate(() => { goMod('decisions'); decNew({}); }); await p.waitForTimeout(400);
  const n1 = await p.evaluate(() => ({ foot: !!$('#decF .uiff2'), go: $('#decF .uiff2 .btn.p').textContent, cancel: !!$('#decF .uiff2 .btn.o'), dis: $('#decF .uiff2 .btn.p').disabled, old: $$('#decF > button.btn').length }));
  ok(n1.foot && n1.go == 'إنشاء القرار' && n1.cancel && !n1.dis && n1.old == 0, 'create form: unified footer, «إنشاء القرار» enabled, «إلغاء» present');
  await p.screenshot({ path: 'tests/out/forms_decnew.png' });
  await p.fill('#decF [name=d]', 'قرار اختبار الشريط الموحّد'); await p.click('#decF .uiff2 .btn.p'); await p.waitForTimeout(500);
  const did = await p.evaluate(() => (DECX.find((x) => x.d == 'قرار اختبار الشريط الموحّد') || {}).id);
  ok(!!did, 'submit from the footer still creates the decision');
  // تعديل القرار
  await p.evaluate((id) => { closeAll(); decEdit(id); }, did); await p.waitForTimeout(400);
  const e1 = await p.evaluate(() => ({ dis: $('#deF .uiff2 .btn.p').disabled, st: $('#deF .uiff2 .uie').textContent, del: ($('#deF .uiff2 .uidel') || {}).textContent }));
  ok(e1.dis && e1.st == 'لا توجد تغييرات' && e1.del == 'حذف القرار', 'edit form: save disabled, status line, delete as red link in footer');
  await p.fill('#deF [name=goal]', 'هدف جديد'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => $('#deF .uiff2 .btn.p').textContent == 'حفظ التعديل' && !$('#deF .uiff2 .btn.p').disabled), 'one change → «حفظ التعديل»');
  await p.screenshot({ path: 'tests/out/forms_decedit.png' });
  await p.click('#deF .uiff2 .btn.p'); await p.waitForTimeout(500);
  ok(await p.evaluate((id) => DECX.find((x) => x.id == id).goal == 'هدف جديد', did), 'save from the footer persists the change');
  await p.evaluate((id) => { closeAll(); decEdit(id); }, did); await p.waitForTimeout(300);
  await p.click('#deF .uiff2 .uidel'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => $('#askT').textContent == 'حذف القرار نهائياً؟' && $('#askd .askun').textContent == 'لا يمكن التراجع'), 'delete → unified confirm');
  await p.click('#askd [data-a="1"]'); await p.waitForTimeout(400);
  ok(await p.evaluate((id) => !DECX.some((x) => x.id == id), did), 'decision deleted');
  // بقية النماذج: كل نموذج له شريط موحّد
  const others = await p.evaluate(async () => {
    const out = {}; const t = async (k, fn) => { try { closeAll(); await fn(); await new Promise((r) => setTimeout(r, 250)); const f = $('#modal form .uiff2'); out[k] = f ? f.querySelector('.btn.p').textContent : 'NO'; } catch (e) { out[k] = 'ERR ' + e.message; } };
    await t('pjCreate', () => pjCreate({}));
    await t('ptNew', () => ptNew());
    await t('campNew', () => campNew({}));
    if (typeof cmEdit == 'function') await t('cmEdit', () => cmEdit());
    if (typeof evNew == 'function') await t('evNew', () => evNew({}));
    closeAll(); return out;
  });
  console.log('   ' + JSON.stringify(others));
  ok(Object.values(others).every((v) => v != 'NO' && !/^ERR/.test(v)), 'other module forms use the unified footer');
  // نموذج «انضم خبيراً»
  const v = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); v.on('pageerror', (e) => errs.push('pub: ' + e.message));
  await v.goto(PUB + '/pro'); await v.waitForTimeout(900);
  const jf = await v.evaluate(() => { const bt = [...document.querySelectorAll('button,a')].find((x) => /انضم خبيراً|سجّل خبيراً|انضم/.test(x.textContent)); return bt ? (bt.click(), 1) : 0; });
  await v.waitForTimeout(500);
  const x1 = await v.evaluate(() => ({ form: !!$('#xpE'), hrs: $$('#xpE [data-us=hrs]').length, mode: $$('#xpE [data-us=mode]').length, foot: !!$('#xpE .uiff2'), last: $('#xpE .uiff2 button:last-child').textContent }));
  ok(jf && x1.form && x1.hrs == 3 && x1.mode == 3, 'expert form: time and mode as segments');
  ok(x1.foot && x1.last == 'إرسال الطلب', 'public form footer: «إلغاء» then «إرسال الطلب»');
  await v.click('#xpE [data-us=mode][data-v=remote]');
  ok(await v.evaluate(() => new FormData($('#xpE')).get('mode') == 'remote'), 'segment value reaches the form');
  ok((await v.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'no horizontal scroll');
  await v.screenshot({ path: 'tests/out/forms_expert.png', fullPage: true });
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
