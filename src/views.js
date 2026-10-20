/**
 * Разметка экранов. Функции возвращают HTML-строку;
 * обработчики навешивает app.js через data-action / data-tab.
 */

(function (root) {
  var e = Fmt.escapeHtml;
  var T = I18n.t;
  var P = I18n.plural;

  // Локальные (ещё не отправленные) записи заменяем серверными, когда те пришли.
  function reconcileList(list) {
    if (!Array.isArray(list)) return list;
    var real = {};
    list.forEach(function (t) { if (!t._local) real[t.id] = true; });
    return list.filter(function (t) { return !t._local || !real[t.id]; });
  }
  var money = Fmt.money;

  function initLetter(name) {
    var s = String(name || '').trim();
    return s ? e(s[0].toUpperCase()) : '?';
  }

  function monthNav(month) {
    var next = Fmt.shiftMonth(month, 1);
    var current = Fmt.currentMonth();
    var isCurrent = month >= current;
    return (
      '<div class="month-nav">' +
      '<button type="button" class="month-nav__btn" data-action="month-prev" aria-label="' + e(T('Предыдущий месяц')) + '">‹</button>' +
      '<span class="month-nav__label">' + e(Fmt.monthTitle(month)) + '</span>' +
      '<button type="button" class="month-nav__btn" data-action="month-next" aria-label="' + e(T('Следующий месяц')) + '"' +
      (isCurrent ? ' disabled' : '') + '>›</button>' +
      '</div>'
    );
  }

  function skeletonSummary() {
    return (
      '<div class="skeleton skeleton--hero"></div>' +
      '<div class="skeleton skeleton--line" style="width:55%"></div>' +
      '<div class="skeleton skeleton--row"></div>' +
      '<div class="skeleton skeleton--row"></div>' +
      '<div class="skeleton skeleton--row"></div>'
    );
  }

  function skeletonList() {
    return (
      '<div class="skeleton skeleton--line" style="width:40%"></div>' +
      '<div class="skeleton skeleton--row"></div>' +
      '<div class="skeleton skeleton--row"></div>' +
      '<div class="skeleton skeleton--row"></div>' +
      '<div class="skeleton skeleton--row"></div>'
    );
  }

  function empty(icon, title, text, actionHtml) {
    return (
      '<div class="empty">' +
      '<div class="empty__icon">' + icon + '</div>' +
      '<div class="empty__title">' + e(title) + '</div>' +
      '<p>' + e(text) + '</p>' +
      (actionHtml || '') +
      '</div>'
    );
  }

  // --- Сводка ---

  function partnerRow(p) {
    var self = State.get().member;
    var isMe = self && p.id === self.id;
    var balance = Number(p.balance) || 0;
    var balanceHtml;
    if (Math.abs(balance) < 1) {
      balanceHtml = '<span class="amount muted">' + e(T('в расчёте')) + '</span>';
    } else {
      var cls = balance > 0 ? 'amount amount--pos' : 'amount amount--neg';
      balanceHtml = '<span class="' + cls + '">' + e(balance > 0 ? T('вернуть ') : T('должен ')) + e(money(Math.abs(balance))) + '</span>';
    }
    return (
      '<div class="partner">' +
      '<span class="avatar">' + initLetter(p.name) + '</span>' +
      '<div class="partner__body">' +
      '<div class="partner__name">' + e(p.name) + (isMe ? e(T(' · вы')) : '') + '</div>' +
      '<div class="partner__meta"><span>' + e(T('Общее: {amount}', { amount: money(p.paid_shared) })) + '</span><span>' +
      e(T('Доля: {amount}', { amount: money(p.share) })) + '</span></div>' +
      '</div>' +
      balanceHtml +
      '</div>'
    );
  }

  // Строка категории на сводке: тап раскрывает записи месяца прямо под ней.
  // expanded — множитель, если категория открыта (записи берутся из кэша месяца).
  function categoryRow(c, expanded) {
    var plan = Number(c.plan) || 0;
    var fact = Number(c.fact) || 0;
    var pct = plan > 0 ? Math.round((fact / plan) * 100) : 0;
    var over = plan > 0 && fact > plan;
    var barCls = over ? ' progress__bar--over' : pct >= 85 ? ' progress__bar--warn' : '';
    var open = !!expanded;
    // Строки держим в DOM всегда: CSS-переход срабатывает только на уже существующих узлах,
    // а видимость переключается классом cat-wrap--open.
    // Строки из кэша месяца: благодаря им анимация играет на уже существующих узлах.
    var st = State.get();
    var cacheKey = 'txCache:' + st.month;
    var cachedRows = (st[cacheKey] && st[cacheKey].data) || [];
    var rows = expanded && expanded.rows
      ? expanded.rows
      : cachedRows.filter(function (t) { return t.category_id === c.id; });
    return (
      '<div class="cat-wrap' + (open ? ' cat-wrap--open' : '') + '" data-cat-id="' + e(c.id) + '">' +
      '<button type="button" class="cat" data-action="toggle-cat" data-id="' + e(c.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<div class="cat__top">' +
      '<span class="cat__icon">' + e(c.icon || '🏷️') + '</span>' +
      '<span class="cat__name">' + e(c.name) + '</span>' +
      '<span class="cat__fact' + (over ? ' cat__fact--over' : '') + '">' + e(money(fact)) + '</span>' +
      '<span class="cat__chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>' +
      '</div>' +
      (plan > 0
        ? '<div class="progress"><div class="progress__bar' + barCls + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
          '<div class="cat__meta"><span>' + e(T('из {amount}', { amount: money(plan) })) + '</span><span class="' + (over ? 'amount--neg' : '') + '">' + pct + '%</span></div>'
        : '<div class="cat__meta"><span>' + e(T('без лимита')) + '</span></div>') +
      '</button>' +
      '<div class="cat-tx"><div class="cat-tx__inner">' +
      '<div class="cat-tx__rows" data-count="' + rows.length + '">' + categoryTxList(rows, open) + '</div>' +
      '<button type="button" class="btn btn--sm btn--primary cat-tx__add" data-action="add-in-cat" data-id="' + e(c.id) + '">' +
      e(T('+ Добавить в «{name}»', { name: c.name })) + '</button>' +
      '</div></div>' +
      '</div>'
    );
  }

  // Записи категории для раскрытого списка. Используется и при полной
  // перерисовке, и при точечном обновлении уже открытой категории.
  function categoryTxList(rows, open) {
    rows = rows || [];
    return rows.length
      ? rows.slice(0, 50).map(function (t) { return categoryTxRow(t); }).join('')
      : (open ? '<div class="cat-tx__empty">' + e(T('Записей за этот месяц нет')) + '</div>' : '');
  }

  // Запись внутри раскрытой категории: дата, заметка/автор, сумма.
  function categoryTxRow(t) {
    var isIncome = t.categories && t.categories.kind === 'income';
    var meta = [];
    if (t.note) meta.push(e(t.note));
    if (t.members && t.members.name && (!State.get().member || t.member_id !== State.get().member.id)) {
      meta.push(e(t.members.name));
    }
    return '<div class="cat-tx__row">' +
      '<span class="cat-tx__date">' + e(Fmt.dayLabel(t.occurred_on)) + '</span>' +
      '<span class="cat-tx__note">' + (meta.length ? meta.join(' · ') : '—') + '</span>' +
      '<span class="amount ' + (isIncome ? 'amount--pos' : '') + '">' + e(Fmt.signedMoney(t.amount, isIncome)) + '</span>' +
      '</div>';
  }

  // Краткая строка о планах на сводке: показываем только если что-то заведено.
  function plansTeaser(plans) {
    if (!plans) return '';
    var goals = (plans.goals || []).length;
    var debts = (plans.debts || []).filter(function (d) { return Number(d.remaining) > 0; }).length;
    var wishes = (plans.wishes || []).filter(function (w) { return !w.purchased; }).length;
    if (!goals && !debts && !wishes) return '';
    var parts = [];
    if (goals) parts.push(T('Цели: {n}', { n: goals }));
    if (debts) parts.push(T('Долги: {n}', { n: debts }));
    if (wishes) parts.push(T('Желания: {n}', { n: wishes }));
    return '<button type="button" class="plans-teaser" data-action="go-plans">' +
      '<span class="plans-teaser__title">' + e(T('📈 Планы')) + '</span>' +
      '<span class="plans-teaser__meta">' + e(parts.join(' · ')) + ' ›</span></button>';
  }

  // Ближайший повторяющийся платёж: за день до даты и в сам день — баннер сверху.
  // Показываем только первый, остальные — в «Планы → Платежи».
  // Крестик скрывает баннер до конца дня (State.dismissDue).
  function dueBanner(plans) {
    if (State.isDueDismissed()) return '';
    var list = (plans && plans.recurring) || [];
    var now = new Date();
    var today = now.getDate();
    var monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var soon = list.filter(function (r) { return r.active !== false; }).map(function (r) {
      var day = Math.min(Number(r.day_of_month) || 1, monthDays);
      return { r: r, day: day, diff: day - today };
    }).filter(function (x) { return x.diff === 0 || x.diff === 1; })
      .sort(function (a, b) { return a.diff - b.diff; });
    if (!soon.length) return '';
    var x = soon[0];
    var more = soon.length - 1;
    var when = T(x.diff === 0 ? 'Сегодня платёж' : 'Завтра платёж');
    return '<div class="due">' +
      '<button type="button" class="due__main" data-action="go-recurring">' +
      '<span class="due__icon">🔔</span>' +
      '<span class="due__body">' +
      '<span class="due__title">' + e(when) + ': ' + e(x.r.name) + ' · ' + e(money(x.r.amount)) + '</span>' +
      '<span class="due__hint">' + (more > 0 ? e(T('и ещё {n} · ', { n: more })) : '') + e(T('отметить оплату ›')) + '</span>' +
      '</span>' +
      '</button>' +
      '<button type="button" class="due__close" data-action="dismiss-due" aria-label="' + e(T('Скрыть напоминание')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '</div>';
  }

  // Ближайшие регулярные платежи, которые ещё не отмечены оплатой.
  // Отметка оплаты создаёт транзакцию с тем же названием и суммой.
  function upcomingRecurring(plans, today, daysInMonth) {
    var st = State.get();
    var cache = st['txCache:' + st.month];
    var tx = (cache && cache.data) || [];
    var total = 0;
    var count = 0;
    ((plans && plans.recurring) || []).forEach(function (r) {
      if (r.active === false) return;
      var day = Math.min(Number(r.day_of_month) || 1, daysInMonth);
      if (day < today) return;
      var name = String(r.name || '').trim().toLowerCase();
      var amount = Number(r.amount) || 0;
      var paid = tx.some(function (t) {
        return name &&
          String(t.note || '').trim().toLowerCase() === name &&
          Math.abs(Number(t.amount) - amount) < 0.005;
      });
      if (paid) return;
      total += amount;
      count++;
    });
    return { total: total, count: count };
  }

  // Прогноз расходов на конец текущего месяца: текущий темп + будущие
  // регулярные платежи. Дневной лимит — сколько можно тратить, чтобы
  // уложиться в доходы после обязательных платежей.
  function forecastCard(s, plans) {
    var st = State.get();
    if (st.month !== Fmt.currentMonth()) return '';
    s = s || {};
    var income = Number(s.income) || 0;
    var expense = Number(s.expense) || 0;

    var now = new Date();
    var day = now.getDate();
    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var daysLeft = daysInMonth - day + 1;
    var afterToday = daysInMonth - day;
    var avgDaily = expense / Math.max(day, 1);
    var upcoming = upcomingRecurring(plans, day, daysInMonth);
    if (!income && !expense && !upcoming.total) return '';
    var forecastExpense = Math.round(expense + avgDaily * afterToday + upcoming.total);
    var overspend = income > 0 && forecastExpense > income;
    var free = income - expense - upcoming.total;
    var overBudget = income > 0 && free < 0;
    var perDay = income > 0 ? Math.round(free / daysLeft) : null;

    var dateLabel = Fmt.dayMonth(daysInMonth, now.getMonth());
    var hint = T('Осталось {days}', { days: P('days', daysLeft) });
    if (upcoming.count) hint += ' · ' + T('с учётом платежей');
    var dailyHtml;
    if (income > 0) {
      dailyHtml = '<span class="forecast__daily-value' + (perDay < 0 ? ' amount--neg' : '') + '">' +
        e(money(Math.max(0, perDay))) + '<small>' + e(T('/день')) + '</small></span>';
      if (overBudget) {
        hint = T('Доходы уже превышены на {amount} · осталось {days}', {
          amount: money(-free),
          days: P('days', daysLeft),
        });
      }
    } else {
      dailyHtml = '<span class="forecast__daily-value muted">—</span>';
      hint = T('Добавьте доход, чтобы рассчитать дневной лимит');
    }

    return '<div class="forecast">' +
      '<div class="forecast__head">' +
      '<span class="forecast__label">' + e(T('Прогноз расходов к {date}', { date: dateLabel })) + '</span>' +
      '<span class="forecast__value' + (overspend ? ' amount--neg' : '') + '">' + e(money(forecastExpense)) + '</span>' +
      '</div>' +
      '<div class="forecast__daily">' +
      '<span class="forecast__daily-label">' + e(T('Можно тратить')) + '</span>' +
      dailyHtml +
      '</div>' +
      '<div class="forecast__hint' + (overBudget ? ' forecast__hint--warn' : '') + '">' + e(hint) + '</div>' +
      '</div>';
  }

  function balanceTrendSvg(transactions, month) {
    if (!Array.isArray(transactions)) return '';
    var ym = String(month || Fmt.currentMonth()).slice(0, 7);
    var parts = ym.split('-');
    var year = Number(parts[0]);
    var monthNumber = Number(parts[1]);
    if (!year || monthNumber < 1 || monthNumber > 12) return '';

    var monthDays = new Date(year, monthNumber, 0).getDate();
    var daysToPlot = ym === Fmt.currentMonth()
      ? Math.min(monthDays, Math.max(1, Number(Fmt.todayIso().slice(8, 10)) || monthDays))
      : monthDays;
    var dailyNet = [];
    for (var i = 0; i < daysToPlot; i++) dailyNet.push(0);

    transactions.forEach(function (t) {
      var date = String(t.occurred_on || '').slice(0, 10);
      if (date.slice(0, 7) !== ym) return;
      var day = Number(date.slice(8, 10));
      if (!day || day > daysToPlot) return;
      var amount = Number(t.amount);
      if (!isFinite(amount)) return;
      var kind = t.categories && t.categories.kind;
      if (kind === 'income') dailyNet[day - 1] += Math.abs(amount);
      else if (kind === 'expense') dailyNet[day - 1] -= Math.abs(amount);
    });

    var running = 0;
    var values = [0];
    dailyNet.forEach(function (net) {
      running += net;
      values.push(running);
    });

    var low = values[0];
    var high = values[0];
    values.forEach(function (value) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    });
    var spread = high - low;
    var points = values.map(function (value, index) {
      var x = index / (values.length - 1) * 360;
      var y = spread > 0 ? 72 - (value - low) / spread * 52 : 46;
      return { x: x.toFixed(2), y: y.toFixed(2) };
    });
    var line = points.map(function (point, index) {
      return (index ? 'L' : 'M') + point.x + ' ' + point.y;
    }).join(' ');
    var fill = 'M' + points[0].x + ' 90 ' +
      points.map(function (point) { return 'L' + point.x + ' ' + point.y; }).join(' ') +
      ' L' + points[points.length - 1].x + ' 90 Z';

    return '<svg class="hero__graph" viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="hero__graph-fill" d="' + fill + '"/>' +
      '<path class="hero__graph-line" d="' + line + '"/>' +
      '</svg>';
  }

  function renderQuickActions(page) {
    var actionPages = [
      [
        { id: 'expense', label: 'Расход', tone: 'green', icon: '<path d="M12 4v15m-6-6 6 6 6-6"/>' },
        { id: 'income', label: 'Доход', tone: 'mint', icon: '<path d="M12 20V5m-6 6 6-6 6 6"/>' },
        { id: 'recurring-new', label: 'Новый платёж', tone: 'amber', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 14v4m-2-2h4"/>' },
        { id: 'goal-new', label: 'Новая цель', tone: 'violet', icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m15 9 5-5"/>' },
        { id: 'debt-new', label: 'Новый долг', tone: 'blue', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>' },
        { id: 'wish-new', label: 'Новое желание', tone: 'pink', icon: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>' },
      ],
      [
        { id: 'transactions', label: 'Все траты', tone: 'blue', icon: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>' },
        { id: 'plans', label: 'Планы', tone: 'violet', icon: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>' },
        { id: 'recurring-list', label: 'Платежи', tone: 'amber', icon: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/>' },
        { id: 'expense-category', label: 'Категория расхода', tone: 'green', icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
        { id: 'income-category', label: 'Категория дохода', tone: 'mint', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10m-5-5h10"/>' },
        { id: 'settings', label: 'Ещё', tone: 'pink', icon: '<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>' },
      ],
    ];
    page = Math.max(0, Math.min(actionPages.length - 1, Number(page) || 0));
    // Все страницы лежат в одной ленте и сдвигаются по X: так работает свайп.
    return '<div class="quick-actions" data-page="' + page + '">' +
      '<div class="quick-actions__head">' +
      '<div class="sheet__title">' + e(T('Быстрые действия')) + '</div>' +
      '<button type="button" class="quick-actions__close" data-sheet-close aria-label="' + e(T('Закрыть')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>' +
      '</div>' +
      '<div class="quick-actions__view">' +
      '<div class="quick-actions__track" style="transform:translateX(' + (-100 * page) + '%)">' +
      actionPages.map(function (actions, index) {
        return '<div class="quick-actions__page"' + (index === page ? '' : ' inert') + '>' +
          '<div class="quick-actions__grid">' + actions.map(function (a) {
            return '<button type="button" class="quick-action" data-action="quick-action" data-quick="' + e(a.id) + '">' +
              '<span class="quick-action__icon quick-action__icon--' + e(a.tone) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + a.icon + '</svg></span>' +
              '<span class="quick-action__label">' + e(T(a.label)) + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') +
      '</div></div>' +
      '<div class="quick-actions__pagination" role="tablist" aria-label="' + e(T('Страницы быстрых действий')) + '">' +
      actionPages.map(function (_, index) {
        var active = index === page;
        return '<button type="button" class="quick-actions__dot' + (active ? ' quick-actions__dot--active' : '') +
          '" data-action="quick-actions-page" data-page="' + index + '" role="tab" aria-selected="' + active +
          '" aria-label="' + e(T('Страница {n}', { n: index + 1 })) + '"><span></span></button>';
      }).join('') + '</div></div>';
  }

  // expandedCat: { id, rows } — раскрытая категория и её записи за месяц.
  function renderSummary(s, plans, expandedCat, transactions, categoryView) {
    var st = State.get();
    s = s || { income: 0, expense: 0, balance: 0, categories: [], members: [] };
    plans = plans || st.plans;
    var viewMode = categoryView === 'list' ? 'list' : 'grid';
    var viewLabel = viewMode === 'grid' ? T('Показать списком') : T('Показать сеткой');
    var viewIcon = viewMode === 'grid'
      ? '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
      : '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
    var balance = Number(s.balance) || 0;
    var solo = State.isSolo();
    var partners = !solo && s.members && s.members.length
      ? '<div class="card">' + s.members.map(partnerRow).join('') +
        '<div class="small muted mt-8">' + e(T('Как делим: {mode}', { mode: T(State.splitModeLabel()) })) + '</div></div>'
      : '';
    var cats = s.categories && s.categories.length
      ? s.categories.map(function (c) {
          return categoryRow(c, expandedCat && expandedCat.id === c.id ? expandedCat : null);
        }).join('')
      : '<div class="empty">' + e(T('Категорий пока нет')) + '</div>';
    var cover = root.Covers ? Covers.current() : null;
    return (
      dueBanner(plans) +
      monthNav(st.month) +
      '<div class="hero' + (cover ? ' hero--cover' + (cover.tone === 'light' ? ' hero--cover--light' : '') : '') + '"' +
      (cover ? ' style="background-image:url(\'' + e(cover.file) + '\')"' : '') + '>' +
      balanceTrendSvg(transactions, st.month) +
      '<button type="button" class="hero__link" data-action="go-tx">' + e(T('Все траты →')) + '</button>' +
      '<div class="hero__label">' + e(T('Остаток за месяц')) + '</div>' +
      '<div class="hero__balance' + (balance < 0 ? ' hero__balance--negative' : '') + '">' + e(money(balance)) + '</div>' +
      '<div class="hero__row">' +
      '<div class="hero__item"><span class="hero__item-label">' + e(T('Доходы')) + '</span><span class="hero__item-value">' + e(money(s.income)) + '</span></div>' +
      '<div class="hero__item"><span class="hero__item-label">' + e(T('Расходы')) + '</span><span class="hero__item-value">' + e(money(s.expense)) + '</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="section categories-section"><div class="section__head categories-section__head"><span class="section__title">' + e(T('Категории')) + '</span>' +
      '<button type="button" class="categories-view-toggle" data-action="toggle-category-view" data-view="' + (viewMode === 'grid' ? 'list' : 'grid') +
      '" aria-label="' + e(viewLabel) + '" aria-pressed="' + (viewMode === 'list') + '" title="' + e(viewLabel) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + viewIcon + '</svg></button></div>' +
      '<div class="card categories--' + viewMode + '">' + cats + '</div></div>' +
      forecastCard(s, plans) +
      plansTeaser(plans) +
      (partners ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Между партнёрами')) + '</span></div>' + partners + '</div>' : '')
    );
  }

  // --- Траты ---

  function txRow(t) {
    var c = t.categories || {};
    var isIncome = c.kind === 'income';
    var meta = [];
    if (t.note) meta.push('<span class="tx__note">' + e(t.note) + '</span>');
    var me = State.get().member;
    if (me && t.member_id !== me.id && t.members && t.members.name) meta.push(e(t.members.name));
    if (!isIncome && t.is_shared) meta.push('<span class="badge">' + e(T('общий')) + '</span>');
    if (!meta.length) meta.push('<span class="tx__note">' + e(Fmt.dayLabel(t.occurred_on)) + '</span>');
    return (
      '<div class="tx" data-tx-id="' + e(t.id) + '">' +
      '<div class="tx__row" data-tx-row>' +
      '<span class="cat__icon">' + e(c.icon || '🏷️') + '</span>' +
      '<div class="tx__body">' +
      '<div class="tx__head"><button type="button" class="tx__name tx__name--link" data-cat-link="' + e(t.category_id) + '">' +
      e(c.name || T('Без категории')) +
      (t._local ? ' <span class="badge">' + e(T('отправляется')) + '</span>' : '') + '</button>' +
      '<span class="amount ' + (isIncome ? 'amount--pos' : '') + '">' + e(Fmt.signedMoney(t.amount, isIncome)) + '</span></div>' +
      (meta.length ? '<div class="tx__meta"><span class="tx__meta-inline">' + meta.join('<span>·</span>') + '</span></div>' : '') +
      '</div>' +
      '<button type="button" class="tx__more" data-tx-more="' + e(t.id) + '" aria-label="' + e(T('Действия с записью')) + '">···</button>' +
      '<button type="button" class="tx__delete-inline" data-tx-delete="' + e(t.id) + '">' + e(T('Удалить')) + '</button>' +
      '</div>' +
      '</div>'
    );
  }

  function groupByDay(list) {
    var groups = [];
    var current = null;
    list.forEach(function (t) {
      var day = String(t.occurred_on || '').slice(0, 10);
      if (!current || current.day !== day) {
        current = { day: day, items: [] };
        groups.push(current);
      }
      current.items.push(t);
    });
    return groups;
  }

  function filterTx(list, filter) {
    var f = filter || {};
    var q = String(f.q || '').trim().toLowerCase();
    var parts = q ? q.split(/\s+/) : [];
    return (list || []).filter(function (t) {
      if (f.category_id && t.category_id !== f.category_id) return false;
      if (f.member_id && t.member_id !== f.member_id) return false;
      if (!parts.length) return true;
      var hay = (String(t.note || '') + ' ' +
        String((t.categories && t.categories.name) || '') + ' ' +
        String((t.members && t.members.name) || '')).toLowerCase();
      return parts.every(function (part) { return hay.indexOf(part) !== -1; });
    });
  }

  function txFilterActive(filter) {
    var f = filter || {};
    return !!(f.category_id || f.member_id || String(f.q || '').trim());
  }

  // Участники и категории для фильтров берутся из загруженного месяца,
  // а активный фильтр добавляется, даже если записей по нему уже нет.
  function txFilterOptions(all, filter) {
    var st = State.get();
    var f = filter || {};
    var members = [];
    var cats = [];
    var seenM = {};
    var seenC = {};
    (all || []).forEach(function (t) {
      if (t.member_id && !seenM[t.member_id]) {
        seenM[t.member_id] = true;
        members.push({ id: t.member_id, name: (t.members && t.members.name) || T('Участник') });
      }
      if (t.category_id && !seenC[t.category_id]) {
        seenC[t.category_id] = true;
        cats.push({
          id: t.category_id,
          name: (t.categories && t.categories.name) || T('Без категории'),
          icon: (t.categories && t.categories.icon) || '🏷️',
        });
      }
    });
    if (f.member_id && !seenM[f.member_id]) {
      var sm = ((st.lastSummary && st.lastSummary.members) || []).find(function (m) { return m.id === f.member_id; });
      members.push({ id: f.member_id, name: sm ? sm.name : T('Участник') });
    }
    if (f.category_id && !seenC[f.category_id]) {
      var sc = (st.categories || []).find(function (c) { return c.id === f.category_id; });
      if (!sc && st.lastSummary) {
        sc = (st.lastSummary.categories || []).find(function (c) { return c.id === f.category_id; });
      }
      cats.push({ id: f.category_id, name: sc ? sc.name : T('Категория'), icon: (sc && sc.icon) || '🏷️' });
    }
    cats.sort(function (a, b) { return a.name.localeCompare(b.name, I18n.locale()); });
    return { members: members, categories: cats };
  }

  function txSelect(label, attr, current, options, allLabel) {
    if (!options.length || (options.length === 1 && !current)) return '';
    return '<label class="tx-filter"><span class="tx-filter__label">' + e(label) + '</span>' +
      '<select class="tx-filter__select" ' + attr + '>' +
      '<option value="">' + e(allLabel) + '</option>' +
      options.map(function (o) {
        return '<option value="' + e(o.id) + '"' + (current === o.id ? ' selected' : '') + '>' +
          (o.icon ? e(o.icon) + ' ' : '') + e(o.name) + '</option>';
      }).join('') +
      '</select></label>';
  }

  function txControls(all, filter) {
    var f = filter || {};
    var opts = txFilterOptions(all, f);
    var q = String(f.q || '');
    var selects = txSelect(T('Кто'), 'data-tx-member', f.member_id || '', opts.members, T('Все')) +
      txSelect(T('Категория'), 'data-tx-category', f.category_id || '', opts.categories, T('Все'));
    return '<div class="tx-search-row">' +
      '<div class="tx-search">' +
      '<span class="tx-search__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg></span>' +
      '<input id="tx-search" class="tx-search__input" type="search" autocomplete="off" enterkeyhint="search" ' +
      'placeholder="' + e(T('Заметка, категория')) + '" aria-label="' + e(T('Поиск по тратам')) + '" value="' + e(q) + '">' +
      '<button type="button" class="tx-search__clear" data-action="tx-search-clear" aria-label="' + e(T('Очистить поиск')) + '"' +
      (q ? '' : ' hidden') + '>&times;</button>' +
      '</div>' +
      '<button type="button" class="tx-analytics" data-action="go-analytics" aria-label="' + e(T('Открыть аналитику')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>' +
      '<span>' + e(T('Аналитика')) + '</span></button>' +
      '</div>' +
      (selects ? '<div class="tx-filters">' + selects + '</div>' : '');
  }

  function txResults(all, filter) {
    var st = State.get();
    var f = filter || {};
    var list = reconcileList(filterTx(all, f)).filter(function (t) {
      return !(root.AppState && root.AppState.isDeleting(t.id));
    });
    var active = txFilterActive(f);
    if (!list.length) {
      return active
        ? empty('🔍', T('Ничего не найдено'), T('Попробуйте изменить запрос или сбросить фильтры.'),
            '<button type="button" class="btn" data-action="tx-clear-filter">' + e(T('Сбросить фильтры')) + '</button>')
        : empty('🧾', T('Записей нет'), T('За {month} пока ничего не записано.', { month: Fmt.monthTitle(st.month) }),
            '<button type="button" class="btn btn--primary" data-action="go-add">' + e(T('Добавить запись')) + '</button>');
    }
    var count = '<div class="tx-count"><span>' + e(T('Найдено: {records}', { records: P('records', list.length) })) + '</span>' +
      '<button type="button" class="tx-count__reset" data-action="tx-clear-filter">' + e(T('Сбросить')) + '</button></div>';
    return (active ? count : '') +
      groupByDay(list).map(function (g) {
        return '<div class="tx-group"><div class="tx-group__title">' + e(Fmt.dayLabel(g.day)) + '</div>' + g.items.map(txRow).join('') + '</div>';
      }).join('');
  }

  function renderTxList(all, filter) {
    var st = State.get();
    var pending = (root.Queue && Queue.size()) ? '<div class="sync-note">' + e(T('Изменения отправятся, когда появится связь')) + '</div>' : '';
    return monthNav(st.month) + pending + txControls(all, filter) +
      '<div id="tx-results">' + txResults(all, filter) + '</div>';
  }

  // --- Форма добавления ---

  function renderForm(opts) {
    var st = State.get();
    var amount = opts.amount || '';
    var note = opts.note || '';
    var date = opts.date || Fmt.todayIso();
    var kind = opts.kind || 'expense';
    var isShared = opts.is_shared !== false;
    var cid = opts.category_id || '';
    var list = (st.categories || []).filter(function (c) { return c.kind === kind; });
    var chips = list.length
      ? list.map(function (c) {
          return '<button type="button" class="cat-chip' + (c.id === cid ? ' cat-chip--active' : '') + '" data-action="pick-cat" data-id="' + e(c.id) + '">' +
            '<span class="cat-chip__icon">' + e(c.icon || '🏷️') + '</span><span>' + e(c.name) + '</span></button>';
        }).join('')
      : '<div class="muted small">' + e(T('Нет категорий — обновите приложение')) + '</div>';
    return (
      '<form data-form="add" novalidate>' +
      '<div class="segments" role="tablist">' +
      '<button type="button" class="segment' + (kind === 'expense' ? ' segment--active' : '') + '" data-action="pick-kind" data-kind="expense">' + e(T('Расход')) + '</button>' +
      '<button type="button" class="segment' + (kind === 'income' ? ' segment--active' : '') + '" data-action="pick-kind" data-kind="income">' + e(T('Доход')) + '</button>' +
      '</div>' +
      '<label class="field"><span class="field__label">' + e(T('Сумма')) + '</span>' +
      '<input class="input input--amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="' + e(Fmt.money(0)) + '" value="' + e(amount) + '" required></label>' +
      '<span class="field__label">' + e(T('Категория')) + '</span>' +
      '<div class="cat-grid">' + chips + '</div>' +
      '<label class="field"><span class="field__label">' + e(T('Заметка')) + '</span>' +
      '<input class="input" name="note" maxlength="200" autocomplete="off" placeholder="' + e(T('Например: пятерочка')) + '" value="' + e(note) + '"></label>' +
      (kind === 'expense'
        ? '<label class="switch-row"><span class="switch-row__text"><span class="switch-row__title">' + e(T('Общий расход')) + '</span>' +
          '<span class="switch-row__hint">' + e(T('Делим между партнёрами')) + '</span></span>' +
          '<span class="switch"><input type="checkbox" name="is_shared"' + (isShared ? ' checked' : '') + '><span class="switch__track"></span></span></label>'
        : '') +
      '<label class="field mt-16"><span class="field__label">' + e(T('Дата')) + '</span>' +
      '<input class="input" type="date" name="occurred_on" max="' + Fmt.todayIso() + '" value="' + e(date) + '"></label>' +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T('Добавить')) + '</button></div>' +
      '</form>'
    );
  }

  // --- Планы: цели, долги, желания ---

  var PLANS_TABS = [
    { id: 'goals', label: 'Цели' },
    { id: 'debts', label: 'Долги' },
    { id: 'wishes', label: 'Желания' },
    { id: 'recurring', label: 'Платежи' },
  ];
  var PRIORITY = { high: 'высокий', medium: 'средний', low: 'низкий' };

  function monthsLeft(remaining, monthly) {
    if (!(monthly > 0)) return '';
    var m = Math.ceil(remaining / monthly);
    return ' · ~' + P('months', m);
  }

  function goalRow(g) {
    var target = Number(g.target) || 0;
    var saved = Number(g.saved) || 0;
    var pct = target > 0 ? Math.round((saved / target) * 100) : 0;
    var left = Math.max(0, target - saved);
    var done = left < 0.01;
    return (
      '<div class="plan" data-plan="goal" data-id="' + e(g.id) + '">' +
      '<div class="plan__top"><span class="plan__name">' + e(g.name) + '</span>' +
      '<span class="plan__amount' + (done ? ' amount--pos' : '') + '">' + e(money(saved)) + ' / ' + e(money(target)) + '</span>' +
      '<button type="button" class="plan__more" data-plan-more>···</button></div>' +
      '<div class="progress"><div class="progress__bar' + (done ? ' progress__bar--done' : '') + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<div class="plan__meta">' +
      (done ? e(T('Готово! Подкоплено на цель')) :
        e(T('Осталось {amount}', { amount: money(left) })) +
        (Number(g.monthly) > 0 ? ' · ' + e(T('{amount}/мес', { amount: money(g.monthly) })) + monthsLeft(left, Number(g.monthly)) : '')) +
      '</div>' +
      '<div class="plan__actions"><button type="button" class="btn btn--sm btn--ghost" data-plan-add>' + e(T('+ Пополнить')) + '</button></div>' +
      '<div class="plan__confirm" hidden>' +
      '<div class="plan__confirm-row"><input class="input" inputmode="decimal" placeholder="' + e(T('Сумма')) + '" data-plan-amount>' +
      '<button type="button" class="btn btn--sm" data-plan-cancel>' + e(T('Отмена')) + '</button>' +
      '<button type="button" class="btn btn--sm btn--primary" data-plan-save>OK</button></div>' +
      '</div>' +
      '</div>'
    );
  }

  function debtRow(d) {
    var total = Number(d.total) || 0;
    var remaining = Number(d.remaining) || 0;
    var paid = Math.max(0, total - remaining);
    var pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    var closed = remaining <= 0;
    return (
      '<div class="plan" data-plan="debt" data-id="' + e(d.id) + '" data-remaining="' + remaining + '">' +
      '<div class="plan__top"><span class="plan__name">' + e(d.name) + (d.creditor ? ' · ' + e(d.creditor) : '') + '</span>' +
      '<span class="plan__amount' + (closed ? ' amount--pos' : '') + '">' + e(money(paid)) + ' / ' + e(money(total)) + '</span>' +
      '<button type="button" class="plan__more" data-plan-more>···</button></div>' +
      '<div class="progress"><div class="progress__bar' + (closed ? ' progress__bar--done' : '') + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<div class="plan__meta">' +
      (closed ? e(T('Долг закрыт 🎉')) :
        e(T('Осталось {amount}', { amount: money(remaining) })) +
        (Number(d.monthly) > 0 ? ' · ' + e(T('{amount}/мес', { amount: money(d.monthly) })) + monthsLeft(remaining, Number(d.monthly)) : '')) +
      '</div>' +
      (closed ? '' :
        '<div class="plan__actions">' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="1000">− 1 000</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="5000">− 5 000</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="all">' + e(T('Весь остаток')) + '</button>' +
        '</div>' +
        '<div class="plan__confirm" hidden>' +
        '<div class="plan__confirm-row"><input class="input" inputmode="decimal" placeholder="' + e(T('Сумма')) + '" data-plan-amount>' +
        '<button type="button" class="btn btn--sm" data-plan-cancel>' + e(T('Отмена')) + '</button>' +
        '<button type="button" class="btn btn--sm btn--primary" data-plan-save>OK</button></div>' +
        '</div>') +
      '</div>'
    );
  }

  function wishRow(w) {
    var cls = w.purchased ? ' plan--done' : '';
    return (
      '<div class="plan' + cls + '" data-plan="wish" data-id="' + e(w.id) + '">' +
      '<div class="plan__top"><span class="plan__name">' + e(w.name) + '</span>' +
      '<span class="plan__amount">' + e(money(w.price)) + '</span>' +
      '<button type="button" class="plan__more" data-plan-more>···</button></div>' +
      '<div class="plan__meta"><span class="badge">' +
      e(T('{priority} приоритет', { priority: T(PRIORITY[w.priority] || w.priority) })) + '</span>' +
      (w.purchased ? ' <span class="amount--pos">' + e(T('куплено')) + '</span>' : '') + '</div>' +
      (w.purchased ? '' : '<div class="plan__actions"><button type="button" class="btn btn--sm btn--ghost" data-wish-buy>' + e(T('Купить')) + '</button></div>') +
      '</div>'
    );
  }

  function recurringRow(r) {
    var cat = r.categories || {};
    return (
      '<div class="plan" data-recurring="' + e(r.id) + '">' +
      '<div class="plan__top">' +
      '<span class="cat__icon">' + e(cat.icon || '🔁') + '</span>' +
      '<span class="plan__name">' + e(r.name) + '</span>' +
      '<span class="plan__amount">' + e(money(r.amount)) + '</span>' +
      '<button type="button" class="plan__more" data-recurring-more>···</button></div>' +
      '<div class="plan__meta">' + e(T('День {day} · {category}', {
        day: r.day_of_month,
        category: cat.name || T('без категории'),
      })) + '</div>' +
      '<div class="plan__actions">' +
      '<button type="button" class="btn btn--sm btn--ghost" data-recurring-pay>' + e(T('Отметить оплату')) + '</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-recurring-edit>' + e(T('Изменить')) + '</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPlans(plans, tab) {
    plans = plans || { goals: [], debts: [], wishes: [] };
    tab = tab || 'goals';
    var list = plans[tab] || [];
    var body;
    if (!list.length) {
      var titles = {
        goals: ['🎯', T('Целей пока нет'), T('Например, отпуск или новая техника')],
        debts: ['💳', T('Долгов нет'), T('Отлично!')],
        wishes: ['✨', T('Список желаний пуст'), T('Добавьте то, что хочется купить')],
        recurring: ['🔁', T('Платежей пока нет'), T('Аренда, подписки, кредиты — напомним накануне')],
      };
      var t = titles[tab];
      body = '<div class="empty"><div class="empty__icon">' + t[0] + '</div><div class="empty__title">' + e(t[1]) + '</div><p>' + e(t[2]) + '</p>' +
        '<button type="button" class="btn btn--primary" data-action="plan-add" data-kind="' + tab + '">' + e(T('Добавить')) + '</button></div>';
    } else {
      var row = { goals: goalRow, debts: debtRow, wishes: wishRow, recurring: recurringRow }[tab];
      body = list.map(row).join('');
    }
    return (
      '<div class="segments">' +
      PLANS_TABS.map(function (t) {
        return '<button type="button" class="segment' + (t.id === tab ? ' segment--active' : '') + '" data-action="plans-tab" data-plans="' + t.id + '">' + e(T(t.label)) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="plans">' + body + '</div>' +
      (list.length ? '<div class="actions"><button type="button" class="btn btn--primary btn--full" data-action="plan-add" data-kind="' + tab + '">' + e(T('Добавить')) + '</button></div>' : '')
    );
  }

  // c === null — создание новой категории.
  function renderCategoryForm(c) {
    if (!c) {
      return (
        '<form data-form="category" novalidate>' +
        '<div class="sheet__title">' + e(T('Новая категория')) + '</div>' +
        '<div class="segments">' +
        '<button type="button" class="segment segment--active" data-action="cat-kind" data-kind="expense">' + e(T('Расход')) + '</button>' +
        '<button type="button" class="segment" data-action="cat-kind" data-kind="income">' + e(T('Доход')) + '</button>' +
        '</div>' +
        '<label class="field"><span class="field__label">' + e(T('Название')) + '</span>' +
        '<input class="input" name="name" maxlength="40" placeholder="' + e(T('Например: Дети')) + '" autocomplete="off"></label>' +
        '<label class="field"><span class="field__label">' + e(T('Иконка (эмодзи)')) + '</span>' +
        '<input class="input input--center" name="icon" maxlength="8" value="🏷️"></label>' +
        '<label class="field"><span class="field__label">' + e(T('Лимит на месяц')) + '</span>' +
        '<input class="input" name="plan" inputmode="decimal" placeholder="' + e(Fmt.money(0)) + '"></label>' +
        '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T('Добавить')) + '</button></div>' +
        '</form>'
      );
    }
    var kindTitle = c.kind === 'income' ? T('Доход') : T('Расход');
    return (
      '<form data-form="category" data-id="' + e(c.id) + '" novalidate>' +
      '<div class="sheet__title">' + e(c.icon || '🏷️') + ' ' + e(c.name) + ' · ' + e(kindTitle) + '</div>' +
      '<label class="field"><span class="field__label">' + e(T('Лимит на месяц')) + '</span>' +
      '<input class="input input--amount" name="plan" inputmode="decimal" placeholder="' + e(Fmt.money(0)) + '" value="' +
        (Number(c.plan_monthly) > 0 ? e(String(Number(c.plan_monthly))) : '') + '"></label>' +
      '<p class="small muted">' + e(T('0 или пусто — без лимита. Сводка считает план/факт для каждого месяца.')) + '</p>' +
      '<label class="field mt-16"><span class="field__label">' + e(T('Название')) + '</span>' +
      '<input class="input" name="name" maxlength="40" value="' + e(c.name) + '"></label>' +
      '<label class="field"><span class="field__label">' + e(T('Иконка (эмодзи)')) + '</span>' +
      '<input class="input input--center" name="icon" maxlength="8" value="' + e(c.icon || '🏷️') + '"></label>' +
      '<div class="actions">' +
      '<button type="submit" class="btn btn--primary btn--full">' + e(T('Сохранить')) + '</button>' +
      '<button type="button" class="btn btn--danger btn--full mt-8" data-action="delete-cat" data-id="' + e(c.id) + '">' + e(T('Удалить категорию')) + '</button>' +
      '</div>' +
      '</form>'
    );
  }

  // Повторяющийся платёж: название, сумма, день месяца, категория.
  function renderRecurringForm(opts) {
    opts = opts || {};
    var cats = (State.get().categories || []).filter(function (c) { return c.kind === 'expense' && !c.archived; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    // Для правки категория приходит из вложенного объекта recurring_payments.categories.
    var byName = opts.categories && opts.categories.name
      ? (cats.find(function (c) { return c.name === opts.categories.name; }) || {}).id
      : null;
    var selected = opts.category_id || byName || null;
    return (
      '<form data-form="plan" data-kind="recurring"' + (opts.id ? ' data-id="' + e(opts.id) + '"' : '') + ' novalidate>' +
      '<div class="sheet__title">' + e(opts.id ? T('Изменить платёж') : T('Новый платёж')) + '</div>' +
      '<label class="field"><span class="field__label">' + e(T('Название')) + '</span>' +
      '<input class="input" name="name" maxlength="80" placeholder="' + e(T('Аренда, интернет…')) + '" value="' + e(opts.name || '') + '"></label>' +
      '<label class="field"><span class="field__label">' + e(T('Сумма')) + '</span>' +
      '<input class="input" name="amount" inputmode="decimal" placeholder="' + e(Fmt.money(0)) + '" value="' + e(opts.amount || '') + '"></label>' +
      '<label class="field"><span class="field__label">' + e(T('День месяца')) + '</span>' +
      '<input class="input input--center" name="day" inputmode="numeric" placeholder="5" value="' + e(opts.day || '') + '"></label>' +
      '<label class="field"><span class="field__label">' + e(T('Категория')) + '</span>' +
      '<select class="input" name="category_id">' + cats.map(function (c) {
        return '<option value="' + e(c.id) + '"' + (selected === c.id ? ' selected' : '') + '>' + e(c.icon || '🏷️') + ' ' + e(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<p class="small muted">' + e(T('Напомним за день до платежа. 31-е в коротком месяце сдвигаем на последний день.')) + '</p>' +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T('Сохранить')) + '</button></div>' +
      '</form>'
    );
  }

  // Форма добавления/редактирования в нижнем шите.
  function renderPlanForm(kind, opts) {
    opts = opts || {};
    var title = { goals: T('Новая цель'), debts: T('Новый долг'), wishes: T('Новое желание') }[kind] || T('Добавить');
    var idAttr = opts.id ? ' data-id="' + e(opts.id) + '"' : '';
    var name = '<label class="field"><span class="field__label">' + e(T('Название')) + '</span>' +
      '<input class="input" name="name" maxlength="80" placeholder="' + e(opts.name_placeholder ? T(opts.name_placeholder) : T('Название')) + '" value="' + e(opts.name || '') + '"></label>';
    var moneyField = function (nameKey, label, value) {
      return '<label class="field"><span class="field__label">' + e(T(label)) + '</span>' +
        '<input class="input" name="' + nameKey + '" inputmode="decimal" placeholder="' + e(Fmt.money(0)) + '" value="' + e(value || '') + '"></label>';
    };
    var fields = '', extra = '';
    if (kind === 'goals') {
      fields = moneyField('target', 'Сколько нужно', opts.target) + moneyField('saved', 'Уже накоплено (необязательно)', opts.saved) +
        moneyField('monthly', 'Откладывать в месяц (необязательно)', opts.monthly);
    } else if (kind === 'debts') {
      fields = moneyField('total', 'Сумма долга', opts.total) + moneyField('remaining', 'Осталось выплатить (по умолчанию — вся сумма)', opts.remaining) +
        moneyField('monthly', 'Платить в месяц (необязательно)', opts.monthly) +
        '<label class="field"><span class="field__label">' + e(T('Кому (необязательно)')) + '</span>' +
        '<input class="input" name="creditor" maxlength="80" placeholder="' + e(T('Банк, человек')) + '" value="' + e(opts.creditor || '') + '"></label>';
    } else if (kind === 'wishes') {
      fields = moneyField('price', 'Цена', opts.price);
      var goals = State.get().plans && State.get().plans.goals || [];
      extra = '<label class="field"><span class="field__label">' + e(T('Приоритет')) + '</span>' +
        '<select class="input" name="priority">' +
        ['high', 'medium', 'low'].map(function (p) {
          return '<option value="' + p + '"' + ((opts.priority || 'medium') === p ? ' selected' : '') + '>' + e(T(PRIORITY[p])) + '</option>';
        }).join('') + '</select></label>';
      if (goals.length) {
        extra += '<label class="field"><span class="field__label">' + e(T('Копим на цель (необязательно)')) + '</span>' +
          '<select class="input" name="goal_id"><option value="">' + e(T('— без цели —')) + '</option>' +
          goals.map(function (g) {
            return '<option value="' + e(g.id) + '"' + (opts.goal_id === g.id ? ' selected' : '') + '>' + e(g.name) + '</option>';
          }).join('') + '</select></label>';
      }
    }
    return (
      '<form data-form="plan" data-kind="' + e(kind) + '"' + idAttr + ' novalidate>' +
      '<div class="sheet__title">' + e(title) + '</div>' +
      name + fields + extra +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T('Сохранить')) + '</button></div>' +
      '</form>'
    );
  }

  // --- Настройки ---

  // Лимиты: полный список категорий с планом. Отдельный экран, чтобы сводку
  // можно было спокойно листать — там строки не реагируют на нажатие.
  function renderLimits() {
    var cats = (State.get().categories || []).filter(function (c) { return !c.archived; });
    var expenses = cats.filter(function (c) { return c.kind === 'expense'; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var incomes = cats.filter(function (c) { return c.kind === 'income'; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var totalPlan = expenses.reduce(function (s, c) { return s + (Number(c.plan_monthly) || 0); }, 0);

    function row(c) {
      var plan = Number(c.plan_monthly) || 0;
      return '<button type="button" class="limit" data-action="edit-cat" data-id="' + e(c.id) + '">' +
        '<span class="cat__icon">' + e(c.icon || '🏷️') + '</span>' +
        '<span class="limit__name">' + e(c.name) + '</span>' +
        '<span class="limit__value' + (plan > 0 ? '' : ' muted') + '">' + (plan > 0 ? e(money(plan)) : e(T('без лимита'))) + '</span>' +
        '<span class="limit__chev">›</span>' +
        '</button>';
    }

    return (
      '<div class="card limits-head"><span class="muted small">' + e(T('Расходы в месяц по плану')) + '</span>' +
      '<div class="limits-total">' + e(money(totalPlan)) + '</div></div>' +
      '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Расходы')) + '</span>' +
      '<button type="button" class="section__action" data-action="add-cat" data-kind="expense">' + e(T('+ Категория')) + '</button></div>' +
      '<div class="card limits">' + (expenses.length ? expenses.map(row).join('') : '<div class="empty">' + e(T('Категорий пока нет')) + '</div>') + '</div></div>' +
      '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Доходы')) + '</span>' +
      '<button type="button" class="section__action" data-action="add-cat" data-kind="income">' + e(T('+ Категория')) + '</button></div>' +
      '<div class="card limits">' + (incomes.length ? incomes.map(row).join('') : '<div class="empty">' + e(T('Категорий пока нет')) + '</div>') + '</div></div>' +
      '<p class="small muted mt-16">' + e(T('Лимит — это план на месяц. Сводка показывает, сколько уже потрачено из него.')) + '</p>'
    );
  }

  // Валюта влияет только на обозначение сумм; данные не конвертируются.
  function currencyCard() {
    var current = Fmt.currencyCode();
    var options = Fmt.currencyList.map(function (c) {
      return '<option value="' + e(c.code) + '"' + (c.code === current ? ' selected' : '') + '>' +
        e(c.symbol + ' — ' + T(c.name)) + '</option>';
    }).join('');
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Валюта')) + '</span></div>' +
      '<div class="card">' +
      '<label class="currency-row"><span class="currency-row__label">' + e(T('Обозначение')) + '</span>' +
      '<select class="currency-row__select" data-currency>' + options + '</select></label>' +
      '<p class="small muted mt-8">' + e(T('Меняется только символ в интерфейсе. Суммы и история не пересчитываются. Выбор сохраняется на этом устройстве.')) + '</p>' +
      '</div></div>';
  }

  function languageCard() {
    var current = I18n.locale();
    var options = I18n.locales.map(function (l) {
      return '<option value="' + e(l.code) + '"' + (l.code === current ? ' selected' : '') + '>' +
        e(l.name) + '</option>';
    }).join('');
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Язык')) + '</span></div>' +
      '<div class="card">' +
      '<label class="currency-row"><span class="currency-row__label">' + e(T('Язык интерфейса')) + '</span>' +
      '<select class="currency-row__select" data-locale>' + options + '</select></label>' +
      '<p class="small muted mt-8">' + e(T('Выбор сохраняется на этом устройстве.')) + '</p>' +
      '</div></div>';
  }

  function coverCard() {
    var current = root.Covers ? Covers.id() : 'default';
    var options = (root.Covers ? Covers.list : []).map(function (c) {
      var bg = c.file ? ' style="background-image:url(\'' + e(c.file) + '\')"' : '';
      var active = c.id === current;
      return '<button type="button" class="cover-option' + (active ? ' cover-option--active' : '') + '"' +
        ' data-action="pick-cover" data-cover="' + e(c.id) + '"' +
        ' aria-label="' + e(T(c.name)) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' + bg + '>' +
        '<span class="cover-option__name">' + e(T(c.name)) + '</span>' +
        (active ? '<span class="cover-option__check">✓</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Оформление')) + '</span></div>' +
      '<div class="card">' +
      '<div class="cover-label">' + e(T('Обложка главной карты')) + '</div>' +
      '<div class="cover-grid">' + options + '</div>' +
      '<p class="small muted mt-8">' + e(T('Применяется к карточке остатка на главной. Выбор сохраняется на этом устройстве.')) + '</p>' +
      '</div></div>';
  }

  // Уведомления в Telegram: платежи, лимиты, недельная сводка и ежедневный отчёт.
  function notificationsCard(notif) {
    notif = notif || {};
    var dailyOn = notif.daily === true;
    var dailyTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(notif.daily_time || '') ? notif.daily_time : '22:00';
    function toggle(key, title, hint) {
      return '<label class="switch-row"><span class="switch-row__text">' +
        '<span class="switch-row__title">' + e(title) + '</span>' +
        '<span class="switch-row__hint">' + e(hint) + '</span></span>' +
        '<span class="switch"><input type="checkbox" data-notif="' + key + '"' + (notif[key] ? ' checked' : '') + '>' +
        '<span class="switch__track"></span></span></label>';
    }
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Уведомления в Telegram')) + '</span></div>' +
      '<div class="card card--stack">' +
      toggle('payments', T('Напоминания о платежах'), T('За день до даты')) +
      toggle('limits', T('Лимиты категорий'), T('При 80 % и 100 % плана')) +
      toggle('digest', T('Итоги недели'), T('Воскресенье, вечером')) +
      toggle('daily', T('Присылать каждый день'), T('Траты за день и топ категорий')) +
      '<div class="daily-time" data-notif-time-wrap' + (dailyOn ? '' : ' hidden') + '>' +
      '<label class="daily-time__row">' +
      '<span class="daily-time__label">' + e(T('Время отчёта')) + '</span>' +
      '<input type="time" class="input daily-time__input" data-notif-time value="' + e(dailyTime) + '" step="300" aria-label="' + e(T('Время ежедневного отчёта')) + '">' +
      '</label>' +
      '<p class="small muted daily-time__hint">' + e(T('По времени телефона')) + '</p>' +
      '</div></div></div>';
  }

  // Баланс карты из банковских SMS: показывается, если бот его получил.
  function cardBalanceCard(h) {
    if (h.card_balance == null) return '';
    var when = '';
    if (h.card_balance_at) {
      var raw = String(h.card_balance_at);
      // Дата без времени уже локальная; timestamp переводим в локальный день.
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        when = Fmt.dayLabel(raw);
      } else {
        var at = new Date(h.card_balance_at);
        if (!isNaN(at.getTime())) when = Fmt.dayLabel(Fmt.isoDate(at));
      }
    }
    // «Сегодня»/«Вчера» в середине фразы пишем со строчной; остальные даты не трогаем.
    if (when === T('Сегодня') || when === T('Вчера')) {
      when = when.charAt(0).toLowerCase() + when.slice(1);
    }
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Карта')) + '</span></div>' +
      '<div class="card">' +
      '<div class="settings-row"><span class="settings-row__label">' + e(T('Баланс из SMS')) + '</span>' +
      '<span class="settings-row__value">' + e(money(h.card_balance)) + '</span></div>' +
      (when ? '<p class="small muted mt-8">' + e(T('Обновлён {date} · приходит из сообщений банка', { date: when })) + '</p>' : '') +
      '<button type="button" class="btn btn--sm btn--ghost mt-8" data-action="clear-balance">' + e(T('Сбросить')) + '</button>' +
      '</div></div>';
  }

  function limitsCard() {
    var cats = ((State.get().categories) || []).filter(function (c) { return c.kind === 'expense' && !c.archived; });
    var total = cats.reduce(function (s, c) { return s + (Number(c.plan_monthly) || 0); }, 0);
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Лимиты')) + '</span></div>' +
      '<button type="button" class="settings-row settings-row--link" data-action="go-limits">' +
      '<span class="settings-row__label">' + e(T('Лимиты по категориям')) + '</span>' +
      '<span class="settings-row__value">' + (total > 0 ? e(money(total)) + ' ›' : e(T('настроить ›'))) + '</span></button>' +
      '</div>';
  }

  // Документы и управление данными: ссылки на оферту/политику и удаление аккаунта.
  function legalCard(busy) {
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Документы и данные')) + '</span></div>' +
      '<div class="card">' +
      '<div class="settings-row"><a class="settings-row__label legal-link" href="legal/terms.html" target="_blank" rel="noopener">' + e(T('Условия использования')) + '</a><span class="settings-row__value">›</span></div>' +
      '<div class="settings-row"><a class="settings-row__label legal-link" href="legal/privacy.html" target="_blank" rel="noopener">' + e(T('Политика конфиденциальности')) + '</a><span class="settings-row__value">›</span></div>' +
      '<p class="small muted mt-8">' + e(T('Юридические документы доступны на русском языке.')) + '</p>' +
      '<p class="small muted mt-8">' + e(T('Удаление аккаунта удаляет семью, траты, цели и долги безвозвратно. История платежей сохраняется обезличенной по требованию закона.')) + '</p>' +
      '<button type="button" class="btn btn--sm btn--danger mt-8" data-action="delete-account"' + (busy ? ' disabled' : '') + '>' + e(T('Удалить аккаунт')) + '</button>' +
      '</div></div>';
  }

  // Тарифы за Telegram Stars: показываются, если сервер их прислал (нет в демо — не рисуем).
  function starsCard(tariffs, busy) {
    if (!tariffs || !tariffs.length) return '';
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Продлить за звёзды')) + '</span></div>' +
      '<div class="card">' +
      tariffs.map(function (t) {
        var perDay = new Intl.NumberFormat(I18n.locale(), { maximumFractionDigits: 1 }).format(t.stars / t.days);
        return '<div class="tariff"><div class="tariff__body"><div class="tariff__title">' + e(T(t.title)) + '</div>' +
          '<div class="tariff__meta">' + e(T('{days} дней · {rate} ⭐/день', { days: t.days, rate: perDay })) + '</div></div>' +
          '<button type="button" class="btn btn--sm btn--primary" data-action="buy" data-buy="' + e(t.code) + '"' + (busy ? ' disabled' : '') + '>' + t.stars + ' ⭐</button></div>';
      }).join('') +
      '<p class="small muted mt-8">' + e(T('Оплата проходит внутри Telegram. Продление начнётся после конца текущего доступа.')) + '</p>' +
      '</div></div>';
  }

  // Промокод: поле и список уже активированных.
  function promoCard(promo) {
    var active = (promo || []).map(function (p) {
      return '<div class="promo__used">✅ ' + e(p.code) + '</div>';
    }).join('');
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Промокод')) + '</span></div>' +
      '<div class="card">' +
      '<form data-form="promo" novalidate class="promo">' +
      '<input class="input input--code" name="code" maxlength="32" autocomplete="off" placeholder="' + e(T('код друга')) + '" value="">' +
      '<button type="submit" class="btn btn--sm btn--primary">' + e(T('Активировать')) + '</button>' +
      '</form>' +
      '<p class="small muted mt-8">' + e(T('Код продлевает доступ к бюджету. Один код — одна активация на семью.')) + '</p>' +
      active +
      '</div></div>';
  }

  // --- Аналитика: месяцы года и динамика категорий ---

  function analyticsBars(data) {
    var max = 0;
    (data || []).forEach(function (d) {
      var s = d.summary || {};
      max = Math.max(max, Number(s.income) || 0, Number(s.expense) || 0);
    });
    var H = 84;
    return '<div class="analytics-bars">' + (data || []).map(function (d) {
      var s = d.summary || {};
      var income = Number(s.income) || 0;
      var expense = Number(s.expense) || 0;
      var hI = income > 0 ? Math.max(2, Math.round((income / max) * H)) : 0;
      var hE = expense > 0 ? Math.max(2, Math.round((expense / max) * H)) : 0;
      return '<div class="analytics-bar" title="' + e(T('{month}: доходы {income}, расходы {expense}', {
        month: Fmt.monthName(d.month),
        income: money(income),
        expense: money(expense),
      })) + '">' +
        '<div class="analytics-bar__pair">' +
        '<span class="analytics-bar__fill analytics-bar__fill--income" style="height:' + hI + 'px"></span>' +
        '<span class="analytics-bar__fill analytics-bar__fill--expense" style="height:' + hE + 'px"></span>' +
        '</div>' +
        '<span class="analytics-bar__label">' + e(Fmt.monthShort(d.month)) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  var DONUT_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b', '#14b8a6', '#a855f7'];

  // Круговая диаграмма расходов текущего месяца: SVG без библиотек.
  // Подписи вынесены в список под диаграммой — на узком экране это читается лучше,
  // чем выноски по краям, как в настольных отчётах.
  function analyticsDonut(data) {
    var cur = data && data[data.length - 1];
    var cats = ((cur && cur.summary && cur.summary.categories) || [])
      .map(function (c) { return { name: c.name, icon: c.icon, fact: Number(c.fact) || 0 }; })
      .filter(function (c) { return c.fact > 0; })
      .sort(function (a, b) { return b.fact - a.fact; });
    var total = cats.reduce(function (s, c) { return s + c.fact; }, 0);
    if (!total) return '';

    var C = 2 * Math.PI * 44;
    var offset = 0;
    var segments = cats.map(function (c, i) {
      var len = (c.fact / total) * C;
      var draw = Math.max(0.5, len - C * 0.012);
      var color = DONUT_COLORS[i % DONUT_COLORS.length];
      var seg = '<circle cx="60" cy="60" r="44" fill="none" stroke="' + color +
        '" stroke-width="18" stroke-dasharray="' + draw + ' ' + (C - draw) +
        '" stroke-dashoffset="' + (-offset) + '"></circle>';
      offset += len;
      return seg;
    }).join('');

    var legend = cats.map(function (c, i) {
      var pct = Math.round((c.fact / total) * 100);
      return '<div class="donut-legend__row">' +
        '<span class="donut-legend__dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' +
        '<span class="donut-legend__name">' + e(c.icon || '🏷️') + ' ' + e(c.name) + '</span>' +
        '<span class="donut-legend__pct">' + (pct < 1 ? '&lt;1%' : pct + '%') + '</span>' +
        '<span class="donut-legend__amount">' + e(money(c.fact)) + '</span>' +
        '</div>';
    }).join('');

    return '<div class="section"><div class="section__head"><span class="section__title">' +
      e(T('Расходы по категориям · {month}', { month: Fmt.monthName(cur.month) })) + '</span></div>' +
      '<div class="card donut-card">' +
      '<div class="donut">' +
      '<svg viewBox="0 0 120 120" role="img" aria-label="' + e(T('Расходы по категориям: всего {amount}', { amount: money(total) })) + '">' +
      '<g transform="rotate(-90 60 60)">' + segments + '</g>' +
      '</svg>' +
      '<div class="donut__center"><span class="donut__sum">' + e(money(total)) + '</span>' +
      '<span class="donut__label">' + e(T('расходы')) + '</span></div>' +
      '</div>' +
      '<div class="donut-legend">' + legend + '</div>' +
      '</div></div>';
  }

  function analyticsCategories(data) {
    if (!data || data.length < 2) return '';
    var cur = data[data.length - 1];
    var prev = data[data.length - 2];
    var curCats = (cur.summary && cur.summary.categories) || [];
    var prevCats = (prev.summary && prev.summary.categories) || [];
    var prevMap = {};
    prevCats.forEach(function (c) {
      prevMap[c.id] = Number(c.fact) || 0;
    });
    var seen = {};
    var rows = curCats.map(function (c) {
      seen[c.id] = true;
      var now = Number(c.fact) || 0;
      return { name: c.name, icon: c.icon, now: now, delta: now - (prevMap[c.id] || 0) };
    }).concat(prevCats.filter(function (c) { return !seen[c.id]; }).map(function (c) {
      return { name: c.name, icon: c.icon, now: 0, delta: -(Number(c.fact) || 0) };
    }))
      .filter(function (r) { return r.now > 0 || r.delta !== 0; })
      .sort(function (a, b) { return b.now - a.now; });
    if (!rows.length) return '';
    return '<div class="section"><div class="section__head"><span class="section__title">' +
      e(T('Категории за {month}', { month: Fmt.monthName(cur.month) })) + '</span>' +
      '<span class="small muted">' + e(T('Δ к прошлому')) + '</span></div>' +
      '<div class="card analytics-cats">' + rows.map(function (r) {
        var delta = r.delta > 0
          ? '<span class="amount--neg">+' + e(money(r.delta)) + '</span>'
          : r.delta < 0
            ? '<span class="amount--pos">' + e(money(r.delta)) + '</span>'
            : '<span class="muted">—</span>';
        return '<div class="analytics-cat">' +
          '<span class="analytics-cat__name">' + e(r.icon || '🏷️') + ' ' + e(r.name) + '</span>' +
          '<span class="analytics-cat__cur">' + e(money(r.now)) + '</span>' +
          '<span class="analytics-cat__delta">' + delta + '</span>' +
          '</div>';
      }).join('') + '</div></div>';
  }

  function renderAnalytics(data, current) {
    var year = String(current || Fmt.currentMonth()).slice(0, 4);
    var totals = { income: 0, expense: 0 };
    (data || []).forEach(function (d) {
      var s = d.summary || {};
      totals.income += Number(s.income) || 0;
      totals.expense += Number(s.expense) || 0;
    });
    totals.balance = totals.income - totals.expense;
    var head = '<div class="analytics-head"><span class="analytics-head__title">' + e(T('Аналитика')) + '</span>' +
      '<span class="analytics-head__meta">' + e(T('{year} · с начала года', { year: year })) + '</span></div>';
    if (!totals.income && !totals.expense) {
      return head + empty('📊', T('Пока нет данных'), T('За {year} год записей ещё нет.', { year: year }), '');
    }
    return head +
      '<div class="analytics-totals">' +
      '<div class="analytics-total"><span class="analytics-total__label">' + e(T('Доходы')) + '</span>' +
      '<span class="analytics-total__value amount--pos">' + e(money(totals.income)) + '</span></div>' +
      '<div class="analytics-total"><span class="analytics-total__label">' + e(T('Расходы')) + '</span>' +
      '<span class="analytics-total__value amount--neg">' + e(money(totals.expense)) + '</span></div>' +
      '<div class="analytics-total"><span class="analytics-total__label">' + e(T('Остаток')) + '</span>' +
      '<span class="analytics-total__value' + (totals.balance < 0 ? ' amount--neg' : '') + '">' + e(money(totals.balance)) + '</span></div>' +
      '</div>' +
      '<div class="section"><div class="section__head"><span class="section__title">' + e(T('По месяцам')) + '</span></div>' +
      analyticsBars(data) +
      '<div class="analytics-legend">' +
      '<span><i class="analytics-legend__dot analytics-legend__dot--income"></i>' + e(T('Доходы')) + '</span>' +
      '<span><i class="analytics-legend__dot analytics-legend__dot--expense"></i>' + e(T('Расходы')) + '</span>' +
      '</div></div>' +
      analyticsDonut(data) +
      analyticsCategories(data);
  }

  function analyticsCard() {
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Аналитика')) + '</span></div>' +
      '<button type="button" class="settings-row settings-row--link" data-action="go-analytics">' +
      '<span class="settings-row__label">' + e(T('Сравнение месяцев и итоги года')) + '</span>' +
      '<span class="settings-row__value">' + e(T('открыть ›')) + '</span></button></div>';
  }

  function renderSettings() {
    var st = State.get();
    var m = st.member;
    var h = (m && m.households) || {};
    var left = State.planDaysLeft();
    var untilText = h.plan_until ? Fmt.dayLabel(h.plan_until) : '';
    var notif = (m && m.notifications) || { payments: true, limits: true, digest: false };
    var planText;
    if (left === null) planText = '—';
    else if (left < 0) planText = T('закончился');
    else if (left === 0) planText = T('последний день');
    else planText = P('days', left);
    return (
      '<div class="card">' +
      '<div class="settings-row"><span class="settings-row__label">' + e(T('Семья')) + '</span><span class="settings-row__value">' + e(h.name || '—') + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">' + e(T('Вы')) + '</span><span class="settings-row__value">' + e(m ? m.name : '—') + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">' + e(T('Деление общих трат')) + '</span><span class="settings-row__value">' + e(State.splitModeLabel()) + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">' + e(T('Доступ')) + '</span><span class="settings-row__value' + (left !== null && left < 0 ? ' amount--neg' : '') + '">' + e(planText) +
        (untilText ? e(T(' · до {date}', { date: untilText })) : '') + '</span></div>' +
      '</div>' +
      cardBalanceCard(h) +
      currencyCard() +
      languageCard() +
      coverCard() +
      notificationsCard(notif) +
      limitsCard() +
      analyticsCard() +
      starsCard(st.tariffs, st.buying) +
      promoCard(st.promo) +
      legalCard(st.deleting) +
      (State.isSolo()
        ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Режим')) + '</span></div>' +
          '<div class="card"><p class="small muted">' + e(T('Личный бюджет: партнёр не подключён, расчёт между участниками не показывается.')) + '</p></div></div>'
        : '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Приглашение')) + '</span></div>' +
          '<div class="card"><p class="small muted">' + e(T('Передайте код партнёру — в приложении он выберет «Подключиться» и введёт его.')) + '</p>' +
          '<div class="invite"><span class="invite__code">' + e(h.invite_code || '—') + '</span>' +
          '<button type="button" class="btn btn--sm btn--primary" data-action="copy-invite">' + e(T('Копировать')) + '</button></div>' +
          '</div></div>') +
      '<div class="section"><div class="section__head"><span class="section__title">' + e(T('О приложении')) + '</span></div>' +
      '<div class="card small muted">' + e(T('Данные видят только участники семьи. Telegram-бот принимает записи сообщением: «кофе 350», «+15000 подработка».')) + '</div></div>' +
      (Api.isDemo()
        ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Демо-режим')) + '</span></div>' +
          '<div class="card"><p class="small muted">' + e(T('Приложение открыто вне Telegram, данные вымышленные и хранятся в памяти страницы.')) + '</p>' +
          '<button type="button" class="btn btn--ghost mt-8" data-action="demo-reset">' + e(T('Сбросить демо-данные')) + '</button></div></div>'
        : '') +
      '<div class="actions"><button type="button" class="btn btn--full" data-action="refresh">' + e(T('Обновить')) + '</button></div>'
    );
  }

  // --- Онбординг ---

  function renderOnboarding(opts) {
    var tab = opts.tab || 'create';
    var isJoin = tab === 'join';
    return (
      '<div class="text-center mt-16"><div class="empty__icon">💰</div><h1 style="font-size:22px">' + e(T('Бюджет пары')) + '</h1>' +
      '<p class="muted small mt-8">' + e(T('Общий бюджет, личные расходы и расчёт между партнёрами.')) + '</p></div>' +
      '<div class="segments mt-24">' +
      '<button type="button" class="segment' + (!isJoin ? ' segment--active' : '') + '" data-action="onb-tab" data-onb="create">' + e(T('Создать семью')) + '</button>' +
      '<button type="button" class="segment' + (isJoin ? ' segment--active' : '') + '" data-action="onb-tab" data-onb="join">' + e(T('Подключиться')) + '</button>' +
      '</div>' +
      (!isJoin
        ? '<div class="segments">' +
          '<button type="button" class="segment' + ((opts.mode || 'pair') === 'pair' ? ' segment--active' : '') + '" data-action="onb-mode" data-mode="pair">' + e(T('👫 Для двоих')) + '</button>' +
          '<button type="button" class="segment' + ((opts.mode || 'pair') === 'solo' ? ' segment--active' : '') + '" data-action="onb-mode" data-mode="solo">' + e(T('🙋 Только для меня')) + '</button>' +
          '</div>' +
          '<p class="small muted mt-8">' +
          e((opts.mode || 'pair') === 'solo'
            ? T('Личный бюджет без приглашения. Партнёра можно не подключать — расчёт между участниками не показывается.')
            : T('После создания получите код, по которому партнёр подключится к общей семье.')) +
          '</p>'
        : '') +
      '<form data-form="' + (isJoin ? 'join' : 'create') + '" novalidate>' +
      '<label class="field"><span class="field__label">' + e(T('Ваше имя')) + '</span>' +
      '<input class="input" name="member_name" maxlength="40" autocomplete="name" placeholder="' + e(T('Как вас звать?')) + '" value="' + e(opts.member_name || '') + '"></label>' +
      (isJoin
        ? '<label class="field"><span class="field__label">' + e(T('Код приглашения')) + '</span>' +
          '<input class="input input--code" name="code" maxlength="64" autocomplete="off" placeholder="' + e(T('например, a1b2c3d4')) + '" value="' + e(opts.code || '') + '"></label>'
        : '<label class="field"><span class="field__label">' + e(T('Название семьи')) + '</span>' +
          '<input class="input" name="name" maxlength="60" placeholder="' + e(T('Наша семья')) + '" value="' + e(opts.household_name || '') + '"></label>') +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(isJoin ? T('Подключиться') : T('Создать семью')) + '</button></div>' +
      '</form>'
    );
  }

  function renderInvite(code) {
    return (
      '<div class="text-center mt-16"><div class="empty__icon">🎉</div><h1 style="font-size:20px">' + e(T('Семья создана')) + '</h1>' +
      '<p class="muted small mt-8">' + e(T('Передайте код партнёру. Перейти в бюджет можно и сейчас.')) + '</p></div>' +
      '<div class="invite"><span class="invite__code">' + e(code) + '</span>' +
      '<button type="button" class="btn btn--sm btn--primary" data-action="copy-code" data-code="' + e(code) + '">' + e(T('Копировать')) + '</button></div>' +
      '<div class="actions"><button type="button" class="btn btn--primary btn--full" data-action="start">' + e(T('Перейти в бюджет')) + '</button></div>'
    );
  }

  // --- Ошибки ---

  // opts.retry === false — повтор бессмысленен (например, нет сессии Telegram).
  // opts.promo — на экране истёкшего доступа добавляем путь к активации кода.
  function renderError(opts) {
    var btn = (opts.retry === false ? '' : '<button type="button" class="btn mt-16" data-action="retry">' + e(T('Повторить')) + '</button>') +
      (opts.promo ? '<button type="button" class="btn btn--primary mt-8" data-action="go-settings">' + e(T('Ввести промокод')) + '</button>' : '');
    return empty(opts.icon || '⚠️', opts.title || T('Что-то пошло не так'), opts.text || '', btn);
  }

  root.Views = {
    skeletonSummary: skeletonSummary,
    skeletonList: skeletonList,
    categoryTxList: categoryTxList,
    renderSummary: renderSummary,
    renderQuickActions: renderQuickActions,
    renderPlans: renderPlans,
    renderPlanForm: renderPlanForm,
    renderCategoryForm: renderCategoryForm,
    renderRecurringForm: renderRecurringForm,
    renderLimits: renderLimits,
    renderAnalytics: renderAnalytics,
    renderTxList: renderTxList,
    txResults: txResults,
    renderForm: renderForm,
    renderSettings: renderSettings,
    starsCard: starsCard,
    legalCard: legalCard,
    renderOnboarding: renderOnboarding,
    renderInvite: renderInvite,
    renderError: renderError,
  };
})(window);
