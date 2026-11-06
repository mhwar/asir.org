// v0.65: فحص وصول آلي لصفحات الزائر (WCAG A/AA) بقوائم مفتوحة، وبطاقات الاستشارة تفتح طلب الخبير بالمجال المختار
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VIS = process.env.VIS || 'http://127.0.0.1:8789';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    for (const r of ['', 'directory', 'consult', 'pro', 'about', 'news', 'stories', 'communities', 'privacy', 'xyz-missing']) {
      await p.goto(VIS + '/#/' + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
      if (!(await p.evaluate(() => typeof axe !== 'undefined'))) await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((x) => x.id + ':' + x.nodes.length));
      ok(!v.length, name + ' /' + r + ' ' + v.join(' '));
    }
    if (name == 'desktop') {
      await p.goto(VIS + '/#/', { waitUntil: 'networkidle' }); await p.click('.ndt >> nth=2'); await p.waitForTimeout(300);
      const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((x) => x.id + ':' + x.nodes.length));
      ok(!v.length, 'قائمة الخدمات مفتوحة ' + v.join(' '));
      await p.goto(VIS + '/#/consult', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
      const n = await p.$$eval('#ctypes .ct', (a) => a.length);
      await p.click('#ctypes .ct >> nth=1'); await p.waitForTimeout(400);
      ok(await p.evaluate(() => { const f = document.querySelector('#xpN [name=fmt]'), a = document.querySelector('#xpN [name=area]'); return !!f && f.value == 'c' && a.value == '1'; }), 'بطاقة المجال (من ' + n + ') تفتح الطلب بصيغة استشارة ومجالها');
    }
    ok(!errs.length, name + ' بلا أخطاء ' + errs.join(' | '));
    await p.close();
  }
  console.log(pass + ' ok, ' + fail + ' fail'); await b.close(); process.exit(fail ? 1 : 0);
})();
