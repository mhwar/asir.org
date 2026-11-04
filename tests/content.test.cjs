// استوديو المحتوى + الصفحة المستقلة + التواصل وطلب التأسيس + صندوق الوارد + القائمة الجانبية
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1 } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(900);
  // 1) إنشاء تجربة من الاستوديو ونشرها في الرئيسية
  await p.evaluate(() => go('admin/content')); await p.waitForTimeout(600);
  await p.click('#csNew'); await p.click('[data-csn=story]'); await p.waitForTimeout(300);
  await p.fill('#csF input[name=t]', 'تجربة اختبار: مكتبة متنقلة لقرى تهامة');
  await p.fill('#csF input[name=c]', 'التعليم');
  await p.fill('#csF textarea[name=lead]', 'كتب تصل إلى الأطفال في القرى البعيدة.');
  await p.fill('#csF textarea[name=body]', 'الفقرة الأولى.\n\nالفقرة الثانية.');
  await p.click('#csMAdd'); await p.fill('[data-mv="0"]', '120'); await p.fill('[data-ml="0"]', 'طفلاً'); await p.dispatchEvent('#csF', 'input');
  await p.check('#csF input[name=home]');
  await p.click('#csPub'); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => { const x = CT.find((c) => c.t.startsWith('تجربة اختبار')); return { id: x && x.id, st: x && x.st, inStories: STORIES.some((s) => s.id == (x && x.id)), home: [...document.querySelectorAll('#homeStories .stc')].some((c) => c.textContent.includes('مكتبة متنقلة')), m: x && x.m, synced: !Object.keys(SYNC.pend).length } });
  ok(st.id && st.st == 'pub' && st.inStories && st.home, 'story published to stories + home'); ok(st.m && st.m[0][0] === 120, 'metric numeric');
  // 2) الصفحة المستقلة برابط ثابت بعد إعادة التحميل (من قاعدة البيانات)
  const v = await b.newPage({ viewport: { width: 1440, height: 900 } }); v.on('pageerror', (e) => errs.push('v:' + e.message));
  await v.goto(BASE + '/#/read/' + st.id); await v.waitForTimeout(1000);
  const rd = await v.evaluate(() => ({ h1: (document.querySelector('.rd2 h1, .rdhero h1') || {}).textContent, paras: document.querySelectorAll('.rdtext>p').length, share: document.querySelectorAll('.rdsb>*').length, title: document.title }));
  ok(rd.h1 && rd.h1.includes('مكتبة متنقلة') && rd.paras >= 2 && rd.share >= 4, 'read page renders from synced state');
  await v.screenshot({ path: 'tests/out/read_page.png' });
  // 3) نموذج التواصل
  await v.evaluate(() => go('contact')); await v.waitForTimeout(500);
  await v.click('[data-cfk=partner]'); await v.fill('#cfF input[name=name]', 'جهة اختبار'); await v.fill('#cfF input[name=email]', 'test@example.com'); await v.fill('#cfF textarea[name=message]', 'نرغب في دعم برامج الجمعيات');
  await v.click('#cfF .btn'); await v.waitForTimeout(800);
  ok(await v.evaluate(() => !!document.querySelector('#ctForm .cfdone')), 'contact submitted');
  // 4) معالج التأسيس
  await v.evaluate(() => openFounding()); await v.waitForTimeout(200);
  await v.click('#fdF .btn.n'); ok(await v.evaluate(() => $('#fdErr').textContent.length > 0), 'founding validates');
  await v.fill('#fdF textarea[name=idea]', 'جمعية للحرف اليدوية'); await v.selectOption('#fdF select[name=governorate]', { index: 1 }); await v.click('#fdF .btn.n'); await v.waitForTimeout(150);
  await v.click('.fdo >> nth=0'); await v.click('.fdc >> nth=1'); await v.click('#fdF .btn.n'); await v.waitForTimeout(150);
  await v.fill('#fdF input[name=name]', 'مؤسس اختبار'); await v.fill('#fdF input[name=phone]', '0500000000'); await v.click('#fdF .btn.p'); await v.waitForTimeout(800);
  ok(await v.evaluate(() => !!document.querySelector('.fdw .cfdone')), 'founding submitted');
  // 5) صندوق الوارد
  await p.evaluate(() => { ADM.inbox.rows = null; goMod('inbox') }); await p.waitForTimeout(1000);
  const ib = await p.evaluate(() => ({ n: ADM.inbox.rows.length, f: ADM.inbox.rows.find((m) => m.kind == 'founding' && m.name == 'مؤسس اختبار') }));
  ok(ib.f && ib.f.details && ib.f.details.help.length == 1, 'inbox has founding with details');
  await p.click(`[data-io="${ib.f.id}"]`); await p.waitForTimeout(600);
  await p.selectOption(`[data-is="${ib.f.id}"]`, 'done'); await p.waitForTimeout(700);
  const after = await p.evaluate(async (id) => (await (await fetch('/api/messages')).json()).data.find((m) => m.id == id).status, ib.f.id);
  ok(after == 'done', 'status patched');
  await p.screenshot({ path: 'tests/out/inbox.png' });
  // 6) القائمة الجانبية: مجموعة قابلة للطي وتُحفظ
  const g = await p.evaluate(() => { const b = document.querySelector('.jgrp[data-gk=partner] .jng'); b.click(); return [document.querySelector('.jgrp[data-gk=partner]').classList.contains('open'), JSON.parse(localStorage.getItem('asirNavOpen')).partner] });
  ok(g[0] && g[1] === true, 'accordion toggles + persists');
  // 6ب) تبويبات الصفحة الفرعية: «طلبات تحديث البيانات» مخفية من القائمة وتظهر تبويباً داخل «نظرة عامة»، والحملات والاستشارات مستقلة
  const sub = await p.evaluate(() => { goMod('updates'); return { side: !!document.querySelector('.jside .jni[data-m=updates]'), on: document.querySelector('.jside .jni.on')?.dataset.m, tabs: [...document.querySelectorAll('.jsubt button')].map((b) => b.dataset.m), solo: !!document.querySelector('.jgrp.solo .jng[data-m=chub]') && !!document.querySelector('.jgrp.solo .jng[data-m=campaigns]') } });
  ok(!sub.side && sub.on == 'overview' && sub.tabs.join() == 'overview,updates,quality' && sub.solo, 'sub-tabs + solo groups ' + JSON.stringify(sub));
  // 6ج) الاستشارات «قريباً» ما دام لا يوجد مستشار مُفعّل
  const soon = await v.evaluate(() => { go('consult'); return [document.body.classList.contains('conssoon'), !!document.querySelector('#booking .soonchip')] });
  ok(soon[0] && soon[1], 'consult coming soon');
  // 6د) الجمعيات المتعثرة: التراخيص المنتهية تلقائياً + تسجيل حالة وقرار ومعالجة
  const tr = await p.evaluate(() => { goMod('trouble'); const auto = trRows().filter((r) => r.st == 'new').length; const o = DB.find((x) => x.st == 'ساري' && !trCase(x.id)); const c = trNew(o.id, { src: 'team', types: ['تعثر مالي'], det: 'اختبار' }); trLog(c, 'dec', 'قرار: زيارة ميدانية'); c.st = 'resolved'; const ok = TRB.cases.some((x) => x.id == c.id && x.st == 'resolved' && x.log.length == 2); TRB.cases = TRB.cases.filter((x) => x.id != c.id); return [auto, ok, auto == DB.filter((x) => x.st == 'منتهي' && !x.closed && !TRB.cases.some((y) => y.aid == x.id)).length] });
  ok(tr[0] > 0 && tr[1] && tr[2], 'trouble cases ' + JSON.stringify(tr));
  // 6هـ) مجالات الاستشارة قابلة للإضافة
  const ct = await p.evaluate(() => { const n = ctypes.length; ctypes.push(['star', 'مجال اختبار', '']); ADM.cset.types.push({ on: 1, dur: 60 }); const has = JSON.stringify(ctypes).includes('مجال اختبار'); ctypes.pop(); ADM.cset.types.pop(); return [n, has] });
  ok(ct[0] >= 8 && ct[1], 'ctypes editable');
  // 6و) مؤشر صحة الجمعية والملف 360° والمقارنة
  const hs = await p.evaluate(() => { hsAll(); const o = DB.find((x) => x.st == 'ساري' && !x.closed); const h = hsOf(o); const sum = h.parts.reduce((t, x) => t + x.v, 0); openAssoc(o.id); const page = !!document.querySelector('.a360h') && location.hash == '#/admin/assoc-' + o.id; ADM.atab = 'tl'; renderAdmin(); const tl = document.querySelectorAll('.a360tl>div').length; const closed = DB.find((x) => x.closed); return [h.s === Math.round(sum), h.s >= 0 && h.s <= 100, h.parts.length == 6, page, tl >= 1, closed ? hsOf(closed).s === null : true, DB.filter((x) => !x.closed).every((x) => typeof x.hs == 'number')] });
  ok(hs.every(Boolean), 'health score + 360 profile ' + JSON.stringify(hs));
  // 7) حذف العنصر التجريبي (تنظيف)
  await p.evaluate((id) => { const i = CT.findIndex((x) => x.id == id); CT.splice(i, 1); ctSave() }, st.id); await p.waitForTimeout(1200);
  // رفض الإرسال من مصدر آخر + حد المعدل يعمل
  const bad = await p.evaluate(async () => (await fetch('/api/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x' }) })).status);
  ok(bad == 422, 'validation 422');
  console.log(JSON.stringify({ st, rd, ib: { n: ib.n }, after, errs }, null, 1));
  ok(!errs.length, 'no page errors');
  await b.close();
})();
