const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup() {
  const context = { window: {} };
  context.window.localStorage = { getItem: () => null };
  context.window.I18n = { t: (s, args) => s.replace(/\{(\w+)\}/g, (_, k) => args?.[k] ?? k), locale: () => 'ru', plural: (_, n) => String(n) };
  context.I18n = context.window.I18n;
  for (const file of ['format', 'state', 'views']) {
    runInNewContext(readFileSync(require.resolve(`../src/${file}.js`), 'utf8'), context);
    Object.assign(context, context.window);
  }
  context.State.get().month = '2025-01';
  return context;
}
const categories = [
  { id: 'zero-a', name: 'Empty A', fact: 0 },
  { id: 'equal-a', name: 'Equal A', fact: 30 },
  { id: 'max', name: 'Maximum', fact: 50 },
  { id: 'equal-b', name: 'Equal B', fact: 30 },
  { id: 'zero-b', name: 'Empty B', fact: 0 },
];
function home(ctx, cats = categories) {
  return ctx.Views.renderSummary({ categories: cats, income: 0, expense: 0, balance: 0 }, null, null, [], 'list');
}
function renderedCategoryIds(html) { return [...html.matchAll(/data-cat-id="([^"]+)"/g)].map(m => m[1]); }
function tx(id, date, created, extra = {}) {
  return { id, occurred_on: date, created_at: created, category_id: 'food', categories: { name: 'Food', kind: 'expense' }, amount: 10, note: `note-${id}`, ...extra };
}

test('home default keeps original category order including zeroes', () => {
  const ctx = setup();
  const before = JSON.stringify(categories);
  assert.deepEqual(renderedCategoryIds(home(ctx)), categories.map(c => c.id));
  assert.equal(JSON.stringify(categories), before);
});
test('amount sorting hides zeroes, ties preserve source order; reveal adds zeroes last', () => {
  const ctx = setup();
  ctx.State.get().homeCategorySort = 'amount';
  const before = JSON.stringify(categories);
  let html = home(ctx);
  assert.deepEqual(renderedCategoryIds(html), ['max', 'equal-a', 'equal-b']);
  assert.match(html, /Показать пустые категории \(2\)/);
  ctx.State.get().homeShowEmpty = true;
  html = home(ctx);
  assert.deepEqual(renderedCategoryIds(html), ['max', 'equal-a', 'equal-b', 'zero-a', 'zero-b']);
  assert.match(html, /Скрыть пустые категории \(2\)/);
  assert.equal(JSON.stringify(categories), before);
});
test('all-zero month has empty state and reveal; month sums determine new order', () => {
  const ctx = setup();
  ctx.State.get().homeCategorySort = 'amount';
  assert.match(home(ctx, categories.filter(c => c.fact === 0)), /Расходов за этот месяц нет/);
  assert.deepEqual(renderedCategoryIds(home(ctx, [{ id: 'equal-b', fact: 90 }, { id: 'max', fact: 5 }])), ['equal-b', 'max']);
  assert.doesNotMatch(home(ctx, [{ id: 'only', fact: 10 }]), /data-action="home-empty-toggle"/);
});
test('finance groups newest days and creation times first without mutating input', () => {
  const ctx = setup();
  const rows = [tx('old', '2025-01-01', '2025-01-01T03:00:00Z'), tx('a', '2025-01-03', '2025-01-03T02:00:00Z'), tx('b', '2025-01-03', '2025-01-03T06:00:00Z'), tx('tie', '2025-01-03', '2025-01-03T06:00:00Z')];
  const before = JSON.stringify(rows);
  const html = ctx.Views.txResults(rows, {});
  assert.deepEqual([...html.matchAll(/data-tx-id="([^"]+)"/g)].map(m => m[1]), ['b', 'tie', 'a', 'old']);
  assert.equal((html.match(/class="tx-group"/g) || []).length, 2);
  assert.equal(JSON.stringify(rows), before);
});
test('finance category is primary static text, description secondary and edit beside delete', () => {
  const ctx = setup();
  const html = ctx.Views.txResults([tx('id', '2025-01-01', '', { note: '<coffee>' })], {});
  assert.match(html, /finance-operation__name">Food/);
  assert.match(html, /finance-operation__note">&lt;coffee&gt;/);
  assert.doesNotMatch(html, /data-cat-link/);
  assert.match(html, /data-action="edit-tx" data-id="id"/);
  assert.match(html, /data-tx-delete="id"/);
  assert.doesNotMatch(ctx.Views.txResults([tx('local', '2025-01-01', '', { _local: true })], {}), /data-action="edit-tx"/);
});
test('finance keeps filters, empty results and local Today/Yesterday labels', () => {
  const ctx = setup();
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const rows = [tx('today', ctx.Fmt.isoDate(now), '', { note: '' }), tx('yesterday', ctx.Fmt.isoDate(yesterday), '')];
  const html = ctx.Views.txResults(rows, {});
  assert.match(html, /tx-group__title">Сегодня/);
  assert.match(html, /tx-group__title">Вчера/);
  assert.match(html, /finance-operation__note"><\/span>/);
  const filtered = ctx.Views.txResults(rows, { q: 'note-yesterday' });
  assert.doesNotMatch(filtered, /data-tx-id="today"/);
  assert.match(filtered, /data-tx-id="yesterday"/);
  assert.match(ctx.Views.txResults(rows, { q: 'missing' }), /Ничего не найдено/);
  assert.match(ctx.Views.txResults([], {}), /Записей нет/);
});
test('home only edits confirmed expenses and does not sort or group their operations', () => {
  const ctx = setup();
  const rows = [tx('older', '2025-01-01', ''), tx('newer', '2025-01-03', '')];
  const html = ctx.Views.categoryTxList(rows, true);
  assert.ok(html.indexOf('data-id="older"') < html.indexOf('data-id="newer"'));
  assert.doesNotMatch(html, /tx-group/);
  assert.doesNotMatch(ctx.Views.categoryTxList([tx('i', '2025-01-01', '', { categories: { kind: 'income' } })], true), /edit-tx/);
});
test('shared edit form preserves values, escapes user text and offers explicit save/cancel only', () => {
  const ctx = setup();
  const row = tx('id', '2025-01-01', '', { note: '"><script>' });
  const html = ctx.Views.renderEditForm(row);
  assert.match(html, /data-form="edit-tx"/);
  assert.match(html, /value="food" selected/);
  assert.match(html, /name="amount"[^>]*value="10"/);
  assert.match(html, /name="occurred_on"[^>]*value="2025-01-01"/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
  assert.match(html, /data-action="cancel-edit-tx"/);
  assert.doesNotMatch(html, /\smax=|data-sheet-close|<script>/);
});
