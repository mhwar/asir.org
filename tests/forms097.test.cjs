// 0.97: ملف الجمعية (السابقة/التالية بترتيب السجل وموضعها، إزالة تكرار المتطلبات) + نمط النماذج (حارس التعديلات، Ctrl+Enter)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  // 1) السابقة/التالية بترتيب السجل وفلاتره
  await p.click('[data-v=attn]'); await W(p);
  const L = await p.evaluate(() => dirList().slice(0, 3).map((o) => o.id));
  await p.evaluate((id) => open360(id), L[1]); await W(p, 800);
  ok(await p.evaluate((n) => /^2 من /.test($('.a3pos').textContent) && $('.a3pos').textContent.endsWith(String(n)), await p.evaluate(() => dirList().length.toLocaleString('en'))), 'file shows its position in the register view');
  await p.evaluate(() => a360Nav(1)); await W(p, 800);
  ok(await p.evaluate((id) => ADM.aid == id, L[2]), 'next follows the register order including «تحتاج انتباهاً»');
  await p.evaluate(() => a360Nav(-1)); await W(p, 800);
  ok(await p.evaluate((id) => ADM.aid == id, L[1]), 'previous goes back');
  // 2) المتطلبات الأساسية لا تتكرر
  await p.evaluate(() => { ADM.a5tab = 'eval'; AM.assoc($('#acontent')) }); await W(p);
  ok(await p.evaluate(() => $$('#a5eval .a5box > b').filter((b) => /المتطلبات والقرارات/.test(b.textContent)).length == 1), 'one «المتطلبات والقرارات» box in the evaluation (1.10)');
  // 3) حارس التعديلات: × و«إلغاء» يسألان، والحفظ لا يسأل
  await p.evaluate(() => uiDialog(uiHead('اختبار') + '<div class="uifrm"><label class="uifld"><span>حقل</span><input id="tf"></label></div>' + uiFoot('', ['tGo', 'حفظ'])));
  await W(p); await p.fill('#tf', 'تعديل'); await W(p, 100);
  ok(await p.evaluate(() => $('#modal').dataset.dirty == '1' && /غير محفوظة/.test($('.uifoot').textContent)), 'typing marks the dialog dirty and the footer says so');
  await p.click('#modal .x.mx'); await W(p);
  ok(await p.evaluate(() => $('#modal').classList.contains('on') && !!$('#askd.on')), '× asks before discarding');
  await p.click('#askd [data-a="0"]'); await W(p);
  ok(await p.evaluate(() => $('#modal').classList.contains('on')), 'keep editing → dialog stays');
  // Ctrl+Enter يضغط الزر الرئيسي
  await p.evaluate(() => { window.__saved = 0; $('#tGo').onclick = () => { window.__saved++; closeAll() } });
  await p.focus('#tf'); await p.keyboard.press('Control+Enter'); await W(p);
  ok(await p.evaluate(() => window.__saved == 1 && !$('#modal').classList.contains('on') && !$('#modal').dataset.dirty), 'Ctrl+Enter saves; saved close does not ask and clears the dirty state');
  await p.evaluate(() => uiDialog(uiHead('نافذة جديدة') + '<p>بلا تعديل</p>' + uiFoot('', ['t2', 'حفظ']))); await W(p);
  await p.click('#modal .uifoot .btn.o'); await W(p);
  ok(await p.evaluate(() => !$('#modal').classList.contains('on') && !$('#askd.on')), 'untouched dialog closes without a question');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
