// NCNP-imported fields: badge in the portal -> association confirms -> pending cleared; approval clears the rest.
// Pre: local D1 seeded by the test itself through the dev API isn't possible, so run:
//   npx wrangler d1 execute asir-council --local --command "INSERT OR IGNORE INTO association_profiles (association_id) VALUES (30); UPDATE association_profiles SET phone_official='0172222222', postal_code='62521', address='أبها - حي المنسك', ncnp_id=999, gov_score=88.5, gov_score_year=2024, ncnp_class='اجتماعي', ncnp_pending='[\"phone\",\"postal\",\"address\"]' WHERE association_id=30"
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const adm = await (await b.newContext()).newPage(); adm.on('pageerror', (e) => errs.push('adm: ' + e.message));
  await adm.goto(BASE + '/'); await adm.waitForTimeout(600);
  const full = await adm.evaluate(async () => (await (await fetch('/api/associations/30/full')).json()).data.ncnp);
  ok(full && full.id == 999 && full.score == 88.5 && full.pending.length == 3, 'getFull returns ncnp block with 3 pending');
  await adm.evaluate(() => { go('admin'); }); await adm.waitForTimeout(700);
  await adm.evaluate(() => open360(30, 'data')); await adm.waitForTimeout(1500);
  const panel = await adm.evaluate(() => { const t = document.body.innerText; return { has: t.includes('السجل الوطني'), score: t.includes('88.5') }; });
  ok(panel.has && panel.score, 'ncnp panel shows in the 360 with governance score');
  await adm.screenshot({ path: 'tests/out/ncnp_360.png' });
  const link = await adm.evaluate(async () => (await (await fetch('/api/update-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ association_ids: [30] }) })).json()).links[0]);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const asc = await ctx.newPage(); asc.on('pageerror', (e) => errs.push('asc: ' + e.message));
  await asc.goto(link.url); await asc.waitForTimeout(300);
  await asc.fill('input[name=pin]', link.pin); await asc.click('button'); await asc.waitForTimeout(1200);
  const st = await asc.evaluate(() => ({ n: Object.keys(PS_NCNP).length, badges: document.querySelectorAll('.ncnpb').length, phone: PS.d.phone, hint: document.querySelector('#psaveTxt').textContent }));
  ok(st.n == 3 && st.badges == 3, 'portal shows 3 NCNP badges (' + st.badges + ')');
  ok(st.phone == '0172222222', 'imported phone prefilled');
  ok(/بانتظار تأكيدكم/.test(st.hint), 'save bar hints at pending confirmations');
  await asc.screenshot({ path: 'tests/out/ncnp_portal.png', fullPage: true });
  // association corrects the address (review/direct field) and confirms the rest without other changes
  await asc.fill('[data-k=address]', 'أبها - حي المنسك - شارع الملك فهد'); await asc.dispatchEvent('[data-k=address]', 'input'); await asc.waitForTimeout(100);
  await asc.evaluate(() => saveProfile()); await asc.waitForTimeout(300);
  await asc.fill('#psubf [name=submitter_name]', 'مختبر'); await asc.fill('#psubf [name=submitter_role]', 'المدير التنفيذي');
  await asc.click('#psubb'); await asc.waitForTimeout(1500);
  const after1 = await asc.evaluate(() => ({ left: Object.keys(PS_NCNP), badges: document.querySelectorAll('.ncnpb').length, modal: document.querySelector('#modal h3')?.textContent }));
  ok(after1.left.length == 0 && after1.badges == 0, 'confirmed fields leave pending in the portal (' + JSON.stringify(after1.left) + ')');
  const dbPend = await adm.evaluate(async () => (await (await fetch('/api/associations/30/full')).json()).data.ncnp.pending);
  ok(Array.isArray(dbPend) && dbPend.length <= 1 && !dbPend.includes('phone') && !dbPend.includes('postal'), 'server cleared confirmed keys (left: ' + JSON.stringify(dbPend) + ')');
  // council approves -> everything cleared
  const rq = await adm.evaluate(async () => (await (await fetch('/api/update-requests')).json()).data.find((r) => r.association_id == 30 && r.status == 'pending'));
  if (rq) {
    const ap = await adm.evaluate(async (id) => { return (await fetch('/api/update-requests/' + id + '/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve', apply: ['address'] }) })).status; }, rq.id);
    ok(ap == 200, 'approve request ' + ap);
  }
  const fin = await adm.evaluate(async () => (await (await fetch('/api/associations/30/full')).json()).data);
  ok(fin.ncnp.pending.length == 0, 'no pending after approval');
  ok(/شارع الملك فهد/.test(JSON.stringify(fin.profile)), 'corrected address saved');
  // confirm-only path: re-seed pending and confirm without changes
  ok(errs.length == 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
