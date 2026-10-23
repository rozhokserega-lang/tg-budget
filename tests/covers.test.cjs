const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function fakeIndexedDb(options = {}) {
  const data = options.data || new Map();
  let storeExists = false;

  function request(exec, tx) {
    const req = {};
    queueMicrotask(() => {
      try {
        req.result = exec();
        if (req.onsuccess) req.onsuccess();
        queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
      } catch (err) {
        req.error = err;
        if (req.onerror) req.onerror();
        queueMicrotask(() => { if (tx.onabort) tx.onabort(); else if (tx.onerror) tx.onerror(); });
      }
    });
    return req;
  }

  const db = {
    objectStoreNames: { contains: name => storeExists && name === 'images' },
    createObjectStore() { storeExists = true; return {}; },
    close() {},
    transaction(name, mode) {
      if (name !== 'images') throw new Error('unknown store');
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = () => ({
        get(key) { return request(() => data.get(key), tx); },
        put(value, key) {
          if (options.quota) {
            const err = new Error('quota exceeded');
            err.name = 'QuotaExceededError';
            return request(() => { throw err; }, tx);
          }
          data.set(key, value);
          return request(() => key, tx);
        },
        delete(key) { data.delete(key); return request(() => undefined, tx); },
      });
      return tx;
    },
    mode: null,
  };

  return {
    data,
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        if (!storeExists && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
}

function fakeUrl() {
  let seq = 0;
  const live = new Set();
  return {
    live,
    api: {
      createObjectURL() {
        const url = 'blob:test-' + (++seq);
        live.add(url);
        return url;
      },
      revokeObjectURL(url) { live.delete(url); },
    },
  };
}

function setup(options = {}) {
  const data = options.data || new Map();
  const storage = options.storage || new Map([['budget.cover', options.saved || 'default']]);
  const urls = fakeUrl();
  const context = { window: {} };
  context.window.localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  if (!options.noIndexedDb) {
    context.window.indexedDB = fakeIndexedDb({ data, quota: options.quota });
  }
  context.window.URL = urls.api;
  runInNewContext(readFileSync(require.resolve('../src/covers.js'), 'utf8'), context);
  return { Covers: context.window.Covers, data, storage, urls };
}

async function settled() {
  await new Promise(resolve => setImmediate(resolve));
}

test('custom cover is stored in IndexedDB and survives a reload', async () => {
  const first = setup();
  assert.equal(first.Covers.id(), 'default');
  const blob = { name: 'photo.jpg', size: 123 };
  await first.Covers.saveCustom(blob);
  await settled();

  assert.equal(first.Covers.id(), 'custom');
  assert.equal(first.Covers.hasCustom(), true);
  assert.match(first.Covers.current().file, /^blob:test-/);
  assert.equal(first.storage.get('budget.cover'), 'custom');
  assert.equal(first.data.get('home-cover'), blob);

  const second = setup({ data: first.data, storage: first.storage });
  assert.equal(second.Covers.id(), 'custom');
  const loaded = await second.Covers.loadCustom();
  await settled();
  assert.equal(loaded.id, 'custom');
  assert.match(second.Covers.current().file, /^blob:test-/);
  assert.equal(second.storage.get('budget.cover'), 'custom');
});

test('clearing a custom cover removes the blob, revokes its URL and restores the default', async () => {
  const env = setup();
  await env.Covers.saveCustom({ name: 'photo.jpg', size: 123 });
  await settled();
  const url = env.Covers.current().file;
  assert.equal(env.urls.live.has(url), true);

  await env.Covers.clearCustom();
  await settled();
  assert.equal(env.Covers.hasCustom(), false);
  assert.equal(env.Covers.id(), 'default');
  assert.equal(env.data.has('home-cover'), false);
  assert.equal(env.storage.get('budget.cover'), 'default');
  assert.equal(env.urls.live.has(url), false);
});

test('quota errors are reported and do not change the selected cover', async () => {
  const env = setup({ quota: true });
  await assert.rejects(
    env.Covers.saveCustom({ name: 'photo.jpg', size: 123 }),
    err => err.code === 'storage_full'
  );
  await settled();
  assert.equal(env.Covers.hasCustom(), false);
  assert.equal(env.Covers.id(), 'default');
  assert.equal(env.storage.get('budget.cover'), 'default');
});

test('missing IndexedDB falls back to default and reports unsupported storage', async () => {
  const env = setup({ noIndexedDb: true, saved: 'custom' });
  assert.equal(env.Covers.id(), 'custom');
  const loaded = await env.Covers.loadCustom();
  await settled();
  assert.equal(loaded, null);
  assert.equal(env.Covers.id(), 'default');
  assert.equal(env.storage.get('budget.cover'), 'default');
  await assert.rejects(
    env.Covers.saveCustom({ name: 'photo.jpg', size: 123 }),
    err => err.code === 'storage_unsupported'
  );
});
