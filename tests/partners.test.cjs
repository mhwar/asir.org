// الشراكات بسجل كامل واستيراد الفعاليات المنتهية من المحتوى (0.48)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const E = (p, f, a) => Promise.race([p.evaluate(f, a), new Promise((_, rj) => setTimeout(() => rj(new Error('evaluate timeout')), 20000))]);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } else console.log('ok  ' + m) };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); await p.addInitScript(() => { window.__noConfirm = true }); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/#/admin/partners'); await p.waitForTimeout(1800);
  const snap = await E(p, () => JSON.stringify({ p: PARTNERS, e: EVTS, pj: PROJS }));
  // 1) التطبيع: كل شراكة لها حقول السجل، وتاريخ البداية يُستنتج من التاريخ العربي
  const n = await E(p, () => { ptNorm(); const x = PARTNERS.find((z) => z.id == 16); return { all: PARTNERS.every((z) => Array.isArray(z.obl) && z.cont && Array.isArray(z.pids) && Array.isArray(z.log)), from: x && x.from, iso: arISO('15 أغسطس 2025'), y: arISO('2024'), kpis: $$('#ptBody .kpi').length, rows: $$('#ptBody [data-po]').length } });
  ok(n.all && n.from == '2026-04-01' && n.iso == '2025-08-15' && n.y == '2024-01-01' && n.kpis == 5 && n.rows > 10, 'partners normalised; Arabic dates parsed; KPIs and rows rendered');
  // 2) إنشاء شراكة بمدة 12 شهراً ثم فتحها
  const c = await E(p, () => { ptNew(); const F = $('#ptF'); F.n.value = 'جهة اختبار الشراكة'; F.from.value = '2026-01-01'; F.dur.value = '12'; F.dur.onchange(); F.goal.value = 'هدف تجريبي'; F.st.value = 'سارية'; F.requestSubmit(); return new Promise((r) => setTimeout(() => { const x = PARTNERS.find((z) => z.n == 'جهة اختبار الشراكة'); r({ to: x && x.to, open: ADM.mod == 'pt' && !!document.querySelector('.aspage'), title: $('#adrawer .dh').textContent, days: ptDays(x), soon: ptSoon(x), id: x && x.id }) }, 400)) });
  ok(c.to == '2026-12-31' && c.open && c.title.includes('جهة اختبار الشراكة') && c.days > 0 && c.soon, 'partnership created with 12-month term, drawer opens, expiry alert within 90 days');
  // 3) الالتزامات والمتابعة والوثائق والربط بمشروع
  const o = await E(p, (id) => { const x = ptById(id); ADM.ptTab = 'ob'; ptOpen(id); const f = $('#obA'); f.t.value = 'تقديم تدريب'; f.who.value = 'الشريك'; f.requestSubmit(); $('[data-ob="0"]').click(); ADM.ptTab = 'fu'; ptOpen(id); const fu = $('#fuA'); fu.t.value = 'اجتماع تنسيقي'; fu.next.value = '2020-01-01'; fu.requestSubmit(); ADM.ptTab = 'lk'; ptOpen(id); const dc = $('#dcA'); dc.t.value = 'نسخة الاتفاقية'; dc.requestSubmit(); return { obl: x.obl.length, done: x.obl[0].done, prog: ptProg(x), fu: x.log.filter((l) => l.k == 'fu').length, next: x.next, alert: ptAlerts().some((z) => z.id == id), docs: x.docs.length, tabs: $$('#adrawer [data-ptt]').length } }, c.id);
  ok(o.obl == 1 && o.done && o.prog == 1 && o.fu == 1 && o.alert && o.docs == 1 && o.tabs == 5, 'obligations, follow-up (with due reminder), documents recorded');
  const pj = await E(p, (id) => { const x = ptById(id); ADM.ptPjFor = id; pjCreate({ n: 'مشروع شراكة اختبار', kind: 'custom' }); $('#pjGo').click(); return new Promise((r) => setTimeout(() => { const p = PROJS.find((z) => z.n == 'مشروع شراكة اختبار'); r({ linked: p && x.pids.includes(p.id) && p.partners.some((q) => q.ptId == id), cnt: ptProjects(x).length, pid: p && p.id }) }, 400)) }, c.id);
  ok(pj.linked && pj.cnt == 1, 'project created from partnership is linked both ways');
  // 4) التجديد والفلاتر والبطاقات
  const rn = await E(p, (id) => { const x = ptById(id); x.to = '2020-06-30'; ADM.ptTab = 'ov'; ptOpen(id); const lapsed = !!$('#ptRenew') && ptLapsed(x); $('#ptRenew').click(); const F = $('#rnF'); F.from.value = '2026-02-01'; F.dur.value = '24'; F.requestSubmit(); ADM.pt.f = 'act'; ADM.pt.vc = 'cards'; goMod('partners'); return new Promise((r) => setTimeout(() => r({ lapsed, st: x.st, to: x.to, cards: $$('#ptBody .pcard').length > 0, inAct: [...$$('#ptBody [data-po]')].some((d) => d.dataset.po == id) }), 500)) }, c.id);
  ok(rn.lapsed && rn.st == 'مجدَّدة' && rn.to == '2028-01-31' && rn.cards && rn.inAct, 'lapsed partnership renewed for 24 months; card view and filters work');
  // 5) الفعاليات المستوردة من المحتوى
  await E(p, () => goMod('mops')); await p.waitForTimeout(800);
  const ev = await E(p, () => { const imp = EVTS.list.filter((e) => e.src == 'content'); const t = imp.find((e) => e.nid == 'x-ev-tawasul'); ADM.evF = 'done'; AM.mops($('#acontent')); const rows = $$('#acontent [data-ev]').length; const yrs = $$('#acontent [data-ey]').length; return { n: imp.length, kinds: [...new Set(imp.map((e) => e.kind))], t: t && { kind: t.kind, st: t.st, d: t.d, pub: t.pub, ct: !!evCt(t) }, rows, yrs, hdr: $('#acontent thead').textContent } });
  ok(ev.n >= 20 && ev.kinds.includes('forum') && ev.kinds.includes('program') && ev.t && ev.t.kind == 'forum' && ev.t.st == 'done' && ev.t.d == '2026-08-15' && ev.t.pub && ev.t.ct && ev.rows >= 20 && ev.yrs >= 3 && ev.hdr.includes('النتائج'), 'past events/programs imported from content as ended with year filters and results column');
  const ov = await E(p, () => { ADM.evTab = 'ov'; evOpen('c-x-ev-tawasul'); const html = $('#adrawer').innerHTML; $('#evOut').value = '300 مشارك'; $('#evOut').onchange(); return { src: html.includes('من المحتوى والأخبار'), out: !!$('#evOut'), saved: EVTS.list.find((e) => e.id == 'c-x-ev-tawasul').out == '300 مشارك' } });
  ok(ov.src && ov.out && ov.saved, 'ended event drawer shows source news and editable outcomes');
  const del = await E(p, async () => { const e = EVTS.list.find((z) => z.id == 'c-x-ev-tot'); evEdit(e.id); $('#eeDel').click(); await new Promise((r) => setTimeout(r, 30)); const gone = !EVTS.list.some((z) => z.id == 'c-x-ev-tot'); evSync(); return { gone, skip: EVTS.skip.includes('x-ev-tot'), still: !EVTS.list.some((z) => z.id == 'c-x-ev-tot') } });
  ok(del.gone && del.skip && del.still, 'deleted imported event is not re-imported');
  await E(p, (x) => { const o = JSON.parse(x); PARTNERS = o.p; EVTS = o.e; PROJS = o.pj; savePartners(); evSave(); pjSave(); return new Promise((r) => setTimeout(r, 2500)) }, snap);
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close();
})();
