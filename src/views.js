/**
 * Разметка экранов. Функции возвращают HTML-строку;
 * обработчики навешивает app.js через data-action / data-tab.
 */

(function (root) {
  var e = Fmt.escapeHtml;
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

  function categoryRow(c) {
    var plan = Number(c.plan) || 0;
    var fact = Number(c.fact) || 0;
    var pct = plan > 0 ? Math.round((fact / plan) * 100) : 0;
    var over = plan > 0 && fact > plan;
    var barCls = over ? ' progress__bar--over' : pct >= 85 ? ' progress__bar--warn' : '';
    return (
      '<div class="cat">' +
      '<div class="cat__top">' +
      '<span class="cat__icon">' + e(c.icon || '🏷️') + '</span>' +
      '<span class="cat__name">' + e(c.name) + '</span>' +
      '<span class="cat__fact' + (over ? ' cat__fact--over' : '') + '">' + e(money(fact)) + '</span>' +
      '</div>' +
      (plan > 0
        ? '<div class="progress"><div class="progress__bar' + barCls + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
          '<div class="cat__meta"><span>из ' + e(money(plan)) + '</span><span class="' + (over ? 'amount--neg' : '') + '">' + pct + '%</span></div>'
        : '<div class="cat__meta"><span>без лимита</span></div>') +
      '</div>'
    );
  }

  function renderSummary(s) {
    var st = State.get();
    s = s || { income: 0, expense: 0, balance: 0, categories: [], members: [] };
    var balance = Number(s.balance) || 0;
    var partners = s.members && s.members.length
      ? '<div class="card">' + s.members.map(partnerRow).join('') +
        '<div class="small muted mt-8">Как делим: ' + e(State.splitModeLabel()) + '</div></div>'
      : '';
    var cats = s.categories && s.categories.length
      ? s.categories.map(categoryRow).join('')
      : '<div class="empty">Категорий пока нет</div>';
    return (
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
      '<div class="tx__head"><span class="tx__name">' + e(c.name || 'Без категории') + '</span>' +
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

  function renderTxList(list) {
    var st = State.get();
    var body;
    if (!list || !list.length) {
      body = empty('🧾', 'Записей нет', 'За ' + Fmt.monthTitle(st.month) + ' пока ничего не записано.', '<button type="button" class="btn btn--primary" data-action="go-add">Добавить запись</button>');
    } else {
      body = groupByDay(list).map(function (g) {
        return '<div class="tx-group"><div class="tx-group__title">' + e(Fmt.dayLabel(g.day)) + '</div>' + g.items.map(txRow).join('') + '</div>';
      }).join('');
    }
    return monthNav(st.month) + body;
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

  // --- Настройки ---

  function renderSettings() {
    var st = State.get();
    var m = st.member;
    var h = (m && m.households) || {};
    var left = State.planDaysLeft();
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
      '<div class="settings-row"><span class="settings-row__label">Доступ</span><span class="settings-row__value' + (left !== null && left < 0 ? ' amount--neg' : '') + '">' + e(planText) + '</span></div>' +
      '</div>' +
      '<div class="section"><div class="section__head"><span class="section__title">Приглашение</span></div>' +
      '<div class="card"><p class="small muted">Передайте код партнёру — в приложении он выберет «Подключиться» и введёт его.</p>' +
      '<div class="invite"><span class="invite__code">' + e(h.invite_code || '—') + '</span>' +
      '<button type="button" class="btn btn--sm btn--primary" data-action="copy-invite">Копировать</button></div>' +
      '</div></div>' +
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

  // opts.retry === false — повтор бессмысленен (например, нет сессии Telegram)
  function renderError(opts) {
    var btn = opts.retry === false ? '' : '<button type="button" class="btn mt-16" data-action="retry">Повторить</button>';
    return empty(opts.icon || '⚠️', opts.title || 'Что-то пошло не так', opts.text || '', btn);
  }

  root.Views = {
    skeletonSummary: skeletonSummary,
    skeletonList: skeletonList,
    renderSummary: renderSummary,
    renderTxList: renderTxList,
    renderForm: renderForm,
    renderSettings: renderSettings,
    renderOnboarding: renderOnboarding,
    renderInvite: renderInvite,
    renderError: renderError,
  };
})(window);
