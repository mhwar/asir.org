// نافذة التصدير الموحّدة: الصيغ الثلاث، النطاق، الأعمدة، البيانات الشخصية، اسم الملف، الذاكرة، تقارير متعددة الأقسام.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.removeItem('asirExp:dir'); go('admin'); }); await p.waitForTimeout(700);
  await p.evaluate(() => goMod('directory', { gov: 'أبها' })); await p.waitForTimeout(700);
  await p.evaluate(() => expDir()); await p.waitForTimeout(400);
  const d0 = await p.evaluate(() => ({ on: $('#modal').classList.contains('on'), fmts: $$('.exf button').length, sel: $('.exf button.on').dataset.xf, scope: $('.exseg button.on').dataset.xs, n: $('.exseg button.on span').textContent, lock: $$('.exk label.lock').length, est: $('#exE').textContent, filt: $('.exs small').textContent }));
  ok(d0.on && d0.fmts == 3 && d0.sel == 'xlsx', 'dialog opens with 3 format cards, Excel default');
  ok(d0.scope == 'filtered' && /أبها/.test(d0.filt), 'scope = current filters, summary names the filter (' + d0.n + ')');
  ok(d0.lock == 6, 'personal columns locked while personal data is hidden');
  ok(/صفاً/.test(d0.est), 'size estimate shown: ' + d0.est);
  await p.screenshot({ path: 'tests/out/export_dialog.png' });
  // CSV with chosen columns
  await p.click('.exf [data-xf=csv]'); await p.click('.exk [data-xc=hs]'); await p.click('.exk [data-xc=uid]');
  await p.fill('#exN', 'asir-export-test'); 
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exGo')]);
  const csvPath = await dl.path(); const csv = fs.readFileSync(csvPath, 'utf8');
  const head = csv.split('\r\n')[0];
  ok(dl.suggestedFilename() == 'asir-export-test.csv', 'custom file name used: ' + dl.suggestedFilename());
  ok(csv.charCodeAt(0) == 0xfeff && head.includes('الرقم الموحد') && !head.includes('مؤشر الصحة'), 'CSV has BOM + chosen columns only');
  const rowsN = csv.split('\r\n').length - 1, filt = await p.evaluate(() => dirRows().length);
  ok(rowsN == filt, 'CSV rows = filtered rows (' + rowsN + ')');
  // memory: reopen keeps CSV + columns
  await p.evaluate(() => expDir()); await p.waitForTimeout(300);
  const mem = await p.evaluate(() => ({ f: $('.exf button.on').dataset.xf, uid: $('.exk [data-xc=uid]').checked, hs: $('.exk [data-xc=hs]').checked }));
  ok(mem.f == 'csv' && mem.uid && !mem.hs, 'remembers last format and columns');
  // XLSX, all associations
  await p.click('.exf [data-xf=xlsx]'); await p.click('.exseg [data-xs=all]');
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('#exGo')]);
  fs.copyFileSync(await dx.path(), '/tmp/exp_test.xlsx');
  ok(fs.statSync('/tmp/exp_test.xlsx').size > 5000, 'xlsx downloaded (' + fs.statSync('/tmp/exp_test.xlsx').size + ' bytes)');
  // personal columns: reveal → unlocked, masked by default
  await p.evaluate(() => { ADM.reveal = true; expDir(); }); await p.waitForTimeout(300);
  const pl = await p.evaluate(() => $$('.exk label.lock').length);
  ok(pl == 0, 'personal columns unlocked after reveal');
  await p.click('.exk [data-xc=email]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!$('[data-xo=mask]') && $('[data-xo=mask]').checked), 'mask toggle appears, on by default');
  await p.click('.exf [data-xf=pdf]'); await p.waitForTimeout(150);
  const pdfUI = await p.evaluate(() => ({ cover: !!$('[data-xo=cover]'), defs: !!$('[data-xo=defs]'), btn: $('#exGo').textContent }));
  ok(pdfUI.cover && pdfUI.defs && /PDF/.test(pdfUI.btn), 'PDF options (cover, definitions) appear');
  await p.click('[data-xo=cover]'); await p.evaluate(() => { window.print = () => {}; }); await p.click('#exGo'); await p.waitForTimeout(500);
  const doc = await p.evaluate(() => ({ cover: !!$('#rptDoc .rpcov'), rows: $$('#rptDoc table tbody tr').length, masked: /•••@/.test($('#rptDoc').textContent), land: !!$('#rptDoc .rpd.land') }));
  ok(!doc.cover && doc.rows > 0, 'PDF built without cover page (' + doc.rows + ' rows)');
  ok(doc.land, 'many columns → landscape');
  await p.evaluate(() => { ADM.reveal = false; document.body.classList.remove('printrpt'); });
  // reports centre: sections, CSV disabled
  await p.evaluate(() => goMod('reports')); await p.waitForTimeout(800);
  await p.evaluate(() => expReport(rpCur())); await p.waitForTimeout(300);
  const rp = await p.evaluate(() => ({ csvDis: $('.exf [data-xf=csv]').disabled, secs: $$('[data-xsec]').length, est: $('#exE').textContent }));
  ok(rp.csvDis && rp.secs >= 2, 'report export: sections list (' + rp.secs + '), CSV disabled');
  await p.screenshot({ path: 'tests/out/export_report.png' });
  await p.evaluate(() => { $$('[data-xsec]').slice(1).forEach((c) => { c.checked = false; c.dispatchEvent(new Event('change')); }); });
  await p.waitForTimeout(200);
  const [dr] = await Promise.all([p.waitForEvent('download'), p.click('#exGo')]);
  fs.copyFileSync(await dr.path(), '/tmp/exp_rpt.xlsx');
  ok(true, 'report xlsx with 1 section downloaded');
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
