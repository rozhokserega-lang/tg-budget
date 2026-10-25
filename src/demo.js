/**
 * Демо-данные для запуска вне Telegram (браузер, вёрстка без бэкенда).
 * Повторяет контракт Edge Function `api` в памяти — состояние живёт до перезагрузки.
 * Внутри Telegram не используется.
 */

(function (root) {
  var seq = 100;
  var id = function () { return 'demo-' + ++seq; };
  var iso = function (d) { return Fmt.isoDate(d); };
  var timezone = function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  };
  var daysAgo = function (n) { return iso(new Date(Date.now() - n * 86400000)); };

  // ?onboarding — демо начинается без семьи, чтобы проверить создание и вступление.
  var state = fresh();
  var query = new URLSearchParams(root.location.search);
  if (query.has('onboarding')) state.member = null;
  if (query.has('expired') && state.member) {
    state.member.households = Object.assign({}, state.member.households,
      { plan_until: new Date(Date.now() - 86400000).toISOString() });
  }

  function fresh() {
    var categories = [
      cat('Продукты', 'expense', 30000, '🛒', 1),
      cat('Жильё и коммуналка', 'expense', 35000, '🏠', 2),
      cat('Транспорт', 'expense', 8000, '🚌', 3),
      cat('Кафе и рестораны', 'expense', 10000, '☕', 4),
      cat('Здоровье', 'expense', 5000, '💊', 5),
      cat('Одежда', 'expense', 6000, '👕', 6),
      cat('Развлечения', 'expense', 8000, '🎬', 7),
      cat('Подписки и связь', 'expense', 3000, '📱', 8),
      cat('Подарки', 'expense', 4000, '🎁', 9),
      cat('Дом и быт', 'expense', 5000, '🧺', 10),
      cat('Путешествия', 'expense', 10000, '✈️', 11),
      cat('Прочее', 'expense', 5000, '📦', 12),
      cat('Зарплата', 'income', 0, '💼', 20),
      cat('Подработка', 'income', 0, '🧩', 21),
      cat('Премия', 'income', 0, '🏆', 22),
      cat('Прочие доходы', 'income', 0, '➕', 23),
    ];
    var members = [
      { id: 'm1', name: 'Аня', telegram_id: 1 },
      { id: 'm2', name: 'Игорь', telegram_id: 2 },
    ];
    var tx = [];
    function add(member, catName, amount, shared, note, day) {
      var c = categories.find(function (x) { return x.name === catName; });
      tx.push({ id: id(), member_id: member, category_id: c.id, amount: amount, is_shared: shared, note: note, occurred_on: day, created_at: new Date().toISOString() });
    }
    add('m1', 'Зарплата', 120000, false, 'оклад', daysAgo(20));
    add('m2', 'Зарплата', 90000, false, 'оклад', daysAgo(19));
    add('m1', 'Продукты', 3240.5, true, 'лента', daysAgo(12));
    add('m1', 'Продукты', 2180, true, 'пятёрочка', daysAgo(5));
    add('m2', 'Продукты', 1450, true, 'магнит', daysAgo(3));
    add('m1', 'Кафе и рестораны', 890, false, 'обед', daysAgo(4));
    add('m2', 'Кафе и рестораны', 1250, false, 'бариста', daysAgo(2));
    add('m1', 'Транспорт', 420, true, 'такси', daysAgo(1));
    add('m1', 'Подписки и связь', 399, true, 'музыка', daysAgo(8));
    add('m2', 'Развлечения', 2400, true, 'кино', daysAgo(6));
    add('m1', 'Здоровье', 1250, false, 'аптека', daysAgo(0));
    add('m2', 'Подработка', 15000, false, 'фриланс', daysAgo(10));
    add('m1', 'Кафе и рестораны', 350, false, 'кофе', daysAgo(0));
    var goals = [
      { id: 'g1', household_id: 'h1', name: 'Отпуск в Турцию', target: 120000, saved: 45000, monthly: 15000 },
      { id: 'g2', household_id: 'h1', name: 'Новый ноутбук', target: 90000, saved: 90000, monthly: 0 },
    ];
    var debts = [
      { id: 'd1', household_id: 'h1', name: 'Кредитная карта', creditor: 'Тинькофф', total: 60000, remaining: 24000, monthly: 5000 },
      { id: 'd2', household_id: 'h1', name: 'Ремонт у друга', creditor: 'Максим', total: 10000, remaining: 0, monthly: 0 },
    ];
    var wishes = [
      { id: 'w1', household_id: 'h1', name: 'Робот-пылесос', price: 35000, priority: 'high', goal_id: null, purchased: false },
      { id: 'w2', household_id: 'h1', name: 'Абонемент в зал', price: 24000, priority: 'medium', goal_id: null, purchased: true },
    ];
    return {
      me: { id: 'm1', household_id: 'h1', name: 'Аня', telegram_id: 1, households: null,
        notifications: { payments: true, limits: true, digest: false, daily: false, daily_time: '22:00', timezone: timezone() } },
      recurring: [
        { id: 'r1', household_id: 'h1', name: 'Аренда', amount: 35000, day_of_month: 5, active: true,
          categories: { name: 'Жильё и коммуналка', icon: '🏠' } },
        { id: 'r2', household_id: 'h1', name: 'Интернет', amount: 900, day_of_month: 12, active: true,
          categories: { name: 'Подписки и связь', icon: '📱' } },
        { id: 'r3', household_id: 'h1', name: 'Сервак', amount: 300,
          day_of_month: new Date(Date.now() + 86400000).getDate(), active: true,
          categories: { name: 'Подписки и связь', icon: '📱' } },
      ],
      goals: goals,
      debts: debts,
      wishes: wishes,
      promo: [],
      promoUsed: {},
      monthSplit: {},
      member: { id: 'm1', household_id: 'h1', name: 'Аня', telegram_id: 1,
        households: { id: 'h1', name: 'Наша семья', mode: new URLSearchParams(root.location.search).has('solo') ? 'solo' : 'pair', split_mode: 'proportional', invite_code: 'demo1234',
          plan_until: new Date(Date.now() + (new URLSearchParams(root.location.search).has('expired') ? -86400000 : 12 * 86400000)).toISOString() } },
      members: members,
      categories: categories,
      tx: tx,
    };
  }

  function cat(name, kind, plan, icon, sort) {
    return { id: id(), name: name, kind: kind, plan_monthly: plan, icon: icon, sort: sort, archived: false };
  }

  // --- Тестовая семья на месяц: два аккаунта, 30 дней операций ---
  // ?test-month&as=anya|igor — одна и та же семья с разным текущим участником.
  // run_test_month в DEMO_API прогоняет сценарий и проверяет итоги после каждого дня.

  var TEST_MONTH = '2026-10';

  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function near(a, b, eps) { return Math.abs(Number(a) - Number(b)) <= (eps == null ? 0.011 : eps); }
  function memberById(memberId) {
    var m = state.members.find(function (x) { return x.id === memberId; });
    if (!m) throw new Error('not_found');
    return m;
  }
  function categoryByName(name) {
    var c = state.categories.find(function (x) { return x.name === name; });
    if (!c) throw new Error('bad_category');
    return c;
  }
  function setActor(memberId) {
    var m = memberById(memberId);
    state.member = Object.assign({}, state.member, {
      id: m.id, name: m.name, telegram_id: m.telegram_id,
    });
    return state.member;
  }
  function addFor(memberId, categoryName, amount, shared, note, date) {
    setActor(memberId);
    return handlers.add_tx({
      category_id: categoryByName(categoryName).id,
      amount: amount,
      is_shared: shared,
      note: note,
      occurred_on: date,
    });
  }

  function resetTestFamily() {
    state = fresh();
    state.tx = [];
    state.goals = [];
    state.debts = [];
    state.wishes = [];
    state.recurring = [
      { id: 'r1', household_id: 'h1', name: 'Аренда', amount: 35000, day_of_month: 5, active: true,
        categories: { name: 'Жильё и коммуналка', icon: '🏠' } },
      { id: 'r2', household_id: 'h1', name: 'Интернет', amount: 900, day_of_month: 12, active: true,
        categories: { name: 'Подписки и связь', icon: '📱' } },
      { id: 'r3', household_id: 'h1', name: 'Сервак', amount: 300, day_of_month: 21, active: true,
        categories: { name: 'Подписки и связь', icon: '📱' } },
    ];
    state.members = [
      { id: 'm1', name: 'Аня', telegram_id: 1 },
      { id: 'm2', name: 'Игорь', telegram_id: 2 },
    ];
    state.member = Object.assign({}, state.member, {
      id: 'm1', name: 'Аня', telegram_id: 1, household_id: 'h1',
      households: { id: 'h1', name: 'Тестовая семья', mode: 'pair', split_mode: 'proportional',
        invite_code: 'demo1234', plan_until: new Date(Date.now() + 12 * 86400000).toISOString() },
    });
    state.promo = [];
    state.promoUsed = {};
    return state;
  }

  function tx(actor, cat, amount, shared, note) {
    return { type: 'tx', actor: actor, cat: cat, amount: amount, shared: shared, note: note };
  }
  function recurring(actor, recurringId) { return { type: 'recurring', actor: actor, id: recurringId }; }
  function goal(name, target, saved, monthly) {
    return { type: 'goal', name: name, target: target, saved: saved, monthly: monthly };
  }
  function goalAdd(name, amount) { return { type: 'goal-add', name: name, amount: amount }; }
  function debt(name, creditor, total, remaining, monthly) {
    return { type: 'debt', name: name, creditor: creditor, total: total, remaining: remaining, monthly: monthly };
  }
  function debtPay(name, amount) { return { type: 'debt-pay', name: name, amount: amount }; }
  function wish(name, price, priority) { return { type: 'wish', name: name, price: price, priority: priority }; }
  function wishBuy(name) { return { type: 'wish-buy', name: name }; }

  var TEST_SCENARIO = [
    { day: 1, actions: [
      tx('m1', 'Зарплата', 120000, false, 'оклад'),
      tx('m2', 'Зарплата', 90000, false, 'оклад'),
      goal('Отпуск', 120000, 0, 10000),
    ] },
    { day: 2, actions: [tx('m1', 'Продукты', 3200.50, true, 'пятёрочка')] },
    { day: 3, actions: [tx('m2', 'Кафе и рестораны', 350, false, 'кофе')] },
    { day: 4, actions: [tx('m1', 'Транспорт', 420, true, 'такси')] },
    { day: 5, actions: [tx('m1', 'Жильё и коммуналка', 35000, true, 'аренда')] },
    { day: 6, actions: [tx('m2', 'Продукты', 2180, true, 'магнит')] },
    { day: 7, actions: [tx('m1', 'Развлечения', 2400, true, 'кино')] },
    { day: 8, actions: [tx('m2', 'Здоровье', 1250, false, 'аптека')] },
    { day: 9, actions: [tx('m1', 'Продукты', 1450, true, 'лента')] },
    { day: 10, actions: [tx('m2', 'Подписки и связь', 399, true, 'музыка'), goalAdd('Отпуск', 10000)] },
    { day: 11, actions: [tx('m1', 'Кафе и рестораны', 890, false, 'обед')] },
    { day: 12, actions: [tx('m2', 'Подписки и связь', 900, true, 'интернет')] },
    { day: 13, actions: [tx('m1', 'Одежда', 2500, true, 'куртка')] },
    { day: 14, actions: [tx('m2', 'Продукты', 3100, true, 'ашан')] },
    { day: 15, actions: [tx('m1', 'Подарки', 1500, false, 'день рождения'),
      debt('Кредитная карта', 'Тинькофф', 60000, 60000, 5000)] },
    { day: 16, actions: [tx('m2', 'Транспорт', 600, true, 'метро')] },
    { day: 17, actions: [tx('m1', 'Кафе и рестораны', 1250, false, 'ужин')] },
    { day: 18, actions: [tx('m2', 'Дом и быт', 1800, true, 'чистящие')] },
    { day: 19, actions: [tx('m1', 'Продукты', 2700, true, 'пятёрочка')] },
    { day: 20, actions: [tx('m2', 'Подработка', 15000, false, 'фриланс'),
      debtPay('Кредитная карта', 5000)] },
    { day: 21, actions: [recurring('m1', 'r3')] },
    { day: 22, actions: [tx('m2', 'Здоровье', 800, false, 'витамины')] },
    { day: 23, actions: [tx('m1', 'Продукты', 2400, true, 'магнит')] },
    { day: 24, actions: [tx('m2', 'Развлечения', 1200, true, 'боулинг')] },
    { day: 25, actions: [tx('m1', 'Кафе и рестораны', 950, false, 'кофе с подругой'),
      wish('Робот-пылесос', 35000, 'high'), wishBuy('Робот-пылесос')] },
    { day: 26, actions: [tx('m2', 'Транспорт', 300, true, 'автобус')] },
    { day: 27, actions: [tx('m1', 'Продукты', 3600, true, 'лента')] },
    { day: 28, actions: [tx('m2', 'Одежда', 1900, false, 'кроссовки')] },
    { day: 29, actions: [tx('m1', 'Подарки', 2000, true, 'подарок маме')] },
    { day: 30, actions: [tx('m2', 'Кафе и рестораны', 1100, false, 'обед'),
      tx('m1', 'Продукты', 1500, true, 'овощи')] },
  ];

  function checkDay(day, s, e) {
    function fail(message) { throw new Error('day ' + day + ': ' + message); }
    if (!near(s.income, e.income)) fail('income ' + s.income + ' != ' + e.income);
    if (!near(s.expense, e.expense)) fail('expense ' + s.expense + ' != ' + e.expense);
    if (!near(s.balance, e.income - e.expense)) fail('balance');
    var catSum = s.categories.reduce(function (a, c) { return a + Number(c.fact || 0); }, 0);
    if (!near(catSum, e.expense)) fail('category sum ' + catSum + ' != ' + e.expense);
    var shareSum = s.members.reduce(function (a, m) { return a + Number(m.share || 0); }, 0);
    if (!near(shareSum, e.shared, 0.02)) fail('share sum ' + shareSum + ' != ' + e.shared);
    var balanceSum = s.members.reduce(function (a, m) { return a + Number(m.balance || 0); }, 0);
    if (Math.abs(balanceSum) > 2) fail('balance sum ' + balanceSum);
    ['m1', 'm2'].forEach(function (memberId) {
      var m = s.members.find(function (x) { return x.id === memberId; });
      var want = e.byMember[memberId];
      if (!m) fail('member ' + memberId + ' missing');
      if (!near(m.income, want.income)) fail(memberId + ' income');
      if (!near(m.paid_shared, want.shared)) fail(memberId + ' shared');
      if (!near(m.personal, want.personal)) fail(memberId + ' personal');
      var expectedShare = e.income > 0 ? e.shared * want.income / e.income : e.shared / 2;
      if (!near(m.share, expectedShare)) fail(memberId + ' share ' + m.share + ' != ' + expectedShare);
      if (Math.abs(Number(m.balance) - Math.round(Number(m.paid_shared) - Number(m.share))) > 1) fail(memberId + ' balance');
    });
    var txCount = state.tx.filter(function (t) { return Fmt.sameMonth(t.occurred_on, TEST_MONTH); }).length;
    if (txCount !== e.txCount) fail('tx count ' + txCount + ' != ' + e.txCount);
    [s.income, s.expense, s.balance, catSum, shareSum, balanceSum].forEach(function (n) {
      if (!Number.isFinite(Number(n))) fail('non-finite total');
    });
  }

  function runTestMonth(viewer) {
    resetTestFamily();
    var goalRows = {};
    var debtRows = {};
    var wishRows = {};
    var expected = {
      income: 0, expense: 0, shared: 0, personal: 0, txCount: 0,
      byMember: {
        m1: { income: 0, shared: 0, personal: 0 },
        m2: { income: 0, shared: 0, personal: 0 },
      },
    };
    var log = [];

    function expectTx(actor, categoryName, amount, shared) {
      var category = categoryByName(categoryName);
      var value = Number(amount);
      if (category.kind === 'income') {
        expected.income += value;
        expected.byMember[actor].income += value;
      } else {
        expected.expense += value;
        if (shared) {
          expected.shared += value;
          expected.byMember[actor].shared += value;
        } else {
          expected.personal += value;
          expected.byMember[actor].personal += value;
        }
      }
      expected.txCount++;
    }

    TEST_SCENARIO.forEach(function (day) {
      var date = TEST_MONTH + '-' + pad2(day.day);
      var operations = [];
      day.actions.forEach(function (action) {
        if (action.type === 'tx') {
          addFor(action.actor, action.cat, action.amount, action.shared, action.note, date);
          expectTx(action.actor, action.cat, action.amount, action.shared);
          operations.push(action.actor + ': ' + action.cat + ' ' + action.amount + (action.shared ? ' (общая)' : ''));
        } else if (action.type === 'recurring') {
          var row = state.recurring.find(function (x) { return x.id === action.id; });
          if (!row) throw new Error('bad_recurring');
          setActor(action.actor);
          handlers.pay_recurring({ id: action.id, occurred_on: date });
          expected.expense += Number(row.amount);
          expected.personal += Number(row.amount);
          expected.byMember[action.actor].personal += Number(row.amount);
          expected.txCount++;
          operations.push(action.actor + ': платёж ' + row.name + ' ' + row.amount);
        } else if (action.type === 'goal') {
          goalRows[action.name] = handlers.save_goal({
            name: action.name, target: action.target, saved: action.saved, monthly: action.monthly,
          });
          operations.push('цель «' + action.name + '»: ' + action.target);
        } else if (action.type === 'goal-add') {
          var goalRow = goalRows[action.name];
          if (!goalRow) throw new Error('bad_goal');
          handlers.add_to_goal({ id: goalRow.id, amount: action.amount });
          operations.push('в цель «' + action.name + '»: +' + action.amount);
        } else if (action.type === 'debt') {
          debtRows[action.name] = handlers.save_debt({
            name: action.name, creditor: action.creditor, total: action.total,
            remaining: action.remaining, monthly: action.monthly,
          });
          operations.push('долг «' + action.name + '»: ' + action.total);
        } else if (action.type === 'debt-pay') {
          var debtRow = debtRows[action.name];
          if (!debtRow) throw new Error('not_found');
          handlers.pay_debt({ id: debtRow.id, amount: action.amount });
          operations.push('платёж по долгу «' + action.name + '»: ' + action.amount);
        } else if (action.type === 'wish') {
          wishRows[action.name] = handlers.save_wish({
            name: action.name, price: action.price, priority: action.priority,
          });
          operations.push('желание «' + action.name + '»: ' + action.price);
        } else if (action.type === 'wish-buy') {
          var wishRow = wishRows[action.name];
          if (!wishRow) throw new Error('not_found');
          handlers.buy_wish({ id: wishRow.id });
          operations.push('куплено «' + action.name + '»');
        }
      });
      var daySummary = summary(TEST_MONTH);
      checkDay(day.day, daySummary, expected);
      log.push({
        day: day.day,
        date: date,
        operations: operations,
        income: daySummary.income,
        expense: daySummary.expense,
        balance: daySummary.balance,
        tx: expected.txCount,
      });
    });

    var finalSummary = summary(TEST_MONTH);
    setActor(viewer === 'igor' ? 'm2' : 'm1');
    return {
      month: TEST_MONTH,
      days: log,
      final: {
        summary: finalSummary,
        goals: state.goals,
        debts: state.debts,
        wishes: state.wishes,
        recurring: state.recurring,
        members: state.members,
      },
    };
  }

  // Режим деления общих трат: последнее изменение с месяцем <= выбранного,
  // иначе значение семьи. Как в month_summary(): прошлые месяцы не зависят
  // от более поздних изменений, а выбор действует на будущие месяцы.
  function splitModeFor(month) {
    var ym = String(month || Fmt.currentMonth()).slice(0, 7);
    var keys = Object.keys(state.monthSplit || {}).filter(function (k) { return k <= ym; }).sort();
    if (keys.length) return state.monthSplit[keys[keys.length - 1]];
    return (state.member && state.member.households && state.member.households.split_mode) || 'proportional';
  }

  function summary(month) {
    var ym = month || Fmt.currentMonth();
    var splitMode = splitModeFor(ym);
    var inMonth = state.tx.filter(function (t) { return Fmt.sameMonth(t.occurred_on, ym); });
    var kindOf = function (t) { return state.categories.find(function (c) { return c.id === t.category_id; }).kind; };
    var income = sum(inMonth.filter(function (t) { return kindOf(t) === 'income'; }));
    var expense = sum(inMonth.filter(function (t) { return kindOf(t) === 'expense'; }));
    var categories = state.categories
      .filter(function (c) { return c.kind === 'expense' && !c.archived; })
      .sort(function (a, b) { return a.sort - b.sort; })
      .map(function (c) {
        return { id: c.id, name: c.name, icon: c.icon, plan: c.plan_monthly,
          fact: sum(inMonth.filter(function (t) { return t.category_id === c.id; })) };
      });
    // Как в month_summary(): общие траты делятся поровну в режиме equal,
    // иначе пропорционально доходу участника, при нулевом суммарном доходе — поровну.
    var totalShared = sum(inMonth.filter(function (t) { return kindOf(t) === 'expense' && t.is_shared; }));
    var totalIncome = sum(inMonth.filter(function (t) { return kindOf(t) === 'income'; }));
    var shareOf = function (m) {
      if (splitMode === 'none') return 0;
      return splitMode === 'equal' || totalIncome <= 0
        ? totalShared / state.members.length
        : totalShared * m.income / totalIncome;
    };
    var members = state.members.map(function (m) {
      var own = inMonth.filter(function (t) { return t.member_id === m.id; });
      var mIncome = sum(own.filter(function (t) { return kindOf(t) === 'income'; }));
      var paidShared = sum(own.filter(function (t) { return kindOf(t) === 'expense' && t.is_shared; }));
      return { id: m.id, name: m.name, income: mIncome, paid_shared: paidShared,
        personal: sum(own.filter(function (t) { return kindOf(t) === 'expense' && !t.is_shared; })),
        personal_limit: 0, share: Math.round(shareOf({ income: mIncome }) * 100) / 100,
        balance: 0 };
    });
    members.forEach(function (m) { m.balance = splitMode === 'none' ? 0 : Math.round(m.paid_shared - m.share); });
    return { income: income, expense: expense, balance: income - expense, split_mode: splitMode, categories: categories, members: members };
  }

  function sum(list) {
    return list.reduce(function (a, t) { return a + Number(t.amount); }, 0);
  }

  var handlers = {
    // API отвечает `{}`, пока пользователь не в семье.
    me: function () {
      if (!state.member) return {};
      var households = Object.assign({}, state.member.households, {
        month_split_mode: splitModeFor(Fmt.currentMonth()),
      });
      return { member: Object.assign({}, state.member, {
          households: households,
          notifications: state.member.notifications || { payments: true, limits: true, digest: false, daily: false, daily_time: '22:00', timezone: timezone() },
        }), promo: state.promo || [] };
    },
    summary: function (p) {
      return summary(p.month);
    },
    set_split_mode: function (p) {
      var mode = p.mode === 'equal' || p.mode === 'proportional' || p.mode === 'none' ? p.mode : null;
      if (!mode) throw new Error('bad_split_mode');
      var month = typeof p.month === 'string' && /^\d{4}-\d{2}$/.test(p.month) ? p.month : null;
      if (!month) throw new Error('bad_month');
      state.monthSplit[month] = mode;
      return { ok: true, month: month, split_mode: mode };
    },
    save_profile: function (p) {
      var hasMember = Object.prototype.hasOwnProperty.call(p, 'member_name');
      var hasHousehold = Object.prototype.hasOwnProperty.call(p, 'household_name');
      if (!hasMember && !hasHousehold) throw new Error('bad_name');
      var memberName = hasMember ? String(p.member_name || '').trim().slice(0, 40) : '';
      var householdName = hasHousehold ? String(p.household_name || '').trim().slice(0, 60) : '';
      if (hasMember && !memberName) throw new Error('bad_name');
      if (hasHousehold && !householdName) throw new Error('bad_name');
      if (hasMember) {
        state.member = Object.assign({}, state.member, { name: memberName });
        state.members = state.members.map(function (m) {
          return m.id === state.member.id ? Object.assign({}, m, { name: memberName }) : m;
        });
      }
      if (hasHousehold) {
        state.member = Object.assign({}, state.member, {
          households: Object.assign({}, state.member.households, { name: householdName }),
        });
      }
      return { ok: true, member_name: state.member.name, household_name: state.member.households && state.member.households.name };
    },
    categories: function () {
      return state.categories.filter(function (c) { return !c.archived; }).sort(function (a, b) { return a.sort - b.sort; });
    },
    list_tx: function (p) {
      var ym = String(p.month || Fmt.currentMonth()).slice(0, 7);
      return state.tx
        .filter(function (t) { return Fmt.sameMonth(t.occurred_on, ym); })
        .sort(function (a, b) { return a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : (a.created_at < b.created_at ? 1 : -1); })
        .map(function (t) {
          var c = state.categories.find(function (x) { return x.id === t.category_id; });
          var m = state.members.find(function (x) { return x.id === t.member_id; });
          return Object.assign({}, t, {
            categories: c ? { name: c.name, icon: c.icon, kind: c.kind } : null,
            members: m ? { name: m.name } : null,
          });
        });
    },
    add_tx: function (p) {
      var c = state.categories.find(function (x) { return x.id === p.category_id; });
      if (!c) throw new Error('bad_category');
      if (!(Number(p.amount) > 0)) throw new Error('bad_amount');
      var receiptKey = null;
      if (p.receipt) {
        if (typeof p.receipt.fn !== 'string' || typeof p.receipt.i !== 'string' || typeof p.receipt.fp !== 'string'
          || !/^\d{16}$/.test(p.receipt.fn) || !/^\d{1,10}$/.test(p.receipt.i) || !/^\d{1,10}$/.test(p.receipt.fp)) {
          throw new Error('bad_receipt');
        }
        receiptKey = p.receipt.fn + ':' + p.receipt.i + ':' + p.receipt.fp;
        if (state.tx.some(function (t) { return t.receipt_key === receiptKey; })) throw new Error('duplicate_receipt');
      }
      var tx = { id: p.local_id || id(), member_id: state.member.id, category_id: c.id, amount: Number(p.amount),
        is_shared: !!p.is_shared, note: p.note || null,
        occurred_on: p.occurred_on || Fmt.todayIso(), created_at: new Date().toISOString() };
      if (receiptKey) tx.receipt_key = receiptKey;
      state.tx.push(tx);
      return tx;
    },
    update_tx: function (p) {
      var tx = state.tx.find(function (t) { return t.id === p.id; });
      if (!tx) throw new Error('not_found');
      var originalCategory = state.categories.find(function (c) { return c.id === tx.category_id; });
      var next = Object.assign({}, tx);
      ['amount', 'category_id', 'note', 'occurred_on', 'is_shared'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(p, key)) next[key] = p[key];
      });
      var category = state.categories.find(function (c) { return c.id === next.category_id; });
      if (!originalCategory || originalCategory.kind !== 'expense' || !category || category.kind !== 'expense' || category.archived) throw new Error('bad_category');
      next.amount = Number(next.amount);
      if (!Number.isFinite(next.amount) || next.amount <= 0) throw new Error('bad_amount');
      var date = String(next.occurred_on || '');
      var parsed = new Date(date + 'T12:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('bad_date');
      next.note = next.note == null || next.note === '' ? null : String(next.note);
      next.is_shared = !!next.is_shared;
      Object.assign(tx, next);
      var member = state.members.find(function (m) { return m.id === tx.member_id; });
      return Object.assign({}, tx, {
        categories: { name: category.name, icon: category.icon, kind: category.kind },
        members: member ? { name: member.name } : null,
      });
    },
    delete_tx: function (p) {
      state.tx = state.tx.filter(function (t) { return t.id !== p.id; });
      return { ok: true };
    },
    create_household: function (p) {
      state.member = joinDemo(p.member_name, p.mode);
      return { ok: true, invite_code: state.member.households.invite_code, mode: state.member.households.mode };
    },
    join: function (p) {
      state.member = joinDemo(p.member_name);
      return { ok: true };
    },
    switch_account: function (p) {
      var member = setActor(p.member_id || p.id);
      return { ok: true, member: member };
    },
    run_test_month: function (p) {
      return runTestMonth(p && p.viewer === 'igor' ? 'igor' : 'anya');
    },

    // --- Планы ---

    list_plans: function () {
      return { goals: state.goals, debts: state.debts, wishes: state.wishes };
    },
    save_goal: function (p) {
      return save('goals', p);
    },
    add_to_goal: function (p) {
      var g = state.goals.find(function (x) { return x.id === p.id; });
      if (!g) throw new Error('not_found');
      g.saved = Math.min(Number(g.target), Number(g.saved) + Number(p.amount));
      return g;
    },
    delete_goal: function (p) {
      state.goals = state.goals.filter(function (x) { return x.id !== p.id; });
      state.wishes.forEach(function (w) { if (w.goal_id === p.id) w.goal_id = null; });
      return { ok: true };
    },
    save_debt: function (p) {
      if (p.remaining == null) p.remaining = p.total;
      return save('debts', p);
    },
    pay_debt: function (p) {
      var d = state.debts.find(function (x) { return x.id === p.id; });
      if (!d) throw new Error('not_found');
      d.remaining = Math.max(0, Math.round((Number(d.remaining) - Number(p.amount)) * 100) / 100);
      return d;
    },
    delete_debt: function (p) {
      state.debts = state.debts.filter(function (x) { return x.id !== p.id; });
      return { ok: true };
    },
    save_wish: function (p) {
      return save('wishes', p);
    },
    buy_wish: function (p) {
      var w = state.wishes.find(function (x) { return x.id === p.id; });
      if (!w) throw new Error('not_found');
      w.purchased = true;
      return w;
    },
    delete_wish: function (p) {
      state.wishes = state.wishes.filter(function (x) { return x.id !== p.id; });
      return { ok: true };
    },
    delete_my_account: function () {
      state.member = null;
      state.goals = [];
      state.debts = [];
      state.wishes = [];
      return { ok: true };
    },
    save_category: function (p) {
      if (p.id && String(p.id).indexOf('local-') === 0) {
        // Локальная категория: сервер ещё не выдал id — присваиваем реальный.
        var local = state.categories.find(function (x) { return x.id === p.id; });
        if (local) {
          local.id = id();
          local._local = false;
        }
        return local || { ok: true };
      }
      if (!p.id) {
        if (state.categories.some(function (x) { return x.name === p.name; })) throw new Error('category_exists');
        var created = cat(p.name, p.kind === 'income' ? 'income' : 'expense', Number(p.plan_monthly) || 0,
          p.icon || '🏷️', state.categories.length + 1);
        state.categories.push(created);
        return created;
      }
      var c = state.categories.find(function (x) { return x.id === p.id; });
      if (!c) throw new Error('not_found');
      c.plan_monthly = Number(p.plan_monthly) || 0;
      if (p.name) c.name = p.name;
      if (p.icon) c.icon = p.icon;
      state.tx = state.tx;
      return c;
    },
    archive_category: function (p) {
      var c = state.categories.find(function (x) { return x.id === p.id; });
      if (!c) throw new Error('not_found');
      var used = state.tx.some(function (t) { return t.category_id === p.id; });
      if (used) c.archived = true;
      else state.categories = state.categories.filter(function (x) { return x.id !== p.id; });
      return { ok: true, archived: used };
    },
    list_recurring: function () {
      return state.recurring.map(function (r) {
        var cat = state.categories.find(function (c) { return c.name === (r.categories && r.categories.name); });
        return Object.assign({}, r, { category_id: cat ? cat.id : null });
      });
    },
    save_recurring: function (p) {
      var reminderDays = p.reminder_days == null ? 1 : Number(p.reminder_days);
      if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) throw { code: 'bad_reminder_days' };
      var cat = state.categories.find(function (c) { return c.id === p.category_id; });
      var row = {
        name: p.name, amount: Number(p.amount), day_of_month: Number(p.day_of_month), active: true,
        reminder_days: reminderDays,
        category_id: cat ? cat.id : null,
        categories: cat ? { name: cat.name, icon: cat.icon } : null,
      };
      if (p.id) {
        var cur = state.recurring.find(function (x) { return x.id === p.id; });
        if (!cur) throw new Error('not_found');
        Object.assign(cur, row);
        return cur;
      }
      var item = Object.assign({ id: id() }, row);
      state.recurring.push(item);
      return item;
    },
    delete_recurring: function (p) {
      state.recurring = state.recurring.filter(function (x) { return x.id !== p.id; });
      return { ok: true };
    },
    pay_recurring: function (p) {
      var r = state.recurring.find(function (x) { return x.id === p.id; });
      if (!r) throw new Error('not_found');
      var cat = state.categories.find(function (c) { return c.name === (r.categories && r.categories.name); });
      var tx = { id: id(), member_id: state.member.id, category_id: cat.id, amount: r.amount,
        is_shared: false, note: r.name, occurred_on: p.occurred_on || Fmt.todayIso(),
        created_at: new Date().toISOString() };
      state.tx.push(tx);
      return { ok: true, transaction: tx };
    },
    save_notifications: function (p) {
      var n = p.notifications || {};
      state.member.notifications = {
        payments: n.payments !== false,
        limits: n.limits !== false,
        digest: n.digest === true,
        daily: n.daily === true,
        daily_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(n.daily_time || '') ? n.daily_time : '22:00',
        timezone: typeof n.timezone === 'string' ? n.timezone : timezone(),
      };
      return { notifications: state.member.notifications };
    },
    plans: function () {
      return [
        { code: 'month', title: '1 месяц', days: 30, stars: 150 },
        { code: 'quarter', title: '3 месяца', days: 90, stars: 400 },
        { code: 'year', title: 'Год', days: 365, stars: 1200 },
      ];
    },
    create_invoice: function (p) {
      var plan = handlers.plans().find(function (x) { return x.code === p.plan; });
      if (!plan) throw new Error('bad_plan');
      state.lastInvoice = plan;
      return { ok: true, url: 'https://t.me/$demo-invoice', stars: plan.stars, days: plan.days };
    },
    redeem_promo: function (p) {
      var code = String(p.code || '').trim().toUpperCase();
      if (!code) throw new Error('bad_promo');
      if (code !== 'FRIENDS2026') throw new Error('bad_promo');
      if (state.promoUsed[code]) throw new Error('promo_used');
      state.promoUsed[code] = true;
      var before = new Date(state.member.households.plan_until).getTime();
      var until = new Date(Math.max(before, Date.now()) + 365 * 86400000).toISOString();
      state.member.households.plan_until = until;
      state.promo.unshift({ code: code, created_at: new Date().toISOString() });
      return { ok: true, code: code, days: 365, plan_until: until };
    },
  };

  // Создание/редактирование строки плана — как в API: id есть → заменить, нет → добавить.
  function save(collection, p) {
    var list = state[collection];
    var row = Object.assign({}, p);
    delete row.id;
    if (collection === 'debts' && !row.creditor) row.creditor = null;
    if (collection === 'wishes' && !row.goal_id) row.goal_id = null;
    if (p.id) {
      var cur = list.find(function (x) { return x.id === p.id; });
      if (!cur) throw new Error('not_found');
      Object.assign(cur, row);
      return cur;
    }
    var item = Object.assign({ id: id() }, row);
    if (collection === 'wishes') item.purchased = false;
    list.push(item);
    return item;
  }

  // Возвращает демо-участника в семью (то, что делает me после create/join на реальном API).
  function joinDemo(name, mode) {
    var s = fresh();
    var member = Object.assign({}, s.member, { name: name || s.member.me.name });
    member.households = Object.assign({}, member.households, { mode: mode === 'solo' ? 'solo' : 'pair' });
    return (state.member = member);
  }

  function call(action, payload) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        var h = handlers[action];
        if (!h) return reject(Object.assign(new Error('unknown_action'), { code: 'unknown_action' }));
        try {
          resolve(h(payload || {}));
        } catch (e) {
          // Код ошибки, как у ApiError: приложение смотрит на err.code.
          reject(Object.assign(new Error(e.message), { code: e.message }));
        }
      }, 120);
    });
  }

  function reset() {
    state = fresh();
  }

  // ?test-month&as=anya|igor — два аккаунта одной тестовой семьи с 30 днями операций.
  if (query.has('test-month')) {
    runTestMonth(query.get('as') === 'igor' ? 'igor' : 'anya');
  }

  // Для отладки из консоли браузера: DEMO_API.state() показывает текущие данные.
  root.DEMO_API = { call: call, reset: reset, state: function () { return state; } };
})(window);
