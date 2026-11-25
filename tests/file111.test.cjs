// 1.11: ملف الجمعية بتبويبات (البيانات، التحليل، السجل) في صف لاصق مع البحث؛ البيانات أربع بطاقات للقراءة،
// والجدول الكامل صار «وضع التدقيق»؛ والبحث يشمل الملف كله ويتجاهل فروق الكتابة ولا يكشف البيانات المخفية.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
const W = (p, ms) => p.waitForTimeout(ms || 300);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/#/admin/directory'); await W(p, 2500);
  const id = await p.evaluate(() => DB.find((o) => /آباء/.test(o.n)).id);
  await p.evaluate((id) => { ADM.a5tab = ''; ADM.a6aud = 0; ADM.a6t = {}; open360(id) }, id); await W(p, 2500);
  ok(await p.evaluate(() => $$('.a6tabs [data-a6tab]').length == 4 && $('.a6tabs .on').dataset.a6tab == 'data' && !!$('#a6q')), 'sticky row: four tabs (data first) and the search box');
  ok(await p.evaluate(() => !!$('#a5data') && !$('#a5eval') && !$('#a5rel')), 'only the chosen section is rendered');
  ok(await p.evaluate(() => $$('.a6c').length == 4 && $$('.a6c .a6ct button').length == 8 && !$('.a5t')), 'data: four reading cards with two tabs each, no table');
  ok(await p.evaluate((id) => { const F = a5Fields(DBI[id], ADM.a360f && ADM.a360f.data); return F.every((f) => A6GT[f.g]) && new Set(F.map((f) => f.g)).size == 8 }, id), 'every field group has a card (no field lost)');
  const first = await p.evaluate(() => $('.a6c .a6r') ? getComputedStyle($('.a6row')).position + ':' + Math.round($('.a6c .a6r').getBoundingClientRect().top) : '');
  ok(/^sticky:/.test(first) && +first.split(':')[1] < 900, 'first value visible without scrolling (' + first + ')');
  await p.click('[data-a6t="con:con"]'); await W(p);
  ok(await p.evaluate(() => $('[data-a6c=con] .a6ct .on').textContent.includes('قنوات') && ADM.a6t.con == 'con'), 'card tab switches and is remembered');
  const rq = await p.evaluate(() => { const b = $('[data-a6rq]'); return b ? b.dataset.a6rq.split(',').length + '|' + b.textContent : '' });
  ok(!rq || +rq.split('|')[0] == +rq.split('|')[1].replace(/\D/g, ''), '«طلب N ناقص» carries exactly N missing keys (' + rq + ')');
  // audit mode = the full table of 1.10
  await p.click('[data-a6aud]'); await W(p);
  ok(await p.evaluate(() => !!$('.a5t') && $$('.a5vt button').length == 7 && !$('.a6c') && $('[data-a6aud]').getAttribute('aria-pressed') == 'true'), 'audit mode shows the full table with views and filters');
  await p.click('[data-a6aud]'); await W(p);
  ok(await p.evaluate(() => $$('.a6c').length == 4), 'audit off returns to cards');
  // tabs
  await p.click('[data-a6tab=eval]'); await W(p);
  ok(await p.evaluate(() => !!$('#a5eval') && !$('#a5data') && $$('.a5axw [data-a5ax]').length == 5 && !!$('.a5ix b') && !!$('.a6gg') && !!$('.a6rd') && !$('[data-a6aud]')), 'analysis tab: index and five axes; audit toggle hidden');
  await p.click('[data-a6tab=rel]'); await W(p);
  ok(await p.evaluate(() => !!$('#a5rel') && $$('#a5rel .a5kp > div').length == 6), 'log tab: relation facts and activity');
  await p.evaluate(() => a5Go('data', 'scope')); await W(p, 500);
  ok(await p.evaluate(() => ADM.a5tab == 'data' && ADM.a6aud == 1 && !!$('.a5ins [data-sct]')), 'a5Go(data, scope) opens the scope editor in audit mode');
  await p.evaluate(() => { ADM.a6aud = 0; ADM.a5tab = 'eval'; AM.assoc($('#acontent')) }); await W(p);
  // 1.12: header, four cards, collapse, projects, membership
  ok(await p.evaluate(() => !!$('.a6hd') && $$('.a6top .a6tc').length == 4 && !$('.a5st') && !$('.a5num')), 'identity header and four top cards (contact, membership, activities, needs)');
  await p.click('[data-a6col]'); await W(p);
  ok(await p.evaluate(() => $('.a6hd').classList.contains('col') && !$('.a6top') && getComputedStyle($('.a6hd')).position == 'sticky'), 'collapse folds the header and cards into one sticky line');
  await p.click('.a6ha [data-a6col]:last-child'); await W(p);
  ok(await p.evaluate(() => $$('.a6top .a6tc').length == 4), 'expand restores the cards');
  await p.click('[data-a5ax=comp]'); await W(p);
  ok(await p.evaluate(() => $('.a5axw .on').dataset.a5ax == 'comp' && $$('.a5axd tbody tr').length >= 2), 'picking an axis shows its indicators');
  await p.click('[data-a6tab=pj]'); await W(p);
  const pj = await p.evaluate((id) => { const L = a6Links(DBI[id]); return { n: L.filter((r) => r.ok).length, rows: $$('.a6plt tbody tr').length, kp: $$('.a6pk > div').length, open: L.filter((r) => r.ok && r.open).length } }, id);
  ok(pj.kp == 4 && pj.rows == pj.open, 'projects tab: summary tiles and one row per open link (' + pj.open + ' of ' + pj.n + ')');
  if (pj.rows > 1) { await p.click('.a6plt tbody tr:nth-child(2)'); await W(p); ok(await p.evaluate(() => $('.a6plt tr.on') == $$('.a6plt tbody tr')[1] && !!$('.a6pd h3')), 'selecting a row fills the side panel') }
  await p.evaluate((id) => a6Mem(id), id); await W(p, 400);
  await p.selectOption('#mmT', 'b'); await p.fill('#mmE', '2027-12-31'); await p.click('#mmGo'); await W(p, 600);
  ok(await p.evaluate((id) => a6MemOf(id).t == 'b' && /العضوية الكاملة ب/.test($('.a6mem').textContent) && /2027-12-31/.test($('.a6top').textContent), id), 'membership saved manually and shown in the header and its card');
  await p.evaluate((id) => { delete LISTS.mem[id]; listsSave(); ADM.a5tab = 'eval'; AM.assoc($('#acontent')) }, id); await W(p, 400);
  // search
  const find = (q) => p.evaluate(([id, q]) => a6Find(DBI[id], a5Fields(DBI[id], ADM.a360f && ADM.a360f.data), q).map((x) => x.g + ':' + x.t), [id, q]);
  const r1 = await find('احسان'), r2 = await find('ايميل'), r3 = await find('الاداره'), r4 = await find('تواصل');
  ok(r1.some((x) => /إحسان/.test(x)), 'hamza-insensitive: «احسان» finds «منصة إحسان»');
  ok(r2.some((x) => /البريد/.test(x)), 'synonym: «ايميل» finds the e-mail fields');
  ok(r3.some((x) => /مجلس الإدارة/.test(x)), 'ta-marbuta and hamza: «الاداره» finds board fields');
  ok(r4.some((x) => x.startsWith('إجراء:')) && r4.some((x) => x.startsWith('بيانات:')), 'results span data and actions (' + r4.length + ')');
  const leak = await p.evaluate((id) => { ADM.reveal = false; const o = DBI[id], q = String(o.mobile || '').slice(-6); return q.length == 6 ? a6Find(o, a5Fields(o, ADM.a360f && ADM.a360f.data), q).filter((x) => x.g == 'بيانات').length : 0 }, id);
  ok(leak === 0, 'masked personal values are not searchable');
  await p.fill('#a6q', 'النطاق'); await W(p);
  ok(await p.evaluate(() => !$('#a6res').hidden && $$('#a6res [data-a6i]').length >= 1 && /في البيانات/.test($('.a6rh').textContent)), 'typing opens a grouped results list');
  await p.click('#a6res [data-a6i]'); await W(p, 500);
  ok(await p.evaluate(() => ADM.a5tab == 'data' && $('[data-a6c=place] .a6ct .on').textContent.includes('النطاق')), 'picking a data result jumps to its card and tab');
  await p.fill('#a6q', 'ززززز'); await W(p);
  ok(await p.evaluate(() => /لا نتائج/.test($('.a6rh').textContent) && !!$('.a6rn')), 'no results: guidance and the masked-data note');
  await p.keyboard.press('Escape'); await W(p);
  ok(await p.evaluate(() => $('#a6res').hidden && $('#a6q').value == ''), 'Escape clears the search');
  // mobile
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => AM.assoc($('#acontent'))); await W(p, 500);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && $$('.a6c').length == 4), 'mobile: no horizontal overflow, cards stack');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await p.screenshot({ path: '/tmp/rp/f111m.png' });
  await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => { scrollTo(0, 0); AM.assoc($('#acontent')) }); await W(p, 500); await p.screenshot({ path: '/tmp/rp/f111.png' });
  await b.close();
})();
