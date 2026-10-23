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
  const attrs = {};
  const props = {};
  const element = {
    style: {
      setProperty(name, value) { props[name] = value; },
      removeProperty(name) { delete props[name]; },
    },
    classList: { add() {} },
    setAttribute(name, value) { attrs[name] = value; },
  };
  return {
    documentElement: element,
    body: { classList: { add() {} } },
    attrs,
    props,
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

test('home screen shortcut is limited to mobile Telegram platforms', () => {
  const sdk = {
    platform: 'tdesktop',
    isVersionAtLeast: () => true,
    addToHomeScreen() {},
    checkHomeScreenStatus() {},
  };
  assert.equal(setup(sdk).window.Tg.canAddToHomeScreen(), false);

  sdk.platform = 'web';
  assert.equal(setup(sdk).window.Tg.canAddToHomeScreen(), false);

  sdk.platform = 'android';
  const android = setup(sdk).window.Tg;
  assert.equal(android.platform(), 'android');
  assert.equal(android.canAddToHomeScreen(), true);

  sdk.platform = 'ios';
  assert.equal(setup(sdk).window.Tg.canAddToHomeScreen(), true);
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

test('manual theme overrides Telegram and system restores its palette', async () => {
  const document = fakeDocument();
  const chrome = [];
  const sdk = {
    themeParams: { bg_color: '#111116', text_color: '#f4f1f7' },
    colorScheme: 'dark',
    ready() {},
    expand() {},
    disableVerticalSwipes() {},
    setHeaderColor(color) { chrome.push(['header', color]); },
    setBackgroundColor(color) { chrome.push(['background', color]); },
    onEvent() {},
  };
  const context = setup(sdk, { document });
  const Tg = context.window.Tg;
  await Tg.init();

  assert.equal(document.attrs['data-theme'], 'dark');
  assert.equal(document.attrs['data-theme-mode'], 'system');
  assert.equal(document.props['--tg-bg'], '#111116');

  Tg.setThemeMode('light');
  assert.equal(Tg.themeMode(), 'light');
  assert.equal(document.attrs['data-theme'], 'light');
  assert.equal(document.attrs['data-theme-mode'], 'light');
  assert.equal(document.props['--tg-bg'], undefined);
  assert.deepEqual(chrome.slice(-2), [['header', '#f7f5fb'], ['background', '#f7f5fb']]);

  Tg.setThemeMode('dark');
  assert.equal(document.attrs['data-theme'], 'dark');
  assert.equal(document.attrs['data-theme-mode'], 'dark');
  assert.deepEqual(chrome.slice(-2), [['header', '#111116'], ['background', '#111116']]);

  Tg.setThemeMode('unknown');
  assert.equal(Tg.themeMode(), 'system');
  assert.equal(document.attrs['data-theme'], 'dark');
  assert.equal(document.props['--tg-bg'], '#111116');
  assert.deepEqual(chrome.slice(-2), [['header', 'secondary_bg_color'], ['background', 'secondary_bg_color']]);
});
