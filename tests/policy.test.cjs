// سياسة الحقول والسياسات والمنجزات ومركز الإطلاق (0.47)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const E = (p, f, a) => Promise.race([p.evaluate(f, a), new Promise((_, rj) => setTimeout(() => rj(new Error('evaluate timeout')), 20000))]);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => { console.log('DIALOG ' + d.message()); d.accept() });
  await p.goto(BASE + '/#/admin/policy'); await p.waitForTimeout(1600);
  const snap = await E(p, () => JSON.stringify({ f: FPOL, p: POLS, i: IMPACT, r: RM }));
  const f = await E(p, async () => { POLS.list = POLS.list.filter((x) => x.t != 'سياسة اختبار'); FPOL = { v: 1, f: {} }; fpSave(); AM.policy($('#acontent')); const sel = $('[data-fv="web"]'); sel.value = 'int'; sel.dispatchEvent(new Event('change')); const t = $('[data-fo="social"]'); t.click(); const l = $('[data-fl="about"]'); l.value = 'نبذة تعريفية'; l.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 1200)); const st = (await (await fetch('/api/state')).json()).data.asirFieldPol; const v = JSON.parse(st.value).f;
    return { web: PF.find((x) => x.k == 'web').v, social: PF.some((x) => x.k == 'social'), about: PF.find((x) => x.k == 'about').l, saved: v.web && v.web.v == 'int' && v.social && v.social.on === false } });
  ok(f.web == 'int' && !f.social && f.about == 'نبذة تعريفية' && f.saved, 'field policy edits apply to PF and persist to shared state');
  const pol = await E(p, () => { polEdit(null); const F = $('#plF'); F.t.value = 'سياسة اختبار'; F.body.value = 'نص السياسة'; F.pub.value = '1'; F.requestSubmit(); return { n: POLS.list.filter((x) => x.t == 'سياسة اختبار').length, pub: polPub().some((x) => x.t == 'سياسة اختبار') } });
  ok(pol.n == 1 && pol.pub, 'policy added and public');
  await E(p, () => { location.hash = '#/governance' }); await p.waitForTimeout(900);
  ok(await E(p, () => [...$$('#gpanel .polp')].some((d) => d.textContent.includes('سياسة اختبار'))), 'public governance shows public policies');
  const pubState = await E(p, async () => { const r = await fetch('/api/state'); return r.status });
  await E(p, () => { location.hash = '#/admin/board' }); await p.waitForTimeout(900);
  const im = await E(p, () => { ADM.bt = 't1'; AM.board($('#acontent')); const fd = termFounded(termOf('t1')); $('#impFd') && $('#impFd').click(); const IM = IMPACT.find((x) => x.k == 't1'); return { fd, x: (IM.x || []).find((z) => z.k == 'founded'), g: termG(termOf('t1')) } });
  ok(im.fd > 0 && im.x && im.x.v == im.fd && im.g.includes('2019'), 'founded-in-term count computed and added as achievement');
  ok(await E(p, () => { renderImpact(); const t = $('#impGrid').textContent; return /منجزات أخرى/.test(t) && !/[٠-٩]/.test(t) }), 'home shows custom achievements with Latin digits');
  await E(p, () => goMod('launch')); await p.waitForTimeout(600);
  const lc = await E(p, () => { ADM.lcTab = 'qa'; AM.launch($('#acontent')); return new Promise((r) => setTimeout(() => { const items = ROAD.flatMap((x) => x.items).length; const done = ROAD.flatMap((x) => x.items).filter((i) => rmSt(i) == 'done').length; $('[data-qs="q3:pass"]').click(); r({ items, done, qa: qaSt('q3'), noDemo: !NAV.some((g) => g.items.some((i) => i[0] == 'demo')) }) }, 700)) });
  ok(lc.items >= 25 && lc.done >= 4 && lc.qa == 'pass' && lc.noDemo, 'launch centre: roadmap auto-status, QA recorded, demo module removed');
  await E(p, (x) => { const o = JSON.parse(x); FPOL = o.f; POLS = o.p; IMPACT = o.i; RM = o.r; fpSave(); polSave(); saveImpact(); rmSave() }, snap);
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
