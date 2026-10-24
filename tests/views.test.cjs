const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup() {
  const context = { window: {} };
  context.window.localStorage = { getItem: () => null };
  context.window.I18n = { t: (s, args) => s.replace(/\{(\w+)\}/g, (_, k) => args?.[k] ?? k), locale: () => 'ru', plural: (_, n) => String(n), locales: [{ code: 'ru', name: 'Русский' }] };
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
test('home income and expense cards open the matching add form', () => {
  const ctx = setup();
  const html = home(ctx);
  assert.match(html, /<button type="button" class="hero__item" data-action="go-add-kind" data-kind="income">/);
  assert.match(html, /<button type="button" class="hero__item" data-action="go-add-kind" data-kind="expense">/);
});
test('home has a square receipt scanner next to the category view toggle', () => {
  const ctx = setup();
  const html = home(ctx);
  assert.match(html, /class="categories-title">Категории<\/h2>/);
  assert.match(html, /class="categories-actions"/);
  assert.match(html, /class="home-scan-btn" data-action="scan-receipt-home"/);
  assert.match(html, /Сканировать чек/);
  assert.doesNotMatch(html, /class="scan-btn scan-btn--primary home-scan"/);
  const head = html.slice(html.indexOf('categories-section__head'), html.indexOf('home-category-sort'));
  assert.match(head, /home-scan-btn/);
  assert.match(head, /categories-view-toggle/);
  const quick = ctx.Views.renderQuickActions(0);
  assert.match(quick, /data-quick="receipt-photo"/);
  assert.match(quick, /Фото чека/);
  const pages = quick.split('<div class="quick-actions__page"').slice(1);
  assert.deepEqual(pages.map(page => (page.match(/data-quick=/g) || []).length), [6, 6, 1]);
  assert.match(quick, /data-page="2"/);
  assert.match(quick, /data-quick="settings"/);
});
test('solo expense form hides the shared-expense toggle', () => {
  const ctx = setup();
  ctx.State.get().member = { households: { mode: 'solo' } };
  const solo = ctx.Views.renderForm({ kind: 'expense', is_shared: true });
  assert.doesNotMatch(solo, /name="is_shared"/);
  assert.doesNotMatch(solo, /Общий расход/);
  ctx.State.get().member = { households: { mode: 'pair' } };
  const pair = ctx.Views.renderForm({ kind: 'expense', is_shared: true });
  assert.match(pair, /name="is_shared"/);
  assert.match(pair, /Общий расход/);
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
test('finance filters by operation kind and highlights the matching overview card', () => {
  const ctx = setup();
  const rows = [
    tx('income', '2025-01-02', '', { category_id: 'salary', categories: { name: 'Salary', kind: 'income' }, amount: 100 }),
    tx('expense', '2025-01-01', '', { amount: 20 }),
  ];
  const html = ctx.Views.renderTxList(rows, { kind: 'income' });
  assert.match(html, /data-tx-id="income"/);
  assert.doesNotMatch(html, /data-tx-id="expense"/);
  assert.doesNotMatch(html, /finance-heading|<h1>Финансы/);
  assert.match(html, /Доходы · Найдено: 1/);
  assert.match(html, /<button type="button" data-action="tx-kind" data-kind="income" aria-pressed="true" class="finance-stat finance-stat--income finance-stat--active">/);
  assert.match(html, /<button type="button" data-action="tx-kind" data-kind="expense" aria-pressed="false" class="finance-stat finance-stat--expense">/);
  const expenses = ctx.Views.txResults(rows, { kind: 'expense' });
  assert.match(expenses, /data-tx-id="expense"/);
  assert.doesNotMatch(expenses, /data-tx-id="income"/);
  assert.match(expenses, /Расходы · Найдено: 1/);
});
test('finance chart switches income, expense and balance independently of the list filter', () => {
  const ctx = setup();
  const rows = [
    tx('salary', '2025-01-05', '', { category_id: 'salary', categories: { name: 'Salary', kind: 'income' }, amount: 100 }),
    tx('gift', '2025-01-04', '', { category_id: 'gift', categories: { name: 'Gift', kind: 'income' }, amount: 50 }),
    tx('food', '2025-01-03', '', { category_id: 'food', categories: { name: 'Food', kind: 'expense' }, amount: 20 }),
    tx('taxi', '2025-01-02', '', { category_id: 'taxi', categories: { name: 'Taxi', kind: 'expense' }, amount: 10 }),
  ];
  const income = ctx.Views.renderTxList(rows, { kind: null }, 'income');
  assert.match(income, /data-kind="income" aria-pressed="true"/);
  assert.match(income, /Доходы за месяц/);
  assert.match(income, /\+150/);
  assert.match(income, /Salary/);
  assert.match(income, /Gift/);
  assert.match(income, /Salary<\/span><small>67%<\/small>/);
  assert.match(income, /Gift<\/span><small>33%<\/small>/);
  assert.equal((income.match(/finance-ring__segment/g) || []).length, 2);
  assert.match(income, /stroke="#54ef9c"/);
  assert.match(income, /stroke="#6cb8ff"/);
  assert.doesNotMatch(income, /#7fe3c1/);
  assert.match(income, /--circ:439\.82/);
  assert.match(income, /--segment-delay:0ms/);
  assert.match(income, /--segment-delay:80ms/);

  const balance = ctx.Views.renderTxList(rows, { kind: null }, 'balance');
  assert.match(balance, /data-kind="balance" aria-pressed="true"/);
  assert.match(balance, /data-tx-id="salary"/);
  assert.match(balance, /data-tx-id="food"/);
  assert.match(balance, /Доходы<\/span><small>83%<\/small>/);
  assert.match(balance, /Расходы<\/span><small>17%<\/small>/);
  assert.match(balance, /Остаток/);

  const expense = ctx.Views.renderTxList(rows, { kind: null }, 'expense');
  assert.match(expense, /data-kind="expense" aria-pressed="true"/);
  assert.match(expense, /Траты за месяц/);
  assert.match(expense, /Food/);
  assert.match(expense, /Taxi/);
  assert.match(expense, /Food<\/span><small>67%<\/small>/);

  const empty = ctx.Views.renderTxList([], {}, 'balance');
  assert.match(empty, /Пока нет данных/);
  assert.doesNotMatch(empty, /NaN/);
  assert.doesNotMatch(empty, /finance-ring__segment/);
});
test('plans keeps its compact add action but drops the page title', () => {
  const ctx = setup();
  const html = ctx.Views.renderPlans({ goals: [], debts: [], wishes: [], recurring: [] }, 'goals');
  assert.doesNotMatch(html, /<h1>Планы<\/h1>/);
  assert.match(html, /class="plans-heading"><p>/);
  assert.match(html, /Двигайтесь к тому, что важно/);
  assert.match(html, /class="plans-create"/);
});

test('home shows the latest confirmed expenses first and keeps edit/delete', () => {
  const ctx = setup();
  const rows = [tx('older', '2025-01-01', ''), tx('newer', '2025-01-03', '')];
  const html = ctx.Views.categoryTxList(rows, true, 'food');
  assert.ok(html.indexOf('data-id="newer"') < html.indexOf('data-id="older"'));
  assert.doesNotMatch(html, /tx-group/);
  assert.match(html, /data-action="edit-tx" data-id="older"/);
  assert.match(html, /data-tx-delete="older"/);
  const income = ctx.Views.categoryTxList([tx('i', '2025-01-01', '', { categories: { kind: 'income' } })], true, 'salary');
  assert.doesNotMatch(income, /edit-tx|data-tx-delete/);
  const local = ctx.Views.categoryTxList([tx('local', '2025-01-01', '', { _local: true })], true, 'food');
  assert.doesNotMatch(local, /edit-tx|data-tx-delete/);
});

test('home category shows five latest expenses and view all only when there are more', () => {
  const ctx = setup();
  const rows = Array.from({ length: 7 }, (_, i) => tx('id' + i, '2025-01-0' + (i + 1), '2025-01-0' + (i + 1) + 'T10:00:00Z'));
  const html = ctx.Views.categoryTxList(rows, true, 'food');
  assert.equal((html.match(/class="cat-tx__row"/g) || []).length, 5);
  assert.match(html, /data-action="open-cat-tx" data-id="food"/);
  assert.match(html, /Посмотреть все/);
  assert.ok(html.indexOf('note-id6') < html.indexOf('note-id5'));
  assert.ok(html.indexOf('note-id5') < html.indexOf('note-id4'));
  assert.doesNotMatch(ctx.Views.categoryTxList(rows.slice(0, 5), true, 'food'), /Посмотреть все/);
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

test('add form shows photo QR scanning and a removable receipt chip', () => {
  const ctx = setup();
  ctx.State.get().categories = [{ id: 'food', name: 'Food', kind: 'expense' }];
  const html = ctx.Views.renderForm({ kind: 'expense', is_shared: true });
  assert.match(html, /data-action="pick-receipt-photo"/);
  assert.match(html, /Распознать QR с фото/);
  const withReceipt = ctx.Views.renderForm({
    kind: 'expense', is_shared: true,
    receipt: { date: '2026-10-22', sum: 12.5 },
  });
  assert.match(withReceipt, /receipt-chip/);
  assert.match(withReceipt, /22\.10\.2026/);
  assert.match(withReceipt, /data-action="clear-receipt"/);
  assert.doesNotMatch(withReceipt, /data-action="pick-receipt-photo"/);
});

test('profile shows the home screen shortcut only when Telegram reports support', () => {
  const ctx = setup();
  assert.doesNotMatch(ctx.Views.renderSettings(), /data-action="add-home-screen"/);

  ctx.State.get().homeScreenStatus = 'unsupported';
  assert.doesNotMatch(ctx.Views.renderSettings(), /data-action="add-home-screen"/);

  ctx.State.get().homeScreenStatus = 'missed';
  const missed = ctx.Views.renderSettings();
  assert.match(missed, /data-action="add-home-screen"/);
  assert.match(missed, /Добавить на главный экран/);
  assert.match(missed, /Открывайте бюджет в один тап/);
  assert.doesNotMatch(missed, /aria-disabled="true"/);

  ctx.State.get().homeScreenStatus = 'unknown';
  assert.match(ctx.Views.renderSettings(), /data-action="add-home-screen"/);

  ctx.window.Tg = { platform: () => 'android' };
  assert.match(ctx.Views.renderSettings(), /Подтвердите в системном окне Android/);
  ctx.window.Tg = { platform: () => 'ios' };
  assert.match(ctx.Views.renderSettings(), /Открывайте бюджет в один тап/);

  ctx.State.get().homeScreenStatus = 'added';
  const added = ctx.Views.renderSettings();
  assert.match(added, /Приложение на главном экране/);
  assert.match(added, /Ярлык уже добавлен/);
  assert.match(added, /aria-disabled="true"/);
});

test('family settings switches the split from the current month and hides it in solo mode', () => {
  const ctx = setup();
  ctx.State.get().member = {
    id: 'm1', name: 'Аня',
    households: { id: 'h1', name: 'Наша семья', mode: 'pair', split_mode: 'proportional', month_split_mode: 'proportional', invite_code: 'demo1234' },
  };

  const proportional = ctx.Views.renderSettings('family');
  assert.match(proportional, /data-action="split-mode" data-mode="proportional"/);
  assert.match(proportional, /data-action="split-mode" data-mode="equal"/);
  assert.match(proportional, /data-action="split-mode" data-mode="none"/);
  assert.match(proportional, /class="segment segment--active" data-action="split-mode" data-mode="proportional"/);
  assert.match(proportional, /Действует с текущего месяца и на будущие\. Прошлые месяцы не меняются\./);
  assert.match(proportional, /Деление общих трат/);

  ctx.State.get().member.households.month_split_mode = 'equal';
  const equal = ctx.Views.renderSettings('family');
  assert.match(equal, /class="segment segment--active" data-action="split-mode" data-mode="equal"/);

  ctx.State.get().member.households.month_split_mode = 'none';
  const none = ctx.Views.renderSettings('family');
  assert.match(none, /class="segment segment--active" data-action="split-mode" data-mode="none"/);
  assert.match(none, /settings-row__value">Не делить</);

  ctx.State.get().member.households.mode = 'solo';
  assert.doesNotMatch(ctx.Views.renderSettings('family'), /data-action="split-mode"/);
});

test('family settings exposes editable member and household names', () => {
  const ctx = setup();
  ctx.State.get().member = {
    id: 'm1', name: 'Аня',
    households: { id: 'h1', name: 'Наша семья', mode: 'pair', split_mode: 'proportional', month_split_mode: 'proportional' },
  };
  const html = ctx.Views.renderSettings('family');
  assert.match(html, /data-form="profile"/);
  assert.match(html, /name="member_name"[^>]*value="Аня"/);
  assert.match(html, /name="household_name"[^>]*value="Наша семья"/);
  assert.match(html, /Имена/);
});

test('summary split label follows the month payload, not the household default', () => {
  const ctx = setup();
  const members = [{ id: 'm1', name: 'Аня', paid_shared: 100, share: 50, balance: 50 }];
  const equal = ctx.Views.renderSummary({ income: 0, expense: 0, balance: 0, split_mode: 'equal', categories: [], members }, null, null, [], 'list');
  assert.match(equal, /Как делим: Поровну/);
  const proportional = ctx.Views.renderSummary({ income: 0, expense: 0, balance: 0, split_mode: 'proportional', categories: [], members }, null, null, [], 'list');
  assert.match(proportional, /Как делим: Пропорционально доходу/);
});

test('none split hides the partner settlement entirely', () => {
  const ctx = setup();
  const members = [{ id: 'm1', name: 'Аня', paid_shared: 100, share: 0, balance: 0 }];
  const html = ctx.Views.renderSummary({ income: 200, expense: 100, balance: 100, split_mode: 'none', categories: [], members }, null, null, [], 'list');
  assert.doesNotMatch(html, /Между партнёрами/);
  assert.doesNotMatch(html, /class="partner"/);
  assert.doesNotMatch(html, /Как делим:/);
  assert.match(html, /Остаток за месяц/);
});

test('home edit mode shows every block with keyboard reorder controls and inert content', () => {
  const ctx = setup();
  const normal = home(ctx);
  assert.match(normal, /data-action="home-edit"/);
  assert.doesNotMatch(normal, /data-action="home-edit-save"/);
  assert.doesNotMatch(normal, /data-home-block=/);

  ctx.State.get().homeEdit = true;
  ctx.State.get().homeDraft = ['categories', 'balance', 'partners', 'forecast', 'plans'];
  const html = home(ctx);
  const ids = [...html.matchAll(/data-home-block="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['categories', 'balance', 'partners', 'forecast', 'plans']);
  assert.match(html, /data-action="home-edit-save"/);
  assert.match(html, /data-action="home-edit-cancel"/);
  assert.match(html, /data-action="home-edit-reset"/);
  assert.match(html, /data-action="home-move" data-home-edit data-id="categories" data-dir="up"[^>]*disabled/);
  assert.match(html, /data-action="home-move" data-home-edit data-id="plans" data-dir="down"[^>]*disabled/);
  assert.match(html, /class="home-block__content" inert/);
  assert.match(html, /Переместить «Категории» выше/);
  assert.match(html, /Между партнёрами/);
  assert.match(html, /Нет данных для этого блока/);
});

test('custom cover fills the hero and appearance offers upload, crop and reset', () => {
  const ctx = setup();
  const custom = { id: 'custom', name: 'Своё фото', file: 'blob:local-cover', tone: 'dark', custom: true };
  ctx.window.Covers = {
    list: [{ id: 'default', name: 'Стандартная' }, { id: 'blue', name: 'Синий', file: 'covers/blue.webp', tone: 'dark' }],
    id: () => 'custom',
    current: () => custom,
    custom: () => custom,
    set: () => true,
    clearCustom: () => Promise.resolve(),
  };
  const html = home(ctx);
  assert.match(html, /class="hero hero--cover hero--custom"/);
  assert.match(html, /background-image:url\('blob:local-cover'\)/);

  const appearance = ctx.Views.renderSettings('appearance');
  assert.match(appearance, /data-action="pick-cover-file"/);
  assert.match(appearance, /data-cover-file/);
  assert.match(appearance, /data-cover="custom"/);
  assert.match(appearance, /Убрать своё фото/);
  assert.match(appearance, /Своё фото хранится только на этом устройстве/);

  const editor = ctx.Views.renderCoverEditor();
  assert.match(editor, /data-cover-preview/);
  assert.match(editor, /data-cover-zoom/);
  assert.match(editor, /data-cover-x/);
  assert.match(editor, /data-cover-y/);
  assert.match(editor, /data-action="apply-cover"/);
  assert.match(editor, /data-sheet-close/);
});

test('home sorting is a labelled dropdown with the selected mode', () => {
  const ctx = setup();
  let html = home(ctx);
  assert.match(html, /home-category-sort__label">Сортировка</);
  assert.match(html, /<select[^>]*data-home-category-sort[^>]*aria-label="Сортировка категорий"/);
  assert.match(html, /<option value="default" selected>По умолчанию<\/option>/);
  assert.doesNotMatch(html, /data-action="home-category-sort"/);

  ctx.State.get().homeCategorySort = 'amount';
  html = home(ctx);
  assert.match(html, /<option value="amount" selected>По сумме<\/option>/);
});

test('appearance offers system, light and dark theme choices', () => {
  const ctx = setup();
  let html = ctx.Views.renderSettings('appearance');
  assert.match(html, /data-theme-pref/);
  assert.match(html, /<option value="system" selected>Система<\/option>/);
  assert.match(html, /<option value="light">Светлая<\/option>/);
  assert.match(html, /<option value="dark">Тёмная<\/option>/);

  ctx.State.setThemeMode('dark');
  html = ctx.Views.renderSettings('appearance');
  assert.match(html, /<option value="dark" selected>Тёмная<\/option>/);
});
