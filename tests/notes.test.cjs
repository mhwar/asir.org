// سجل الملاحظات: ملاحظة من اللوحة تظهر في رابط التحديث، ثم الصفحة العامة والطباعة
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/'); await p.waitForTimeout(800);
  const { id, lic } = await p.evaluate(() => { const o = DB.find((o) => !o.closed && o.issues.length && o.lic && LOGO[o.id]) || DB.find((o) => !o.closed && o.lic); return { id: o.id, lic: o.lic } });
  const add = await p.evaluate(async (id) => api(`/api/associations/${id}/notes`, { method: 'POST', body: JSON.stringify({ text: 'الشعار غير واضح، نرجو رفع نسخة أعلى دقة', field: 'logo' }) }), id);
  await p.evaluate(async (id) => api(`/api/associations/${id}/notes`, { method: 'POST', body: JSON.stringify({ text: 'ملاحظة داخلية للفريق فقط', visible: false }) }), id);
  await p.evaluate(() => { go('admin') }); await p.waitForTimeout(500);
  await p.evaluate((id) => recEdit(id, 'notes'), id); await p.waitForTimeout(900);
  await p.screenshot({ path: 'tests/out/notes_dash.png' });
  const link = await p.evaluate(async (id) => (await api('/api/update-links', { method: 'POST', body: JSON.stringify({ association_ids: [id] }) })).links[0], id);
  // الصفحة العامة
  await p.evaluate(() => closeAll());
  await p.evaluate((id) => { location.hash = '#/association/' + id }, lic); await p.waitForTimeout(900);
  await p.screenshot({ path: 'tests/out/pub_page.png', fullPage: true });
  // الطباعة
  const F = await p.evaluate(async (id) => { const F = await recFull(id); window.print = () => {}; profilePDF(F, { gen: 1, prof: 1, con: 1, lead: 1, notes: 1, mask: 1 }); return F.notes.length }, id);
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(300);
  await p.pdf({ path: 'tests/out/profile.pdf', format: 'A4', margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' }, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  // الجوال: الصفحة العامة + البوابة
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); m.on('pageerror', (e) => errs.push('m:' + e.message));
  await m.goto(BASE + '/#/association/' + lic); await m.waitForTimeout(1000);
  await m.screenshot({ path: 'tests/out/pub_page_m.png', fullPage: true });
  const u = await b.newPage({ viewport: { width: 390, height: 844 } }); u.on('pageerror', (e) => errs.push('u:' + e.message));
  await u.goto(link.url); await u.fill('input[name=pin]', link.pin); await u.click('button'); await u.waitForTimeout(1300);
  const portal = await u.evaluate(() => ({ notes: PORTAL.notes, card: !!document.querySelector('#ps_notes'), noted: document.querySelectorAll('.fld.noted').length }));
  await u.screenshot({ path: 'tests/out/portal_notes.png' });
  console.log(JSON.stringify({ id, add: add.notes.length, F, portal, errs }, null, 1));
  await b.close();
})();
