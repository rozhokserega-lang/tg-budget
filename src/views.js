/**
 * Разметка экранов. Функции возвращают HTML-строку;
 * обработчики навешивает app.js через data-action / data-tab.
 */

(function (root) {
  var e = Fmt.escapeHtml;

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
      '<button type="button" class="month-nav__btn" data-action="month-prev" aria-label="Предыдущий месяц">‹</button>' +
      '<span class="month-nav__label">' + e(Fmt.monthTitle(month)) + '</span>' +
      '<button type="button" class="month-nav__btn" data-action="month-next" aria-label="Следующий месяц"' +
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
      balanceHtml = '<span class="amount muted">в расчёте</span>';
    } else {
      var cls = balance > 0 ? 'amount amount--pos' : 'amount amount--neg';
      balanceHtml = '<span class="' + cls + '">' + (balance > 0 ? 'вернуть ' : 'должен ') + e(money(Math.abs(balance))) + '</span>';
    }
    return (
      '<div class="partner">' +
      '<span class="avatar">' + initLetter(p.name) + '</span>' +
      '<div class="partner__body">' +
      '<div class="partner__name">' + e(p.name) + (isMe ? ' · вы' : '') + '</div>' +
      '<div class="partner__meta"><span>Общее: ' + e(money(p.paid_shared)) + '</span><span>Доля: ' + e(money(p.share)) + '</span></div>' +
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
          '<div class="cat__meta"><span>из ' + e(money(plan)) + '</span><span class="' + (over ? 'amount--neg' : '') + '">' + pct + '%</span></div>'
        : '<div class="cat__meta"><span>без лимита</span></div>') +
      '</button>' +
      '<div class="cat-tx"><div class="cat-tx__inner">' +
      '<div class="cat-tx__rows" data-count="' + rows.length + '">' + categoryTxList(rows, open) + '</div>' +
      '<button type="button" class="btn btn--sm btn--primary cat-tx__add" data-action="add-in-cat" data-id="' + e(c.id) + '">' +
      '+ Добавить в «' + e(c.name) + '»</button>' +
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
      : (open ? '<div class="cat-tx__empty">Записей за этот месяц нет</div>' : '');
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
    if (goals) parts.push('Цели: ' + goals);
    if (debts) parts.push('Долги: ' + debts);
    if (wishes) parts.push('Желания: ' + wishes);
    return '<button type="button" class="plans-teaser" data-action="go-plans">' +
      '<span class="plans-teaser__title">📈 Планы</span>' +
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
    var when = x.diff === 0 ? 'Сегодня платёж' : 'Завтра платёж';
    return '<div class="due">' +
      '<button type="button" class="due__main" data-action="go-recurring">' +
      '<span class="due__icon">🔔</span>' +
      '<span class="due__body">' +
      '<span class="due__title">' + e(when) + ': ' + e(x.r.name) + ' · ' + e(money(x.r.amount)) + '</span>' +
      '<span class="due__hint">' + (more > 0 ? 'и ещё ' + more + ' · ' : '') + 'отметить оплату ›</span>' +
      '</span>' +
      '</button>' +
      '<button type="button" class="due__close" data-action="dismiss-due" aria-label="Скрыть напоминание">' +
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

    var dateLabel = daysInMonth + ' ' + Fmt.monthGenitive(now.getMonth());
    var hint = 'Осталось ' + daysLeft + ' ' + Fmt.plural(daysLeft, 'день', 'дня', 'дней');
    if (upcoming.count) hint += ' · с учётом платежей';
    var dailyHtml;
    if (income > 0) {
      dailyHtml = '<span class="forecast__daily-value' + (perDay < 0 ? ' amount--neg' : '') + '">' +
        e(money(Math.max(0, perDay))) + '<small>/день</small></span>';
      if (overBudget) {
        hint = 'Доходы уже превышены на ' + e(money(-free)) + ' · осталось ' + daysLeft + ' ' +
          Fmt.plural(daysLeft, 'день', 'дня', 'дней');
      }
    } else {
      dailyHtml = '<span class="forecast__daily-value muted">—</span>';
      hint = 'Добавьте доход, чтобы рассчитать дневной лимит';
    }

    return '<div class="forecast">' +
      '<div class="forecast__head">' +
      '<span class="forecast__label">Прогноз расходов к ' + e(dateLabel) + '</span>' +
      '<span class="forecast__value' + (overspend ? ' amount--neg' : '') + '">' + e(money(forecastExpense)) + '</span>' +
      '</div>' +
      '<div class="forecast__daily">' +
      '<span class="forecast__daily-label">Можно тратить</span>' +
      dailyHtml +
      '</div>' +
      '<div class="forecast__hint' + (overBudget ? ' forecast__hint--warn' : '') + '">' + e(hint) + '</div>' +
      '</div>';
  }

  // expandedCat: { id, rows } — раскрытая категория и её записи за месяц.
  function renderSummary(s, plans, expandedCat) {
    var st = State.get();
    s = s || { income: 0, expense: 0, balance: 0, categories: [], members: [] };
    plans = plans || st.plans;
    var balance = Number(s.balance) || 0;
    var solo = State.isSolo();
    var partners = !solo && s.members && s.members.length
      ? '<div class="card">' + s.members.map(partnerRow).join('') +
        '<div class="small muted mt-8">Как делим: ' + e(State.splitModeLabel()) + '</div></div>'
      : '';
    var cats = s.categories && s.categories.length
      ? s.categories.map(function (c) {
          return categoryRow(c, expandedCat && expandedCat.id === c.id ? expandedCat : null);
        }).join('')
      : '<div class="empty">Категорий пока нет</div>';
    return (
      dueBanner(plans) +
      monthNav(st.month) +
      '<div class="hero">' +
      '<button type="button" class="hero__link" data-action="go-tx">Все траты →</button>' +
      '<div class="hero__label">Остаток за месяц</div>' +
      '<div class="hero__balance' + (balance < 0 ? ' hero__balance--negative' : '') + '">' + e(money(balance)) + '</div>' +
      '<div class="hero__row">' +
      '<div class="hero__item"><span class="hero__item-label">Доходы</span><span class="hero__item-value">' + e(money(s.income)) + '</span></div>' +
      '<div class="hero__item"><span class="hero__item-label">Расходы</span><span class="hero__item-value">' + e(money(s.expense)) + '</span></div>' +
      '</div>' +
      '</div>' +
      forecastCard(s, plans) +
      plansTeaser(plans) +
      (partners ? '<div class="section"><div class="section__head"><span class="section__title">Между партнёрами</span></div>' + partners + '</div>' : '') +
      '<div class="section"><div class="section__head"><span class="section__title">Категории</span></div><div class="card">' + cats + '</div></div>'
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
    if (!isIncome && t.is_shared) meta.push('<span class="badge">общий</span>');
    if (!meta.length) meta.push('<span class="tx__note">' + e(Fmt.dayLabel(t.occurred_on)) + '</span>');
    return (
      '<div class="tx" data-tx-id="' + e(t.id) + '">' +
      '<div class="tx__row" data-tx-row>' +
      '<span class="cat__icon">' + e(c.icon || '🏷️') + '</span>' +
      '<div class="tx__body">' +
      '<div class="tx__head"><button type="button" class="tx__name tx__name--link" data-cat-link="' + e(t.category_id) + '">' +
      e(c.name || 'Без категории') +
      (t._local ? ' <span class="badge">отправляется</span>' : '') + '</button>' +
      '<span class="amount ' + (isIncome ? 'amount--pos' : '') + '">' + e(Fmt.signedMoney(t.amount, isIncome)) + '</span></div>' +
      (meta.length ? '<div class="tx__meta"><span class="tx__meta-inline">' + meta.join('<span>·</span>') + '</span></div>' : '') +
      '</div>' +
      '<button type="button" class="tx__more" data-tx-more="' + e(t.id) + '" aria-label="Действия с записью">···</button>' +
      '<button type="button" class="tx__delete-inline" data-tx-delete="' + e(t.id) + '">Удалить</button>' +
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
        members.push({ id: t.member_id, name: (t.members && t.members.name) || 'Участник' });
      }
      if (t.category_id && !seenC[t.category_id]) {
        seenC[t.category_id] = true;
        cats.push({
          id: t.category_id,
          name: (t.categories && t.categories.name) || 'Без категории',
          icon: (t.categories && t.categories.icon) || '🏷️',
        });
      }
    });
    if (f.member_id && !seenM[f.member_id]) {
      var sm = ((st.lastSummary && st.lastSummary.members) || []).find(function (m) { return m.id === f.member_id; });
      members.push({ id: f.member_id, name: sm ? sm.name : 'Участник' });
    }
    if (f.category_id && !seenC[f.category_id]) {
      var sc = (st.categories || []).find(function (c) { return c.id === f.category_id; });
      if (!sc && st.lastSummary) {
        sc = (st.lastSummary.categories || []).find(function (c) { return c.id === f.category_id; });
      }
      cats.push({ id: f.category_id, name: sc ? sc.name : 'Категория', icon: (sc && sc.icon) || '🏷️' });
    }
    cats.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
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
    var selects = txSelect('Кто', 'data-tx-member', f.member_id || '', opts.members, 'Все') +
      txSelect('Категория', 'data-tx-category', f.category_id || '', opts.categories, 'Все');
    return '<div class="tx-search">' +
      '<span class="tx-search__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg></span>' +
      '<input id="tx-search" class="tx-search__input" type="search" autocomplete="off" enterkeyhint="search" ' +
      'placeholder="Заметка, категория или имя" aria-label="Поиск по тратам" value="' + e(q) + '">' +
      '<button type="button" class="tx-search__clear" data-action="tx-search-clear" aria-label="Очистить поиск"' +
      (q ? '' : ' hidden') + '>&times;</button>' +
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
        ? empty('🔍', 'Ничего не найдено', 'Попробуйте изменить запрос или сбросить фильтры.',
            '<button type="button" class="btn" data-action="tx-clear-filter">Сбросить фильтры</button>')
        : empty('🧾', 'Записей нет', 'За ' + Fmt.monthTitle(st.month) + ' пока ничего не записано.',
            '<button type="button" class="btn btn--primary" data-action="go-add">Добавить запись</button>');
    }
    var count = '<div class="tx-count"><span>Найдено: ' + list.length + ' ' +
      Fmt.plural(list.length, 'запись', 'записи', 'записей') + '</span>' +
      '<button type="button" class="tx-count__reset" data-action="tx-clear-filter">Сбросить</button></div>';
    return (active ? count : '') +
      groupByDay(list).map(function (g) {
        return '<div class="tx-group"><div class="tx-group__title">' + e(Fmt.dayLabel(g.day)) + '</div>' + g.items.map(txRow).join('') + '</div>';
      }).join('');
  }

  function renderTxList(all, filter) {
    var st = State.get();
    var active = txFilterActive(filter);
    var pending = (root.Queue && Queue.size()) ? '<div class="sync-note">Изменения отправятся, когда появится связь</div>' : '';
    var controls = (all && all.length) || active ? txControls(all, filter) : '';
    return monthNav(st.month) + pending + controls +
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
      : '<div class="muted small">Нет категорий — обновите приложение</div>';
    return (
      '<form data-form="add" novalidate>' +
      '<div class="segments" role="tablist">' +
      '<button type="button" class="segment' + (kind === 'expense' ? ' segment--active' : '') + '" data-action="pick-kind" data-kind="expense">Расход</button>' +
      '<button type="button" class="segment' + (kind === 'income' ? ' segment--active' : '') + '" data-action="pick-kind" data-kind="income">Доход</button>' +
      '</div>' +
      '<label class="field"><span class="field__label">Сумма</span>' +
      '<input class="input input--amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0 ₽" value="' + e(amount) + '" required></label>' +
      '<span class="field__label">Категория</span>' +
      '<div class="cat-grid">' + chips + '</div>' +
      '<label class="field"><span class="field__label">Заметка</span>' +
      '<input class="input" name="note" maxlength="200" autocomplete="off" placeholder="Например: пятерочка" value="' + e(note) + '"></label>' +
      (kind === 'expense'
        ? '<label class="switch-row"><span class="switch-row__text"><span class="switch-row__title">Общий расход</span>' +
          '<span class="switch-row__hint">Делим между партнёрами</span></span>' +
          '<span class="switch"><input type="checkbox" name="is_shared"' + (isShared ? ' checked' : '') + '><span class="switch__track"></span></span></label>'
        : '') +
      '<label class="field mt-16"><span class="field__label">Дата</span>' +
      '<input class="input" type="date" name="occurred_on" max="' + Fmt.todayIso() + '" value="' + e(date) + '"></label>' +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">Добавить</button></div>' +
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
    return ' · ~' + m + ' ' + Fmt.plural(m, 'мес.', 'мес.', 'мес.');
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
      (done ? 'Готово! Подкоплено на цель' :
        'Осталось ' + e(money(left)) + (Number(g.monthly) > 0 ? ' · ' + e(money(g.monthly)) + '/мес' + monthsLeft(left, Number(g.monthly)) : '')) +
      '</div>' +
      '<div class="plan__actions"><button type="button" class="btn btn--sm btn--ghost" data-plan-add>+ Пополнить</button></div>' +
      '<div class="plan__confirm" hidden>' +
      '<div class="plan__confirm-row"><input class="input" inputmode="decimal" placeholder="Сумма" data-plan-amount>' +
      '<button type="button" class="btn btn--sm" data-plan-cancel>Отмена</button>' +
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
      (closed ? 'Долг закрыт 🎉' :
        'Осталось ' + e(money(remaining)) + (Number(d.monthly) > 0 ? ' · ' + e(money(d.monthly)) + '/мес' + monthsLeft(remaining, Number(d.monthly)) : '')) +
      '</div>' +
      (closed ? '' :
        '<div class="plan__actions">' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="1000">− 1 000</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="5000">− 5 000</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-debt-pay="all">Весь остаток</button>' +
        '</div>' +
        '<div class="plan__confirm" hidden>' +
        '<div class="plan__confirm-row"><input class="input" inputmode="decimal" placeholder="Сумма" data-plan-amount>' +
        '<button type="button" class="btn btn--sm" data-plan-cancel>Отмена</button>' +
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
      '<div class="plan__meta"><span class="badge">' + e(PRIORITY[w.priority] || w.priority) + ' приоритет</span>' +
      (w.purchased ? ' <span class="amount--pos">куплено</span>' : '') + '</div>' +
      (w.purchased ? '' : '<div class="plan__actions"><button type="button" class="btn btn--sm btn--ghost" data-wish-buy>Купить</button></div>') +
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
      '<div class="plan__meta">' + r.day_of_month + '-го числа · ' + e(cat.name || 'без категории') + '</div>' +
      '<div class="plan__actions">' +
      '<button type="button" class="btn btn--sm btn--ghost" data-recurring-pay>Отметить оплату</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-recurring-edit>Изменить</button>' +
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
        goals: ['🎯', 'Целей пока нет', 'Например, отпуск или новая техника'],
        debts: ['💳', 'Долгов нет', 'Отлично!'],
        wishes: ['✨', 'Список желаний пуст', 'Добавьте то, что хочется купить'],
        recurring: ['🔁', 'Платежей пока нет', 'Аренда, подписки, кредиты — напомним накануне'],
      };
      var t = titles[tab];
      body = '<div class="empty"><div class="empty__icon">' + t[0] + '</div><div class="empty__title">' + t[1] + '</div><p>' + t[2] + '</p>' +
        '<button type="button" class="btn btn--primary" data-action="plan-add" data-kind="' + tab + '">Добавить</button></div>';
    } else {
      var row = { goals: goalRow, debts: debtRow, wishes: wishRow, recurring: recurringRow }[tab];
      body = list.map(row).join('');
    }
    return (
      '<div class="segments">' +
      PLANS_TABS.map(function (t) {
        return '<button type="button" class="segment' + (t.id === tab ? ' segment--active' : '') + '" data-action="plans-tab" data-plans="' + t.id + '">' + t.label + '</button>';
      }).join('') +
      '</div>' +
      '<div class="plans">' + body + '</div>' +
      (list.length ? '<div class="actions"><button type="button" class="btn btn--primary btn--full" data-action="plan-add" data-kind="' + tab + '">Добавить</button></div>' : '')
    );
  }

  // c === null — создание новой категории.
  function renderCategoryForm(c) {
    if (!c) {
      return (
        '<form data-form="category" novalidate>' +
        '<div class="sheet__title">Новая категория</div>' +
        '<div class="segments">' +
        '<button type="button" class="segment segment--active" data-action="cat-kind" data-kind="expense">Расход</button>' +
        '<button type="button" class="segment" data-action="cat-kind" data-kind="income">Доход</button>' +
        '</div>' +
        '<label class="field"><span class="field__label">Название</span>' +
        '<input class="input" name="name" maxlength="40" placeholder="Например: Дети" autocomplete="off"></label>' +
        '<label class="field"><span class="field__label">Иконка (эмодзи)</span>' +
        '<input class="input input--center" name="icon" maxlength="8" value="🏷️"></label>' +
        '<label class="field"><span class="field__label">Лимит на месяц</span>' +
        '<input class="input" name="plan" inputmode="decimal" placeholder="0 ₽"></label>' +
        '<div class="actions"><button type="submit" class="btn btn--primary btn--full">Добавить</button></div>' +
        '</form>'
      );
    }
    var kindTitle = c.kind === 'income' ? 'Доход' : 'Расход';
    return (
      '<form data-form="category" data-id="' + e(c.id) + '" novalidate>' +
      '<div class="sheet__title">' + e(c.icon || '🏷️') + ' ' + e(c.name) + ' · ' + kindTitle + '</div>' +
      '<label class="field"><span class="field__label">Лимит на месяц</span>' +
      '<input class="input input--amount" name="plan" inputmode="decimal" placeholder="0 ₽" value="' +
        (Number(c.plan_monthly) > 0 ? e(String(Number(c.plan_monthly))) : '') + '"></label>' +
      '<p class="small muted">0 или пусто — без лимита. Сводка считает план/факт для каждого месяца.</p>' +
      '<label class="field mt-16"><span class="field__label">Название</span>' +
      '<input class="input" name="name" maxlength="40" value="' + e(c.name) + '"></label>' +
      '<label class="field"><span class="field__label">Иконка (эмодзи)</span>' +
      '<input class="input input--center" name="icon" maxlength="8" value="' + e(c.icon || '🏷️') + '"></label>' +
      '<div class="actions">' +
      '<button type="submit" class="btn btn--primary btn--full">Сохранить</button>' +
      '<button type="button" class="btn btn--danger btn--full mt-8" data-action="delete-cat" data-id="' + e(c.id) + '">Удалить категорию</button>' +
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
      '<div class="sheet__title">' + (opts.id ? 'Изменить платёж' : 'Новый платёж') + '</div>' +
      '<label class="field"><span class="field__label">Название</span>' +
      '<input class="input" name="name" maxlength="80" placeholder="Аренда, интернет…" value="' + e(opts.name || '') + '"></label>' +
      '<label class="field"><span class="field__label">Сумма</span>' +
      '<input class="input" name="amount" inputmode="decimal" placeholder="0 ₽" value="' + e(opts.amount || '') + '"></label>' +
      '<label class="field"><span class="field__label">День месяца</span>' +
      '<input class="input input--center" name="day" inputmode="numeric" placeholder="5" value="' + e(opts.day || '') + '"></label>' +
      '<label class="field"><span class="field__label">Категория</span>' +
      '<select class="input" name="category_id">' + cats.map(function (c) {
        return '<option value="' + e(c.id) + '"' + (selected === c.id ? ' selected' : '') + '>' + e(c.icon || '🏷️') + ' ' + e(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<p class="small muted">Напомним за день до платежа. 31-е в коротком месяце сдвигаем на последний день.</p>' +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">Сохранить</button></div>' +
      '</form>'
    );
  }

  // Форма добавления/редактирования в нижнем шите.
  function renderPlanForm(kind, opts) {
    opts = opts || {};
    var title = { goals: 'Новая цель', debts: 'Новый долг', wishes: 'Новое желание' }[kind] || 'Добавить';
    var idAttr = opts.id ? ' data-id="' + e(opts.id) + '"' : '';
    var name = '<label class="field"><span class="field__label">Название</span>' +
      '<input class="input" name="name" maxlength="80" placeholder="' + e(opts.name_placeholder || 'Название') + '" value="' + e(opts.name || '') + '"></label>';
    var moneyField = function (nameKey, label, value) {
      return '<label class="field"><span class="field__label">' + label + '</span>' +
        '<input class="input" name="' + nameKey + '" inputmode="decimal" placeholder="0 ₽" value="' + e(value || '') + '"></label>';
    };
    var fields = '', extra = '';
    if (kind === 'goals') {
      fields = moneyField('target', 'Сколько нужно', opts.target) + moneyField('saved', 'Уже накоплено (необязательно)', opts.saved) +
        moneyField('monthly', 'Откладывать в месяц (необязательно)', opts.monthly);
    } else if (kind === 'debts') {
      fields = moneyField('total', 'Сумма долга', opts.total) + moneyField('remaining', 'Осталось выплатить (по умолчанию — вся сумма)', opts.remaining) +
        moneyField('monthly', 'Платить в месяц (необязательно)', opts.monthly) +
        '<label class="field"><span class="field__label">Кому (необязательно)</span>' +
        '<input class="input" name="creditor" maxlength="80" placeholder="Банк, человек" value="' + e(opts.creditor || '') + '"></label>';
    } else if (kind === 'wishes') {
      fields = moneyField('price', 'Цена', opts.price);
      var goals = State.get().plans && State.get().plans.goals || [];
      extra = '<label class="field"><span class="field__label">Приоритет</span>' +
        '<select class="input" name="priority">' +
        ['high', 'medium', 'low'].map(function (p) {
          return '<option value="' + p + '"' + ((opts.priority || 'medium') === p ? ' selected' : '') + '>' + PRIORITY[p] + '</option>';
        }).join('') + '</select></label>';
      if (goals.length) {
        extra += '<label class="field"><span class="field__label">Копим на цель (необязательно)</span>' +
          '<select class="input" name="goal_id"><option value="">— без цели —</option>' +
          goals.map(function (g) {
            return '<option value="' + e(g.id) + '"' + (opts.goal_id === g.id ? ' selected' : '') + '>' + e(g.name) + '</option>';
          }).join('') + '</select></label>';
      }
    }
    return (
      '<form data-form="plan" data-kind="' + e(kind) + '"' + idAttr + ' novalidate>' +
      '<div class="sheet__title">' + e(title) + '</div>' +
      name + fields + extra +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">Сохранить</button></div>' +
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
        '<span class="limit__value' + (plan > 0 ? '' : ' muted') + '">' + (plan > 0 ? e(money(plan)) : 'без лимита') + '</span>' +
        '<span class="limit__chev">›</span>' +
        '</button>';
    }

    return (
      '<div class="card limits-head"><span class="muted small">Расходы в месяц по плану</span>' +
      '<div class="limits-total">' + e(money(totalPlan)) + '</div></div>' +
      '<div class="section"><div class="section__head"><span class="section__title">Расходы</span>' +
      '<button type="button" class="section__action" data-action="add-cat" data-kind="expense">+ Категория</button></div>' +
      '<div class="card limits">' + (expenses.length ? expenses.map(row).join('') : '<div class="empty">Категорий пока нет</div>') + '</div></div>' +
      '<div class="section"><div class="section__head"><span class="section__title">Доходы</span>' +
      '<button type="button" class="section__action" data-action="add-cat" data-kind="income">+ Категория</button></div>' +
      '<div class="card limits">' + (incomes.length ? incomes.map(row).join('') : '<div class="empty">Категорий пока нет</div>') + '</div></div>' +
      '<p class="small muted mt-16">Лимит — это план на месяц. Сводка показывает, сколько уже потрачено из него.</p>'
    );
  }

  // Уведомления в Telegram: платежи и лимиты включены, сводка — по желанию.
  function notificationsCard(notif) {
    notif = notif || {};
    function toggle(key, title, hint) {
      return '<label class="switch-row"><span class="switch-row__text">' +
        '<span class="switch-row__title">' + e(title) + '</span>' +
        '<span class="switch-row__hint">' + e(hint) + '</span></span>' +
        '<span class="switch"><input type="checkbox" data-notif="' + key + '"' + (notif[key] ? ' checked' : '') + '>' +
        '<span class="switch__track"></span></span></label>';
    }
    return '<div class="section"><div class="section__head"><span class="section__title">Уведомления в Telegram</span></div>' +
      '<div class="card card--stack">' +
      toggle('payments', 'Напоминания о платежах', 'За день до даты') +
      toggle('limits', 'Лимиты категорий', 'При 80 % и 100 % плана') +
      toggle('digest', 'Итоги недели', 'Воскресенье, вечером') +
      '</div></div>';
  }

  function limitsCard() {
    var cats = ((State.get().categories) || []).filter(function (c) { return c.kind === 'expense' && !c.archived; });
    var total = cats.reduce(function (s, c) { return s + (Number(c.plan_monthly) || 0); }, 0);
    return '<div class="section"><div class="section__head"><span class="section__title">Лимиты</span></div>' +
      '<button type="button" class="settings-row settings-row--link" data-action="go-limits">' +
      '<span class="settings-row__label">Лимиты по категориям</span>' +
      '<span class="settings-row__value">' + (total > 0 ? e(money(total)) + ' ›' : 'настроить ›') + '</span></button>' +
      '</div>';
  }

  // Документы и управление данными: ссылки на оферту/политику и удаление аккаунта.
  function legalCard(busy) {
    return '<div class="section"><div class="section__head"><span class="section__title">Документы и данные</span></div>' +
      '<div class="card">' +
      '<div class="settings-row"><a class="settings-row__label legal-link" href="legal/terms.html" target="_blank" rel="noopener">Условия использования</a><span class="settings-row__value">›</span></div>' +
      '<div class="settings-row"><a class="settings-row__label legal-link" href="legal/privacy.html" target="_blank" rel="noopener">Политика конфиденциальности</a><span class="settings-row__value">›</span></div>' +
      '<p class="small muted mt-8">Удаление аккаунта удаляет семью, траты, цели и долги безвозвратно. История платежей сохраняется обезличенной по требованию закона.</p>' +
      '<button type="button" class="btn btn--sm btn--danger mt-8" data-action="delete-account"' + (busy ? ' disabled' : '') + '>Удалить аккаунт</button>' +
      '</div></div>';
  }

  // Тарифы за Telegram Stars: показываются, если сервер их прислал (нет в демо — не рисуем).
  function starsCard(tariffs, busy) {
    if (!tariffs || !tariffs.length) return '';
    return '<div class="section"><div class="section__head"><span class="section__title">Продлить за звёзды</span></div>' +
      '<div class="card">' +
      tariffs.map(function (t) {
        var perDay = t.stars / t.days;
        return '<div class="tariff"><div class="tariff__body"><div class="tariff__title">' + e(t.title) + '</div>' +
          '<div class="tariff__meta">' + t.days + ' дней · ' + perDay.toFixed(1).replace('.', ',') + ' ⭐/день</div></div>' +
          '<button type="button" class="btn btn--sm btn--primary" data-action="buy" data-buy="' + e(t.code) + '"' + (busy ? ' disabled' : '') + '>' + t.stars + ' ⭐</button></div>';
      }).join('') +
      '<p class="small muted mt-8">Оплата проходит внутри Telegram. Продление начнётся после конца текущего доступа.</p>' +
      '</div></div>';
  }

  // Промокод: поле и список уже активированных.
  function promoCard(promo) {
    var active = (promo || []).map(function (p) {
      return '<div class="promo__used">✅ ' + e(p.code) + '</div>';
    }).join('');
    return '<div class="section"><div class="section__head"><span class="section__title">Промокод</span></div>' +
      '<div class="card">' +
      '<form data-form="promo" novalidate class="promo">' +
      '<input class="input input--code" name="code" maxlength="32" autocomplete="off" placeholder="код друга" value="">' +
      '<button type="submit" class="btn btn--sm btn--primary">Активировать</button>' +
      '</form>' +
      '<p class="small muted mt-8">Код продлевает доступ к бюджету. Один код — одна активация на семью.</p>' +
      active +
      '</div></div>';
  }

  // --- Аналитика: месяцы года и динамика категорий ---

  var MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function monthShort(ym) {
    return MONTHS_SHORT[Number(String(ym).slice(5, 7)) - 1] || '';
  }

  function monthName(ym) {
    return String(Fmt.monthTitle(ym)).split(' ')[0];
  }

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
      return '<div class="analytics-bar" title="' + e(monthName(d.month)) + ': доходы ' + e(money(income)) +
        ', расходы ' + e(money(expense)) + '">' +
        '<div class="analytics-bar__pair">' +
        '<span class="analytics-bar__fill analytics-bar__fill--income" style="height:' + hI + 'px"></span>' +
        '<span class="analytics-bar__fill analytics-bar__fill--expense" style="height:' + hE + 'px"></span>' +
        '</div>' +
        '<span class="analytics-bar__label">' + e(monthShort(d.month)) + '</span>' +
        '</div>';
    }).join('') + '</div>';
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
    return '<div class="section"><div class="section__head"><span class="section__title">Категории за ' + e(monthName(cur.month)) + '</span>' +
      '<span class="small muted">Δ к прошлому</span></div>' +
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
    var head = '<div class="analytics-head"><span class="analytics-head__title">Аналитика</span>' +
      '<span class="analytics-head__meta">' + e(year) + ' · с начала года</span></div>';
    if (!totals.income && !totals.expense) {
      return head + empty('📊', 'Пока нет данных', 'За ' + e(year) + ' год записей ещё нет.', '');
    }
    return head +
      '<div class="analytics-totals">' +
      '<div class="analytics-total"><span class="analytics-total__label">Доходы</span>' +
      '<span class="analytics-total__value amount--pos">' + e(money(totals.income)) + '</span></div>' +
      '<div class="analytics-total"><span class="analytics-total__label">Расходы</span>' +
      '<span class="analytics-total__value amount--neg">' + e(money(totals.expense)) + '</span></div>' +
      '<div class="analytics-total"><span class="analytics-total__label">Остаток</span>' +
      '<span class="analytics-total__value' + (totals.balance < 0 ? ' amount--neg' : '') + '">' + e(money(totals.balance)) + '</span></div>' +
      '</div>' +
      '<div class="section"><div class="section__head"><span class="section__title">По месяцам</span></div>' +
      analyticsBars(data) +
      '<div class="analytics-legend">' +
      '<span><i class="analytics-legend__dot analytics-legend__dot--income"></i>Доходы</span>' +
      '<span><i class="analytics-legend__dot analytics-legend__dot--expense"></i>Расходы</span>' +
      '</div></div>' +
      analyticsCategories(data);
  }

  function analyticsCard() {
    return '<div class="section"><div class="section__head"><span class="section__title">Аналитика</span></div>' +
      '<button type="button" class="settings-row settings-row--link" data-action="go-analytics">' +
      '<span class="settings-row__label">Сравнение месяцев и итоги года</span>' +
      '<span class="settings-row__value">открыть ›</span></button></div>';
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
    else if (left < 0) planText = 'закончился';
    else if (left === 0) planText = 'последний день';
    else planText = left + ' ' + Fmt.plural(left, 'день', 'дня', 'дней');
    return (
      '<div class="card">' +
      '<div class="settings-row"><span class="settings-row__label">Семья</span><span class="settings-row__value">' + e(h.name || '—') + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">Вы</span><span class="settings-row__value">' + e(m ? m.name : '—') + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">Деление общих трат</span><span class="settings-row__value">' + e(State.splitModeLabel()) + '</span></div>' +
      '<div class="settings-row"><span class="settings-row__label">Доступ</span><span class="settings-row__value' + (left !== null && left < 0 ? ' amount--neg' : '') + '">' + e(planText) +
        (untilText ? ' · до ' + e(untilText) : '') + '</span></div>' +
      '</div>' +
      notificationsCard(notif) +
      limitsCard() +
      analyticsCard() +
      starsCard(st.tariffs, st.buying) +
      promoCard(st.promo) +
      legalCard(st.deleting) +
      (State.isSolo()
        ? '<div class="section"><div class="section__head"><span class="section__title">Режим</span></div>' +
          '<div class="card"><p class="small muted">Личный бюджет: партнёр не подключён, расчёт между участниками не показывается.</p></div></div>'
        : '<div class="section"><div class="section__head"><span class="section__title">Приглашение</span></div>' +
          '<div class="card"><p class="small muted">Передайте код партнёру — в приложении он выберет «Подключиться» и введёт его.</p>' +
          '<div class="invite"><span class="invite__code">' + e(h.invite_code || '—') + '</span>' +
          '<button type="button" class="btn btn--sm btn--primary" data-action="copy-invite">Копировать</button></div>' +
          '</div></div>') +
      '<div class="section"><div class="section__head"><span class="section__title">О приложении</span></div>' +
      '<div class="card small muted">Данные видят только участники семьи. Telegram-бот принимает записи сообщением: «кофе 350», «+15000 подработка».</div></div>' +
      (Api.isDemo()
        ? '<div class="section"><div class="section__head"><span class="section__title">Демо-режим</span></div>' +
          '<div class="card"><p class="small muted">Приложение открыто вне Telegram, данные вымышленные и хранятся в памяти страницы.</p>' +
          '<button type="button" class="btn btn--ghost mt-8" data-action="demo-reset">Сбросить демо-данные</button></div></div>'
        : '') +
      '<div class="actions"><button type="button" class="btn btn--full" data-action="refresh">Обновить</button></div>'
    );
  }

  // --- Онбординг ---

  function renderOnboarding(opts) {
    var tab = opts.tab || 'create';
    var isJoin = tab === 'join';
    return (
      '<div class="text-center mt-16"><div class="empty__icon">💰</div><h1 style="font-size:22px">Бюджет пары</h1>' +
      '<p class="muted small mt-8">Общий бюджет, личные расходы и расчёт между партнёрами.</p></div>' +
      '<div class="segments mt-24">' +
      '<button type="button" class="segment' + (!isJoin ? ' segment--active' : '') + '" data-action="onb-tab" data-onb="create">Создать семью</button>' +
      '<button type="button" class="segment' + (isJoin ? ' segment--active' : '') + '" data-action="onb-tab" data-onb="join">Подключиться</button>' +
      '</div>' +
      (!isJoin
        ? '<div class="segments">' +
          '<button type="button" class="segment' + ((opts.mode || 'pair') === 'pair' ? ' segment--active' : '') + '" data-action="onb-mode" data-mode="pair">👫 Для двоих</button>' +
          '<button type="button" class="segment' + ((opts.mode || 'pair') === 'solo' ? ' segment--active' : '') + '" data-action="onb-mode" data-mode="solo">🙋 Только для меня</button>' +
          '</div>' +
          '<p class="small muted mt-8">' +
          ((opts.mode || 'pair') === 'solo'
            ? 'Личный бюджет без приглашения. Партнёра можно не подключать — расчёт между участниками не показывается.'
            : 'После создания получите код, по которому партнёр подключится к общей семье.') +
          '</p>'
        : '') +
      '<form data-form="' + (isJoin ? 'join' : 'create') + '" novalidate>' +
      '<label class="field"><span class="field__label">Ваше имя</span>' +
      '<input class="input" name="member_name" maxlength="40" autocomplete="name" placeholder="Как вас звать?" value="' + e(opts.member_name || '') + '"></label>' +
      (isJoin
        ? '<label class="field"><span class="field__label">Код приглашения</span>' +
          '<input class="input input--code" name="code" maxlength="64" autocomplete="off" placeholder="например, a1b2c3d4" value="' + e(opts.code || '') + '"></label>'
        : '<label class="field"><span class="field__label">Название семьи</span>' +
          '<input class="input" name="name" maxlength="60" placeholder="Наша семья" value="' + e(opts.household_name || '') + '"></label>') +
      '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + (isJoin ? 'Подключиться' : 'Создать семью') + '</button></div>' +
      '</form>'
    );
  }

  function renderInvite(code) {
    return (
      '<div class="text-center mt-16"><div class="empty__icon">🎉</div><h1 style="font-size:20px">Семья создана</h1>' +
      '<p class="muted small mt-8">Передайте код партнёру. Перейти в бюджет можно и сейчас.</p></div>' +
      '<div class="invite"><span class="invite__code">' + e(code) + '</span>' +
      '<button type="button" class="btn btn--sm btn--primary" data-action="copy-code" data-code="' + e(code) + '">Копировать</button></div>' +
      '<div class="actions"><button type="button" class="btn btn--primary btn--full" data-action="start">Перейти в бюджет</button></div>'
    );
  }

  // --- Ошибки ---

  // opts.retry === false — повтор бессмысленен (например, нет сессии Telegram).
  // opts.promo — на экране истёкшего доступа добавляем путь к активации кода.
  function renderError(opts) {
    var btn = (opts.retry === false ? '' : '<button type="button" class="btn mt-16" data-action="retry">Повторить</button>') +
      (opts.promo ? '<button type="button" class="btn btn--primary mt-8" data-action="go-settings">Ввести промокод</button>' : '');
    return empty(opts.icon || '⚠️', opts.title || 'Что-то пошло не так', opts.text || '', btn);
  }

  root.Views = {
    skeletonSummary: skeletonSummary,
    skeletonList: skeletonList,
    categoryTxList: categoryTxList,
    renderSummary: renderSummary,
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
