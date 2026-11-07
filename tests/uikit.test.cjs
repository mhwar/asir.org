// مكوّنات نوافذ القرار (0.75): دليل الواجهة، نافذة الروابط، تقييم جديد، علامة «تحتاج تحقق»، ملف الجمعية.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith('asirUI:')).forEach((k) => localStorage.removeItem(k)); go('admin'); }); await p.waitForTimeout(700);
  // 1) دليل الواجهة
  await p.evaluate(() => goMod('uikit')); await p.waitForTimeout(600);
  const kit = await p.evaluate(() => ({ panels: $$('.uikx').length, cards: $$('.uikd .uic').length, rules: $$('.uikr li').length, nav: !!document.querySelector('[data-m=uikit]') }));
  ok(kit.panels >= 7 && kit.cards >= 2 && kit.rules == 7, 'UI kit page renders components + 7 rules');
  await p.screenshot({ path: 'tests/out/uikit_page.png', fullPage: true });
  // 2) رابط تحديث لجمعية واحدة: نافذة قبل الإنشاء
  const A = 33;
  await p.evaluate(async (A) => { goMod('updates'); await updLoad(false); updLink([A]); }, A); await p.waitForTimeout(500);
  const l1 = await p.evaluate(() => ({ title: $('.lkw h3').textContent, days: $('[data-uc=days].on').dataset.v, go: $('#lkGo').textContent, notes: $$('.lkw .uin').length }));
  ok(/روابط تحديث/.test(l1.title) && l1.days == '30' && l1.go == 'إنشاء الرابط', 'link dialog: validity cards (30 default), action named');
  await p.click('[data-uc=days][data-v="60"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /60/.test($('#lkGoE').textContent)), 'estimate follows the chosen validity');
  await p.screenshot({ path: 'tests/out/uikit_link.png' });
  await p.click('#lkGo'); await p.waitForTimeout(1800);
  const made = await p.evaluate(async (A) => { const L = (await (await fetch('/api/update-links?association_id=' + A)).json()).data; const l = L.find((x) => x.state == 'active'); return { has: !!document.querySelector('#lkOut input'), days: l ? Math.round((Date.parse(l.expires_at) - Date.parse(l.created_at)) / 864e5) : 0 }; }, A);
  ok(made.has && made.days == 60, 'link created with 60 days, share panel shown');
  // ثانية: تُعدّ الروابط الفعّالة التي ستُلغى
  await p.evaluate(async (A) => { await updLoad(false); updLink([A]); }, A); await p.waitForTimeout(400);
  ok(await p.evaluate(() => /سيُلغى|ستُلغى/.test($('.lkw').textContent)), 'warns that the active link will be revoked');
  ok(await p.evaluate(() => $('[data-uc=days].on').dataset.v == '60'), 'remembers last validity');
  await p.evaluate(() => closeAll());
  // 3) bulk: no double confirm, named count
  await p.evaluate(() => updLink([30, 31, 32], true)); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $('#lkGo').textContent == 'إنشاء 3 رابطاً' && !document.querySelector('.ask')), 'bulk: one dialog, button names the count');
  await p.evaluate(() => closeAll());
  // 4) تقييم جديد
  await p.evaluate((A) => open360(A, 'diag'), A); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => /تقييم جديد/.test(($('.dgacts .jbtn') || {}).textContent || '')), 'diagnostic tab: single «تقييم جديد» entry');
  await p.evaluate((A) => dgPick(A), A); await p.waitForTimeout(300);
  const d1 = await p.evaluate(() => ({ cards: $$('[data-uc=k]').length, days: !!$('[data-uc=days]'), go: $('#dgGo').textContent }));
  ok(d1.cards == 4 && d1.days && /التقييم الذاتي/.test(d1.go), 'new assessment: 4 kind cards, self shows validity');
  await p.click('[data-uc=k][data-v=xlink]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!$('#dgWho')), 'expert kind shows the expert field');
  await p.click('#dgGo'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => $('#modal').classList.contains('on')), 'expert name required');
  await p.click('[data-uc=k][data-v=desk]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !$('[data-uc=days]') && /المكتبية/.test($('#dgGo').textContent)), 'desk: no validity, action renamed');
  await p.screenshot({ path: 'tests/out/uikit_diag.png' });
  await p.evaluate(() => closeAll());
  // 5) علامة
  await p.evaluate((A) => flagAdd(A), A); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $$('[data-uc=kind]').length == 4 && $$('[data-uc=kind].tone').length == 4), 'flag dialog: 4 coloured kind cards');
  await p.click('[data-uc=kind][data-v=missing]'); await p.fill('#flgTx', 'اختبار مكوّنات الواجهة'); await p.click('#flgGo'); await p.waitForTimeout(700);
  const fl = await p.evaluate(async (A) => (await (await fetch('/api/flags')).json()).data.filter((f) => f.aid == A && f.text == 'اختبار مكوّنات الواجهة'), A);
  ok(fl.length == 1 && fl[0].kind == 'missing', 'flag saved with the chosen kind');
  await p.evaluate(async ([A, id]) => fetch(`/api/associations/${A}/notes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) }), [A, fl[0] && fl[0].id]);
  // 6) ملف الجمعية عبر نافذة التصدير
  await p.evaluate(async (A) => { ADM.reveal = false; await recPrint(A); }, A); await p.waitForTimeout(600);
  const pr = await p.evaluate(() => ({ fmts: $$('[data-uc=fmt]').length, secs: $$('.uik [data-ug]').length, lock: $$('.uik label.lock').length, title: $('.uiw h3').textContent }));
  ok(pr.fmts == 2 && pr.secs == 5 && pr.lock == 2 && /ملف/.test(pr.title), 'profile export: PDF/Excel, 5 sections, 2 personal locked');
  await p.click('[data-uc=fmt][data-v=xlsx]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exGo')]);
  ok(fs.statSync(await dl.path()).size > 3000, 'profile xlsx downloaded');
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
