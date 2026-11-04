// Shared-state sync: edit in browser A appears in browser B; stale save is rejected (409).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async () => { const c = await b.newContext(); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('admin')); await p.waitForTimeout(300); return p; };
  const A = await open(), B = await open();
  const k = await A.evaluate(() => GAPS[0].k);
  const note = 'اختبار مزامنة ' + Date.now();
  await A.evaluate((n) => { GAPS[0].note = n; saveGaps(); }, note);
  await A.waitForTimeout(1800);
  const badgeA = await A.evaluate(() => document.getElementById('syncSt')?.dataset.st);
  const C = await open();
  const seen = await C.evaluate((k) => GAPI[k].note, k);
  // B still has the old version -> its save must be rejected
  await B.evaluate(() => { GAPS[0].note = 'نسخة قديمة'; saveGaps(); });
  await B.waitForTimeout(1800);
  const toastB = await B.evaluate(() => document.getElementById('toast').textContent);
  const after = await (await open()).evaluate((k) => GAPI[k].note, k);
  // board (public key) round trip
  await A.evaluate(() => { BOARD[0].n = BOARD[0].n; BOARD.push({ n: 'عضو تجريبي', r: 'member', ph: '' }); saveBoard(); }); await A.waitForTimeout(1500);
  const boardN = await (await open()).evaluate(() => BOARD.length);
  await A.evaluate(() => { BOARD.pop(); saveBoard(); }); await A.waitForTimeout(1500);
  const audit = await A.evaluate(async () => (await (await fetch('/api/audit?entity=app_state&limit=5')).json()).data.map((x) => x.entity_id + ':' + x.actor_email));
  console.log(JSON.stringify({ badgeA, synced: seen === note, conflictToast: toastB, kept: after === note, boardN, audit, errs }, null, 1));
  await b.close();
})();
