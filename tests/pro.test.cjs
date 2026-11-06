// التطوع الاحترافي «تطوّع بخبرتك» (0.62): الصفحة العامة، طلبا الخبير والجمعية من الموقع، ودورة العمل في اللوحة
// حتى إنجاز المهمة، وما يظهر للزائر (أرقام مجمّعة ومخرجات بموافقة، بلا بيانات شخصية).
// VIS: نسخة عامة بلا دخول (8789)، BASE: نسخة الفريق (8787). يُصفَّر حد الرسائل قبل التشغيل:
//   npx wrangler d1 execute asir-council --local --command "UPDATE contact_messages SET created_at='2026-01-01T00:00:00Z'"
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VIS = process.env.VIS || 'http://127.0.0.1:8789';
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const AXE = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ FAIL ' + m); } };
const tag = 'اختبار' + Date.now().toString(36);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(VIS + '/pro', { waitUntil: 'networkidle' });
  ok(await p.evaluate(() => /تطوّع بخبرتك/.test(document.querySelector('.page.on h1')?.textContent || '')), 'الصفحة العامة تفتح من الرابط النظيف /pro');
  ok(await p.evaluate(() => document.querySelectorAll('.xpf').length === 3 && document.querySelectorAll('.xpareas>div').length >= 5), 'الصيغ الثلاث ومجالات الخبرة ظاهرة');
  ok(await p.evaluate(() => !!document.querySelector('#nav a[href="#/pro"]') && !!document.querySelector('footer a[href="#/pro"]')), 'رابط في قائمة الخدمات والتذييل');
  await p.addScriptTag({ content: AXE });
  let ax = await p.evaluate(async () => (await axe.run(document.querySelector('.page.on'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));
  ok(!ax.length, 'axe على الصفحة ' + ax.join(' '));

  // طلب انضمام خبير
  await p.click('.xpcta .btn.p'); await p.waitForTimeout(300);
  await p.fill('#xpE [name=name]', 'خبير ' + tag); await p.fill('#xpE [name=ttl]', 'محاسب قانوني'); await p.fill('#xpE [name=email]', tag.replace(/[^a-z0-9]/g, '') + '@example.org');
  await p.fill('#xpE [name=yrs]', '12'); await p.check('#xpE [name=areas][value="2"]'); await p.check('#xpE [name=nda]'); await p.check('#xpE [name=pub]');
  ax = await p.evaluate(async () => (await axe.run(document.querySelector('#modal'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));
  ok(!ax.length, 'axe على نموذج الخبير ' + ax.join(' '));
  const r1 = p.waitForResponse((r) => r.url().includes('/api/public/contact'));
  await p.click('#xpE [type=submit]'); const s1 = (await r1).status(); await p.waitForTimeout(300);
  ok(s1 === 201 && await p.evaluate(() => /وصل طلبك/.test(document.querySelector('#modal').textContent)), 'طلب الخبير يصل للخادم (' + s1 + ')');
  await p.evaluate(() => closeAll());
  // طلب دعم من جمعية
  const an = await p.evaluate(() => assoc[3].n);
  await p.click('.xpcta .btn.o'); await p.waitForTimeout(300);
  await p.fill('#xpN [name=org]', an); await p.fill('#xpN [name=name]', 'مدير ' + tag); await p.fill('#xpN [name=email]', 'need@example.org');
  await p.selectOption('#xpN [name=area]', '2'); await p.selectOption('#xpN [name=fmt]', 't');
  await p.fill('#xpN [name=title]', 'إعداد السياسة المالية ' + tag); await p.fill('#xpN [name=det]', 'لا توجد سياسة مالية معتمدة لدى الجمعية.'); await p.fill('#xpN [name=out]', 'سياسة مالية معتمدة');
  await p.check('#xpN [name=auth]');
  const r2 = p.waitForResponse((r) => r.url().includes('/api/public/contact'));
  await p.click('#xpN [type=submit]'); const s2 = (await r2).status(); await p.waitForTimeout(300);
  ok(s2 === 201, 'طلب الجمعية يصل للخادم (' + s2 + ')');
  await p.evaluate(() => closeAll());
  // «انضم إلى شبكة المستشارين» في صفحة الاستشارات صار الطلب الحقيقي نفسه
  await p.evaluate(() => { location.hash = '#/consult'; }); await p.waitForTimeout(300);
  await p.evaluate(() => joinConsultant()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('#xpE') && document.querySelector('#xpE [name=fmts][value=c]').checked), 'انضمام المستشار يفتح نموذج الخبير (صيغة الاستشارة محددة)');
  await p.evaluate(() => closeAll());
  ok(!errs.length, 'بلا أخطاء في صفحة الزائر ' + errs.join(' | '));

  // اللوحة: الطلبات الواردة ← اعتماد ← مطابقة ← مهمة ← إنجاز
  const t = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const terr = []; t.on('pageerror', (e) => terr.push(e.message));
  await t.goto(BASE + '/#/admin', { waitUntil: 'networkidle' });
  await t.evaluate(() => { localStorage.removeItem('asirPro'); });
  await t.evaluate(() => goMod('pro')); await t.waitForTimeout(900);
  ok(await t.evaluate(() => /تطوّع بخبرتك/.test(document.body.innerText) && !!document.querySelector('.xptabs')), 'وحدة التطوع الاحترافي في اللوحة');
  await t.evaluate(() => { ADM.prov.tab = 'in'; renderAdmin(); }); await t.waitForTimeout(900);
  const inbox = await t.evaluate((tg) => (ADM.proIn || []).filter((m) => (m.name + (m.details && m.details.title || '')).includes(tg)).map((m) => [m.id, m.kind]), tag);
  ok(inbox.length === 2 && inbox.some((x) => x[1] === 'expert') && inbox.some((x) => x[1] === 'need'), 'الطلبان في «الطلبات الواردة» ' + JSON.stringify(inbox));
  const eId = inbox.find((x) => x[1] === 'expert')[0], nId = inbox.find((x) => x[1] === 'need')[0];
  await t.click(`[data-pacc="${eId}"]`); await t.waitForTimeout(500);
  ok(await t.evaluate((tg) => PRO.experts.some((e) => e.n.includes(tg) && e.st === 'active' && e.pub && e.areas.includes(2)), tag), 'اعتماد الخبير يضيفه للشبكة بموافقة الظهور');
  await t.evaluate(() => { ADM.prov.tab = 'in'; renderAdmin(); }); await t.waitForTimeout(300);
  await t.click(`[data-pacc="${nId}"]`); await t.waitForTimeout(700);
  const n = await t.evaluate((tg) => { const x = PRO.needs.find((y) => y.title.includes(tg)); return x && { id: x.id, aid: x.aid, st: x.st }; }, tag);
  ok(n && n.aid && n.st === 'new' && await t.evaluate(() => document.querySelector('#adrawer').classList.contains('on')), 'قبول طلب الجمعية يحوّله لاحتياج مربوط بالدليل ويفتح درجه');
  ok(await t.evaluate((tg) => [...document.querySelectorAll('#adrawer .xpm b')].some((b) => b.textContent.includes(tg)), tag), 'الخبير مرشّح للاحتياج (المجال يتوافق)');
  await t.evaluate((tg) => { const e = PRO.experts.find((x) => x.n.includes(tg)); document.querySelector(`#adrawer [data-pa="${e.id}"]`).click(); }, tag); await t.waitForTimeout(300);
  await t.click('#paF button'); await t.waitForTimeout(500);
  const g = await t.evaluate((tg) => { const x = PRO.engs.find((y) => y.title.includes(tg)); return x && { id: x.id, st: x.st, ms: x.ms.length, ex: (proE(x.eid) || {}).n || '' }; }, tag);
  ok(g && g.st === 'plan' && g.ms >= 3 && g.ex.includes(tag), 'الإسناد ينشئ مهمة بمراحل مربوطة بالخبير');
  await t.fill('#phF [name=h]', '6'); await t.click('#phF button'); await t.waitForTimeout(300);
  await t.click('[data-gx="deliv"]'); await t.waitForTimeout(200); await t.fill('#pxD [name=url]', 'https://example.org/policy'); await t.click('#pxD button'); await t.waitForTimeout(300);
  await t.click('[data-gx="accept"]'); await t.waitForTimeout(200); await t.check('#pxA [name=pub]'); await t.fill('#pxA [name=story]', 'سياسة مالية اعتمدها مجلس الإدارة ' + tag); await t.click('#pxA button'); await t.waitForTimeout(500);
  const fin = await t.evaluate((id) => { const x = PRO.engs.find((y) => y.id === id); const nd = PRO.needs.find((y) => y.id === x.need); return { st: x.st, hrs: proHrs(x), nst: nd.st, pub: x.pubOk }; }, g.id);
  ok(fin.st === 'done' && fin.hrs === 6 && fin.nst === 'done' && fin.pub, 'التسليم واعتماد الجمعية ينهيان المهمة والاحتياج ' + JSON.stringify(fin));
  const ms = await t.evaluate(() => { const r = (ADM.proIn || []); return r.filter((m) => m.status === 'done').length; });
  ok(ms >= 2, 'الطلبان معلَّمان «تمت المعالجة» في صندوق الوارد');
  await t.waitForTimeout(1600);  // مزامنة asirPro مع الخادم
  await t.evaluate(() => { ADM.prov.tab = 'over'; renderAdmin(); }); await t.waitForTimeout(300);
  await t.addScriptTag({ content: AXE });
  ax = await t.evaluate(async () => (await axe.run(document.querySelector('.jmain') || document.body, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));
  ok(!ax.length, 'axe على وحدة اللوحة ' + ax.join(' '));
  ok(!terr.length, 'بلا أخطاء في اللوحة ' + terr.join(' | '));

  // ما يراه الزائر بعد الإنجاز: أرقام ومخرج منشور، بلا بريد ولا جوال ولا تفاصيل احتياجات
  const html = await (await fetch(VIS + '/')).text();
  const st = JSON.parse(JSON.parse(html.match(/\/\*@STATE\*\/JSON\.parse\((".*?")\)\/\*@END\*\//s)[1])).asirPro;
  const pv = JSON.parse(st.value);
  ok(pv.stats && pv.stats.engs >= 1 && pv.stats.hours >= 6 && pv.showcase.some((x) => (x.story || '').includes(tag)), 'الزائر يرى الأرقام والمخرج المنشور');
  ok(!/@example\.org|"needs"|"email"|"phone"|"det"/.test(st.value), 'لا بيانات شخصية ولا تفاصيل احتياجات في الجزء العام');
  await p.goto(VIS + '/pro', { waitUntil: 'networkidle' });
  ok(await p.evaluate((tg) => document.querySelector('.xpstats') && [...document.querySelectorAll('.xpsc')].some((x) => x.textContent.includes(tg)) && [...document.querySelectorAll('.xpex b')].some((x) => x.textContent.includes(tg)), tag), 'الصفحة العامة تعرض الأثر والمخرج والخبير المعتمد');
  await b.close();
  console.log(`\n${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
