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
  const windowEvents = fakeNode();
  const context = { document, console, performance, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => fn() };
  if (options.clock) context.Date = class extends Date { static now() { return options.clock.now; } };
  context.window = {
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener: windowEvents.addEventListener, removeEventListener: windowEvents.removeEventListener,
    Tg: { backButton: fn => { context.backHandler = fn; }, haptic() {} },
    I18n: { t: s => s, locale: () => 'ru', plural: (_, n) => String(n) },
    Api: {
      updateTx: payload => { calls.push(payload); return updateTx(payload); },
      call(action, payload) {
        apiCalls.push({ action, payload });
        if (options.api) return options.api(action, payload);
        return Promise.resolve(action === 'me' ? { member: context.State.get().member } : action === 'list_plans' ? {} : []);
      },
    },
    Queue: { size: () => queueOps.length, push(action, payload) { const op = { id: 'op-' + (queueOps.length + 1), action, payload }; queueOps.push(op); return op; } },
  };
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
    openEditTx: openEditTx, submitEditTx: submitEditTx, cancelEditTx: cancelEditTx,
    closeSheet: closeSheet, beginSheetDrag: beginSheetDrag, syncBackButton: syncBackButton,
    getEditing: function () { return editingTx; }, getSaving: function () { return editSaving; },
    getDrag: function () { return sheetDrag; },
    openSummary: openSummary, openTx: openTx, openTxKind: openTxKind, setTxKind: setTxKind, loadResource: loadResource,
    fetchSummary: fetchSummary, loadTx: loadTx, adoptMember: adoptMember,
    refreshOnReturn: refreshOnReturn, clearCache: clearCache, cached: cached,
    applyLocalTx: applyLocalTx,
    loadMember: loadMember, deleteAccount: deleteAccount, closeDialog: closeDialog,
    openPlans: openPlans, openTab: openTab, refreshTxResults: refreshTxResults,
    submitAdd: submitAdd, deleteTx: deleteTx, removeLocalTx: removeLocalTx,
    mutate: mutate, loadPlans: loadPlans, submitCategory: submitCategory, submitRecurring: submitRecurring,
    fillExpandedCat: fillExpandedCat,
    setExpandedForTest: function (value) { expandedCat = value; },
    getExpanded: function () { return expandedCat; },
    setAddDraftForTest: function (draft) { form = draft; },
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
  return { context, app: context.window.TestApp, st, tx, sheet, panel, nodes, calls, apiCalls, windowEvents, queueOps,
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
  assert.match(html, /value="food" selected/);
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
  assert.equal(env.st['txCache:2026-09'], undefined);
  assert.equal(env.st['summaryCache:2026-09'], undefined);
  assert.equal(env.st['txCache:2026-10'], undefined);
  assert.equal(env.st['summaryCache:2026-10'], undefined);
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
  assert.equal(env.st['txCache:2026-09'], undefined);
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
  assert.equal((await env.app.loadTx('2026-09', true)).length, 0);
  env.windowEvents.dispatch('queue-sent', { detail: { id: env.queueOps[0].id, result: {} } });
  assert.equal(env.context.window.AppState.isDeleting('expense'), false);
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
  env.app.setTxKind('expense');
  assert.equal(env.st.txFilter.kind, 'expense');
  assert.match(env.nodes.get('#screen').innerHTML, /finance-stat--expense finance-stat--active/);
  env.app.setTxKind('');
  assert.equal(env.st.txFilter.kind, null);
  env.app.openTab('tx');
  await settled();
  assert.equal(env.st.txFilter.kind, null);
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
