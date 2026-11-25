// 1.17: اختبار وحدة لمزامنة سجام في الخادم (fetch وD1 مقلَّدان): لا يُعلَّم شيء «اختفى» عند رد ناقص،
// الدمج يحفظ تاريخ أول ظهور والمطابقة اليدوية، والمطابقة تُحفظ وحدها بشرط الإصدار.
const path = require('path');
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL ') + m); if (!c) process.exitCode = 1 };
function mkDB(row) {
  const st = { row };
  return { st, DB: { prepare(sql) { return { bind(...a) { return {
    async first() { return /SELECT/.test(sql) ? (st.row ? { ...st.row } : null) : null },
    async run() {
      if (/^UPDATE/.test(sql)) { if (!st.row || st.row.version !== a[3]) return { meta: { changes: 0 } }; st.row = { value: a[1], version: st.row.version + 1 }; return { meta: { changes: 1 } } }
      if (/^INSERT/.test(sql)) { if (st.row) return { meta: { changes: 0 } }; st.row = { value: a[1], version: 1 }; return { meta: { changes: 1 } } }
      return { meta: { changes: 0 } } } } } } } } };
}
const item = (id, sid = 7) => ({ id, title: 'منجز ' + id, associationId: sid, associationName: 'جمعية س', completionDate: '2026-10-0' + (id % 9), files: 'x' });
const resp = (pages) => { let i = 0; global.fetch = async () => { const pg = pages[Math.min(i++, pages.length - 1)]; return pg === 'down' ? { ok: false, status: 503 } : { ok: true, status: 200, json: async () => { if (pg === 'html') throw new Error('not json'); return pg } } } };
const U = { email: 't@x.sa' };
const err = async (f) => { try { await f(); return null } catch (e) { return e } };
(async () => {
  const sj = await import(path.resolve(__dirname, '../worker/src/sijam.js'));
  const old = JSON.stringify({ v: 1, at: '2026-01-01T00:00:00Z', by: 'a@b.sa', total: 2, items: [{ id: 1, t: 'قديم', sid: 7, at: '2025-12-01' }, { id: 2, t: 'سيختفي', sid: 7, at: '2025-12-02' }], map: { 7: 201 } });

  let e = mkDB({ value: old, version: 3 }); resp(['html']);
  let x = await err(() => sj.sync(e, U));
  ok(x && x.status == 502 && e.st.row.version == 3, 'non-JSON 200 reply fails and changes nothing');
  e = mkDB({ value: old, version: 3 }); resp([{ totalCount: 0 }]);
  x = await err(() => sj.sync(e, U));
  ok(x && x.status == 502 && e.st.row.version == 3, 'reply without items[] fails and changes nothing');
  e = mkDB({ value: old, version: 3 }); resp([{ totalCount: 120, items: [item(1)] }, { totalCount: 120, items: [] }]);
  x = await err(() => sj.sync(e, U));
  ok(x && x.status == 502 && JSON.parse(e.st.row.value).items.every((i) => !i.gone), 'incomplete paging fails without marking anything gone');
  e = mkDB({ value: old, version: 3 }); resp(['down']);
  x = await err(() => sj.sync(e, U));
  ok(x && x.status == 502, 'upstream error is reported');

  e = mkDB({ value: old, version: 3 }); resp([{ totalCount: 3, items: [item(1), item(3), item(3), null] }]);
  const r = await sj.sync(e, U); const v = JSON.parse(e.st.row.value);
  ok(r.fetched == 2 && r.added == 1 && r.gone == 1 && r.version == 4, 'merge counts: fetched 2 (duplicate dropped), added 1, gone 1');
  ok(v.items.find((i) => i.id == 1).at == '2025-12-01' && v.items.find((i) => i.id == 2).gone && v.map[7] == 201, 'first-seen date, gone item and manual map are kept');
  ok(!('by' in v) && v.items.find((i) => i.id == 1).img === undefined, 'no syncer email in the shared value; non-array files tolerated');
  x = await err(() => sj.sync(e, U));
  ok(x && x.status == 429, 'a second sync within a minute is refused');

  const m = await sj.setMap(e, U, { map: { 7: 0, 9: '15', bad: 3, 11: null } });
  const v2 = JSON.parse(e.st.row.value);
  ok(JSON.stringify(m.map) == '{"7":0,"9":15}' && v2.items.length == v.items.length && m.version == 5, 'map is saved alone, items untouched, invalid keys dropped');
  x = await err(() => sj.setMap(e, U, { map: [] }));
  ok(x && x.status == 422, 'array map rejected');
  // تزامن: كتابة بين القراءة والكتابة تُرفض بدل أن تُمحى
  const race = mkDB({ value: old, version: 3 }); const rp = race.DB.prepare.bind(race.DB);
  race.DB.prepare = (sql) => { const q = rp(sql); if (/^UPDATE/.test(sql)) race.st.row.version = 9; return q };
  x = await err(() => sj.setMap(race, U, { map: { 1: 2 } }));
  ok(x && x.status == 409, 'concurrent write is detected (409), not overwritten');
})();
