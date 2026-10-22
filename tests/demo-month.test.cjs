const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function environment(search = '') {
  const window = {
    location: { search },
    localStorage: { getItem: () => null },
    Tg: { isInsideTelegram: () => false, initData: () => '' },
  };
  const context = { window, URLSearchParams, Intl, console, setTimeout: fn => fn() };
  for (const file of ['format.js', 'demo.js']) {
    runInNewContext(readFileSync(require.resolve('../src/' + file), 'utf8'), context);
    Object.assign(context, window);
  }
  return window;
}

const byName = (items, name) => items.find(item => item.name === name);

test('30-day demo family month keeps totals and split in sync', async () => {
  const env = environment();
  const result = await env.DEMO_API.call('run_test_month', { viewer: 'anya' });

  assert.equal(result.month, '2026-10');
  assert.equal(result.days.length, 30);

  const s = result.final.summary;
  assert.equal(s.income, 225000);
  assert.equal(s.expense, 77939.5);
  assert.equal(s.balance, 147060.5);

  const anya = byName(s.members, 'Аня');
  const igor = byName(s.members, 'Игорь');
  assert.ok(anya && igor);
  assert.equal(anya.income, 120000);
  assert.equal(igor.income, 105000);
  assert.equal(anya.paid_shared, 57170.5);
  assert.equal(igor.paid_shared, 10479);
  assert.equal(anya.personal, 4890);
  assert.equal(igor.personal, 5400);
  assert.equal(anya.share, 36079.73);
  assert.equal(igor.share, 31569.77);
  assert.equal(anya.balance, 21091);
  assert.equal(igor.balance, -21091);
  assert.equal(anya.balance + igor.balance, 0);

  const facts = Object.fromEntries(s.categories.map(c => [c.name, c.fact]));
  assert.equal(facts['Продукты'], 20130.5);
  assert.equal(facts['Жильё и коммуналка'], 35000);
  assert.equal(facts['Транспорт'], 1320);
  assert.equal(facts['Кафе и рестораны'], 4540);
  assert.equal(facts['Здоровье'], 2050);
  assert.equal(facts['Одежда'], 4400);
  assert.equal(facts['Развлечения'], 3600);
  assert.equal(facts['Подписки и связь'], 1599);
  assert.equal(facts['Подарки'], 3500);
  assert.equal(facts['Дом и быт'], 1800);
  assert.equal(facts['Путешествия'], 0);
  assert.equal(facts['Прочее'], 0);

  assert.equal(result.final.goals[0].saved, 10000);
  assert.equal(result.final.debts[0].remaining, 55000);
  assert.equal(result.final.wishes[0].purchased, true);

  const tx = await env.DEMO_API.call('list_tx', { month: '2026-10' });
  assert.equal(tx.length, 32);
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-09' })).expense, 0);
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-11' })).expense, 0);
});

test('demo account switch keeps one family and attributes new records to the second member', async () => {
  const env = environment();
  await env.DEMO_API.call('run_test_month');
  const before = await env.DEMO_API.call('summary', { month: '2026-10' });

  const switched = await env.DEMO_API.call('switch_account', { member_id: 'm2' });
  assert.equal(switched.member.name, 'Игорь');
  const me = await env.DEMO_API.call('me');
  assert.equal(me.member.name, 'Игорь');
  assert.equal(me.member.households.name, 'Тестовая семья');
  assert.deepEqual(await env.DEMO_API.call('summary', { month: '2026-10' }), before);

  const category = env.DEMO_API.state().categories.find(c => c.name === 'Продукты');
  const tx = await env.DEMO_API.call('add_tx', {
    category_id: category.id, amount: 100, is_shared: true, occurred_on: '2026-10-30',
  });
  assert.equal(tx.member_id, 'm2');
  const after = await env.DEMO_API.call('summary', { month: '2026-10' });
  assert.equal(after.expense, before.expense + 100);
  assert.equal(
    byName(after.members, 'Игорь').paid_shared,
    before.members.find(m => m.id === 'm2').paid_shared + 100,
  );
});

test('test-month query loads the final month as the selected account', async () => {
  const env = environment('?test-month&as=igor');
  const me = await env.DEMO_API.call('me');
  assert.equal(me.member.name, 'Игорь');
  const s = await env.DEMO_API.call('summary', { month: '2026-10' });
  assert.equal(s.income, 225000);
  assert.equal(s.expense, 77939.5);
  assert.equal(s.members.find(m => m.id === 'm1').balance, 21091);
  assert.equal(s.members.find(m => m.id === 'm2').balance, -21091);
});

test('equal split applies from the selected month onward and keeps past months', async () => {
  const env = environment();
  await env.DEMO_API.call('run_test_month', { viewer: 'anya' });

  const before = await env.DEMO_API.call('summary', { month: '2026-10' });
  assert.equal(before.split_mode, 'proportional');
  assert.equal(byName(before.members, 'Аня').share, 36079.73);

  const saved = await env.DEMO_API.call('set_split_mode', { month: '2026-10', mode: 'equal' });
  assert.equal(saved.split_mode, 'equal');
  assert.equal(saved.month, '2026-10');

  const after = await env.DEMO_API.call('summary', { month: '2026-10' });
  const anya = byName(after.members, 'Аня');
  const igor = byName(after.members, 'Игорь');
  assert.equal(after.split_mode, 'equal');
  assert.equal(anya.share, 33824.75);
  assert.equal(igor.share, 33824.75);
  assert.equal(anya.balance, 23346);
  assert.equal(igor.balance, -23346);
  assert.equal(anya.balance + igor.balance, 0);

  // Выбор действует с октября: сентябрь сохраняет прежний расчёт, ноябрь наследует новый.
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-09' })).split_mode, 'proportional');
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-11' })).split_mode, 'equal');

  // me показывает режим текущего месяца.
  const current = env.Fmt.currentMonth();
  await env.DEMO_API.call('set_split_mode', { month: current, mode: 'equal' });
  assert.equal((await env.DEMO_API.call('me')).member.households.month_split_mode, 'equal');

  // Более позднее изменение не переписывает прошлые месяцы.
  await env.DEMO_API.call('set_split_mode', { month: '2026-11', mode: 'none' });
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-10' })).split_mode, 'equal');
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-11' })).split_mode, 'none');
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-12' })).split_mode, 'none');

  // Возврат к пропорциональному расчёту с октября; ноябрьское изменение остаётся в силе.
  await env.DEMO_API.call('set_split_mode', { month: '2026-10', mode: 'proportional' });
  const restored = await env.DEMO_API.call('summary', { month: '2026-10' });
  assert.equal(restored.split_mode, 'proportional');
  assert.equal(byName(restored.members, 'Аня').balance, 21091);
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-11' })).split_mode, 'none');

  await assert.rejects(
    env.DEMO_API.call('set_split_mode', { month: '2026-10', mode: 'manual' }),
    err => err.code === 'bad_split_mode',
  );
  await assert.rejects(
    env.DEMO_API.call('set_split_mode', { month: 'nope', mode: 'equal' }),
    err => err.code === 'bad_month',
  );
});

test('none split disables the partner settlement but keeps shared totals', async () => {
  const env = environment();
  await env.DEMO_API.call('run_test_month', { viewer: 'anya' });

  const before = await env.DEMO_API.call('summary', { month: '2026-10' });
  await env.DEMO_API.call('set_split_mode', { month: '2026-10', mode: 'none' });
  const after = await env.DEMO_API.call('summary', { month: '2026-10' });

  assert.equal(after.split_mode, 'none');
  assert.equal(after.income, before.income);
  assert.equal(after.expense, before.expense);
  assert.equal(after.balance, before.balance);
  assert.deepEqual(after.categories, before.categories);

  const anya = byName(after.members, 'Аня');
  const igor = byName(after.members, 'Игорь');
  assert.equal(anya.paid_shared, 57170.5);
  assert.equal(igor.paid_shared, 10479);
  assert.equal(anya.share, 0);
  assert.equal(igor.share, 0);
  assert.equal(anya.balance, 0);
  assert.equal(igor.balance, 0);

  assert.equal((await env.DEMO_API.call('summary', { month: '2026-09' })).split_mode, 'proportional');
  assert.equal((await env.DEMO_API.call('summary', { month: '2026-11' })).split_mode, 'none');

  const current = env.Fmt.currentMonth();
  await env.DEMO_API.call('set_split_mode', { month: current, mode: 'none' });
  assert.equal((await env.DEMO_API.call('me')).member.households.month_split_mode, 'none');
});
