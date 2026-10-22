const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../src/telegram.js'), 'utf8');

function setup(webApp, extra = {}) {
  const context = {
    window: { Telegram: { WebApp: webApp }, console, ...extra },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  if (extra.document) context.document = extra.document;
  runInNewContext(source, context);
  return context;
}

function fakeDocument() {
  const element = {
    style: { setProperty() {} },
    classList: { add() {} },
    setAttribute() {},
  };
  return {
    documentElement: element,
    body: { classList: { add() {} } },
  };
}

test('home screen shortcut reports supported status and calls the native prompt', () => {
  const calls = [];
  const sdk = {
    isVersionAtLeast: version => version === '8.0',
    addToHomeScreen: () => calls.push('add'),
    checkHomeScreenStatus: callback => { calls.push('check'); callback('missed'); },
  };
  const context = setup(sdk);
  const Tg = context.window.Tg;

  assert.equal(Tg.canAddToHomeScreen(), true);
  let status = null;
  assert.equal(Tg.checkHomeScreenStatus(value => { status = value; }), true);
  assert.equal(status, 'missed');
  assert.equal(Tg.addToHomeScreen(), true);
  assert.deepEqual(calls, ['check', 'add']);
});

test('home screen shortcut reports unsupported for old clients and missing methods', () => {
  const old = setup({
    isVersionAtLeast: () => false,
    addToHomeScreen() {},
    checkHomeScreenStatus() {},
  });
  let status = null;
  assert.equal(old.window.Tg.canAddToHomeScreen(), false);
  assert.equal(old.window.Tg.checkHomeScreenStatus(value => { status = value; }), false);
  assert.equal(status, 'unsupported');
  assert.equal(old.window.Tg.addToHomeScreen(), false);

  const missing = setup({ isVersionAtLeast: () => true });
  assert.equal(missing.window.Tg.canAddToHomeScreen(), false);
});

test('homeScreenAdded event reaches registered app handlers', async () => {
  const handlers = {};
  const sdk = {
    isVersionAtLeast: () => true,
    addToHomeScreen() {},
    checkHomeScreenStatus() {},
    ready() {},
    expand() {},
    disableVerticalSwipes() {},
    setHeaderColor() {},
    setBackgroundColor() {},
    onEvent(name, fn) { handlers[name] = fn; },
  };
  const context = setup(sdk, { document: fakeDocument() });
  await context.window.Tg.init();

  let added = 0;
  context.window.Tg.onHomeScreenAdded(() => { added += 1; });
  handlers.homeScreenAdded();
  assert.equal(added, 1);
});
