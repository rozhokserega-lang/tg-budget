const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function fakeNode() {
  const classes = new Set();
  const listeners = {};
  return {
    hidden: true, innerHTML: '', textContent: '', scrollTop: 0, children: [],
    style: { removeProperty() {}, setProperty() {} },
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: name => classes.has(name),
      toggle(name, active) { const on = active ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); return on; },
    },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    removeEventListener(name, fn) { listeners[name] = (listeners[name] || []).filter(item => item !== fn); },
    dispatch(name, event) { for (const fn of listeners[name] || []) fn(event); },
    querySelector: () => null, querySelectorAll: () => [],
    setAttribute() {}, removeAttribute() {},
  };
}

function setup(updateTx = () => Promise.reject(new Error('server unsupported')), options = {}) {
  const nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, fakeNode()); return nodes.get(selector); };
  const panel = fakeNode();
  const sheet = node('#sheet');
  sheet.querySelector = selector => selector === '.sheet__panel' ? panel : null;
  const document = fakeNode();
  document.querySelector = node;
  document.documentElement = fakeNode();
  document.body = fakeNode();
  const timers = new Map();
  let timerId = 0;
  const calls = [];
  const apiCalls = [];
  const queueOps = [];
  const alerts = [];
  const homeScreen = options.homeScreen || { supported: false, status: 'unsupported', added: false };
  const windowEvents = fakeNode();
  const storage = new Map(options.storage || []);
  const frames = new Map();
  let frameId = 0, frameTime = 0;
  const context = { document, console, performance: { now: () => frameTime }, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id) };
  if (options.clock) context.Date = class extends Date { static now() { return options.clock.now; } };
  context.window = {
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => { storage.set(key, String(value)); },
      removeItem: key => { storage.delete(key); },
    },
    addEventListener: windowEvents.addEventListener, removeEventListener: windowEvents.removeEventListener,
    Tg: {
      backButton: fn => { context.backHandler = fn; },
      haptic() {},
      setThemeMode: mode => { context.themeMode = mode; },
      platform: () => homeScreen.platform || '',
      showAlert: text => { alerts.push(text); },
      canAddToHomeScreen: () => homeScreen.supported,
      checkHomeScreenStatus: cb => { cb(homeScreen.status); },
      addToHomeScreen: () => { homeScreen.added = true; return homeScreen.supported; },
      onHomeScreenAdded: fn => { context.homeScreenAddedHandler = fn; },
    },
    I18n: { t: s => s, locale: () => 'ru', plural: (_, n) => String(n), locales: [{ code: 'ru', name: 'Русский' }] },
    Api: {
      updateTx: payload => { calls.push(payload); return updateTx(payload); },
      call(action, payload) {
        apiCalls.push({ action, payload });
        if (options.api) return options.api(action, payload);
        return Promise.resolve(action === 'me' ? { member: context.State.get().member } : action === 'list_plans' ? {} : action === 'categories' ? context.State.get().categories || [] : []);
      },
    },
    Queue: { size: () => queueOps.length, push(action, payload) { const op = { id: 'op-' + (queueOps.length + 1), action, payload }; queueOps.push(op); return op; } },
  };
  if (options.motionMedia) context.window.matchMedia = () => options.motionMedia;
  if (options.covers) context.window.Covers = options.covers;
  Object.assign(context, context.window);
  for (const file of ['recurring', 'format', 'state', 'views', 'cache']) {
    runInNewContext(readFileSync(require.resolve(`../src/${file}.js`), 'utf8'), context);
    Object.assign(context, context.window);
  }
  const source = readFileSync(require.resolve('../src/app.js'), 'utf8');
  assert.match(source, /\n  boot\(\);/);
  // Keep production event registration and implementations; omit network boot only.
  runInNewContext(source.replace(/\n  boot\(\);/, `
  root.TestApp = {
    dockSample: dockSample, getDockState: function () { return dockState; }, getDockMotion: function () { return dockMotion; },
    applyRouteUi: applyRouteUi, setRoute: function (name) { route = {name:name}; },
    pageGestureAxis: pageGestureAxis, refreshCurrentPage: refreshCurrentPage,
    openEditTx: openEditTx, submitEditTx: submitEditTx, cancelEditTx: cancelEditTx,
    closeSheet: closeSheet, beginSheetDrag: beginSheetDrag, syncBackButton: syncBackButton,
    getEditing: function () { return editingTx; }, getSaving: function () { return editSaving; },
    getDrag: function () { return sheetDrag; },
    openSummary: openSummary, openTx: openTx, openTxKind: openTxKind, setTxKind: setTxKind, loadResource: loadResource,
    fetchSummary: fetchSummary, loadTx: loadTx, adoptMember: adoptMember, loadCategories: loadCategories, invalidateTransactions: invalidateTransactions,
    refreshOnReturn: refreshOnReturn, clearCache: clearCache, cached: cached,
    applyLocalTx: applyLocalTx,
    loadMember: loadMember, deleteAccount: deleteAccount, closeDialog: closeDialog,
    openPlans: openPlans, openTab: openTab, openSettings: openSettings, refreshTxResults: refreshTxResults,
    addHomeScreen: addHomeScreen, refreshHomeScreenStatus: refreshHomeScreenStatus,
    markHomeScreenAdded: markHomeScreenAdded,
    getHomeScreenStatus: function () { return st.homeScreenStatus; },
    submitAdd: submitAdd, deleteTx: deleteTx, removeLocalTx: removeLocalTx, formValues: formValues,
    mutate: mutate, loadPlans: loadPlans, submitCategory: submitCategory, submitRecurring: submitRecurring,
    submitProfile: submitProfile,
    fillExpandedCat: fillExpandedCat,
    startHomeEdit: startHomeEdit, saveHomeEdit: saveHomeEdit, resetHomeEdit: resetHomeEdit,
    cancelHomeEdit: cancelHomeEdit, moveHomeBlock: moveHomeBlock,
    setCover: setCover, resetCustomCover: resetCustomCover, readCoverFile: readCoverFile,
    drawCoverCrop: drawCoverCrop, updateCoverDraft: updateCoverDraft,
    setCoverDraftForTest: function (draft) { coverDraft = draft; },
    getCoverDraft: function () { return coverDraft; },
    setExpandedForTest: function (value) { expandedCat = value; },
    getExpanded: function () { return expandedCat; },
    setAddDraftForTest: function (draft) { form = draft; },
    setHomeCategorySort: setHomeCategorySort,
    setThemePreference: setThemePreference,
    swipeTarget: swipeTarget,
    pageSwipeAllowed: pageSwipeAllowed,
    navigateBySwipe: navigateBySwipe,
    pagePreviewHtml: pagePreviewHtml,
    pageSwipeFlip: pageSwipeFlip,
    settlePageSwipe: settlePageSwipe,
    flushPageSettle: flushPageSettle,
    dropPageSettle: dropPageSettle,
    getPageSettle: function () { return pageSettle; },
    getRoute: function () { return route; },
    preventRouteReloadForTest: function () {
      openSummary = function () { root.routeReloaded = 'summary'; };
      openTx = function () { root.routeReloaded = 'tx'; };
    }
  };`), context);
  const st = context.State.get();
  const tx = { id: 'expense', category_id: 'food', amount: 20, note: 'old note', occurred_on: '2026-09-30', is_shared: false, categories: { name: 'Food', kind: 'expense' }, member_id: 'me' };
  st.month = '2026-09';
  st.categories = [{ id: 'food', name: 'Food', kind: 'expense' }, { id: 'travel', name: 'Travel', kind: 'expense' }];
  st['txCache:2026-09'] = { data: [tx], at: Date.now() };
  st['summaryCache:2026-09'] = { data: { expense: 20 }, at: Date.now() };
  st['txCache:2026-10'] = { data: [], at: Date.now() };
  st['summaryCache:2026-10'] = { data: { expense: 0 }, at: Date.now() };
  if (options.stubReload !== false) context.window.TestApp.preventRouteReloadForTest();
  return { context, app: context.window.TestApp, st, tx, sheet, panel, nodes, calls, apiCalls, windowEvents, queueOps, homeScreen, alerts, storage,
    frames, frame(time) { frameTime = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); },
    flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}
function form(overrides = {}) {
  const values = { amount: '35,50', category_id: 'travel', note: '', occurred_on: '2026-10-01', ...overrides };
  const buttons = [{ disabled: false }, { disabled: false }];
  const error = fakeNode();
  return { elements: Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value }])), querySelector: selector => selector === '.edit-tx-error' ? error : null, querySelectorAll: () => buttons, buttons, error };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function settled() { await new Promise(resolve => setImmediate(resolve)); }
async function open(env) { env.app.openEditTx('expense'); await settled(); }

test('edit entry points open a shared form with source values without mutating transaction', async () => {
  const env = setup();
  const before = JSON.stringify(env.tx);
  await open(env);
  const html = env.nodes.get('#sheet-body').innerHTML;
  assert.match(html, /data-form="edit-tx"/);
  assert.match(html, /name="amount"[^>]*value="20"/);
  assert.match(html, /name="note"[^>]*value="old note"/);
  assert.match(html, /name="occurred_on"[^>]*value="2026-09-30"/);
  assert.match(html, /name="category_id" value="food"/);
  assert.equal(JSON.stringify(env.tx), before);
  assert.notEqual(env.app.getEditing(), env.tx);
});

test('edit sheet ignores backdrop close, drag and Telegram Back until explicit cancel', async () => {
  const env = setup();
  await open(env);
  env.app.closeSheet();
  env.app.beginSheetDrag({ closest: () => env.panel }, 0, 0, 1);
  env.context.backHandler();
  assert.equal(env.sheet.hidden, false);
  assert.equal(env.sheet.classList.contains('sheet--closing'), false);
  assert.equal(env.app.getDrag(), null);
  assert.ok(env.app.getEditing());
  env.app.cancelEditTx();
  assert.equal(env.app.getEditing(), null);
  env.flushTimers();
  assert.equal(env.sheet.hidden, true);
  assert.equal(env.calls.length, 0);
});

test('validation rejects invalid amount, calendar date and category before request', async () => {
  const env = setup();
  await open(env);
  for (const invalid of [{ amount: 'abc' }, { amount: '0' }, { amount: '1000000001' }, { occurred_on: '2026-02-30' }, { occurred_on: '' }, { category_id: 'missing' }]) {
    env.app.submitEditTx(form(invalid));
    assert.equal(env.calls.length, 0);
    assert.equal(env.app.getSaving(), false);
    assert.ok(env.app.getEditing());
  }
});

test('save waits for confirmation, rejects duplicate submit and preserves original shared flag', async () => {
  const pending = deferred();
  const env = setup(() => pending.promise);
  await open(env);
  const before = JSON.stringify(env.st);
  const f = form();
  env.app.submitEditTx(f);
  env.app.submitEditTx(f);
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].is_shared, false);
  assert.equal(env.calls[0].amount, 35.5);
  assert.equal(env.calls[0].category_id, 'travel');
  assert.equal(env.calls[0].occurred_on, '2026-10-01');
  assert.equal(env.calls[0].note, null);
  assert.equal(JSON.stringify(env.st), before);
  assert.ok(f.buttons.every(b => b.disabled));
  env.app.cancelEditTx();
  assert.ok(env.app.getEditing());
  pending.resolve({ id: 'expense' });
  await settled();
  assert.equal(env.app.getEditing(), null);
  assert.equal(env.app.getSaving(), false);
  assert.equal(env.st['txCache:2026-09'].data[0].id, 'expense');
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 20);
  assert.equal(env.st['txCache:2026-10'].data.length, 0);
  assert.equal(env.st['summaryCache:2026-10'].data.expense, 0);
  assert.equal(env.context.window.routeReloaded, 'summary');
});

test('unsupported server failure keeps entered values and original caches, unlocks retry', async () => {
  const env = setup();
  await open(env);
  const f = form({ note: 'user draft' });
  const before = JSON.stringify(env.st);
  env.app.submitEditTx(f);
  await settled();
  assert.ok(env.app.getEditing());
  assert.equal(env.sheet.hidden, false);
  assert.equal(f.elements.note.value, 'user draft');
  assert.equal(JSON.stringify(env.st), before);
  assert.equal(env.app.getSaving(), false);
  assert.ok(f.buttons.every(b => !b.disabled));
  assert.equal(f.error.textContent, 'server unsupported');
  assert.equal(f.error.hidden, false);
  env.app.submitEditTx(f);
  await settled();
  assert.equal(env.calls.length, 2);
});

test('mismatched server confirmation does not close or invalidate edited expense', async () => {
  const env = setup(() => Promise.resolve({ id: 'other' }));
  await open(env);
  const before = JSON.stringify(env.st);
  const f = form();
  env.app.submitEditTx(f);
  await settled();
  assert.ok(env.app.getEditing());
  assert.equal(JSON.stringify(env.st), before);
  assert.match(f.error.textContent, /не подтвердил/);
});

test('pending local records and incomes cannot enter expense editing', async () => {
  const env = setup();
  env.tx._local = true;
  await open(env);
  assert.equal(env.app.getEditing(), null);
  delete env.tx._local;
  env.tx.categories.kind = 'income';
  await open(env);
  assert.equal(env.app.getEditing(), null);
});

test('SWR paints cached summary immediately and force refreshes summary and rows in parallel', async () => {
  const summary = deferred(), rows = deferred();
  const env = setup(undefined, { stubReload: false, api: action => action === 'summary' ? summary.promise : action === 'list_tx' ? rows.promise : Promise.resolve(action === 'list_plans' ? {} : []) });
  env.app.cached('summaryCache:2026-09', { expense: 20, categories: [{ id: 'food', name: 'cached-name', fact: 20 }] });
  env.app.cached('txCache:2026-09', [env.tx]);
  env.app.openSummary(true);
  assert.match(env.nodes.get('#screen').innerHTML, /cached-name/);
  await settled();
  assert.deepEqual(env.apiCalls.map(c => c.action), ['list_tx', 'summary']);
  summary.resolve({ expense: 40, categories: [{ id: 'food', name: 'fresh-name', fact: 40 }] });
  rows.resolve([env.tx]);
  await settled();
  assert.match(env.nodes.get('#screen').innerHTML, /fresh-name/);
});

test('ordinary reads obey five-minute TTL while force bypasses a fresh hit', async () => {
  const clock = { now: 1000 };
  let count = 0;
  const env = setup(undefined, { clock, api: () => Promise.resolve({ expense: ++count }) });
  const a = await env.app.fetchSummary('2026-09');
  assert.equal((await env.app.fetchSummary('2026-09')).expense, a.expense);
  assert.equal(env.apiCalls.length, 1);
  await env.app.fetchSummary('2026-09', true);
  assert.equal(env.apiCalls.length, 2);
  clock.now += 5 * 60 * 1000 + 1;
  await env.app.fetchSummary('2026-09');
  assert.equal(env.apiCalls.length, 3);
});

test('concurrent same-month requests share one API operation', async () => {
  const pending = deferred();
  const env = setup(undefined, { api: () => pending.promise });
  const first = env.app.loadTx('2026-09', true);
  const second = env.app.loadTx('2026-09', true);
  await settled();
  assert.equal(env.apiCalls.length, 1);
  pending.resolve([env.tx]);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, b);
});

test('late previous-month response cannot overwrite current finance screen', async () => {
  const oldMonth = deferred(), newMonth = deferred();
  const env = setup(undefined, { stubReload: false, api: (_, payload) => payload.month === '2026-09' ? oldMonth.promise : newMonth.promise });
  env.app.clearCache();
  env.app.openTx();
  env.st.month = '2026-10';
  env.app.openTx();
  await settled();
  const current = { ...env.tx, id: 'current', occurred_on: '2026-10-01', note: 'current-month-marker' };
  newMonth.resolve([current]);
  await settled();
  assert.match(env.nodes.get('#screen').innerHTML, /current-month-marker/);
  oldMonth.resolve([{ ...env.tx, note: 'obsolete-month-marker' }]);
  await settled();
  assert.doesNotMatch(env.nodes.get('#screen').innerHTML, /obsolete-month-marker/);
  assert.match(env.nodes.get('#screen').innerHTML, /current-month-marker/);
});

test('changing user or household clears displayed caches and rejects old requests', async () => {
  const pending = deferred();
  const env = setup(undefined, { api: () => pending.promise });
  env.app.adoptMember({ id: 'one', household_id: 'home-a' });
  env.app.cached('txCache:2026-09', [env.tx]);
  const request = env.app.loadTx('2026-09', true);
  const rejected = assert.rejects(request, { code: 'stale_response' });
  await settled();
  env.app.adoptMember({ id: 'one', household_id: 'home-b' });
  assert.equal(env.st.categories, null);
  assert.equal(env.st.plans, null);
  assert.equal(env.st['txCache:2026-09'], undefined);
  pending.resolve([env.tx]);
  await rejected;
  assert.equal(env.st['txCache:2026-09'], undefined);
  env.app.cached('summaryCache:2026-09', { expense: 77 });
  env.app.adoptMember({ id: 'two', household_id: 'home-b' });
  assert.equal(env.st['summaryCache:2026-09'], undefined);
});

test('optimistic queued write supersedes older read and confirmed invalidation rejects late data', async () => {
  const pending = deferred();
  const env = setup(undefined, { api: () => pending.promise });
  env.app.cached('txCache:2026-09', [env.tx]);
  const request = env.app.loadTx('2026-09', true);
  const rejected = assert.rejects(request, { code: 'stale_response' });
  await settled();
  const local = { ...env.tx, id: 'local', _local: true, amount: 5 };
  env.app.applyLocalTx(local);
  pending.resolve([env.tx]);
  await rejected;
  assert.equal(env.st['txCache:2026-09'].data[0].id, 'local');
  const later = deferred();
  const read = env.app.loadResource('test-list', () => later.promise, true);
  const invalidated = assert.rejects(read, { code: 'stale_response' });
  await settled();
  env.app.clearCache();
  later.resolve([env.tx]);
  await invalidated;
  assert.equal(env.st['txCache:2026-09'], undefined);
});

test('foreground visibility forces fresh data despite TTL and coalesces duplicate lifecycle signals', async () => {
  const member = { id: 'me', household_id: 'home' };
  const me = deferred();
  const env = setup(undefined, { stubReload: false, api: action => {
    if (action === 'me') return me.promise;
    if (action === 'summary') return Promise.resolve({ expense: 21, categories: [] });
    return Promise.resolve(action === 'list_plans' ? {} : []);
  } });
  env.app.adoptMember(member);
  env.app.cached('summaryCache:2026-09', { expense: 20, categories: [] });
  env.app.cached('txCache:2026-09', [env.tx]);
  env.context.document.visibilityState = 'hidden';
  env.context.document.dispatch('visibilitychange', {});
  assert.equal(env.apiCalls.length, 0);
  env.context.document.visibilityState = 'visible';
  env.context.document.dispatch('visibilitychange', {});
  env.windowEvents.dispatch('pageshow', { persisted: true });
  assert.equal(env.apiCalls.filter(c => c.action === 'me').length, 1);
  me.resolve({ member });
  await settled();
  assert.equal(env.apiCalls.filter(c => c.action === 'summary').length, 1);
  assert.equal(env.apiCalls.filter(c => c.action === 'list_tx').length, 1);
});

test('background request failure retains cached screen and reports a soft error', async () => {
  const env = setup(undefined, { stubReload: false, api: () => Promise.reject(new Error('offline')) });
  env.app.cached('summaryCache:2026-09', { expense: 20, categories: [{ id: 'food', name: 'offline-cache-marker', fact: 20 }] });
  env.app.cached('txCache:2026-09', [env.tx]);
  env.app.openSummary(true);
  await settled();
  assert.match(env.nodes.get('#screen').innerHTML, /offline-cache-marker/);
  assert.match(env.nodes.get('#toast').textContent, /Не удалось обновить/);
});

test('pending edit response cannot clear new household data or reopen the former screen', async () => {
  const pending = deferred();
  const env = setup(() => pending.promise);
  env.st.member = { id: 'me', household_id: 'first' };
  await open(env);
  env.app.submitEditTx(form());
  env.app.adoptMember({ id: 'me', household_id: 'second' });
  env.app.cached('txCache:2026-09', [{ id: 'second-household' }]);
  pending.resolve({ id: 'expense' });
  await settled();
  assert.equal(env.st['txCache:2026-09'].data[0].id, 'second-household');
  assert.equal(env.context.window.routeReloaded, undefined);
  assert.notEqual(env.nodes.get('#toast').textContent, 'Сохранено');
  assert.equal(env.app.getEditing(), null);
});

test('pending me response cannot resurrect an account removed while it was loading', async () => {
  const pending = deferred();
  const env = setup(undefined, { api: action => action === 'me' ? pending.promise : Promise.resolve({}) });
  env.app.adoptMember({ id: 'me', household_id: 'first' });
  const loading = env.app.loadMember();
  const rejected = assert.rejects(loading, { code: 'stale_response' });
  env.app.deleteAccount();
  env.app.closeDialog(true);
  await settled();
  assert.equal(env.st.member, null);
  assert.ok(env.apiCalls.some(c => c.action === 'delete_my_account'));
  pending.resolve({ member: { id: 'me', household_id: 'first' } });
  await rejected;
  assert.equal(env.st.member, null);
});

test('queued add keeps optimistic record until confirmation and invalidates on success', async () => {
  const env = setup();
  env.app.setAddDraftForTest({ amount: '12,50', category_id: 'food', note: 'draft', date: '2026-09-22', is_shared: true, kind: 'expense' });
  env.app.submitAdd({ querySelector: () => ({ disabled: false }) });
  assert.equal(env.queueOps.length, 1);
  assert.equal(env.queueOps[0].action, 'add_tx');
  assert.equal(env.queueOps[0].payload.amount, 12.5);
  assert.equal(env.queueOps[0].payload.occurred_on, '2026-09-22');
  assert.ok(env.st['txCache:2026-09'].data.some(row => row._local));
  env.windowEvents.dispatch('queue-sent', { detail: { id: env.queueOps[0].id, result: { id: 'server-new' } } });
  assert.equal(env.st['txCache:2026-09'].data.some(row => row.id === 'server-new' && !row._local), true);
});

test('member scope change removes pending add and delete overlays', async () => {
  const env = setup(undefined, { api: () => Promise.resolve([env.tx]) });
  env.st.member = { id: 'me', household_id: 'first' };
  env.app.setAddDraftForTest({ amount: '12', category_id: 'food', note: 'draft', date: '2026-09-22', is_shared: true, kind: 'expense' });
  env.app.submitAdd({ querySelector: () => ({ disabled: false }) });
  env.app.removeLocalTx('expense');
  assert.equal(env.context.window.AppState.isDeleting('expense'), true);
  env.app.adoptMember({ id: 'me', household_id: 'second' });
  assert.equal(env.context.window.AppState.isDeleting('expense'), false);
  const rows = await env.app.loadTx('2026-09', true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'expense');
  assert.equal(rows.some(row => row._local), false);
});

test('delete uses confirmation, removes cached record and ignores outdated server list while queued', async () => {
  const env = setup(undefined, { api: () => Promise.resolve([env.tx]) });
  env.st.lastSummary = env.st['summaryCache:2026-09'].data;
  env.app.deleteTx('expense');
  assert.equal(env.queueOps.length, 0);
  env.app.closeDialog(false);
  await settled();
  assert.equal(env.queueOps.length, 0);
  env.app.deleteTx('expense');
  env.app.closeDialog(true);
  await settled();
  assert.equal(env.queueOps.length, 1);
  assert.equal(env.queueOps[0].action, 'delete_tx');
  assert.equal(env.queueOps[0].payload.id, 'expense');
  assert.equal(env.context.window.AppState.isDeleting('expense'), true);
  assert.equal(env.st['txCache:2026-09'].data.length, 0);
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 0);
  assert.equal(env.st.lastSummary.expense, 0);
  assert.equal((await env.app.loadTx('2026-09', true)).length, 0);
  env.windowEvents.dispatch('queue-sent', { detail: { id: env.queueOps[0].id, result: {} } });
  assert.equal(env.context.window.AppState.isDeleting('expense'), false);
});

test('failed delete restores the record, category totals and member amounts', async () => {
  const env = setup();
  const summary = {
    income: 0, expense: 20, balance: -20,
    categories: [{ id: 'food', fact: 20, plan: 100 }],
    members: [{ id: 'me', income: 0, paid_shared: 0, personal: 20, share: 0, balance: 0 }],
  };
  env.st['summaryCache:2026-09'].data = summary;
  env.st.lastSummary = summary;
  env.app.deleteTx('expense');
  env.app.closeDialog(true);
  await settled();
  assert.equal(env.st['txCache:2026-09'].data.length, 0);
  assert.equal(env.st.lastSummary.expense, 0);
  assert.equal(env.st.lastSummary.categories[0].fact, 0);
  assert.equal(env.st.lastSummary.members[0].personal, 0);
  const op = env.queueOps[0];
  env.windowEvents.dispatch('queue-failed', { detail: { op, error: { code: 'not_found', message: 'nope' } } });
  assert.equal(env.context.window.AppState.isDeleting('expense'), false);
  assert.equal(env.st['txCache:2026-09'].data[0].id, 'expense');
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 20);
  assert.equal(env.st.lastSummary.expense, 20);
  assert.equal(env.st.lastSummary.categories[0].fact, 20);
  assert.equal(env.st.lastSummary.members[0].personal, 20);
  assert.match(env.nodes.get('#toast').textContent, /Не удалилось/);
});

test('plan SWR shows cached goals and retains them if background refresh fails', async () => {
  const env = setup(undefined, { api: () => Promise.reject(new Error('offline')) });
  env.st.plans = { goals: [{ id: 'g', name: 'cached-plan-marker', target: 100, saved: 10 }], debts: [], wishes: [], recurring: [] };
  env.app.openPlans();
  assert.match(env.nodes.get('#screen').innerHTML, /cached-plan-marker/);
  await settled();
  assert.match(env.nodes.get('#screen').innerHTML, /cached-plan-marker/);
  assert.match(env.nodes.get('#toast').textContent, /Не удалось обновить/);
});

test('a delayed plans response does not repaint settings after a quick tab switch', async () => {
  const plans = deferred();
  const env = setup(undefined, {
    api(action) {
      if (action === 'list_plans') return plans.promise;
      if (action === 'list_recurring') return Promise.resolve([]);
      return Promise.resolve([]);
    },
  });
  env.st.member = { id: 'me', household_id: 'home' };

  env.app.openPlans();
  env.app.openTab('settings');
  plans.resolve({ goals: [{ id: 'g', name: 'late-plan-marker', target: 100, saved: 10 }], debts: [], wishes: [] });
  await settled();
  await settled();
  env.flushTimers();

  const html = env.nodes.get('#screen').innerHTML;
  assert.match(html, /profile-page/);
  assert.doesNotMatch(html, /late-plan-marker/);
  assert.equal(env.app.getRoute().name, 'settings');
});

test('the primary add tab is visible only on home', () => {
  const env = setup(undefined, {
    stubReload: false,
    api: action => Promise.resolve(action === 'summary' ? { expense: 0 } : action === 'list_plans' ? {} : []),
  });
  env.st.member = { id: 'me', household_id: 'home' };

  env.app.openPlans();
  assert.equal(env.nodes.get('#tabs').classList.contains('tabs--primary-hidden'), true);
  env.app.openSummary();
  assert.equal(env.nodes.get('#tabs').classList.contains('tabs--primary-hidden'), false);
  env.app.openSettings();
  assert.equal(env.nodes.get('#tabs').classList.contains('tabs--primary-hidden'), true);
});

test('finance navigation preserves active filters on refresh and resets them on explicit tab entry', async () => {
  const env = setup(undefined, { stubReload: false, api: () => Promise.resolve([env.tx]) });
  env.st.member = { id: 'me', household_id: 'first' };
  env.st.txFilter = { kind: 'income', category_id: 'food', member_id: 'me', q: 'old note' };
  env.app.openTx();
  await settled();
  assert.equal(env.st.txFilter.kind, 'income');
  assert.equal(env.st.txFilter.member_id, 'me');
  assert.equal(env.st.txFilter.q, 'old note');
  env.app.openTab('tx');
  await settled();
  assert.equal(env.st.txFilter.kind, null);
  assert.equal(env.st.txFilter.category_id, null);
  assert.equal(env.st.txFilter.member_id, null);
  assert.equal(env.st.txFilter.q, '');
});

test('home income and expense cards open finance with a kind filter and switching stays on the page', async () => {
  const env = setup(undefined, { stubReload: false, api: () => Promise.resolve([env.tx]) });
  env.st.member = { id: 'me', household_id: 'first' };
  env.app.openTxKind('income');
  assert.equal(env.st.txFilter.kind, 'income');
  assert.equal(env.st.txFilter.category_id, null);
  assert.equal(env.st.txFilter.member_id, null);
  assert.equal(env.st.txFilter.q, '');
  assert.match(env.nodes.get('#screen').innerHTML, /finance-stat--income finance-stat--active/);
  await settled();
  env.nodes.get('#screen').scrollTop = 240;
  env.app.setTxKind('expense');
  assert.equal(env.st.txFilter.kind, 'expense');
  assert.equal(env.st.txChart, 'expense');
  assert.match(env.nodes.get('#screen').innerHTML, /finance-stat--expense finance-stat--active/);
  assert.equal(env.nodes.get('#screen').scrollTop, 240);
  env.app.setTxKind('');
  assert.equal(env.st.txFilter.kind, null);
  assert.equal(env.st.txChart, 'balance');
  assert.match(env.nodes.get('#screen').innerHTML, /finance-stat--balance finance-stat--active/);
  env.app.openTab('tx');
  await settled();
  assert.equal(env.st.txFilter.kind, null);
});

test('category drill-down sets the category filter and the matching chart mode', async () => {
  const env = setup(undefined, { stubReload: false, api: () => Promise.resolve([env.tx]) });
  env.st.member = { id: 'me', household_id: 'first' };
  env.st.categories = [{ id: 'food', name: 'Food', kind: 'expense' }, { id: 'salary', name: 'Salary', kind: 'income' }];
  env.app.openTx('food');
  assert.equal(env.st.txFilter.category_id, 'food');
  assert.equal(env.st.txChart, 'expense');
  await settled();
  env.app.openTx('salary');
  assert.equal(env.st.txFilter.category_id, 'salary');
  assert.equal(env.st.txChart, 'income');
  await settled();
});

test('confirmed mutation supersedes a pending plans read before reloading plans', async () => {
  const previous = deferred();
  let planReads = 0;
  const env = setup(undefined, { api: action => {
    if (action === 'list_plans') return ++planReads === 1 ? previous.promise : Promise.resolve({ goals: [{ id: 'new-goal' }] });
    return Promise.resolve(action === 'list_recurring' ? [] : {});
  } });
  const oldPlans = env.app.loadPlans(true);
  const rejected = assert.rejects(oldPlans, { code: 'stale_response' });
  await settled();
  await env.app.mutate('save_goal', { name: 'New goal' });
  const fresh = await env.app.loadPlans();
  assert.equal(fresh.goals[0].id, 'new-goal');
  previous.resolve({ goals: [{ id: 'old-goal' }] });
  await rejected;
  assert.equal(env.st.plans.goals[0].id, 'new-goal');
  assert.equal(planReads, 2);
});

test('queued category and recurring acknowledgments invalidate resource cache', async () => {
  for (const kind of ['category', 'recurring']) {
    const env = setup();
    const values = kind === 'category'
      ? { name: 'New category', icon: '🛒', plan: '100' }
      : { name: 'New recurring', amount: '100', day: '15', reminder_days: '3', category_id: 'food' };
    const f = { getAttribute: () => null, elements: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])), querySelector: () => ({ disabled: false }) };
    if (kind === 'category') env.app.submitCategory(f); else env.app.submitRecurring(f);
    assert.equal(env.queueOps[0].action, kind === 'category' ? 'save_category' : 'save_recurring');
    let resourceReads = 0;
    const loader = () => Promise.resolve({ generation: ++resourceReads });
    await env.app.loadResource('ack-probe', loader);
    await env.app.loadResource('ack-probe', loader);
    assert.equal(resourceReads, 1);
    env.windowEvents.dispatch('queue-sent', { detail: { id: env.queueOps[0].id, result: {} } });
    await settled();
    await env.app.loadResource('ack-probe', loader);
    assert.equal(resourceReads, 2);
  }
});

test('expanded category ignores late rows from old month even when category ID is unchanged', async () => {
  const pending = deferred();
  const env = setup(undefined, { api: () => pending.promise });
  env.app.setExpandedForTest({ id: 'food', rows: null });
  env.app.fillExpandedCat(null, 'food');
  await settled();
  env.st.month = '2026-10';
  const nextExpanded = { id: 'food', rows: [{ id: 'current-month-only' }] };
  env.app.setExpandedForTest(nextExpanded);
  pending.resolve([env.tx]);
  await settled();
  assert.equal(env.app.getExpanded(), nextExpanded);
  assert.equal(env.app.getExpanded().rows[0].id, 'current-month-only');
});

test('old edit finally cannot clear saving state of a new edit after scope change', async () => {
  const oldRequest = deferred(), newRequest = deferred();
  let saves = 0;
  const env = setup(() => ++saves === 1 ? oldRequest.promise : newRequest.promise);
  env.st.member = { id: 'me', household_id: 'first' };
  await open(env);
  env.app.submitEditTx(form());
  env.app.adoptMember({ id: 'me', household_id: 'second' });
  assert.equal(env.app.getSaving(), false);
  env.st.categories = [{ id: 'food', name: 'Food', kind: 'expense' }, { id: 'travel', name: 'Travel', kind: 'expense' }];
  env.app.cached('txCache:2026-09', [{ ...env.tx }]);
  await open(env);
  const nextForm = form();
  env.app.submitEditTx(nextForm);
  assert.equal(env.app.getSaving(), true);
  oldRequest.resolve({ id: 'expense' });
  await settled();
  assert.equal(env.app.getSaving(), true);
  assert.ok(nextForm.buttons.every(button => button.disabled));
  assert.ok(env.app.getEditing());
  newRequest.resolve({ id: 'expense' });
  await settled();
  assert.equal(env.app.getSaving(), false);
  assert.equal(env.app.getEditing(), null);
});

for (const code of ['unauthorized', 'no_household']) {
  test(`forced ${code} response clears fresh family cache instead of keeping offline access`, async () => {
    const env = setup(undefined, { stubReload: false, api: action => {
      if (action === 'summary') return Promise.reject(Object.assign(new Error(code), { code }));
      return Promise.resolve(action === 'list_plans' ? {} : []);
    } });
    env.app.adoptMember({ id: 'me', household_id: 'old-family' });
    env.st.categories = [{ id: 'food', name: 'old-family-sensitive-category', kind: 'expense' }];
    env.st.plans = { goals: [], debts: [], wishes: [], recurring: [] };
    env.app.cached('summaryCache:2026-09', { expense: 20, categories: [{ id: 'food', name: 'old-family-sensitive-category', fact: 20 }] });
    env.app.cached('txCache:2026-09', [env.tx]);
    env.app.openSummary(true);
    assert.match(env.nodes.get('#screen').innerHTML, /old-family-sensitive-category/);
    await settled();
    assert.ok(env.apiCalls.some(call => call.action === 'summary'));
    assert.equal(env.st.member, null);
    assert.equal(env.st.categories, null);
    assert.equal(env.st.plans, null);
    assert.equal(env.st['summaryCache:2026-09'], undefined);
    assert.equal(env.st['txCache:2026-09'], undefined);
    assert.doesNotMatch(env.nodes.get('#screen').innerHTML, /old-family-sensitive-category/);
    assert.equal(env.nodes.get('#tabs').hidden, true);
    if (code === 'unauthorized') assert.match(env.nodes.get('#screen').innerHTML, /Нужен доступ из бота/);
    else assert.match(env.nodes.get('#screen').innerHTML, /Создать семью/);
  });
}

test('page gesture direction uses movement lock and leaves diagonals undecided', () => {
 const {app} = setup();
 assert.equal(app.pageGestureAxis(5,2), null);
 assert.equal(app.pageGestureAxis(80,20), 'x');
 assert.equal(app.pageGestureAxis(20,80), 'y');
 assert.equal(app.pageGestureAxis(40,40), null);
});
test('pull refresh coalesces requests, only refreshes finance rows and keeps data on failure', async () => {
 let reject;
 const env=setup(undefined,{stubReload:false,api: action => action==='list_tx' ? new Promise((_,r)=>{reject=r;}) : Promise.resolve({})});
 env.app.openTx();
 await Promise.resolve();
 const before=env.apiCalls.length;
 const first=env.app.refreshCurrentPage();
 assert.equal(first,env.app.refreshCurrentPage());
 await Promise.resolve();
 assert.ok(env.apiCalls.slice(before).every(c=>c.action==='list_tx'));
 reject(new Error('offline'));
 await first;
 assert.equal(env.st['txCache:2026-09'].data[0].id,'expense');
 assert.equal(env.nodes.get('#screen').classList.contains('screen--refreshing'),false);
});

test('dock visibility, focusability and intro follow home across interrupted transitions', () => {
 const env=setup(), tabs=env.nodes.get('#tabs'); env.st.member={id:'me'};
 const attrs = new Map(), primary=Object.assign(fakeNode(), {contains:()=>false, setAttribute:(k,v)=>attrs.set(k,v)});
 tabs.children=['summary','tx','add','plans','settings'].map(id=>Object.assign(fakeNode(),{getAttribute:()=>id}));
 tabs.querySelector=selector=>selector==='[data-tab="add"]'?primary:selector==='.tabs__notch-fill'?{}:null;
 for (const name of ['summary','plans','summary','settings','tx','add','limits','summary']) {
   env.app.setRoute(name); env.app.applyRouteUi();
   const shown=name==='summary';
   assert.equal(tabs.classList.contains('tabs--primary-hidden'),!shown);
   assert.equal(tabs.classList.contains('tabs--intro'),shown);
   assert.equal(primary.tabIndex,shown?0:-1);
   assert.equal(primary.inert,!shown);
   assert.equal(attrs.get('aria-hidden'),String(!shown));
 }
 env.frame(800);
 assert.equal(tabs.classList.contains('tabs--intro'),false);
 env.app.applyRouteUi(); // cached repaint does not restart an already settled home intro
 assert.equal(tabs.classList.contains('tabs--intro'),false);
 env.app.setRoute('plans'); env.app.applyRouteUi();
 env.app.setRoute('summary'); env.app.applyRouteUi();
 assert.equal(tabs.classList.contains('tabs--intro'),true);
 env.st.member=null; env.app.applyRouteUi(); env.flushTimers();
 assert.equal(tabs.hidden,true); assert.equal(tabs.classList.contains('tabs--intro'),false);
});
test('leaving home moves focus away from the central action before hiding it', () => {
 const env=setup(), tabs=env.nodes.get('#tabs'); env.st.member={id:'me'};
 let focused=false;
 const primary=Object.assign(fakeNode(), {contains:node=>node===primary, setAttribute(name) { if(name==='aria-hidden') assert.equal(focused,true); }});
 const profile={focus(){focused=true;}};
 tabs.querySelector=selector=>selector==='[data-tab="add"]'?primary:selector==='[data-tab="settings"]'?profile:selector==='.tabs__notch-fill'?{}:null;
 env.context.document.activeElement=primary;
 env.app.setRoute('settings'); env.app.applyRouteUi();
 assert.equal(focused,true); assert.equal(primary.inert,true);
});
test('a stale add action outside home cannot open quick actions', () => {
 const env=setup(); env.st.member={id:'me'};
 env.app.openSettings(); env.app.openTab('add');
 assert.equal(env.sheet.hidden,true);
 assert.equal(env.app.getRoute().name,'settings');
});
test('page pull starts only at top, cancels cleanly and does not navigate from expense or sheet', async () => {
 const env=setup(undefined,{stubReload:false}); env.st.member={id:'me'};
 const screen=env.nodes.get('#screen'); screen.clientWidth=375;
 env.context.window.innerWidth=375; env.context.window.getComputedStyle=()=>({overflowX:'visible'});
 const target={closest:()=>null,parentElement:screen,scrollTop:0,scrollWidth:0,clientWidth:0};
 const event=(x,y)=>({target,touches:[{clientX:x,clientY:y}],preventDefault(){},cancelable:true});
 screen.scrollTop=20; screen.dispatch('touchstart',event(180,100)); screen.dispatch('touchmove',event(180,300)); screen.dispatch('touchend',event(180,300));
 assert.equal(env.apiCalls.length,0);
 screen.scrollTop=0; screen.dispatch('touchstart',event(180,100)); screen.dispatch('touchmove',event(180,300)); screen.dispatch('touchcancel',event(180,300));
 assert.equal(screen.classList.contains('screen--pulling'),false); assert.equal(env.apiCalls.length,0);
 env.sheet.hidden=false; screen.dispatch('touchstart',event(180,100)); screen.dispatch('touchmove',event(30,100)); screen.dispatch('touchend',event(30,100)); assert.equal(env.apiCalls.length,0);
 env.sheet.hidden=true; const expense={...target,closest:selector=>selector.includes('.tx,')?{}:null};
 screen.dispatch('touchstart',{...event(180,100),target:expense}); screen.dispatch('touchmove',event(30,100)); screen.dispatch('touchend',event(30,100)); assert.equal(env.apiCalls.length,0);
});

test('page swipe switches once and vertical top pull refreshes current resources', async () => {
 const env=setup(undefined,{stubReload:false,api:action=>Promise.resolve(action==='summary'?{income:100,expense:20,balance:80,categories:[]}:action==='list_plans'?{goals:[],debts:[],wishes:[]}:[])});
 env.st.member={id:'me'}; const screen=env.nodes.get('#screen'); screen.clientWidth=375;
 env.context.window.innerWidth=375; env.context.window.getComputedStyle=()=>({overflowX:'visible'});
 const target={closest:()=>null,parentElement:screen,scrollTop:0,scrollWidth:0,clientWidth:0};
 const event=(x,y)=>({target,touches:[{clientX:x,clientY:y}],preventDefault(){},cancelable:true});
 screen.dispatch('touchstart',event(200,100)); screen.dispatch('touchmove',event(200,300)); screen.dispatch('touchend',event(200,300));
 await env.app.refreshCurrentPage();
 assert.deepEqual(env.apiCalls.map(c=>c.action).sort(),['list_plans','list_recurring','list_tx','summary']);
 assert.equal(env.st['summaryCache:2026-09'].data.balance,80);
 env.apiCalls.length=0;
 env.app.navigateBySwipe(1);
 await Promise.resolve(); await Promise.resolve();
 assert.equal(env.app.getRoute().name,'tx');
 assert.equal(env.apiCalls.filter(c=>c.action==='list_tx').length,0);
 screen.dispatch('touchstart',event(200,100)); screen.dispatch('touchmove',event(80,105)); screen.dispatch('touchend',event(80,105));
 assert.equal(env.apiCalls.filter(c=>c.action==='list_plans').length,0);
});
test('profile shows add-to-home-screen only for supported statuses and invokes native prompt', () => {
  const env = setup(undefined, { homeScreen: { supported: true, status: 'missed', added: false } });
  env.app.openSettings();
  assert.equal(env.app.getHomeScreenStatus(), 'missed');
  const html = env.nodes.get('#screen').innerHTML;
  assert.match(html, /data-action="add-home-screen"/);
  assert.match(html, /Добавить на главный экран/);
  env.app.addHomeScreen();
  assert.equal(env.homeScreen.added, true);
});

test('profile marks an installed shortcut and hides it when unsupported', () => {
  const installed = setup(undefined, { homeScreen: { supported: true, status: 'added', added: false } });
  installed.app.openSettings();
  const html = installed.nodes.get('#screen').innerHTML;
  assert.match(html, /Приложение на главном экране/);
  assert.match(html, /aria-disabled="true"/);
  installed.app.addHomeScreen();
  assert.equal(installed.homeScreen.added, false);

  const unsupported = setup();
  unsupported.app.openSettings();
  assert.doesNotMatch(unsupported.nodes.get('#screen').innerHTML, /data-action="add-home-screen"/);
  unsupported.app.addHomeScreen();
  assert.equal(unsupported.homeScreen.added, false);
});

test('homeScreenAdded marks the shortcut and refreshes the profile', () => {
  const env = setup(undefined, { homeScreen: { supported: true, status: 'missed', added: false } });
  env.app.openSettings();
  env.app.markHomeScreenAdded();
  assert.equal(env.app.getHomeScreenStatus(), 'added');
  assert.match(env.nodes.get('#screen').innerHTML, /Ярлык уже добавлен/);
  assert.match(env.nodes.get('#toast').textContent, /Ярлык добавлен/);
});

test('android shortcut shows a manual fallback when the native dialog produces no event', () => {
  const env = setup(undefined, { homeScreen: { supported: true, status: 'missed', added: false, platform: 'android' } });
  env.app.openSettings();
  env.app.addHomeScreen();
  assert.equal(env.homeScreen.added, true);
  assert.equal(env.app.getHomeScreenStatus(), 'missed');
  env.flushTimers();
  assert.match(env.nodes.get('#dialog-text').textContent, /Откройте чат с ботом/);
  assert.equal(env.nodes.get('#dialog').hidden, false);
});

test('android shortcut fallback is cancelled by homeScreenAdded', () => {
  const env = setup(undefined, { homeScreen: { supported: true, status: 'missed', added: false, platform: 'android' } });
  env.app.openSettings();
  env.app.addHomeScreen();
  env.app.markHomeScreenAdded();
  env.flushTimers();
  assert.equal(env.app.getHomeScreenStatus(), 'added');
  assert.equal(env.nodes.get('#dialog').hidden, true);
  assert.doesNotMatch(env.nodes.get('#dialog-text').textContent, /Откройте чат с ботом/);
});

test('profile form saves member and household names and rolls back on failure', async () => {
  let fail = false;
  const env = setup(undefined, {
    stubReload: false,
    api: (action, payload) => {
      if (action === 'save_profile') {
        if (fail) return Promise.reject(Object.assign(new Error('bad_name'), { code: 'bad_name' }));
        return Promise.resolve({ ok: true, member_name: payload.member_name, household_name: payload.household_name });
      }
      return Promise.resolve(action === 'me' ? { member: env.st.member } : []);
    },
  });
  env.st.member = { id: 'me', name: 'Аня', households: { id: 'h1', name: 'Наша семья' } };
  env.app.openSettings('family');
  const formNode = {
    elements: { member_name: { value: '  Анечка ' }, household_name: { value: ' Семья 2 ' } },
    querySelector: selector => selector === '[type="submit"]' ? { disabled: false } : null,
  };
  env.app.submitProfile(formNode);
  assert.equal(env.st.member.name, 'Анечка');
  assert.equal(env.st.member.households.name, 'Семья 2');
  await settled();
  assert.ok(env.apiCalls.some(call => call.action === 'save_profile' && call.payload.member_name === 'Анечка'));
  assert.match(env.nodes.get('#toast').textContent, /Сохранено/);

  fail = true;
  const failing = {
    elements: { member_name: { value: 'Имя 2' }, household_name: { value: 'Семья 3' } },
    querySelector: () => ({ disabled: false }),
  };
  env.app.submitProfile(failing);
  assert.equal(env.st.member.name, 'Имя 2');
  await settled();
  assert.equal(env.st.member.name, 'Анечка');
  assert.equal(env.st.member.households.name, 'Семья 2');
});

test('home edit reorders blocks, persists on save, resets and cancels', () => {
  const env = setup();
  const defaults = ['balance', 'categories', 'forecast', 'plans', 'partners'];
  env.app.startHomeEdit();
  assert.equal(env.st.homeEdit, true);
  assert.match(env.nodes.get('#screen').innerHTML, /data-action="home-edit-save"/);

  env.app.moveHomeBlock('categories', 'up');
  assert.deepEqual(Array.from(env.st.homeDraft), ['categories', 'balance', 'forecast', 'plans', 'partners']);
  assert.deepEqual(Array.from(env.st.homeOrder), defaults);

  env.app.saveHomeEdit();
  assert.equal(env.st.homeEdit, false);
  assert.equal(env.st.homeDraft, null);
  assert.deepEqual(Array.from(env.st.homeOrder), ['categories', 'balance', 'forecast', 'plans', 'partners']);
  assert.equal(JSON.parse(env.storage.get('budget.homeOrder.' + (env.st.member && env.st.member.id)))[0], 'categories');

  const reloaded = setup(undefined, { storage: env.storage });
  assert.deepEqual(Array.from(reloaded.context.State.homeOrder()), ['categories', 'balance', 'forecast', 'plans', 'partners']);

  env.app.startHomeEdit();
  env.app.moveHomeBlock('plans', 'up');
  env.app.cancelHomeEdit();
  assert.deepEqual(Array.from(env.st.homeOrder), ['categories', 'balance', 'forecast', 'plans', 'partners']);
  assert.equal(JSON.parse(env.storage.get('budget.homeOrder.' + (env.st.member && env.st.member.id)))[0], 'categories');

  env.app.startHomeEdit();
  env.app.moveHomeBlock('partners', 'up');
  env.app.resetHomeEdit();
  assert.deepEqual(Array.from(env.st.homeDraft), defaults);
  assert.match(env.nodes.get('#toast').textContent, /Порядок сброшен/);
  env.app.saveHomeEdit();
  assert.deepEqual(Array.from(env.st.homeOrder), defaults);
  assert.deepEqual(JSON.parse(env.storage.get('budget.homeOrder.' + (env.st.member && env.st.member.id))), defaults);
});

test('profile form saves the changed name even when the stored household name is empty', async () => {
  const saves = [];
  const env = setup(undefined, {
    stubReload: false,
    api: (action, payload) => {
      if (action === 'save_profile') {
        saves.push(payload);
        return Promise.resolve({ ok: true, member_name: payload.member_name });
      }
      return Promise.resolve(action === 'me' ? { member: env.st.member } : []);
    },
  });
  env.st.member = { id: 'me', name: 'Аня', households: { id: 'h1' } };
  env.app.openSettings('family');
  const formNode = {
    elements: { member_name: { value: 'Анечка' }, household_name: { value: '' } },
    querySelector: selector => selector === '[type="submit"]' ? { disabled: false } : null,
  };
  env.app.submitProfile(formNode);
  assert.equal(env.st.member.name, 'Анечка');
  await settled();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].member_name, 'Анечка');
  assert.equal(Object.prototype.hasOwnProperty.call(saves[0], 'household_name'), false);
  assert.match(env.nodes.get('#toast').textContent, /Сохранено/);
  assert.doesNotMatch(env.nodes.get('#toast').textContent, /Введите/);
});

test('profile submit event reaches the profile handler', async () => {
  const env = setup(undefined, {
    stubReload: false,
    api: (action, payload) => {
      if (action === 'save_profile') return Promise.resolve({ ok: true, household_name: payload.household_name });
      return Promise.resolve(action === 'me' ? { member: env.st.member } : []);
    },
  });
  env.st.member = { id: 'me', name: 'Аня', households: { id: 'h1', name: 'Наша семья' } };
  env.app.openSettings('family');
  const formNode = {
    matches: selector => selector === 'form',
    getAttribute: name => name === 'data-form' ? 'profile' : null,
    elements: { member_name: { value: 'Аня' }, household_name: { value: 'Семья 2' } },
    querySelector: () => null,
  };
  env.context.document.dispatch('submit', { target: formNode, preventDefault() {} });
  assert.equal(env.st.member.households.name, 'Семья 2');
  await settled();
  assert.ok(env.apiCalls.some(call => call.action === 'save_profile' && call.payload.household_name === 'Семья 2'));
});

test('solo add form forces is_shared false even without the toggle', () => {
  const env = setup();
  const formNode = fakeNode();
  formNode.elements = {
    amount: { value: '12' },
    note: { value: '' },
    occurred_on: { value: '2026-10-01' },
  };
  const screen = env.nodes.get('#screen');
  screen.querySelector = selector => selector === '[data-form="add"]' ? formNode : null;
  env.st.member = { id: 'me', name: 'Me', households: { mode: 'solo' } };
  assert.equal(env.app.formValues().is_shared, false);
  env.st.member = { id: 'me', name: 'Me', households: { mode: 'pair' } };
  formNode.elements.is_shared = { checked: true };
  assert.equal(env.app.formValues().is_shared, true);
});


test('custom cover selection and reset update appearance without server calls', async () => {
  let selected = 'custom';
  let cleared = 0;
  const custom = { id: 'custom', name: 'Своё фото', file: 'blob:cover', tone: 'dark', custom: true };
  const covers = {
    list: [{ id: 'default', name: 'Стандартная' }, { id: 'blue', name: 'Синий', file: 'covers/blue.webp', tone: 'dark' }],
    id: () => selected,
    current: () => selected === 'custom' ? custom : null,
    custom: () => custom,
    set(id) { selected = id; return true; },
    clearCustom() { cleared++; selected = 'default'; return Promise.resolve(true); },
    loadCustom() { return Promise.resolve(custom); },
  };
  const env = setup(undefined, { covers });
  env.app.openSettings('appearance');
  assert.match(env.nodes.get('#screen').innerHTML, /data-cover="custom"/);
  env.app.setCover('blue');
  assert.equal(selected, 'blue');
  assert.match(env.nodes.get('#toast').textContent, /Обложка обновлена/);
  selected = 'custom';
  env.app.resetCustomCover();
  await settled();
  assert.equal(cleared, 1);
  assert.equal(selected, 'default');
  assert.match(env.nodes.get('#toast').textContent, /Свой фон убран/);
  assert.equal(env.apiCalls.length, 0);
});

test('cover crop keeps the card ratio and respects zoom and offsets', () => {
  const env = setup();
  const calls = [];
  const canvas = {
    width: 1500,
    height: 600,
    getContext: () => ({
      clearRect() {},
      drawImage() { calls.push(Array.from(arguments).slice(1)); },
    }),
  };
  const image = { naturalWidth: 3000, naturalHeight: 3000 };
  assert.equal(env.app.drawCoverCrop(canvas, image, 1, 50, 50), true);
  assert.deepEqual(calls[0], [0, 900, 3000, 1200, 0, 0, 1500, 600]);
  calls.length = 0;
  assert.equal(env.app.drawCoverCrop(canvas, image, 2, 25, 50), true);
  assert.deepEqual(calls[0], [375, 1200, 1500, 600, 0, 0, 1500, 600]);
  calls.length = 0;
  assert.equal(env.app.drawCoverCrop(canvas, image, 0.2, -20, 120), true);
  assert.deepEqual(calls[0], [0, 1800, 3000, 1200, 0, 0, 1500, 600]);
  assert.equal(env.app.drawCoverCrop({ getContext: () => null }, image, 1, 0, 0), false);
  assert.equal(env.app.drawCoverCrop(canvas, { naturalWidth: 0, naturalHeight: 1 }, 1, 0, 0), false);

  const draft = { image, zoom: 1, x: 50, y: 50 };
  env.app.setCoverDraftForTest(draft);
  env.app.updateCoverDraft({ matches: selector => selector === '[data-cover-zoom]', value: '250' });
  assert.equal(draft.zoom, 2.5);
  env.app.updateCoverDraft({ matches: selector => selector === '[data-cover-x]', value: '10' });
  assert.equal(draft.x, 10);
  env.app.updateCoverDraft({ matches: selector => selector === '[data-cover-y]', value: '90' });
  assert.equal(draft.y, 90);
});

test('cover upload validates image type and size before reading', () => {
  const env = setup();
  env.app.readCoverFile({ type: 'application/pdf', size: 20 });
  assert.match(env.nodes.get('#toast').textContent, /Выберите изображение/);
  env.app.readCoverFile({ type: 'image/jpeg', size: 13 * 1024 * 1024 });
  assert.match(env.nodes.get('#toast').textContent, /Файл слишком большой/);
});

test('home category sort dropdown updates and persists the preference', () => {
  const env = setup();
  env.st.homeShowEmpty = true;
  env.app.setHomeCategorySort('amount');
  assert.equal(env.st.homeCategorySort, 'amount');
  assert.equal(env.st.homeShowEmpty, false);
  assert.equal(env.storage.get('budget.homeCategorySort'), 'amount');
  env.app.setHomeCategorySort('unknown');
  assert.equal(env.st.homeCategorySort, 'default');
  assert.equal(env.storage.get('budget.homeCategorySort'), 'default');
});

test('theme preference is saved and passed to the Telegram theme layer', () => {
  const env = setup();
  env.app.setThemePreference('dark');
  assert.equal(env.context.themeMode, 'dark');
  assert.equal(env.storage.get('budget.theme'), 'dark');
  env.app.setThemePreference('system');
  assert.equal(env.context.themeMode, 'system');
  assert.equal(env.storage.get('budget.theme'), 'system');
});

test('page swipe follows main tabs, skips add and ignores interactive targets', () => {
  const env = setup();
  env.st.member = { id: 'me', household_id: 'home' };
  assert.equal(env.app.swipeTarget('summary', 1), 'tx');
  assert.equal(env.app.swipeTarget('tx', 1), 'plans');
  assert.equal(env.app.swipeTarget('plans', 1), 'settings');
  assert.equal(env.app.swipeTarget('settings', 1), null);
  assert.equal(env.app.swipeTarget('summary', -1), null);
  assert.equal(env.app.swipeTarget('add', 1), null);
  assert.equal(env.app.swipeTarget('limits', -1), null);

  assert.equal(env.app.pageSwipeAllowed({ closest: () => null }), true);
  assert.equal(env.app.pageSwipeAllowed({ closest: () => ({}) }), false);

  env.context.window.routeReloaded = null;
  assert.equal(env.app.navigateBySwipe(1), true);
  assert.equal(env.context.window.routeReloaded, 'tx');
  env.context.window.routeReloaded = null;
  assert.equal(env.app.navigateBySwipe(-1), false);
  assert.equal(env.context.window.routeReloaded, null);
});

test('page swipe starts on cards and stat buttons but not on gesture surfaces', () => {
  const env = setup();
  env.st.member = { id: 'me', household_id: 'home' };
  // На телефоне карточки категорий и стат-блоки занимают почти весь экран:
  // если считать их интерактивными, свайп между страницами почти не работает.
  const token = name => new RegExp('(^|,)\\s*' + name + '\\s*(,|$)');
  const target = selector => ({ closest: value => token(selector).test(value) ? {} : null });
  assert.equal(env.app.pageSwipeAllowed(target('button')), true);
  assert.equal(env.app.pageSwipeAllowed(target('input')), false);
  assert.equal(env.app.pageSwipeAllowed(target('.tx')), false);
  assert.equal(env.app.pageSwipeAllowed(target('.finance-operation')), false);
  assert.equal(env.app.pageSwipeAllowed(target('.segments')), false);
});

test('page swipe peeks at the neighbouring page rendered from cached data', () => {
  const env = setup();
  env.st.member = { id: 'me', household_id: 'home' };
  env.app.cached('summaryCache:2026-09', {
    expense: 20,
    categories: [{ id: 'food', name: 'cached-name', fact: 20, kind: 'expense' }],
  });
  assert.match(env.app.pagePreviewHtml('summary'), /cached-name/);
  assert.match(env.app.pagePreviewHtml('tx'), /old note/);
  assert.match(env.app.pagePreviewHtml('settings'), /profile-page/);
  assert.equal(env.app.pagePreviewHtml('add'), '');

  // Соседняя страница есть — тянем на четверть ширины; на краю список не листается.
  assert.equal(env.app.pageSwipeFlip({ dx: -90, width: 320, dir: -1 }), true);
  assert.equal(env.app.pageSwipeFlip({ dx: -40, width: 320, dir: -1 }), false);
  assert.equal(env.app.pageSwipeFlip({ dx: -40, width: 320, dir: -1, fast: true }), true);
  assert.equal(env.app.pageSwipeFlip({ dx: 30, width: 320, dir: -1 }), false);
  assert.equal(env.app.pageSwipeFlip({ dx: -30, width: 320, dir: -1, edge: true, fast: true }), false);
});

test('a new swipe finishes the previous transition instead of fighting it', () => {
  const env = setup();
  env.st.member = { id: 'me', household_id: 'home' };
  env.app.settlePageSwipe({ dx: -200, width: 320, dir: -1, from: 'summary', target: 'tx', peek: null }, true);
  assert.ok(env.app.getPageSettle());
  env.app.flushPageSettle();
  assert.equal(env.context.window.routeReloaded, 'tx');
  assert.equal(env.app.getPageSettle(), null);

  // Таймер завершённого перехода уже снят и не перелистнёт страницу ещё раз.
  env.context.window.routeReloaded = null;
  env.flushTimers();
  assert.equal(env.context.window.routeReloaded, null);
});

test('changing tabs drops a half-finished swipe without navigating', () => {
  const env = setup();
  env.st.member = { id: 'me', household_id: 'home' };
  env.app.settlePageSwipe({ dx: -200, width: 320, dir: -1, from: 'summary', target: 'tx', peek: null }, true);
  env.app.dropPageSettle();
  assert.equal(env.app.getPageSettle(), null);
  env.flushTimers();
  assert.equal(env.context.window.routeReloaded, undefined);

});

test('profile opens the shared home editor and returns after saving or cancelling', () => {
 const env=setup(undefined,{stubReload:false}); env.st.member={id:'me'};
 env.app.openSettings('interface'); env.app.startHomeEdit();
 assert.equal(env.st.homeEdit,true); assert.equal(env.app.getRoute().name,'summary');
 env.app.moveHomeBlock('categories','up'); env.app.saveHomeEdit();
 assert.equal(env.app.getRoute().name,'settings'); assert.equal(env.app.getRoute().section,'interface');
 assert.equal(env.context.State.homeOrder()[0],'categories');
 env.app.startHomeEdit(); env.app.cancelHomeEdit();
 assert.equal(env.app.getRoute().section,'interface'); assert.equal(env.st.homeEdit,false);
});

function countScreenPaints(env) {
  const screen = env.nodes.get('#screen');
  let html = screen.innerHTML, count = 0;
  Object.defineProperty(screen, 'innerHTML', { get: () => html, set: value => { html = value; count++; } });
  return () => count;
}

test('fresh finance cache paints once, equal forced response does not repaint or reset scroll', async () => {
  const env = setup(undefined, { stubReload: false, api: () => Promise.resolve([]) });
  env.app.cached('txCache:2026-09', []);
  const paints = countScreenPaints(env);
  env.app.openTx(); await settled();
  assert.equal(paints(), 1); assert.equal(env.apiCalls.length, 0);
  env.nodes.get('#screen').scrollTop = 200;
  await env.app.refreshCurrentPage();
  assert.equal(paints(), 1); assert.equal(env.nodes.get('#screen').scrollTop, 200);
});

test('expired finance cache is synchronous and a changed response preserves search, focus, scroll and sheet', async () => {
  const clock = { now: 1000 }, pending = deferred();
  const env = setup(undefined, { stubReload: false, clock, api: () => pending.promise });
  env.app.cached('txCache:2026-09', [env.tx]); clock.now += 300001;
  env.st.txFilter.q = 'old';
  env.app.openTx();
  assert.match(env.nodes.get('#screen').innerHTML, /old note/);
  assert.doesNotMatch(env.nodes.get('#screen').innerHTML, /skeleton/);
  const screen = env.nodes.get('#screen'); screen.scrollTop = 125;
  const input = { id: 'tx-search', selectionStart: 1, selectionEnd: 2, focus() { this.focused = true; }, setSelectionRange(a,b) { this.range = [a,b]; } };
  env.context.document.activeElement = input;
  screen.querySelector = selector => selector === '#tx-search' ? input : null;
  env.sheet.hidden = false; env.nodes.get('#sheet-body').innerHTML = 'draft stays';
  pending.resolve([{ ...env.tx, note: 'old note updated' }]); await settled();
  assert.match(screen.innerHTML, /old note updated/);
  assert.equal(screen.scrollTop, 125); assert.equal(env.st.txFilter.q, 'old');
  assert.equal(input.focused, true); assert.deepEqual(input.range, [1,2]);
  assert.equal(env.sheet.hidden, false); assert.equal(env.nodes.get('#sheet-body').innerHTML, 'draft stays');
  assert.equal(screen.classList.contains('screen--instant'), true);
});

test('ordinary plans entry respects TTL and expired categories return stale values while revalidating', async () => {
  const clock = { now: 1000 }, categories = deferred();
  let categoryCalls = 0;
  const env = setup(undefined, { clock, api: action => {
    if (action === 'categories') return ++categoryCalls === 1 ? Promise.resolve([{ id: 'old' }]) : categories.promise;
    return Promise.resolve(action === 'list_plans' ? {} : []);
  } });
  env.app.openPlans(); await settled(); env.app.openPlans(); await settled();
  assert.equal(env.apiCalls.filter(c => c.action === 'list_plans').length, 1);
  await env.app.loadCategories(true);
  clock.now += 300001;
  assert.equal((await env.app.loadCategories())[0].id, 'old');
  assert.equal(categoryCalls, 2);
  categories.resolve([{ id: 'new' }]); await settled();
  assert.equal(env.st.categories[0].id, 'new');
});

test('rapid home/finance switches and repeated month opens deduplicate active reads', async () => {
  const rows = deferred(), summary = deferred();
  const env = setup(undefined, { stubReload: false, api: action => action === 'list_tx' ? rows.promise : action === 'summary' ? summary.promise : Promise.resolve(action === 'list_plans' ? {} : []) });
  env.app.cached('txCache:2026-09', [env.tx]);
  env.app.cached('summaryCache:2026-09', { expense: 20, categories: [] });
  env.app.openSummary(true); env.app.openTx(undefined, true); env.app.openSummary(true); env.app.openTx(undefined, true);
  await settled();
  assert.equal(env.apiCalls.filter(c => c.action === 'list_tx').length, 1);
  assert.equal(env.apiCalls.filter(c => c.action === 'summary').length, 1);
  rows.resolve([{ ...env.tx, note: 'latest-marker' }]); summary.resolve({ expense: 30, categories: [] }); await settled();
  assert.match(env.nodes.get('#screen').innerHTML, /latest-marker/);
  assert.equal(env.app.getRoute().name, 'tx');
});

test('pull refresh and lifecycle share page reads and lifecycle remains coalesced until data completes', async () => {
  const rows = deferred(), member = { id: 'me', household_id: 'home' };
  const env = setup(undefined, { stubReload: false, api: action => action === 'me' ? Promise.resolve({member}) : action === 'list_tx' ? rows.promise : Promise.resolve([]) });
  env.app.adoptMember(member); env.app.cached('txCache:2026-09', [env.tx]); env.app.openTx(); await settled();
  const pull = env.app.refreshCurrentPage(); const lifecycle = env.app.refreshOnReturn(); await settled();
  assert.equal(env.app.refreshOnReturn(), lifecycle);
  assert.equal(env.apiCalls.filter(c => c.action === 'list_tx').length, 1);
  assert.equal(env.apiCalls.filter(c => c.action === 'me').length, 1);
  rows.resolve([{ ...env.tx, note: 'partner-marker' }]); await Promise.all([pull, lifecycle]);
  assert.match(env.nodes.get('#screen').innerHTML, /partner-marker/);
});

test('return from background updates finance behind an active edit without changing its draft', async () => {
  const member = { id: 'me', household_id: 'home' };
  const env = setup(undefined, { stubReload: false, api: action => Promise.resolve(action === 'me' ? {member} : action === 'categories' ? [{ id: 'food', kind: 'expense' }] : [{ ...env.tx, note: 'partner-change' }]) });
  env.st.member = member;
  env.app.cached('txCache:2026-09', [env.tx]); env.app.openTx(); await settled();
  await open(env);
  const editing = env.app.getEditing(), draft = env.nodes.get('#sheet-body').innerHTML;
  await env.app.refreshOnReturn();
  assert.equal(env.app.getEditing(), editing); assert.equal(env.nodes.get('#sheet-body').innerHTML, draft);
  assert.equal(env.sheet.hidden, false); assert.equal(env.nodes.get('#screen').inert, true);
  assert.match(env.nodes.get('#screen').innerHTML, /partner-change/);
});

test('targeted edit expires both months but leaves other month, plans and categories fresh', async () => {
  const pending = deferred();
  const env = setup(() => pending.promise);
  env.app.cached('txCache:2026-08', []);
  await env.app.loadPlans(); await env.app.loadCategories(true); await open(env);
  const before = env.apiCalls.length;
  env.app.submitEditTx(form()); pending.resolve({ id: 'expense' }); await settled();
  await env.app.loadTx('2026-08'); await env.app.loadPlans(); await env.app.loadCategories(false);
  assert.equal(env.apiCalls.length, before);
  const data = deferred(); const late = env.app.loadResource('txCache:2026-09', () => data.promise, true);
  const rejected = assert.rejects(late, {code: 'stale_response'}); await settled();
  env.app.invalidateTransactions(['2026-09']); data.resolve([env.tx]); await rejected;
  const n = env.apiCalls.length;
  await env.app.loadTx('2026-09'); await env.app.loadTx('2026-10');
  assert.equal(env.apiCalls.length - n, 2);
});

test('confirmed delete rejects pre-delete server response and revalidates partner totals', async () => {
  const old = deferred(); let reads = 0;
  const env = setup(undefined, { stubReload: false, api: action => action === 'list_tx' ? (++reads === 1 ? old.promise : Promise.resolve([])) : Promise.resolve(action === 'summary' ? { expense: 0, categories: [], members: [{ id: 'me', share: 0, balance: 0 }] } : action === 'list_plans' ? {} : []) });
  env.app.cached('txCache:2026-09', [env.tx]); env.app.cached('summaryCache:2026-09', { expense: 20, categories: [] });
  const request = env.app.loadTx('2026-09', true), rejected = assert.rejects(request, {code:'stale_response'}); await settled();
  env.app.deleteTx('expense'); env.app.closeDialog(true); await settled();
  env.queueOps.pop();
  env.windowEvents.dispatch('queue-sent', { detail: { id: 'op-1', result: {} } });
  await settled(); old.resolve([env.tx]); await rejected;
  assert.equal(env.st['txCache:2026-09'].data.length, 0);
  assert.equal(env.st['summaryCache:2026-09'].data.members[0].share, 0);
});

test('rolling back one delete preserves a second pending delete and a concurrent add', async () => {
  const env = setup();
  const second = { ...env.tx, id: 'second', amount: 10 };
  env.app.cached('txCache:2026-09', [env.tx, second]);
  env.app.cached('summaryCache:2026-09', { expense: 30, categories: [{id:'food',fact:30}], members: [] });
  env.app.deleteTx('expense'); env.app.closeDialog(true); await settled();
  env.app.deleteTx('second'); env.app.closeDialog(true); await settled();
  env.app.applyLocalTx({ ...env.tx, id: 'third', amount: 5 });
  env.windowEvents.dispatch('queue-failed', { detail: { op:env.queueOps[0], error: {code:'forbidden'} } });
  const rows = env.st['txCache:2026-09'].data;
  assert.equal(rows.filter(row => row.id === 'expense').length, 1);
  assert.equal(rows.some(row => row.id === 'second'), false);
  assert.equal(rows.some(row => row.id === 'third'), true);
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 25);
});

test('refresh on a newly opened page does not reuse an obsolete page promise or repaint the old route', async () => {
  const september = deferred(), october = deferred();
  const env = setup(undefined, { stubReload:false, api: (_, payload) => payload.month === '2026-09' ? september.promise : october.promise });
  env.app.openTx(); const first = env.app.refreshCurrentPage();
  env.st.month = '2026-10'; env.app.openTx(); const second = env.app.refreshCurrentPage();
  assert.notEqual(first, second);
  october.resolve([{...env.tx, occurred_on:'2026-10-01', note:'october-only'}]); await second;
  september.resolve([{...env.tx, note:'september-hidden'}]); await first;
  assert.match(env.nodes.get('#screen').innerHTML, /october-only/);
  assert.doesNotMatch(env.nodes.get('#screen').innerHTML, /september-hidden/);
});

test('failed queued add rolls back only itself without dropping another pending add or unrelated month', async () => {
  const env = setup();
  env.app.cached('txCache:2026-08', []);
  for (const amount of ['5', '7']) {
    env.app.setAddDraftForTest({ amount, category_id:'food', note:'draft', date:'2026-09-22', is_shared:false, kind:'expense' });
    env.app.submitAdd({ querySelector: () => ({ disabled:false }) });
  }
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 32);
  env.windowEvents.dispatch('queue-failed', { detail:{op:env.queueOps[0],error:{code:'bad_amount',message:'bad amount'}} });
  assert.equal(env.st['summaryCache:2026-09'].data.expense, 27);
  assert.equal(env.st['txCache:2026-09'].data.filter(row => row._local).length, 1);
  const before = env.apiCalls.length; await env.app.loadTx('2026-08');
  assert.equal(env.apiCalls.length, before);
});

test('confirming parallel adds reconciles IDs once and preserves the remaining optimistic row', async () => {
  const env = setup(undefined, { api: action => Promise.resolve(action === 'list_tx' ? [{ ...env.tx, id:'server-first', amount:5 }] : []) });
  for (const amount of ['5', '7']) {
    env.app.setAddDraftForTest({ amount, category_id:'food', note:'draft', date:'2026-09-22', is_shared:false, kind:'expense' });
    env.app.submitAdd({ querySelector: () => ({ disabled:false }) });
  }
  env.windowEvents.dispatch('queue-sent', { detail:{id:env.queueOps[0].id,result:{id:'server-first'}} });
  assert.equal(env.st['txCache:2026-09'].data.filter(row => row.id === 'server-first').length, 1);
  assert.equal(env.st['txCache:2026-09'].data.filter(row => row._local).length, 1);
  const rows = await env.app.loadTx('2026-09');
  assert.equal(rows.filter(row => row.id === 'server-first').length, 1);
  assert.equal(rows.filter(row => row._local).length, 1);
});

test('partner summary and finance updates still paint when optional plans refresh fails', async () => {
  const member = {id:'me',household_id:'home'};
  const env = setup(undefined, {stubReload:false,api: action => {
    if (action === 'me') return Promise.resolve({member});
    if (action === 'list_plans' || action === 'list_recurring') return Promise.reject(Error('plans offline'));
    return Promise.resolve(action === 'summary' ? { expense:40,categories:[{id:'food',name:'partner-updated',fact:40}] } : []);
  }});
  env.app.adoptMember(member);
  env.app.cached('summaryCache:2026-09', {expense:20,categories:[]});
  env.app.cached('txCache:2026-09', []);
  await env.app.refreshOnReturn();
  assert.match(env.nodes.get('#screen').innerHTML, /partner-updated/);
  assert.match(env.nodes.get('#toast').textContent, /Не удалось обновить/);
});

test('search draft survives a background response before the debounce timer runs', async () => {
  const next = deferred();
  const env = setup(undefined, {stubReload:false,api:() => next.promise});
  env.app.cached('txCache:2026-09', [env.tx]); env.app.openTx(); await settled();
  env.nodes.get('#screen').dispatch('input', {target:{id:'tx-search',value:'pending text'}});
  assert.equal(env.st.txFilter.q, 'pending text');
  const refresh = env.app.refreshCurrentPage();
  next.resolve([{...env.tx,note:'pending text server'}]); await refresh;
  assert.match(env.nodes.get('#screen').innerHTML, /value="pending text"/);
});

test('fixed dock insert stays flat until contact, opens once and survives button rebound', () => {
  const env = setup(), tabs = env.nodes.get('#tabs');
  env.st.member = { id: 'me' };
  const properties = new Map(), iconProperties = new Map();
  tabs.style.setProperty = (k, v) => properties.set(k, v);
  tabs.style.removeProperty = k => properties.delete(k);
  const icon = { style: { setProperty() {}, removeProperty: k => iconProperties.delete(k),
    set transform(v) { iconProperties.set('transform', v); }, set opacity(v) { iconProperties.set('opacity', v); } } };
  const primary = Object.assign(fakeNode(), { contains: () => false });
  tabs.querySelector = s => s === '.tab--primary .tab__icon' ? icon : s === '.tabs__notch-fill' ? {} : primary;
  Object.defineProperty(tabs, 'offsetWidth', { get() { throw new Error('forced layout'); } });
  env.app.setRoute('summary'); env.app.applyRouteUi();
  const motion = env.app.getDockMotion();
  const insertPath = () => decodeURIComponent(properties.get('--dock-insert-mask') || '');
  for (const time of [0, 80, 159, 160]) {
    env.frame(time);
    assert.equal(properties.get('--dock-notch-height'), '40px');
    assert.match(insertPath(), /M0 0C16 0 12 0 48 0C84 0 80 0 96 0V40H0Z/);
    assert.match(insertPath(), /preserveAspectRatio="none"/);
  }
  assert.equal(env.app.getDockState().y, -34);
  env.frame(220);
  const pressing = Number(insertPath().match(/M0 0C16 0 12 ([\d.]+)/)[1]);
  assert.ok(pressing > 0 && pressing < 38);
  env.frame(280);
  assert.equal(properties.get('--dock-insert-mask'), 'linear-gradient(transparent,transparent)');
  assert.equal(env.app.getDockState().y, 6);
  env.frame(400);
  assert.equal(properties.get('--dock-notch-height'), '40px');
  assert.equal(properties.get('--dock-insert-mask'), 'linear-gradient(transparent,transparent)');
  assert.equal(env.app.getDockState().y, -6);
  for (const step of [8, 16, 33, 100]) {
    let previous = env.app.dockSample(motion, 0);
    for (let t = step; t <= 800; t += step) {
      const next = env.app.dockSample(motion, t);
      assert.ok(Number.isFinite(next.y) && Number.isFinite(next.velocity));
      if (t <= 160) assert.ok(next.y <= -34);
      assert.ok(Math.abs(next.y - previous.y) <= step * .8);
      previous = next;
    }
  }
  for (const t of [160, 280, 400, 500, 620, 720]) {
    const a = env.app.dockSample(motion, t - .001), b = env.app.dockSample(motion, t + .001);
    assert.ok(Math.abs(a.y - b.y) < .002);
    assert.ok(Math.abs(a.velocity - b.velocity) < .001);
  }
  env.frame(800);
  assert.equal(env.frames.size, 0);
  for (const key of ['--dock-notch-height', '--dock-insert-mask', '--dock-contact-edge']) {
    assert.equal(properties.has(key), false); // only animation properties are discarded
  }
  assert.equal(iconProperties.size, 0);
  assert.equal(env.app.getDockState().y, 0);
  assert.equal(tabs.classList.contains('tabs--motion'), false);
});

test('dock interruption preserves position and velocity, cancels old frames and cleans up', () => {
  const env = setup(), tabs = env.nodes.get('#tabs'); env.st.member = { id: 'me' };
  env.app.setRoute('summary'); env.app.applyRouteUi(); env.frame(230);
  const before = env.app.getDockState();
  env.app.setRoute('tx'); env.app.applyRouteUi();
  assert.equal(env.app.getDockState().y, before.y);
  assert.equal(env.app.getDockMotion().points[0].v, before.velocity);
  assert.equal(env.frames.size, 1);
  env.frame(270); const exiting = env.app.getDockState();
  env.app.setRoute('summary'); env.app.applyRouteUi();
  assert.equal(env.app.getDockState().y, exiting.y);
  assert.equal(env.app.getDockMotion().points[0].v, exiting.velocity);
  assert.equal(env.frames.size, 1);
  env.windowEvents.dispatch('resize', {});
  assert.equal(env.frames.size, 1);
  env.frame(1070);
  assert.equal(env.frames.size, 0);
  env.app.applyRouteUi(); assert.equal(env.frames.size, 0);
  env.app.setRoute('tx'); env.app.applyRouteUi();
  env.windowEvents.dispatch('pagehide', {});
  assert.equal(env.frames.size, 0);
  assert.equal(tabs.classList.contains('tabs--motion'), false);
  env.app.setRoute('summary'); env.app.applyRouteUi();
  tabs.isConnected = false; env.frame(1100);
  assert.equal(env.frames.size, 0);
  tabs.isConnected = true;
  env.app.setRoute('tx'); env.app.applyRouteUi();
  env.context.document.visibilityState = 'hidden';
  env.context.document.dispatch('visibilitychange', {});
  assert.equal(env.frames.size, 0);
});

test('reduced motion uses final dock geometry immediately and cancels active motion on change', () => {
  let change;
  const media = { matches: true, addEventListener(name, fn) { change = fn; } };
  const env = setup(undefined, { motionMedia: media }); env.st.member = { id: 'me' };
  env.app.setRoute('summary'); env.app.applyRouteUi();
  assert.equal(env.frames.size, 0); assert.equal(env.app.getDockState().y, 0);
  media.matches = false;
  env.app.setRoute('tx'); env.app.applyRouteUi(); env.frame(300);
  env.app.setRoute('summary'); env.app.applyRouteUi(); env.frame(460);
  assert.equal(env.frames.size, 1);
  media.matches = true; change();
  assert.equal(env.frames.size, 0); assert.equal(env.app.getDockState().y, 0);
});
