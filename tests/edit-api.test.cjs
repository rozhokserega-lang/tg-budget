const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function environment(real = false) {
  let requests = 0;
  const window = {
    location: { search: '' },
    APP_API_URL: 'https://example.invalid/api',
    localStorage: { getItem: () => null },
    Tg: { isInsideTelegram: () => real, initData: () => 'test' },
  };
  const context = { window, URLSearchParams, Intl, console,
    setTimeout: fn => fn(), fetch: () => { requests++; throw new Error('Unexpected network'); } };
  for (const file of ['format.js', 'demo.js', 'api.js']) {
    runInNewContext(readFileSync(require.resolve('../src/' + file), 'utf8'), context);
    Object.assign(context, window);
  }
  return { ...window, requests: () => requests };
}

test('demo update preserves immutable and omitted fields, refreshes relations and clears note', async () => {
  const env = environment();
  const state = env.DEMO_API.state();
  const category = state.categories.find(c => c.kind === 'expense');
  const other = state.categories.find(c => c.kind === 'expense' && c.id !== category.id);
  const tx = await env.Api.call('add_tx', { category_id: category.id, amount: 20,
    note: 'Original', occurred_on: '2026-01-12', is_shared: true });
  const before = { ...tx };
  const result = await env.Api.updateTx({ id: tx.id, category_id: other.id, amount: '41.50',
    note: '', member_id: 'unauthorized-change', created_at: 'changed' });
  assert.equal(result.amount, 41.5);
  assert.equal(result.note, null);
  assert.equal(result.category_id, other.id);
  assert.equal(result.categories.name, other.name);
  assert.equal(result.member_id, before.member_id);
  assert.equal(result.created_at, before.created_at);
  assert.equal(result.is_shared, true);
  assert.equal(result.occurred_on, before.occurred_on);
  assert.ok(result.members.name);
});

test('moving expense updates both month lists and summary, accepts future/leap dates', async () => {
  const env = environment();
  const category = env.DEMO_API.state().categories.find(c => c.kind === 'expense');
  const tx = await env.Api.call('add_tx', { category_id: category.id, amount: 13, occurred_on: '2028-01-31' });
  const before = await env.Api.call('summary', { month: '2028-01' });
  await env.Api.updateTx({ id: tx.id, amount: 17, occurred_on: '2028-02-29', is_shared: true });
  assert.equal((await env.Api.call('summary', { month: '2028-01' })).expense, before.expense - 13);
  assert.equal((await env.Api.call('summary', { month: '2028-02' })).expense, 17);
  assert.equal((await env.Api.call('list_tx', { month: '2028-01' })).some(t => t.id === tx.id), false);
  const moved = (await env.Api.call('list_tx', { month: '2028-02' })).find(t => t.id === tx.id);
  assert.equal(moved.occurred_on, '2028-02-29');
  assert.equal(moved.is_shared, true);
});

test('invalid updates reject without mutating the existing expense', async () => {
  const env = environment();
  const state = env.DEMO_API.state();
  const expense = state.categories.find(c => c.kind === 'expense');
  const income = state.categories.find(c => c.kind === 'income');
  const tx = await env.Api.call('add_tx', { category_id: expense.id, amount: 20, occurred_on: '2026-01-12' });
  const before = JSON.stringify(tx);
  const cases = [
    [{ id: 'missing' }, 'not_found'],
    [{ category_id: 'missing' }, 'bad_category'],
    [{ category_id: income.id }, 'bad_category'],
    ...[0, -1, Infinity, NaN, 'no'].map(amount => [{ amount }, 'bad_amount']),
    ...['2026-02-29', '2028-02-30', '2026-13-01', '', '2026-01-01T00:00:00Z'].map(occurred_on => [{ occurred_on }, 'bad_date']),
  ];
  for (const [patch, code] of cases) {
    await assert.rejects(env.Api.updateTx({ id: tx.id, ...patch }), error => error.code === code && !!error.message);
    assert.equal(JSON.stringify(tx), before);
  }
});

test('real mode reports unsupported without a request or demo mutation', async () => {
  const env = environment(true);
  const before = JSON.stringify(env.DEMO_API.state().tx);
  await assert.rejects(env.Api.updateTx({ id: 'anything', amount: 12 }), error =>
    error.code === 'update_unsupported' && error.message.includes('Изменения не сохранены'));
  assert.equal(env.requests(), 0);
  assert.equal(JSON.stringify(env.DEMO_API.state().tx), before);
});
