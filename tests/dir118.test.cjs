// 1.18: عرض سجل الجمعيات — شريط «ما يحتاج معالجة»، خلايا الجدول، البطاقات المنبثقة للملاحظات والتواصل،
// البطاقات المجمّعة، وعرض المحافظات بفهرس جانبي. عرض فقط: لا تغيير في البيانات.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  await p.evaluate(() => { ADM.dir.lay = 'table'; ADM.dir.view = 'main'; ADM.dir.cols = DVIEWS.main[1].slice(); DFIL.forEach((f) => ADM.dir[f[0]] = ''); ADM.dir.q = ''; renderAdmin() }); await W(p, 600);

  // 1) الشريط: خمس شرائح، أعدادها = dirList بالفلتر نفسه، والضغط يفعّل الفلتر ويلغيه
  const strip = await p.evaluate(() => $$('.dviss [data-iss]').map((b) => { const [k, v] = b.dataset.iss.split('|'); return { k, v, n: +b.querySelector('.n b').textContent.replace(/,/g, ''), want: dirList({ [k]: v }).length } }));
  ok(strip.length == 5 && strip.every((x) => x.n == x.want), 'issue strip counts match the existing filters ' + JSON.stringify(strip.map((x) => x.n)));
  await p.click('.dviss [data-iss="st|منتهي"]'); await W(p);
  ok(await p.evaluate(() => ADM.dir.st == 'منتهي' && $('.dviss [data-iss="st|منتهي"]').getAttribute('aria-pressed') == 'true' && dirList().every((o) => o.st == 'منتهي')), 'a chip applies its filter');
  const inScope = await p.evaluate(() => { const b = $('.dviss [data-iss="attn|crit"]'); return +b.querySelector('.n b').textContent.replace(/,/g, '') == dirList({ attn: 'crit' }).length && dirList({ attn: 'crit' }).every((o) => o.st == 'منتهي') });
  ok(inScope, 'other chips count within the current filter');
  await p.click('.dviss [data-iss="st|منتهي"]'); await W(p);
  ok(await p.evaluate(() => !ADM.dir.st), 'clicking the active chip clears it');

  // 2) خلايا الجدول
  ok(await p.evaluate(() => durAr(-2045) == 'منذ 5 سنوات و7 أشهر' && durAr(23) == 'بعد 23 يوماً' && durAr(-1) == 'منذ يوم' && durAr(-2) == 'منذ يومين' && durAr(400) == 'بعد سنة وشهر' && durAr(360) == 'بعد سنة' && durAr(-75) == 'منذ شهرين'), 'durations read as words');
  const cells = await p.evaluate(() => { const r = $('#dirT tbody tr'); return { hs: !!r.querySelector('.dvhs i em'), con: r.querySelectorAll('.dvci>span').length, lic: !!r.querySelector('.dvsm'), sub: /·/.test(r.querySelector('.jname small').textContent), grpCol: !ADM.dir.cols.includes('grp') } });
  ok(cells.hs && cells.con == 4 && cells.lic && cells.sub && cells.grpCol, 'row: effectiveness bar, four contact icons, licence duration, domain under the name ' + JSON.stringify(cells));

  // 2ب) 1.19: توزيع الأعمدة — الاسم يأخذ مساحة كافية، الأزرار في سطر، ولا «سليمة» تناقض ترخيصاً منتهياً
  const lay = await p.evaluate(() => { const th = $('#dirT th[data-col=n]'), a = $('#dirT tbody tr .dvaw'), bs = a ? [...a.children].map((x) => Math.round(x.getBoundingClientRect().top)) : []; return { name: Math.round(th.getBoundingClientRect().width), same: bs.length < 2 || Math.abs(bs[0] - bs[1]) < 3, fits: $('#dirT').scrollWidth <= $('.jtable.dirt').clientWidth + 1, ok: !$$('#dirT td[data-col=iss] .p-ok').length, rowH: Math.round($('#dirT tbody tr').getBoundingClientRect().height) } });
  ok(lay.name >= 280 && lay.same && lay.fits && lay.ok && lay.rowH <= 84, 'columns: name ≥280px, actions on one line, no horizontal scroll at 1440, rows ≤84px, no «سليمة» in the table ' + JSON.stringify(lay));
  // 3) البطاقات المنبثقة
  const nb = await p.$('#dirT [data-pop^="n:"]');
  if (nb) {
    await nb.hover(); await W(p, 500);
    const pn = await p.evaluate(() => { const pp = $('#dvpp'), id = +$('[data-pop^="n:"][aria-expanded=true]').dataset.pop.split(':')[1]; return { vis: !pp.hidden, items: pp.querySelectorAll('.dvppl li').length, want: DBI[id].issues.length, inView: pp.getBoundingClientRect().left >= 0 && pp.getBoundingClientRect().right <= innerWidth } });
    ok(pn.vis && pn.items == pn.want && pn.inView, 'hovering the notes badge shows each note, inside the screen ' + JSON.stringify(pn));
    await p.mouse.move(700, 120); await W(p, 500);
    ok(await p.evaluate(() => $('#dvpp').hidden), 'leaving the badge hides the popover');
  } else ok(true, 'no notes in local data (skipped)');
  await p.focus('#dirT [data-pop^="c:"]'); await W(p, 300);
  const pc = await p.evaluate(() => { const pp = $('#dvpp'); return { vis: !pp.hidden, rows: pp.querySelectorAll('.dvppc li').length, masked: !ADM.reveal ? !!pp.querySelector('.dvppn') : true, role: pp.getAttribute('role') } });
  ok(pc.vis && pc.rows == 4 && pc.masked && pc.role == 'dialog', 'keyboard focus opens the contact popover with four rows and the masking note ' + JSON.stringify(pc));
  await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => $('#dvpp').hidden && document.activeElement.matches('[data-pop^="c:"]')), 'Escape closes it and keeps focus on the trigger');
  const rows0 = await p.evaluate(() => location.hash);
  await p.click('#dirT [data-pop^="c:"]'); await W(p);
  ok(await p.evaluate((h) => !$('#dvpp').hidden && location.hash == h, rows0), 'clicking the icons opens the popover without opening the file');
  await p.click('#dvpp [data-ppo]'); await W(p, 900);
  ok(await p.evaluate(() => ADM.mod == 'assoc' || /assoc|360/.test(location.hash) || !!$('.a6hd')), '«فتح الملف» opens the association file');
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2000);

  // 4) البطاقات: التجميع
  await p.evaluate(() => { ADM.dir.lay = 'cards'; ADM.dir.cg = 'band'; renderAdmin() }); await W(p, 500);
  const cg = await p.evaluate(() => ({ secs: $$('.dvcsec').length, cards: $$('.dvcards .dcard').length, page: Math.min(ADM.dir.per, dirList().length), hs: !!$('.dcard .dchs'), dl: !!$('.dcard .dcdl .dvci') }));
  ok(cg.secs >= 1 && cg.cards == cg.page && cg.hs && cg.dl, 'cards grouped by effectiveness band, same page size ' + JSON.stringify(cg));
  ok(await p.evaluate(() => { const C = $$('.dvcards')[0].querySelectorAll('.dcard'), t = [...C].slice(0, 3).map((c) => Math.round(c.querySelector('.dcg').getBoundingClientRect().top)); return t.every((x) => Math.abs(x - t[0]) < 2) }), 'cards in a row line up (name clamped to two lines)');
  const before = await p.evaluate(() => ADM.dir.sel.size);
  await p.click('.dvcsec [data-gsel]'); await W(p);
  ok(await p.evaluate((b0) => ADM.dir.sel.size > b0 && !!$('.dvbulk'), before), '«تحديد المجموعة» selects the group and shows the bulk bar');
  await p.evaluate(() => { ADM.dir.sel.clear(); renderAdmin() }); await W(p);
  await p.click('[data-cg=none]'); await W(p);
  ok(await p.evaluate(() => ADM.dir.cg == 'none' && $$('.dvcsec').length == 1 && !$('.dvcsec header')), 'grouping can be switched off');
  await p.click('[data-cg=band]'); await W(p);

  // 5) المحافظات
  await p.evaluate(() => { ADM.dir.lay = 'gov'; ADM.dir.gx = null; renderAdmin() }); await W(p, 500);
  const gv = await p.evaluate(() => ({ rail: $$('.dvgr [data-gj]').length, secs: $$('.dvgm>.dvgsec').length, open: $$('.dvgsec.op').length, kpi: $$('.dvgsec.op .dvgk>div').length, rows: $$('.dvgsec.op .dvgt tbody tr').length, total: $$('.dvgr small').reduce((a, x) => a + +x.textContent, 0), want: dirList().length }));
  ok(gv.rail == gv.secs && gv.open == 1 && gv.kpi == 5 && gv.rows >= 1 && gv.rows <= 5 && gv.total == gv.want, 'governorates: rail = sections, first expanded with 5 figures and the weakest rows ' + JSON.stringify(gv));
  await p.click('.dvgm>.dvgsec:nth-child(3) [data-gx]'); await W(p);
  ok(await p.evaluate(() => $$('.dvgsec.op').length == 2 && document.activeElement.matches('[data-gx]')), 'expanding another governorate keeps focus on its toggle');
  await p.click('.dvgr [data-gj="5"]'); await W(p, 700);
  ok(await p.evaluate(() => $('#dvg-5').classList.contains('op')), 'the rail expands the chosen governorate');
  ok(await p.evaluate(() => $$('.dvgsec.op').every((s) => s.scrollWidth <= s.clientWidth + 1)), 'governorate tables fit inside their section');

  // 6) دور الاطلاع: لا إجراءات سريعة في البطاقات ولا «تسجيل تواصل» في المنبثقة
  await p.evaluate(() => { window.__pp = SESSION.perms; SESSION.perms = { '*': 'read' }; ADM.dir.lay = 'cards'; renderAdmin() }); await W(p, 400);
  await p.focus('.dcard [data-pop^="c:"]'); await W(p, 300);
  ok(await p.evaluate(() => !$('[data-qlink]') && !$('[data-qlog]') && !$('#dvpp [data-ppl]')), 'read-only role gets no quick write actions');
  await p.evaluate(() => { SESSION.perms = window.__pp; renderAdmin() });

  // 7) الجوال
  await p.setViewportSize({ width: 390, height: 844 });
  for (const lay of ['table', 'cards', 'gov']) { await p.evaluate((l) => { ADM.dir.lay = l; renderAdmin() }, lay); await W(p, 400); ok(await p.evaluate(() => document.documentElement.scrollWidth <= 391), 'mobile ' + lay + ': no horizontal overflow') }

  // 8) الحزمة العامة لا تحمل شيئاً من هذا
  const dist = path.join(__dirname, '..', 'dist', 'site');
  const pub = fs.readdirSync(path.join(dist, 'assets')).filter((f) => /^pub\..*\.js$/.test(f)).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('');
  ok(pub.length > 0 && !/dvIssStrip|dvPopHtml|DVCG/.test(pub), 'public bundle has none of the team-only registry code');
  ok(errs.length == 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
