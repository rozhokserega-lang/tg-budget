const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup(options) {
  const window = {};
  runInNewContext(readFileSync(require.resolve('../src/cache.js'), 'utf8'), { window });
  return { cache: window.BudgetCache.create(options), module: window.BudgetCache };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test('central five-minute TTL, stale reads and normal cache hits', async () => {
  let time = 0;
  const { cache, module } = setup({ now: () => time });
  assert.equal(module.DEFAULT_TTL, 300000);
  assert.equal(cache.read('month'), null);
  cache.write('month', { amount: 1 });
  time = 299999;
  assert.equal((await cache.fetch('month', () => { throw Error('unexpected load'); })).amount, 1);
  time = 300000;
  assert.equal(cache.read('month'), null);
  assert.equal(cache.read('month', true).amount, 1);
  assert.equal((await cache.fetch('month', () => ({ amount: 2 }))).amount, 2);
  assert.equal(cache.read('month').amount, 2);
});

test('concurrent loads deduplicate and force refresh bypasses fresh TTL', async () => {
  const { cache } = setup();
  const load = deferred();
  let calls = 0;
  cache.write('month', ['cached']);
  const first = cache.fetch('month', () => { calls++; return load.promise; }, { force: true });
  const second = cache.fetch('month', () => { calls++; return []; }, { force: true });
  assert.equal(first, second);
  assert.equal(cache.read('month', true)[0], 'cached');
  load.resolve(['fresh']);
  assert.equal((await second)[0], 'fresh');
  assert.equal(calls, 1);
});

test('failed refresh keeps rendered cache and allows retry, including sync loader failure', async () => {
  const { cache } = setup();
  cache.write('month', ['cached']);
  await assert.rejects(cache.fetch('month', () => { throw Error('offline'); }, { force: true }), /offline/);
  assert.equal(cache.read('month', true)[0], 'cached');
  assert.equal((await cache.fetch('month', () => ['retried'], { force: true }))[0], 'retried');
});

test('mutation invalidation rejects late responses and does not dedup new loads with them', async () => {
  const { cache } = setup();
  const old = deferred();
  const first = cache.fetch('month', () => old.promise);
  const rejection = assert.rejects(first, error => error.code === 'stale_response');
  cache.invalidate();
  const result = await cache.fetch('month', () => ['after-delete']);
  old.resolve(['deleted-item']);
  await rejection;
  assert.equal(result[0], 'after-delete');
  assert.equal(cache.read('month')[0], 'after-delete');
});

test('manual write supersedes a pending request without invalidating unrelated keys', async () => {
  const { cache } = setup();
  cache.write('other', 7);
  const old = deferred();
  const request = cache.fetch('month', () => old.promise);
  const rejection = assert.rejects(request, error => error.code === 'stale_response');
  cache.write('month', ['confirmed-edit']);
  old.resolve(['before-edit']);
  await rejection;
  assert.equal(cache.read('month')[0], 'confirmed-edit');
  assert.equal(cache.read('other'), 7);
});

test('scope changes isolate accounts and stale rejected requests stay silent to consumers', async () => {
  const { cache } = setup();
  assert.equal(cache.setScope('user-a/family-a'), true);
  cache.write('summary', 'private-a');
  const load = deferred();
  const first = cache.fetch('tx', () => load.promise);
  const rejection = assert.rejects(first, error => error.code === 'stale_response');
  assert.equal(cache.setScope('user-b/family-b'), true);
  assert.equal(cache.read('summary', true), null);
  await cache.fetch('tx', () => ['private-b']);
  load.reject(Error('old request failed'));
  await rejection;
  assert.equal(cache.read('tx')[0], 'private-b');
  assert.equal(cache.setScope('user-b/family-b'), false);
  assert.equal(cache.read('tx')[0], 'private-b');
});

test('rapid month requests retain separate keys and custom TTL, including empty arrays', async () => {
  let time = 10;
  const { cache } = setup({ ttl: 20, now: () => time });
  const october = deferred();
  const first = cache.fetch('2026-10', () => october.promise);
  await cache.fetch('2026-11', () => []);
  october.resolve(['october']);
  await first;
  assert.equal(cache.read('2026-11').length, 0);
  assert.equal(cache.read('2026-10')[0], 'october');
  time = 30;
  assert.equal(cache.read('2026-10'), null);
});

test('zero and empty lists are fresh cache hits', async () => {
  const { cache } = setup();
  for (const value of [0, false, '', []]) {
    cache.write('value', value);
    assert.equal(await cache.fetch('value', () => { throw Error('unexpected request'); }), value);
  }
});

test('targeted invalidation keeps stale data and unrelated fresh resources, rejecting old reads', async () => {
  const { cache } = setup();
  cache.write('month', ['old']); cache.write('plans', 0);
  const old = deferred();
  const read = cache.fetch('month', () => old.promise, { force: true });
  const rejected = assert.rejects(read, { code: 'stale_response' });
  cache.invalidate(['month']);
  assert.equal(cache.read('month'), null);
  assert.equal(cache.read('month', true)[0], 'old');
  assert.equal(await cache.fetch('plans', () => { throw Error('unrelated reload'); }), 0);
  await cache.fetch('month', () => ['new']);
  old.resolve(['resurrected']); await rejected;
  assert.equal(cache.read('month')[0], 'new');
});

test('equal JSON response reuses data identity and renews TTL', async () => {
  let time = 0;
  const { cache } = setup({ ttl: 10, now: () => time });
  const data = { rows: [], amount: 0 };
  cache.write('data', data); time = 11;
  assert.equal(await cache.fetch('data', () => ({ rows: [], amount: 0 })), data);
  assert.equal(cache.read('data'), data);
  time = 20; assert.equal(cache.read('data'), data);
});
