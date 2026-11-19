// 0.91: المكتبة المعرفية — البيانات في الخادم، صفحة الموقع، الإدارة من اللوحة، والظهور داخل الأدوات
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  // 1) الواجهة العامة للبيانات بلا دخول
  const r = await (await fetch(BASE + '/api/public/kb')).json();
  const items = r.data.items;
  ok(items.length >= 31 && r.data.collections.some((c) => c.id == 'ccsa-2025'), `public API: ${items.length} references and their source collection, no login`);
  ok(items.every((x) => !('src' in x) && !('status' in x)), 'public API hides internal fields (original link, status)');
  ok(items.filter((x) => x.kind == 'exreg').every((x) => !x.parent || items.some((y) => y.id == x.parent)), 'every executive regulation points to an existing law');
  ok(items.filter((x) => /tinyurl/.test(x.url || '')).length <= 4, 'most shortened links replaced with official sources');
  // 2) صفحة الموقع
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(700); await p.evaluate(() => go('library')); await p.waitForTimeout(1200);
  const pg = await p.evaluate(() => ({ g: $$('#kbPage .kbg').length, cats: $$('#kbPage .kbtoc button').length, cards: $$('#kbPage .kbfam').length, kids: $$('#kbPage .kbi.sub').length, src: !!$('#kbPage .kbsrc'), dis: !!$('#kbPage .kbdis'), nav: !!$('#nav a[href="#/library"]'), fresh: $$('#kbPage .kbnew a').length, st: !!$('#kbPage .kbst'), t: document.title }));
  ok(pg.g == 6 && pg.cats == 6 && pg.src && pg.dis && pg.nav && pg.st && pg.fresh >= 3, `library page: counts, «new and amended», topic index, source note, disclaimer, nav link (${pg.cards} families)`);
  ok(pg.kids >= 10 && pg.cards + pg.kids == items.length, 'executive regulations nested under their laws');
  await p.fill('#kbQ', 'التبرعات'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => $$('#kbPage .kbi').length >= 1 && $$('#kbPage .kbi').every((h) => /تبرع/.test(h.textContent)) && $$('#kbPage mark').length >= 1 && /نتائج|نتيجة/.test($('.kbcount').textContent)), 'search filters, highlights matches and shows the result count');
  await p.fill('#kbQ', ''); await p.waitForTimeout(400);
  await p.evaluate(() => $('[data-kk=guide]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $$('#kbPage .kbi').length == 3), 'kind filter: three self-assessment guides');
  await p.evaluate(() => $('[data-kv=cards]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => $$('#kbPage .kbc').length == 3 && localStorage.getItem('kbView') == 'cards'), 'card view available and remembered');
  await p.evaluate(() => $('[data-kv=list]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { KBS.kind = 'all'; go('library/ex-donate') }); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!$('#kb-ex-donate.hl')), 'deep link highlights the regulation within its law family');
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => go('library')); await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'library page fits a phone screen');
  await p.screenshot({ path: 'tests/out/kb-mobile.png' });
  await p.setViewportSize({ width: 1366, height: 900 });
  // 3) الإدارة من اللوحة
  await p.evaluate(() => go('admin')); await p.waitForTimeout(1200);
  await p.evaluate(() => { ADM.content = 'kb'; goMod('content') }); await p.waitForTimeout(1200);
  const ad = await p.evaluate(() => ({ rows: $$('#ctBody tbody tr').length, warn: $$('#ctBody .pill2.p-warn').length }));
  ok(ad.rows >= 31 && ad.warn >= 6, `admin tab lists every reference, flags unofficial links (${ad.warn})`);
  await p.evaluate(() => kbEdit()); await p.waitForTimeout(400);
  const nid = 'kb-test-' + Date.now().toString(36);
  await p.evaluate((nid) => { const f = $('#kbF'); f.title.value = 'دليل تجريبي للاختبار'; f.id.value = nid; f.cat.value = 'council'; f.kind.value = 'guide'; f.url.value = 'https://example.org/guide.pdf'; $('#modal [data-ug="tr|تعثر مالي"]').checked = true; }, nid);
  await p.click('#kbGo'); await p.waitForTimeout(1000);
  let pub = (await (await fetch(BASE + '/api/public/kb')).json()).data.items;
  ok(!pub.some((x) => x.id == nid), 'a new reference is saved as a draft and stays off the public site');
  await p.evaluate(async (nid) => { await api('/api/kb/' + nid, { method: 'PATCH', body: JSON.stringify({ status: 'published' }) }) }, nid);
  pub = (await (await fetch(BASE + '/api/public/kb')).json()).data.items;
  ok(pub.some((x) => x.id == nid && x.cat == 'council' && x.links.tr.includes('تعثر مالي')), 'publishing it shows it publicly with its tool links');
  await p.evaluate((id) => kbReviewed(id), 'ru-coord'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => KB.by['ru-coord'].reviewed == new Date().toISOString().slice(0, 10)), '«reviewed today» records the review date');
  const bad = await p.evaluate(async () => { try { await api('/api/kb/ru-coord', { method: 'PATCH', body: JSON.stringify({ url: 'javascript:alert(1)' }) }); return 'saved' } catch (e) { return e.message } });
  ok(bad != 'saved', 'only https links are accepted');
  // 4) داخل الأدوات
  const ctx = await p.evaluate(() => ({ tr: kbFor('tr', ['تعثر مالي']).map((x) => x.id), pj: kbFor('pj', ['hr']).length, pf: kbHint('volSt'), hs: kbFor('hs', ['a_gov']).length }));
  ok(ctx.tr.includes('gd-finance') && ctx.pj >= 3 && /نظام العمل التطوعي/.test(ctx.pf) && ctx.hs >= 1, 'references attach to trouble types, project kinds, portal fields and requirements');
  const aid = await p.evaluate(() => { const o = DB.find((x) => !x.closed && !trCase(x.id)); TRB.cases.push({ aid: o.id, types: ['تعثر مالي'], sev: 'متوسطة', st: 'open', at: new Date().toISOString(), upd: new Date().toISOString(), log: [] }); return o.id; });
  await p.evaluate((aid) => trOpen(aid), aid); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => !!$('[data-c=kb] .kbr') && /السلامة المالية/.test($('[data-c=kb]').textContent)), 'trouble case page shows the regulations for its trouble types');
  await p.evaluate((aid) => { TRB.cases = TRB.cases.filter((c) => c.aid != aid) }, aid);
  const ex = await p.evaluate(() => { const o = DB.find((x) => !x.closed && x.st == 'منتهي'); return o && o.id; });
  await p.evaluate((i) => { open360(i, 'req') }, ex); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !!$('#a5eval .kbr')), 'association evaluation links regulations for unmet requirements');
  await p.evaluate(async (nid) => { await api('/api/kb/' + nid, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) }) }, nid);
  ok(errs.length == 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
