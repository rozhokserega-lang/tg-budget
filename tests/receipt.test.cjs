const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function contextWithStorage() {
  const stored = new Map();
  const window = {
    localStorage: {
      getItem: key => stored.has(key) ? stored.get(key) : null,
      setItem: (key, value) => stored.set(key, String(value)),
    },
  };
  const context = { window };
  for (const file of ['receipt', 'receipt-store']) {
    runInNewContext(readFileSync(require.resolve(`../src/${file}.js`), 'utf8'), context);
    Object.assign(context, window);
  }
  return { parse: window.Receipt.parse, store: window.ReceiptStore, stored };
}

// Реальные QR, считанные с двух чеков (Магнит). Совпадают с печатными ФН, ФД, ФП, датой и итогом.
const R1 = 't=20250207T1740&s=187.98&fn=7380440700187177&i=83702&fp=1425956587&n=1';
const R2 = 't=20250131T1004&s=1139.00&fn=7380440700116991&i=15004&fp=3786357904&n=1';

test('real receipts: sum, date, time and key', () => {
  const { parse } = contextWithStorage();
  assert.deepEqual(JSON.parse(JSON.stringify(parse(R1))), { ok: true, date: '2025-02-07', time: '17:40', sum: 187.98, op: 1, kind: 'expense',
    fn: '7380440700187177', i: '83702', fp: '1425956587', key: '7380440700187177:83702:1425956587' });
  const r = parse(R2);
  assert.equal(r.sum, 1139);               // итог к оплате (со скидкой и округлением), а не «итог без скидок»
  assert.equal(r.date, '2025-01-31');
  assert.equal(r.time, '10:04');
});

test('the same receipt always gives the same key (reprints and rescans)', () => {
  const { parse } = contextWithStorage();
  assert.equal(parse(R1).key, parse('  ' + R1 + '\n').key);
});

test('refund receipt is income; receipts for seller expense are not supported', () => {
  const { parse } = contextWithStorage();
  assert.equal(parse(R1.replace('n=1', 'n=2')).kind, 'income');
  assert.equal(parse(R1.replace('n=1', 'n=3')).kind, null);
  assert.equal(parse(R1.replace('&n=1', '')).kind, 'expense');   // n отсутствует: считаем покупкой
});

test('tolerates seconds, comma, key order, case, and a url prefix', () => {
  const { parse } = contextWithStorage();
  assert.equal(parse(R1.replace('T1740', 'T174015')).time, '17:40');
  assert.equal(parse(R1.replace('187.98', '187,98')).sum, 187.98);
  assert.equal(parse('FP=1425956587&I=83702&FN=7380440700187177&S=187.98&T=20250207T1740&N=1').ok, true);
  assert.equal(parse('https://example.test/check?' + R1).sum, 187.98);
  assert.equal(parse(R1.replace('187.98', '1500')).sum, 1500);
});

test('rejects things that are not receipts', () => {
  const { parse } = contextWithStorage();
  assert.equal(parse('').reason, 'empty');
  assert.equal(parse(null).reason, 'empty');
  assert.equal(parse('https://t.me/telegatreckerbot').reason, 'not_receipt');
  assert.equal(parse(R1.replace('&fp=1425956587', '')).reason, 'not_receipt');
});

test('rejects broken values', () => {
  const { parse } = contextWithStorage();
  assert.equal(parse(R1.replace('20250207', '20251307')).reason, 'bad_date');
  assert.equal(parse(R1.replace('20250207', '20250230')).reason, 'bad_date');
  assert.equal(parse(R1.replace('T1740', 'T2560')).reason, 'bad_date');
  assert.equal(parse(R1.replace('187.98', '0.00')).reason, 'bad_sum');
  assert.equal(parse(R1.replace('187.98', 'abc')).reason, 'bad_sum');
  assert.equal(parse(R1.replace('187.98', '12.345')).reason, 'bad_sum');
  assert.equal(parse(R1.replace('7380440700187177', '123')).reason, 'bad_fiscal');
});

test('local receipt store is isolated by member scope', () => {
  const { store } = contextWithStorage();
  store.remember('member-1:family-1', 'fn:1:2', { txId: 'local-1', date: '2026-10-22', sum: 10.5 });
  assert.equal(store.has('member-1:family-1', 'fn:1:2'), true);
  assert.equal(store.has('member-2:family-1', 'fn:1:2'), false);
  store.forget('member-1:family-1', 'fn:1:2');
  assert.equal(store.has('member-1:family-1', 'fn:1:2'), false);
});

test('local receipt store links local and server ids for delete cleanup', () => {
  const { store } = contextWithStorage();
  store.remember('scope', 'fn:3:4', { txId: 'local-3', date: '2026-10-22', sum: 99.99 });
  store.link('scope', 'local-3', 'server-3', 'fn:3:4');
  store.forgetForTx('scope', { id: 'server-3' });
  assert.equal(store.has('scope', 'fn:3:4'), false);
});

test('delete cleanup falls back to date and amount when receipt_key is missing', () => {
  const { store } = contextWithStorage();
  store.remember('scope', 'fn:5:6', { date: '2026-10-22', sum: 12.5 });
  store.remember('scope', 'fn:7:8', { date: '2026-10-23', sum: 12.5 });
  store.forgetForTx('scope', { occurred_on: '2026-10-22', amount: 12.5 });
  assert.equal(store.has('scope', 'fn:5:6'), false);
  assert.equal(store.has('scope', 'fn:7:8'), true);
});

test('remember replaces a repeated key and keeps the entries bounded', () => {
  const { store } = contextWithStorage();
  for (let i = 0; i < 205; i++) store.remember('scope', 'key-' + i, { date: '2026-10-22', sum: i });
  assert.equal(store.list('scope').length, 200);
  store.remember('scope', 'key-204', { txId: 'new' });
  assert.equal(store.list('scope').filter(row => row.key === 'key-204').length, 1);
  assert.equal(store.list('scope').find(row => row.key === 'key-204').txId, 'new');
});
