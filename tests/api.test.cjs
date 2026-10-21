const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup(options = {}) {
  const requests = [];
  const demoCalls = [];
  const window = {
    location: { search: options.search || '' },
    APP_API_URL: options.url === undefined ? 'https://example.invalid/api' : options.url,
    Tg: { isInsideTelegram: () => options.inside !== false, initData: () => 'signed-test-init-data' },
    DEMO_API: { call: (action, payload) => { demoCalls.push({ action, payload }); return Promise.resolve({ demo: true }); } },
  };
  const fetch = (url, config) => {
    requests.push({ url, config });
    if (options.failure) return Promise.reject(new Error('Connection lost'));
    const status = options.status === undefined ? 200 : options.status;
    return Promise.resolve({ ok: status >= 200 && status < 300, status,
      text: () => Promise.resolve(options.body === undefined ? '{"ok":true}' : options.body) });
  };
  runInNewContext(readFileSync(require.resolve('../src/api.js'), 'utf8'), { window, fetch, URLSearchParams });
  return { api: window.Api, requests, demoCalls };
}

test('authenticated requests POST initData, action and payload and preserve JSON response', async () => {
  const env = setup({ body: '{"income":123,"categories":[]}' });
  const result = await env.api.call('summary', { month: '2026-10' });
  assert.equal(result.income, 123);
  assert.equal(result.categories.length, 0);
  assert.equal(env.requests.length, 1);
  const { url, config } = env.requests[0];
  assert.equal(url, 'https://example.invalid/api');
  assert.equal(config.method, 'POST');
  assert.equal(config.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(config.body), {
    initData: 'signed-test-init-data', action: 'summary', month: '2026-10',
  });
});

test('authorization and household JSON errors reject even when HTTP status is 200', async () => {
  for (const code of ['unauthorized', 'no_household']) {
    const env = setup({ body: JSON.stringify({ error: code, detail: 'test' }) });
    await assert.rejects(env.api.call('me'), err => err instanceof env.api.ApiError &&
      err.code === code && err.status === 200 && err.data.detail === 'test');
  }
});

test('non-2xx JSON error retains server code; non-error HTTP failures report network', async () => {
  const forbidden = setup({ status: 403, body: '{"error":"forbidden"}' });
  await assert.rejects(forbidden.api.call('delete_tx', { id: 'test' }), err =>
    err.code === 'forbidden' && err.status === 403);
  const failed = setup({ status: 503, body: '{"detail":"unavailable"}' });
  await assert.rejects(failed.api.call('summary'), err =>
    err.code === 'network' && err.status === 503 && err.data.detail === 'unavailable');
});

test('malformed successful JSON differs from malformed HTTP failure and rejected fetch', async () => {
  const invalid = setup({ body: '<not-json>' });
  await assert.rejects(invalid.api.call('summary'), err => err.code === 'invalid_json' && err.status === 200);
  const failed = setup({ status: 502, body: '<gateway-error>' });
  await assert.rejects(failed.api.call('summary'), err => err.code === 'network' && err.status === 502);
  const offline = setup({ failure: true });
  await assert.rejects(offline.api.call('summary'), err => err.code === 'network' && err.status === 0);
});

test('missing or placeholder server configuration rejects before fetch', async () => {
  for (const url of ['', 'https://<project-ref>.supabase.co/api']) {
    const env = setup({ url });
    await assert.rejects(env.api.call('me'), err => err.code === 'no_config');
    assert.equal(env.requests.length, 0);
  }
});

test('browser and explicit demo mode dispatch to demo API without fetch or server config', async () => {
  for (const options of [{ inside: false, url: '' }, { search: '?demo', url: '' }]) {
    const env = setup(options);
    assert.equal((await env.api.call('list_tx', { month: '2026-10' })).demo, true);
    assert.equal(env.requests.length, 0);
    assert.equal(env.demoCalls.length, 1);
    assert.equal(env.demoCalls[0].action, 'list_tx');
    assert.equal(env.demoCalls[0].payload.month, '2026-10');
  }
});
