/**
 * Демо-данные для запуска вне Telegram (браузер, вёрстка без бэкенда).
 * Повторяет контракт Edge Function `api` в памяти — состояние живёт до перезагрузки.
 * Внутри Telegram не используется.
 */

(function (root) {
  var seq = 100;
  var id = function () { return 'demo-' + ++seq; };
  var iso = function (d) { return Fmt.isoDate(d); };
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
        notifications: { payments: true, limits: true, digest: false } },
      recurring: [
        { id: 'r1', household_id: 'h1', name: 'Аренда', amount: 35000, day_of_month: 5, active: true,
          categories: { name: 'Жильё и коммуналка', icon: '🏠' } },
        { id: 'r2', household_id: 'h1', name: 'Интернет', amount: 900, day_of_month: 12, active: true,
          categories: { name: 'Подписки и связь', icon: '📱' } },
      ],
      goals: goals,
      debts: debts,
      wishes: wishes,
      promo: [],
      promoUsed: {},
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

  function summary(month) {
    var ym = month || Fmt.currentMonth();
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
    // Как в month_summary(): общие траты делятся пропорционально доходу участника,
    // при нулевом суммарном доходе — поровну.
    var totalShared = sum(inMonth.filter(function (t) { return kindOf(t) === 'expense' && t.is_shared; }));
    var totalIncome = sum(inMonth.filter(function (t) { return kindOf(t) === 'income'; }));
    var shareOf = function (m) {
      return totalIncome > 0
        ? totalShared * m.income / totalIncome
        : totalShared / state.members.length;
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
    members.forEach(function (m) { m.balance = Math.round(m.paid_shared - m.share); });
    return { income: income, expense: expense, balance: income - expense, categories: categories, members: members };
  }

  function sum(list) {
    return list.reduce(function (a, t) { return a + Number(t.amount); }, 0);
  }

  var handlers = {
    // API отвечает `{}`, пока пользователь не в семье.
    me: function () {
      return state.member
        ? { member: Object.assign({}, state.member.me, {
            households: state.member.households,
            notifications: state.member.notifications || { payments: true, limits: true, digest: false },
          }), promo: state.promo || [] }
        : {};
    },
    summary: function (p) {
      return summary(p.month);
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
      var tx = { id: id(), member_id: state.member.id, category_id: c.id, amount: Number(p.amount),
        is_shared: !!p.is_shared, note: p.note || null,
        occurred_on: p.occurred_on || Fmt.todayIso(), created_at: new Date().toISOString() };
      state.tx.push(tx);
      return tx;
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
    list_recurring: function () { return state.recurring; },
    save_recurring: function (p) {
      var cat = state.categories.find(function (c) { return c.id === p.category_id; });
      var row = {
        name: p.name, amount: Number(p.amount), day_of_month: Number(p.day_of_month), active: true,
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
        is_shared: false, note: r.name, occurred_on: Fmt.todayIso(), created_at: new Date().toISOString() };
      state.tx.push(tx);
      return { ok: true, transaction: tx };
    },
    save_notifications: function (p) {
      state.member.notifications = {
        payments: p.notifications.payments !== false,
        limits: p.notifications.limits !== false,
        digest: p.notifications.digest === true,
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

  // Для отладки из консоли браузера: DEMO_API.state() показывает текущие данные.
  root.DEMO_API = { call: call, reset: reset, state: function () { return state; } };
})(window);
