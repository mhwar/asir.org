// تدقيق الوصول (WCAG 2.1 A/AA) لكل صفحات اللوحة وللدرج، بالوضعين الفاتح والليلي (0.51)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
const RUN = (sel) => axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then((x) => x.violations.map((v) => ({ id: v.id, n: v.nodes.length, at: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 860 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/home'); await p.waitForTimeout(1600); await p.addScriptTag({ content: AXE });
  for (const theme of ['light', 'dark']) {
    await p.evaluate((t) => { document.documentElement.dataset.theme = t }, theme);
    const mods = await p.evaluate(() => MODS.map((m) => m[0]).filter((m) => can(m)));
    const bad = [];
    for (const m of mods) { await p.evaluate((m) => { closeAll(); goMod(m) }, m); await p.waitForTimeout(220); const v = await p.evaluate(`(${RUN.toString()})('#adminRoot')`); if (v.length) bad.push({ m, v }) }
    ok(!bad.length, `${theme}: all ${mods.length} dashboard pages pass WCAG A/AA ` + JSON.stringify(bad).slice(0, 600));
    await p.evaluate(() => { closeAll(); goMod('partners'); ADM.ptTab = 'ov'; ptOpen(16) }); await p.waitForTimeout(300);
    const d = await p.evaluate(`(${RUN.toString()})('#adrawer')`);
    await p.evaluate(() => { closeAll(); goMod('mops'); evOpen(EVTS.list[0].id) }); await p.waitForTimeout(300);
    const d2 = await p.evaluate(`(${RUN.toString()})('#adrawer')`);
    await p.evaluate(() => { closeAll(); ptNew() }); await p.waitForTimeout(250);
    const md = await p.evaluate(`(${RUN.toString()})('#modal')`);
    await p.evaluate(() => { closeAll(); $('#bellBtn').click() }); await p.waitForTimeout(150);
    const nt = await p.evaluate(`(${RUN.toString()})('#jntf')`);
    await p.evaluate(() => { ntfClose(); closeAll() });
    ok(!d.length && !d2.length && !md.length && !nt.length, `${theme}: drawers, modal form and notifications pass ` + JSON.stringify([d, d2, md, nt]).slice(0, 600));
  }
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
