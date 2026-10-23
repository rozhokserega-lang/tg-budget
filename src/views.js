/**
 * Разметка экранов. Функции возвращают HTML-строку;
 * обработчики навешивает app.js через data-action / data-tab.
 */

(function (root) {
  var e = Fmt.escapeHtml;
  var T = I18n.t;
  var P = I18n.plural;

  // Duotone category illustrations: shared geometry and colour across screens.
  var categoryArtwork = {
    '🛒': '<path class="category-art__fill" d="M8 12h26l-3 14H12z"/><path d="M5 7h4l4 22h19M12 17h20M18 13l2 12m7-12-2 12"/><circle cx="16" cy="34" r="2"/><circle cx="29" cy="34" r="2"/><path d="M17 10V6m6 4V4m6 6V7"/>',
    '🏠': '<path class="category-art__fill" d="M9 18 21 7l12 11v17H9z"/><path d="m5 19 16-14 16 14M10 16v19h22V16M17 35V24h8v11M27 7V4h5v8"/><path d="M14 19h3m8 0h3"/>',
    '🚌': '<rect class="category-art__fill" x="9" y="5" width="24" height="30" rx="6"/><rect x="9" y="5" width="24" height="30" rx="6"/><path d="M10 22h22M21 11v11M14 9h14M7 15H5v7h3m27-7h2v7h-3M13 35v3m16-3v3"/><circle cx="15" cy="28" r="2"/><circle cx="27" cy="28" r="2"/>',
    '☕': '<path class="category-art__fill" d="M9 17h22v10a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z"/><path d="M9 17h22v10a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8zM31 19h3a5 5 0 0 1 0 10h-4M6 38h29M15 11c-4-4 4-4 0-8m7 8c-4-4 4-4 0-8"/>',
    '💊': '<path class="category-art__fill" d="m10 29 17-17a8 8 0 0 1 11 11L21 40z" transform="translate(-3 -4)"/><path d="m9 20 11-11a9 9 0 0 1 13 13L22 33A9 9 0 0 1 9 20zm6-6 13 13M25 11l3-3"/><path d="M6 7v6m-3-3h6M33 32v6m-3-3h6"/>',
    '👕': '<path class="category-art__fill" d="m14 6-10 8 6 9 5-3v17h14V20l5 3 6-9-10-8z"/><path d="m14 6-10 8 6 9 5-3v17h14V20l5 3 6-9-10-8M16 6a6 6 0 0 0 12 0M19 30h7"/>',
    '🎬': '<rect class="category-art__fill" x="6" y="16" width="30" height="21" rx="3"/><path d="M6 17h30v17a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 17 4 9l29-6 2 8zM11 7l5 6m4-8 5 6m4-8 5 6"/><path class="category-art__solid" d="m18 22 9 5-9 5z"/>',
    '📱': '<rect class="category-art__fill" x="12" y="4" width="21" height="34" rx="4"/><rect x="12" y="4" width="21" height="34" rx="4"/><path d="M18 8h9M20 34h5M6 14a10 10 0 0 0 0 14m3-11a6 6 0 0 0 0 8M18 17h9v9h-9z"/>',
    '🎁': '<path class="category-art__fill" d="M7 20h28v17H7zM5 13h32v8H5z"/><path d="M7 21v16h28V21M5 13h32v8H5zM21 13v24M21 13C7 15 8 1 16 5c4 2 5 8 5 8zm0 0C35 15 34 1 26 5c-4 2-5 8-5 8z"/>',
    '🧺': '<path class="category-art__fill" d="M5 17h32l-5 20H10z"/><path d="M5 17h32l-5 20H10zM11 17l6-12m14 12L25 5M15 23l1 8m10-8-1 8m-4-8v8M4 17h34"/>',
    '✈️': '<path class="category-art__fill" d="m5 22 13-5 1-11a3 3 0 0 1 6 0l1 11 12 5v5l-13-3-1 9 5 3v3l-8-2-8 2v-3l5-3-1-9-12 3z"/><path d="m5 22 13-5 1-11a3 3 0 0 1 6 0l1 11 12 5v5l-13-3-1 9 5 3v3l-8-2-8 2v-3l5-3-1-9-12 3z"/>',
    '📦': '<path class="category-art__fill" d="m5 12 16-8 16 8v19l-16 8-16-8z"/><path d="m5 12 16-8 16 8v19l-16 8-16-8zM5 12l16 8 16-8M21 20v19M13 8l16 8v8M10 27l5 3"/>',
    '💼': '<rect class="category-art__fill" x="5" y="12" width="32" height="24" rx="4"/><rect x="5" y="12" width="32" height="24" rx="4"/><path d="M14 12V6h14v6M5 21l12 4m8 0 12-4M18 21h6v7h-6zM11 32h5"/>',
    '🧩': '<path class="category-art__fill" d="M7 8h11a5 5 0 1 1 9 0h8v12a5 5 0 1 0 0 9v8H23a5 5 0 1 0-9 0H7V25a5 5 0 1 0 0-9z"/><path d="M7 8h11a5 5 0 1 1 9 0h8v12a5 5 0 1 0 0 9v8H23a5 5 0 1 0-9 0H7V25a5 5 0 1 0 0-9z"/>',
    '🏆': '<path class="category-art__fill" d="M12 5h18v11a9 9 0 0 1-18 0z"/><path d="M12 5h18v11a9 9 0 0 1-18 0zM12 9H5v5a8 8 0 0 0 9 8m16-13h7v5a8 8 0 0 1-9 8M21 25v9m-8 4v-4h16v4z"/><path d="m21 10 1 3 4 1-3 2 1 4-3-2-3 2 1-4-3-2 4-1z"/>',
    '➕': '<rect class="category-art__fill" x="5" y="9" width="32" height="26" rx="5"/><rect x="5" y="9" width="32" height="26" rx="5"/><path d="M5 16h32M21 21v9m-5-4h10M10 5h20"/>',
  };
  function categoryIcon(c) {
    var artwork = categoryArtwork[c.icon];
    if (!artwork) return e(c.icon || '🏷️');
    return '<svg class="category-art" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + artwork + '</svg>';
  }

  // Локальные (ещё не отправленные) записи заменяем серверными, когда те пришли.
  function reconcileList(list) {
    if (!Array.isArray(list)) return list;
    var real = {};
    list.forEach(function (t) { if (!t._local) real[t.id] = true; });
    return list.filter(function (t) { return !t._local || !real[t.id]; });
  }
  var money = Fmt.money;

  var QR_ICON_PATHS = '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M8 8h3v3H8zm5 5h3v3h-3z"/>';
  var PHOTO_ICON_PATHS = '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 21"/>';
  var QR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' + QR_ICON_PATHS + '</svg>';
  var PHOTO_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' + PHOTO_ICON_PATHS + '</svg>';

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
  function categoryRow(c, expanded, index) {
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
      '<div class="cat-wrap' + (open ? ' cat-wrap--open' : '') + '" style="--cat-order:' + index + '" data-cat-id="' + e(c.id) + '">' +
      '<button type="button" class="cat" data-action="toggle-cat" data-id="' + e(c.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<div class="cat__top">' +
      '<span class="cat__icon">' + categoryIcon(c) + '</span>' +
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
      '<div class="cat-tx__rows" data-count="' + rows.length + '">' + categoryTxList(rows, open, c.id) + '</div>' +
      '<button type="button" class="btn btn--sm btn--primary cat-tx__add" data-action="add-in-cat" data-id="' + e(c.id) + '">' +
      e(T('+ Добавить в «{name}»', { name: c.name })) + '</button>' +
      '</div></div>' +
      '</div>'
    );
  }

  // Записи категории для раскрытого списка. Используется и при полной
  // перерисовке, и при точечном обновлении уже открытой категории.
  function categoryTxList(rows, open, categoryId) {
    rows = rows || [];
    var sorted = rows.map(function (t, index) { return { t: t, index: index }; }).sort(function (a, b) {
      var day = String(b.t.occurred_on || '').slice(0, 10).localeCompare(String(a.t.occurred_on || '').slice(0, 10));
      var created = String(b.t.created_at || '').localeCompare(String(a.t.created_at || ''));
      return day || created || a.index - b.index;
    }).map(function (item) { return item.t; });
    var visible = sorted.slice(0, 5);
    var id = categoryId || (rows[0] && rows[0].category_id) || '';
    var all = rows.length > 5 && id
      ? '<button type="button" class="btn btn--sm cat-tx__all" data-action="open-cat-tx" data-id="' + e(id) + '">' + e(T('Посмотреть все')) + ' →</button>'
      : '';
    return visible.length
      ? visible.map(function (t) { return categoryTxRow(t); }).join('') + all
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
      (!isIncome && !t._local
        ? '<button type="button" class="tx-edit" data-action="edit-tx" data-id="' + e(t.id) + '" aria-label="' + e(T('Редактировать расход')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z"/></svg></button>' +
          '<button type="button" class="tx-delete" data-tx-delete="' + e(t.id) + '" aria-label="' + e(T('Удалить расход')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></button>'
        : '') +
      '</div>';
  }

  // Краткая строка о планах на сводке: показываем только если что-то заведено.
  function plansTeaser(plans) {
    if (!plans) return '';
    var goals = plans.goals || [], debts = plans.debts || [], wishes = plans.wishes || [];
    if (!goals.length && !debts.length && !wishes.length) return '';
    function positive(value) { return Math.max(0, Number(value) || 0); }
    var target = 0, saved = 0, debtTotal = 0, remaining = 0;
    goals.forEach(function (goal) {
      var amount = positive(goal.target);
      target += amount;
      saved += Math.min(amount, positive(goal.saved));
    });
    debts.forEach(function (debt) {
      var balance = positive(debt.remaining);
      debtTotal += Math.max(positive(debt.total), balance);
      remaining += balance;
    });
    var bought = wishes.filter(function (wish) { return wish.purchased; }).length;
    var wishTotal = wishes.filter(function (wish) { return !wish.purchased; }).reduce(function (sum, wish) {
      return sum + positive(wish.price);
    }, 0);
    function section(tab, title, icon, count, value, caption, done, total, footer) {
      var pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
      return '<button type="button" class="plans-overview__section plans-overview__section--' + tab + '" data-action="go-plans" data-plans-tab="' + tab + '">' +
        '<span class="plans-overview__top"><span class="plans-overview__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg></span>' +
        '<span class="plans-overview__name">' + e(T(title)) + '</span><span class="plans-overview__count">' + count + '</span><span class="plans-overview__arrow" aria-hidden="true">›</span></span>' +
        '<span class="plans-overview__amount">' + e(value) + '</span><span class="plans-overview__caption">' + e(caption) + '</span>' +
        (count && total > 0 ? '<span class="plans-overview__progress" role="progressbar" aria-label="' + e(T(title)) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></span>' : '') +
        '<span class="plans-overview__footer"><span>' + e(footer) + '</span>' + (count && total > 0 ? '<strong>' + pct + '%</strong>' : '') + '</span></button>';
    }
    return '<section class="plans-overview" aria-label="' + e(T('Планы')) + '"><div class="plans-overview__heading"><h2>' + e(T('Планы')) + '</h2>' +
      '<button type="button" data-action="go-plans">' + e(T('Все планы')) + ' <span aria-hidden="true">›</span></button></div>' +
      section('goals', 'Цели', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        goals.length, goals.length ? money(saved) : T('Пока нет целей'), goals.length ? T('Накоплено из {amount}', { amount: money(target) }) : T('Начните копить на важное'),
        saved, target, goals.length ? T('Осталось {amount}', { amount: money(Math.max(0, target - saved)) }) : T('Добавить цель')) +
      section('debts', 'Долги', '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18m-6 5h3M6 14h3"/>',
        debts.length, debts.length ? money(remaining) : T('Долгов нет'), debts.length ? T('Остаток к погашению') : T('Здесь появятся ваши долги'),
        debtTotal - remaining, debtTotal, debts.length ? T('Погашено {amount}', { amount: money(debtTotal - remaining) }) : T('Добавить долг')) +
      section('wishes', 'Желания', '<path d="M20 13 12 21 4 13a5 5 0 0 1 8-6 5 5 0 0 1 8 6z"/>',
        wishes.length, wishes.length ? money(wishTotal) : T('Список пока пуст'), wishes.length ? T('Стоимость оставшихся желаний') : T('Сохраните желанные покупки'),
        bought, wishes.length, wishes.length ? T('Куплено {done} из {total}', { done: bought, total: wishes.length }) : T('Добавить желание')) + '</section>';
  }

  // Ближайший повторяющийся платёж: за день до даты и в сам день — баннер сверху.
  // Показываем только первый, остальные — в «Планы → Платежи».
  // Крестик скрывает баннер до конца дня (State.dismissDue).
  function dueBanner(plans) {
    if (State.isDueDismissed()) return '';
    var list = (plans && plans.recurring) || [];
    var cache = State.get()['txCache:' + Fmt.currentMonth()];
    var transactions = (cache && cache.data) || [];
    var now = new Date();
    var soon = list.filter(function (r) {
      if (r.active === false) return false;
      return !transactions.some(function (tx) {
        return String(tx.note || '').trim().toLowerCase() === String(r.name || '').trim().toLowerCase() &&
          Math.abs(Number(tx.amount) - Number(r.amount)) < 0.005 &&
          (!r.category_id || tx.category_id === r.category_id);
      });
    }).map(function (r) {
      var due = Recurring.upcoming(r, now);
      return { r: r, diff: due.diff, visible: due.visible };
    }).filter(function (x) { return x.visible; })
      .sort(function (a, b) { return a.diff - b.diff; });
    if (!soon.length) return '';
    var x = soon[0];
    var more = soon.length - 1;
    var when = x.diff < 2 ? T(x.diff === 0 ? 'Сегодня платёж' : 'Завтра платёж') : T('Платёж через {days}', { days: P('days', x.diff) });
    return '<div class="due">' +
      '<button type="button" class="due__main" data-action="go-recurring">' +
      '<span class="due__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-13 5 3 2 5-4"/></svg></span>' +
      '<span class="due__body">' +
      '<span class="due__when">' + e(when) + '</span>' +
      '<span class="due__title">' + e(x.r.name) + '</span>' +
      '<span class="due__amount">' + e(money(x.r.amount)) + '</span>' +
      '<span class="due__hint">' + (more > 0 ? e(T('и ещё {n} · ', { n: more })) : '') + e(T('Все платежи')) + ' <span aria-hidden="true">›</span></span>' +
      '</span>' +
      '</button>' +
      '<button type="button" class="due__pay" data-action="pay-due" data-id="' + e(x.r.id) + '" aria-label="' + e(T('Отметить оплату') + ': ' + x.r.name) + '" title="' + e(T('Отметить оплату')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>' +
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
        { id: 'expense', label: 'Расход', tone: 'red', icon: '<path d="M12 4v15m-6-6 6 6 6-6"/>' },
        { id: 'income', label: 'Доход', tone: 'mint', icon: '<path d="M12 20V5m-6 6 6-6 6 6"/>' },
        { id: 'receipt-photo', label: 'Фото чека', tone: 'mint', icon: PHOTO_ICON_PATHS },
        { id: 'recurring-new', label: 'Новый платёж', tone: 'amber', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 14v4m-2-2h4"/>' },
        { id: 'goal-new', label: 'Новая цель', tone: 'violet', icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m15 9 5-5"/>' },
        { id: 'debt-new', label: 'Новый долг', tone: 'blue', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>' },
      ],
      [
        { id: 'transactions', label: 'Финансы', tone: 'blue', icon: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>' },
        { id: 'plans', label: 'Планы', tone: 'violet', icon: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>' },
        { id: 'recurring-list', label: 'Платежи', tone: 'amber', icon: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/>' },
        { id: 'expense-category', label: 'Категория расхода', tone: 'green', icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
        { id: 'income-category', label: 'Категория дохода', tone: 'mint', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10m-5-5h10"/>' },
        { id: 'wish-new', label: 'Новое желание', tone: 'pink', icon: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>' },
      ],
      [
        { id: 'settings', label: 'Ещё', tone: 'pink', icon: '<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>' },
      ],
    ];
    page = Math.max(0, Math.min(actionPages.length - 1, Number(page) || 0));
    // Все страницы лежат в одной ленте и сдвигаются по X: так работает свайп.
    return '<div class="quick-actions" data-page="' + page + '">' +
      '<div class="quick-actions__head">' +
      '<div class="sheet__title">' + e(T('Быстрые действия')) + '</div>' +
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
    var partners = !solo && s.split_mode !== 'none' && s.members && s.members.length
      ? '<div class="card">' + s.members.map(partnerRow).join('') +
        '<div class="small muted mt-8">' + e(T('Как делим: {mode}', { mode: T(State.splitModeLabel(s.split_mode)) })) + '</div></div>'
      : '';
    var categorySort = st.homeCategorySort === 'amount' ? 'amount' : 'default';
    var originalCategories = s.categories || [];
    var zeroCategories = originalCategories.filter(function (c) { return !(Number(c.fact) || 0); });
    var visibleCategories = categorySort === 'amount'
      ? originalCategories.map(function (c, index) { return { category: c, index: index }; })
          .filter(function (item) { return st.homeShowEmpty || (Number(item.category.fact) || 0) !== 0; })
          .sort(function (a, b) {
            var av = Number(a.category.fact) || 0, bv = Number(b.category.fact) || 0;
            return (av === 0) - (bv === 0) || bv - av || a.index - b.index;
          })
          .map(function (item) { return item.category; })
      : originalCategories;
    var cats = visibleCategories.length
      ? visibleCategories.map(function (c, index) {
          return categoryRow(c, expandedCat && expandedCat.id === c.id ? expandedCat : null, index);
        }).join('')
      : '<div class="empty">' + e(T(originalCategories.length ? 'Расходов за этот месяц нет' : 'Категорий пока нет')) + '</div>';
    var sortControls = '<div class="home-category-sort" role="group" aria-label="' + e(T('Порядок категорий')) + '">' +
      ['default', 'amount'].map(function (mode) {
        return '<button type="button" class="btn btn--sm" data-action="home-category-sort" data-sort="' + mode + '" aria-pressed="' + (categorySort === mode) + '">' + e(T(mode === 'amount' ? 'По сумме' : 'По умолчанию')) + '</button>';
      }).join('') + '</div>';
    var emptyControl = categorySort === 'amount' && zeroCategories.length
      ? '<button type="button" class="btn btn--sm home-empty-toggle" data-action="home-empty-toggle">' + e(T(st.homeShowEmpty ? 'Скрыть пустые категории' : 'Показать пустые категории')) + ' (' + zeroCategories.length + ')</button>' : '';
    var cover = root.Covers ? root.Covers.current() : null;
    var edit = !!st.homeEdit;
    var heroBlock =
      '<div class="hero' + (cover ? ' hero--cover' + (cover.tone === 'light' ? ' hero--cover--light' : '') + (cover.custom ? ' hero--custom' : '') : '') + '"' +
      (cover ? ' style="background-image:url(\'' + e(cover.file) + '\')"' : '') + '>' +
      balanceTrendSvg(transactions, st.month) +
      '<button type="button" class="hero__link" data-action="go-tx">' + e(T('Финансы →')) + '</button>' +
      '<div class="hero__label">' + e(T('Остаток за месяц')) + '</div>' +
      '<div class="hero__balance' + (balance < 0 ? ' hero__balance--negative' : '') + '">' + e(money(balance)) + '</div>' +
      '<div class="hero__row">' +
      '<button type="button" class="hero__item" data-action="go-add-kind" data-kind="income"><span class="hero__item-label"><svg class="hero__direction hero__direction--income" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>' + e(T('Доходы')) + '</span><span class="hero__item-value">+' + e(money(s.income)) + '</span></button>' +
      '<button type="button" class="hero__item" data-action="go-add-kind" data-kind="expense"><span class="hero__item-label"><svg class="hero__direction hero__direction--expense" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6"/></svg>' + e(T('Расходы')) + '</span><span class="hero__item-value">−' + e(money(s.expense)) + '</span></button>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="scan-btn scan-btn--primary home-scan" data-action="scan-receipt-home">' + QR_ICON + '<span>' + e(T('Сканировать чек')) + '</span></button>';
    var categoriesBlock = '<div class="section categories-section"><div class="section__head categories-section__head"><span class="section__title">' + e(T('Категории')) + '</span>' +
      '<button type="button" class="categories-view-toggle" data-action="toggle-category-view" data-view="' + (viewMode === 'grid' ? 'list' : 'grid') +
      '" aria-label="' + e(viewLabel) + '" aria-pressed="' + (viewMode === 'list') + '" title="' + e(viewLabel) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + viewIcon + '</svg></button></div>' +
      sortControls + '<div class="card categories--' + viewMode + '">' + cats + '</div>' + emptyControl + '</div>';
    var partnersBlock = partners ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Между партнёрами')) + '</span></div>' + partners + '</div>' : '';
    var blockMap = {
      balance: heroBlock,
      categories: categoriesBlock,
      forecast: forecastCard(s, plans),
      plans: plansTeaser(plans),
      partners: partnersBlock,
    };
    var blockLabels = {
      balance: 'Карточка бюджета',
      categories: 'Категории',
      forecast: 'Прогноз',
      plans: 'Планы',
      partners: 'Между партнёрами',
    };
    var order = State.homeOrder ? State.homeOrder() : ['balance', 'categories', 'forecast', 'plans', 'partners'];
    function editBlock(id, content, index) {
      var label = T(blockLabels[id]);
      var emptyText = T('Нет данных для этого блока');
      return '<section class="home-block" data-home-block="' + e(id) + '" aria-label="' + e(label) + '">' +
        '<div class="home-block__head"><span class="home-block__title">' + e(label) + '</span>' +
        '<div class="home-block__actions">' +
        '<button type="button" class="home-block__move" data-action="home-move" data-home-edit data-id="' + e(id) + '" data-dir="up"' +
        ' aria-label="' + e(T('Переместить «{name}» выше', { name: label })) + '"' + (index === 0 ? ' disabled' : '') + '>' +
        '<span aria-hidden="true">↑</span></button>' +
        '<button type="button" class="home-block__move" data-action="home-move" data-home-edit data-id="' + e(id) + '" data-dir="down"' +
        ' aria-label="' + e(T('Переместить «{name}» ниже', { name: label })) + '"' + (index === order.length - 1 ? ' disabled' : '') + '>' +
        '<span aria-hidden="true">↓</span></button>' +
        '</div></div>' +
        '<div class="home-block__content" inert>' + (content || '<div class="empty home-block__empty">' + e(emptyText) + '</div>') + '</div>' +
        '</section>';
    }
    var toolbar = edit
      ? '<div class="home-toolbar home-toolbar--edit"><span class="home-toolbar__title">' + e(T('Порядок блоков')) + '</span>' +
        '<div class="home-toolbar__actions">' +
        '<button type="button" class="btn btn--sm" data-action="home-edit-reset" data-home-edit>' + e(T('Сбросить')) + '</button>' +
        '<button type="button" class="btn btn--sm" data-action="home-edit-cancel" data-home-edit>' + e(T('Отмена')) + '</button>' +
        '<button type="button" class="btn btn--sm btn--primary" data-action="home-edit-save" data-home-edit>' + e(T('Сохранить')) + '</button>' +
        '</div></div>'
      : '<div class="home-toolbar"><button type="button" class="home-toolbar__edit" data-action="home-edit">' + e(T('Изменить главную')) + '</button></div>';
    var body = order.map(function (id, index) {
      var content = blockMap[id] || '';
      return edit ? editBlock(id, content, index) : content;
    }).join('');
    return dueBanner(plans) + monthNav(st.month) + toolbar + body;
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
      '<span class="cat__icon">' + categoryIcon(c) + '</span>' +
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
    list.map(function (t, index) { return { tx: t, index: index }; }).sort(function (a, b) {
      var day = String(b.tx.occurred_on || '').slice(0, 10).localeCompare(String(a.tx.occurred_on || '').slice(0, 10));
      var created = String(b.tx.created_at || '').localeCompare(String(a.tx.created_at || ''));
      return day || created || a.index - b.index;
    }).forEach(function (item) {
      var t = item.tx;
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
      if (f.kind && ((t.categories && t.categories.kind) || 'expense') !== f.kind) return false;
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
    return !!(f.kind || f.category_id || f.member_id || String(f.q || '').trim());
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
    if (!options.length && !current) return '';
    var list = [{ id: '', name: allLabel }].concat(options);
    var selected = list.find(function (o) { return o.id === current; }) || list[0];
    function optionContent(o) {
      return '<span class="category-picker__icon">' + (o.id ? categoryIcon(o) :
        '<svg class="category-art" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="3"/><rect x="26" y="6" width="12" height="12" rx="3"/><rect x="6" y="26" width="12" height="12" rx="3"/><rect x="26" y="26" width="12" height="12" rx="3"/></svg>') + '</span><span>' + e(o.name) + '</span>';
    }
    return '<div class="tx-filter"><span class="tx-filter__label">' + e(label) + '</span>' +
      '<details class="category-picker"><summary aria-label="' + e(label) + '"><span class="category-picker__current">' + optionContent(selected) +
      '</span><svg class="category-picker__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></summary>' +
      '<div class="category-picker__options" role="group" aria-label="' + e(label) + '">' + list.map(function (o) {
        return '<button type="button" class="category-picker__option" aria-label="' + e(o.name) + '" data-tx-choice="' + e(o.id) + '" aria-pressed="' + (o.id === current) + '">' + optionContent(o) + '</button>';
      }).join('') + '</div></details></div>';
  }

  function txControls(all, filter) {
    var f = filter || {};
    var opts = txFilterOptions(all, f);
    var q = String(f.q || '');
    var selects = txSelect(T('Категория'), 'data-tx-category', f.category_id || '', opts.categories, T('Все'));
    return '<div class="tx-search-row">' +
      '<div class="tx-search">' +
      '<span class="tx-search__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg></span>' +
      '<input id="tx-search" class="tx-search__input" type="search" autocomplete="off" enterkeyhint="search" ' +
      'placeholder="' + e(T('Заметка, категория')) + '" aria-label="' + e(T('Поиск по тратам')) + '" value="' + e(q) + '">' +
      '<button type="button" class="tx-search__clear" data-action="tx-search-clear" aria-label="' + e(T('Очистить поиск')) + '"' +
      (q ? '' : ' hidden') + '>&times;</button>' +
      '</div>' +
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
    var kindLabel = f.kind === 'income' ? T('Доходы') : f.kind === 'expense' ? T('Расходы') : '';
    var found = T('Найдено: {records}', { records: P('records', list.length) });
    var count = '<div class="tx-count"><span>' + (kindLabel ? e(kindLabel) + ' · ' : '') + e(found) + '</span>' +
      '<button type="button" class="tx-count__reset" data-action="tx-clear-filter">' + e(T('Сбросить')) + '</button></div>';
    return (active ? count : '') +
      groupByDay(list).map(function (g) {
        return '<div class="tx-group"><div class="tx-group__title">' + e(Fmt.dayLabel(g.day)) + '</div>' + g.items.map(financeHistoryRow).join('') + '</div>';
      }).join('');
  }

  function renderTxList(all, filter, chartMode) {
    var st = State.get();
    var pending = (root.Queue && Queue.size()) ? '<div class="sync-note">' + e(T('Изменения отправятся, когда появится связь')) + '</div>' : '';
    return '<div class="finance-page"><div class="finance-heading"><h1>' + e(T('Финансы')) + '</h1></div>' +
      monthNav(st.month) + pending + financeOverview(all, filter, chartMode) +
      '<div class="finance-ledger">' + txControls(all, filter) +
      '<h2 class="finance-history-title">' + e(T('История')) + '</h2>' +
      '<div id="tx-results">' + txResults(all, filter) + '</div></div></div>';
  }

  function financeHistoryRow(t) {
    var c = t.categories || {};
    var income = c.kind === 'income';
    return '<div class="tx finance-operation" data-tx-id="' + e(t.id) + '"><div class="tx__row" data-tx-row tabindex="0" aria-label="' + e((t.note || c.name || '') + ' · ' + Fmt.signedMoney(t.amount, income)) + '">' +
      '<span class="cat__icon">' + categoryIcon(c) + '</span><div class="tx__body">' +
      '<div class="tx__head"><span class="finance-operation__name">' + e(c.name || T('Без категории')) +
      (t._local ? '<span class="badge">' + e(T('отправляется')) + '</span>' : '') + '</span>' +
      '<span class="amount ' + (income ? 'amount--pos' : 'amount--neg') + '">' + e(Fmt.signedMoney(t.amount, income)) + '</span></div>' +
      '<div class="finance-operation__meta"><span class="finance-operation__note">' + e(t.note || '') + '</span>' +
      '<span>' + e(Fmt.dayLabel(t.occurred_on)) + '</span></div></div>' +
      '</div>' + (!income && !t._local ? '<button type="button" class="tx__edit-inline" tabindex="-1" data-action="edit-tx" data-id="' + e(t.id) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z"/></svg>' + e(T('Редактировать')) + '</button>' : '') +
      '<button type="button" class="tx__delete-inline" tabindex="-1" data-tx-delete="' + e(t.id) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>' + e(T('Удалить')) + '</button></div>';
  }

  function financeOverview(all, filter, chartMode) {
    var income = 0, expense = 0, incomeGroups = {}, expenseGroups = {};
    // Режим графика не зависит от фильтра списка: «Остаток» показывает все
    // операции, а «Доходы»/«Расходы» дополнительно фильтруют историю.
    var mode = chartMode === 'income' || chartMode === 'expense' || chartMode === 'balance'
      ? chartMode
      : ((filter && (filter.kind === 'income' || filter.kind === 'expense')) ? filter.kind : 'expense');
    reconcileList(all || []).forEach(function (tx) {
      if (root.AppState && root.AppState.isDeleting(tx.id)) return;
      var amount = Number(tx.amount) || 0;
      var isIncome = tx.categories && tx.categories.kind === 'income';
      var groups = isIncome ? incomeGroups : expenseGroups;
      if (isIncome) income += amount; else expense += amount;
      var key = tx.category_id || 'other';
      if (!groups[key]) groups[key] = { name: (tx.categories && tx.categories.name) || T('Прочее'), amount: 0 };
      groups[key].amount += amount;
    });
    var cards = [
      ['income', T('Доходы'), '+' + money(income), '<path d="M6 18 18 6M6 6h12v12"/>'],
      ['expense', T('Расходы'), '−' + money(expense), '<path d="m6 6 12 12M6 18h12V6"/>'],
      ['balance', T('Остаток'), money(income - expense), '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M16 14h5v4h-5zM6 6V3h12"/>'],
    ].map(function (item) {
      var active = mode === item[0];
      return '<button type="button" data-action="tx-kind" data-kind="' + item[0] + '" aria-pressed="' + active + '" class="finance-stat finance-stat--' + item[0] + (active ? ' finance-stat--active' : '') + '"><span class="finance-stat__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + item[3] +
        '</svg></span><span class="finance-stat__label">' + e(item[1]) + '</span><strong>' + e(item[2]) + '</strong></button>';
    }).join('');

    function topCategories(groups) {
      var list = Object.keys(groups).map(function (key) { return groups[key]; }).sort(function (a, b) { return b.amount - a.amount; });
      if (list.length > 5) list = list.slice(0, 4).concat([{ name: T('Прочее'), amount: list.slice(4).reduce(function (sum, c) { return sum + c.amount; }, 0) }]);
      return list;
    }

    var cats;
    if (mode === 'balance') {
      cats = [];
      if (income > 0) cats.push({ name: T('Доходы'), amount: income, color: '#54ef9c' });
      if (expense > 0) cats.push({ name: T('Расходы'), amount: expense, color: '#ff637c' });
    } else {
      cats = topCategories(mode === 'income' ? incomeGroups : expenseGroups);
    }

    var total = mode === 'income' ? income : mode === 'balance' ? income + expense : expense;
    // Расходный график сохраняет прежнюю палитру; доходный — зелёно-голубую,
    // чтобы доходные сегменты не выглядели как расходные.
    var colors = mode === 'income'
      ? ['#54ef9c', '#7fe3c1', '#6cb8ff', '#b8f27c', '#b984ff']
      : ['#54ef9c', '#ff637c', '#7989ff', '#eb62e4', '#b984ff'];
    var offset = 0, circumference = 2 * Math.PI * 70;
    var segments = total > 0 ? cats.map(function (c, i) {
      var length = c.amount / total * circumference;
      var gap = Math.min(8, length * .2);
      var dash = Math.max(0, length - gap);
      var rest = circumference - dash;
      // Кольцо «заполняется» после переключения графика: CSS анимирует
      // stroke-dasharray от пустого сегмента до его доли. Небольшая задержка
      // по индексу даёт последовательное заполнение по часовой стрелке.
      var segment = '<circle class="finance-ring__segment" cx="100" cy="100" r="70" stroke="' + (c.color || colors[i]) + '" stroke-dasharray="' + dash + ' ' + rest + '" stroke-dashoffset="' + (-offset) + '" style="--circ:' + circumference.toFixed(2) + ';--len:' + dash.toFixed(2) + ';--rest:' + rest.toFixed(2) + ';--segment-delay:' + (i * 80) + 'ms"/>';
      offset += length;
      return segment;
    }).join('') : '';
    var legend = total > 0 ? cats.map(function (c, i) {
      return '<div class="finance-legend__item" style="--segment:' + (c.color || colors[i]) + '"><span>' + e(c.name) + '</span><small>' + Math.round(c.amount / total * 100) + '%</small></div>';
    }) : [];
    var centerValue, centerLabel, ariaLabel;
    if (total <= 0) {
      centerValue = money(0);
      centerLabel = mode === 'income' ? T('Доходов за этот месяц нет')
        : mode === 'expense' ? T('Расходов за этот месяц нет')
        : T('Пока нет данных');
    } else if (mode === 'income') {
      centerValue = '+' + money(income);
      centerLabel = T('Доходы за месяц');
    } else if (mode === 'balance') {
      centerValue = money(income - expense);
      centerLabel = T('Остаток');
    } else {
      centerValue = '−' + money(expense);
      centerLabel = T('Траты за месяц');
    }
    ariaLabel = mode === 'income' ? T('Доходы по категориям')
      : mode === 'balance' ? T('Доходы и расходы')
      : T('Расходы по категориям');
    return '<div class="finance-stats">' + cards + '</div><div class="finance-breakdown">' +
      '<div class="finance-legend finance-legend--left">' + legend.filter(function (_, i) { return i % 2 === 1; }).join('') + '</div>' +
      '<div class="finance-ring"><svg viewBox="0 0 200 200" role="img" aria-label="' + e(ariaLabel) + '"><circle class="finance-ring__track" cx="100" cy="100" r="70"/><g transform="rotate(-90 100 100)">' + segments + '</g></svg>' +
      '<div class="finance-ring__center"><strong>' + e(centerValue) + '</strong><span>' + e(centerLabel) + '</span></div></div>' +
      '<div class="finance-legend finance-legend--right">' + legend.filter(function (_, i) { return i % 2 === 0; }).join('') + '</div></div>';
  }

  // --- Форма добавления ---

  function renderEditForm(tx) {
    var categories = (State.get().categories || []).filter(function (c) { return c.kind === 'expense'; });
    if (!categories.some(function (c) { return c.id === tx.category_id; }) && tx.categories) {
      categories = categories.concat([Object.assign({}, tx.categories, { id: tx.category_id })]);
    }
    return '<form class="edit-tx-form" data-form="edit-tx" novalidate><h2>' + e(T('Редактировать расход')) + '</h2>' +
      '<label class="field"><span class="field__label">' + e(T('Сумма расхода')) + '</span><input class="input" name="amount" inputmode="decimal" autocomplete="off" value="' + e(tx.amount) + '" required></label>' +
      '<label class="field"><span class="field__label">' + e(T('Категория')) + '</span><select class="input" name="category_id">' + categories.map(function (c) {
        return '<option value="' + e(c.id) + '"' + (c.id === tx.category_id ? ' selected' : '') + '>' + e(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span class="field__label">' + e(T('Заметка')) + '</span><input class="input" name="note" maxlength="200" value="' + e(tx.note || '') + '"></label>' +
      '<label class="field"><span class="field__label">' + e(T('Дата')) + '</span><input class="input" type="date" name="occurred_on" value="' + e(String(tx.occurred_on || '').slice(0, 10)) + '" required></label>' +
      '<p class="edit-tx-error" role="alert" hidden></p><div class="actions"><button type="submit" class="btn btn--primary">' + e(T('Сохранить')) + '</button>' +
      '<button type="button" class="btn" data-action="cancel-edit-tx">' + e(T('Отмена')) + '</button></div></form>';
  }

  function renderForm(opts) {
    var st = State.get();
    var amount = opts.amount || '';
    var note = opts.note || '';
    var date = opts.date || Fmt.todayIso();
    var kind = opts.kind || 'expense';
    var solo = State.isSolo();
    var isShared = !solo && opts.is_shared !== false;
    var cid = opts.category_id || '';
    var list = (st.categories || []).filter(function (c) { return c.kind === kind; });
    var chips = list.length
      ? list.map(function (c) {
          return '<button type="button" class="cat-chip' + (c.id === cid ? ' cat-chip--active' : '') + '" aria-pressed="' + (c.id === cid) + '" data-action="pick-cat" data-id="' + e(c.id) + '">' +
            '<span class="cat-chip__icon">' + categoryIcon(c) + '</span><span>' + e(c.name) + '</span></button>';
        }).join('')
      : '<div class="muted small">' + e(T('Нет категорий — обновите приложение')) + '</div>';
    var scanBlock = '';
    if (opts.receipt) {
      var receiptDate = String(opts.receipt.date || '');
      var shownDate = /^\d{4}-\d{2}-\d{2}$/.test(receiptDate)
        ? receiptDate.slice(8, 10) + '.' + receiptDate.slice(5, 7) + '.' + receiptDate.slice(0, 4)
        : receiptDate;
      scanBlock = '<div class="receipt-chip" role="status"><span class="receipt-chip__icon" aria-hidden="true">🧾</span>' +
        '<span class="receipt-chip__text">' + e(T('Чек от {date} · {sum}', { date: shownDate, sum: Fmt.money(opts.receipt.sum) })) + '</span>' +
        '<button type="button" class="receipt-chip__x" data-action="clear-receipt" aria-label="' + e(T('Убрать чек')) + '">×</button></div>';
    } else {
      var tg = root.Tg;
      var canScan = !!(tg && ((typeof tg.canScanQr === 'function' && tg.canScanQr()) ||
        (typeof tg.isInsideTelegram === 'function' && !tg.isInsideTelegram())));
      scanBlock = '<div class="scan-row">' +
        (canScan ? '<button type="button" class="scan-btn scan-btn--primary" data-action="scan-receipt">' + QR_ICON + '<span>' + e(T('Сканировать чек')) + '</span></button>' : '') +
        '<button type="button" class="scan-btn" data-action="pick-receipt-photo">' + PHOTO_ICON + '<span>' + e(T('Распознать QR с фото')) + '</span></button>' +
        '</div>';
    }
    return (
      '<form class="entry-form entry-form--' + kind + '" data-form="add" novalidate>' +
      '<div class="entry-heading"><button type="button" class="profile-back" data-action="start" aria-label="' + e(T('Назад')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><div><h1>' + e(T(kind === 'income' ? 'Новый доход' : 'Новый расход')) + '</h1><p>' + e(T('Добавьте запись в свой бюджет')) + '</p></div></div>' +
      '<div class="segments entry-kind" role="group" aria-label="' + e(T('Тип записи')) + '">' +
      '<button type="button" class="segment' + (kind === 'expense' ? ' segment--active' : '') + '" aria-pressed="' + (kind === 'expense') + '" data-action="pick-kind" data-kind="expense"><span aria-hidden="true">↘</span>' + e(T('Расход')) + '</button>' +
      '<button type="button" class="segment' + (kind === 'income' ? ' segment--active' : '') + '" aria-pressed="' + (kind === 'income') + '" data-action="pick-kind" data-kind="income"><span aria-hidden="true">↗</span>' + e(T('Доход')) + '</button>' +
      '</div>' + scanBlock +
      '<label class="field entry-amount"><span class="field__label">' + e(T(kind === 'income' ? 'Сумма дохода' : 'Сумма расхода')) + '</span>' +
      '<span class="entry-amount__line"><span class="entry-amount__sign" aria-hidden="true">' + (kind === 'income' ? '+' : '−') + '</span><input class="input input--amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="' + e(amount) + '" required><span class="entry-amount__currency">' + e(Fmt.currencySymbol()) + '</span></span></label>' +
      '<div class="entry-section-heading"><h2>' + e(T('Категория')) + '</h2><span>' + e(T('Выберите одну')) + '</span></div>' +
      '<div class="cat-grid">' + chips + '</div>' +
      '<div class="entry-section-heading"><h2>' + e(T('Детали')) + '</h2></div><div class="entry-details">' +
      '<label class="field"><span class="field__label">' + e(T('Заметка')) + '</span>' +
      '<input class="input" name="note" maxlength="200" autocomplete="off" placeholder="' + e(T('Например: пятерочка')) + '" value="' + e(note) + '"></label>' +
      (kind === 'expense' && !solo
        ? '<label class="switch-row"><span class="switch-row__text"><span class="switch-row__title">' + e(T('Общий расход')) + '</span>' +
          '<span class="switch-row__hint">' + e(T('Делим между партнёрами')) + '</span></span>' +
          '<span class="switch"><input type="checkbox" name="is_shared"' + (isShared ? ' checked' : '') + '><span class="switch__track"></span></span></label>'
        : '') +
      '<label class="field mt-16"><span class="field__label">' + e(T('Дата')) + '</span>' +
      '<input class="input" type="date" name="occurred_on" max="' + Fmt.todayIso() + '" value="' + e(date) + '"></label>' +
      '</div><div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T(kind === 'income' ? 'Добавить доход' : 'Добавить расход')) + '</button></div>' +
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
      '<span class="plan__amount' + (done ? ' amount--pos' : '') + '">' + e(money(saved)) + '<small> / ' + e(money(target)) + '</small></span>' +
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
      '<span class="plan__amount' + (closed ? ' amount--pos' : '') + '">' + e(money(remaining)) + '<small> ' + e(T('осталось')) + '</small></span>' +
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
      '<span class="cat__icon">' + categoryIcon(cat) + '</span>' +
      '<span class="plan__name">' + e(r.name) + '</span>' +
      '<span class="plan__amount">' + e(money(r.amount)) + '</span>' +
      '<button type="button" class="plan__more" data-recurring-more>···</button></div>' +
      '<div class="plan__meta">' + e(T('День {day} · {category}', {
        day: r.day_of_month,
        category: cat.name || T('без категории'),
      })) + '</div>' +
      '<div class="plan__meta">' + e(Recurring.reminderDays(r.reminder_days) === 0 ? T('На главной: в день платежа') : T('На главной: за {days}', { days: P('days', Recurring.reminderDays(r.reminder_days)) })) + '</div>' +
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
    var total = 0, completed = 0, target = 0;
    list.forEach(function (item) {
      if (tab === 'goals') { total += Math.max(0, Number(item.saved) || 0); target += Math.max(0, Number(item.target) || 0); if (Number(item.saved) >= Number(item.target)) completed++; }
      if (tab === 'debts') { total += Math.max(0, Number(item.remaining) || 0); if (Number(item.remaining) <= 0) completed++; }
      if (tab === 'wishes') { if (item.purchased) completed++; else total += Math.max(0, Number(item.price) || 0); }
      if (tab === 'recurring' && item.active !== false) total += Math.max(0, Number(item.amount) || 0);
    });
    var labels = { goals: ['Накоплено на цели', 'Двигайтесь к тому, что важно'], debts: ['Осталось погасить', 'Держите обязательства под контролем'], wishes: ['На будущие покупки', 'Всё, что хочется осуществить'], recurring: ['Регулярные платежи в месяц', 'Запланированные расходы без сюрпризов'] };
    var addLabels = { goals: 'Новая цель', debts: 'Новый долг', wishes: 'Новое желание', recurring: 'Новый платёж' };
    return (
      '<div class="plans-page plans-page--' + tab + '"><div class="plans-heading"><div><h1>' + e(T('Планы')) + '</h1><p>' + e(T(labels[tab][1])) + '</p></div>' +
      '<button type="button" class="plans-create" data-action="plan-add" data-kind="' + tab + '" aria-label="' + e(T(addLabels[tab])) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>' +
      '<div class="segments plans-segments" role="group" aria-label="' + e(T('Разделы планов')) + '">' +
      PLANS_TABS.map(function (t) {
        return '<button type="button" class="segment' + (t.id === tab ? ' segment--active' : '') + '" aria-pressed="' + (t.id === tab) + '" data-action="plans-tab" data-plans="' + t.id + '">' + e(T(t.label)) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="plans-total"><span>' + e(T(labels[tab][0])) + '</span><strong>' + e(money(total)) + '</strong><div class="plans-total__footer"><span>' + e(T('Всего: {n}', { n: list.length })) + '</span><span>' +
      (tab === 'goals' ? e(T('из {amount}', { amount: money(target) })) : tab === 'recurring' ? e(T('В месяц')) : e(T('Завершено: {n}', { n: completed }))) + '</span></div></div>' +
      '<div class="plans-list-heading"><h2>' + e(T(PLANS_TABS.find(function (item) { return item.id === tab; }).label)) + '</h2><span>' + list.length + '</span></div>' +
      '<div class="plans">' + body + '</div>' +
      (list.length ? '<div class="actions"><button type="button" class="btn btn--primary btn--full" data-action="plan-add" data-kind="' + tab + '">+ ' + e(T(addLabels[tab])) + '</button></div>' : '') + '</div>'
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
      '<label class="field"><span class="field__label">' + e(T('Напоминание на главной — за сколько дней')) + '</span>' +
      '<input class="input" type="number" name="reminder_days" min="0" max="30" step="1" inputmode="numeric" required value="' + Recurring.reminderDays(opts.reminder_days) + '"></label>' +
      '<p class="small muted">' + e(T('От 0 до 30 дней. 0 — только в день платежа. Напоминание отображается до даты оплаты включительно. 31-е в коротком месяце сдвигаем на последний день.')) + '</p>' +
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
        '<span class="cat__icon">' + categoryIcon(c) + '</span>' +
        '<span class="limit__name">' + e(c.name) + '</span>' +
        '<span class="limit__value' + (plan > 0 ? '' : ' muted') + '">' + (plan > 0 ? e(money(plan)) : e(T('без лимита'))) + '</span>' +
        '<span class="limit__chev">›</span>' +
        '</button>';
    }

    return (
      '<div class="profile-detail__heading"><button type="button" class="profile-back" data-action="open-profile-section" data-section="budget" aria-label="' + e(T('Назад')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1>' + e(T('Категории и лимиты')) + '</h1></div>' +
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
    var current = root.Covers ? root.Covers.id() : 'default';
    var options = (root.Covers ? root.Covers.list : []).map(function (c) {
      var bg = c.file ? ' style="background-image:url(\'' + e(c.file) + '\')"' : '';
      var active = c.id === current;
      return '<button type="button" class="cover-option' + (active ? ' cover-option--active' : '') + '"' +
        ' data-action="pick-cover" data-cover="' + e(c.id) + '"' +
        ' aria-label="' + e(T(c.name)) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' + bg + '>' +
        '<span class="cover-option__name">' + e(T(c.name)) + '</span>' +
        (active ? '<span class="cover-option__check">✓</span>' : '') +
        '</button>';
    }).join('');
    var custom = root.Covers && root.Covers.custom ? root.Covers.custom() : null;
    if (custom) {
      var customActive = current === 'custom';
      options += '<button type="button" class="cover-option cover-option--custom' + (customActive ? ' cover-option--active' : '') + '"' +
        ' data-action="pick-cover" data-cover="custom"' +
        ' aria-label="' + e(T('Своё фото')) + '" aria-pressed="' + (customActive ? 'true' : 'false') + '"' +
        ' style="background-image:url(\'' + e(custom.file) + '\')">' +
        '<span class="cover-option__name">' + e(T('Своё фото')) + '</span>' +
        (customActive ? '<span class="cover-option__check">✓</span>' : '') +
        '</button>';
    }
    return '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Оформление')) + '</span></div>' +
      '<div class="card">' +
      '<div class="cover-label">' + e(T('Обложка главной карты')) + '</div>' +
      '<div class="cover-grid">' + options + '</div>' +
      '<input type="file" class="cover-upload__input" accept="image/*" data-cover-file aria-label="' + e(T('Выбрать изображение')) + '">' +
      '<div class="cover-upload">' +
      '<button type="button" class="btn btn--sm" data-action="pick-cover-file">' + e(T(custom ? 'Заменить фото' : 'Загрузить фото')) + '</button>' +
      (custom ? '<button type="button" class="btn btn--sm btn--ghost" data-action="clear-custom-cover">' + e(T('Убрать своё фото')) + '</button>' : '') +
      '</div>' +
      '<p class="small muted mt-8">' + e(T('Своё фото хранится только на этом устройстве, не отправляется на сервер и не синхронизируется.')) + '</p>' +
      '<p class="small muted mt-8">' + e(T('Применяется к карточке остатка на главной. Выбор сохраняется на этом устройстве.')) + '</p>' +
      '</div></div>';
  }

  // Редактор своего фона: кадр под размер карточки, масштаб и положение.
  function renderCoverEditor() {
    return '<div class="sheet__title">' + e(T('Свой фон')) + '</div>' +
      '<p class="small muted">' + e(T('Выберите кадр — он сохранится только на этом устройстве.')) + '</p>' +
      '<div class="cover-crop"><canvas data-cover-preview width="750" height="300" aria-label="' + e(T('Предпросмотр фона')) + '"></canvas></div>' +
      '<label class="cover-control"><span class="cover-control__label">' + e(T('Масштаб')) + '</span>' +
      '<input type="range" min="100" max="300" value="100" data-cover-zoom aria-label="' + e(T('Масштаб')) + '"></label>' +
      '<label class="cover-control"><span class="cover-control__label">' + e(T('Сдвиг по горизонтали')) + '</span>' +
      '<input type="range" min="0" max="100" value="50" data-cover-x aria-label="' + e(T('Сдвиг по горизонтали')) + '"></label>' +
      '<label class="cover-control"><span class="cover-control__label">' + e(T('Сдвиг по вертикали')) + '</span>' +
      '<input type="range" min="0" max="100" value="50" data-cover-y aria-label="' + e(T('Сдвиг по вертикали')) + '"></label>' +
      '<div class="actions actions--row">' +
      '<button type="button" class="btn btn--ghost" data-sheet-close>' + e(T('Отмена')) + '</button>' +
      '<button type="button" class="btn btn--primary" data-action="apply-cover">' + e(T('Применить')) + '</button>' +
      '</div>';
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

  // Ярлык Telegram Mini App на главном экране. Строку показываем только когда
  // клиент подтвердил поддержку; на десктопе checkHomeScreenStatus = unsupported.
  function homeScreenRow(status) {
    var added = status === 'added';
    if (!added && status !== 'missed' && status !== 'unknown') return '';
    var platform = root.Tg && root.Tg.platform ? root.Tg.platform() : '';
    var android = platform === 'android' || platform === 'android_x';
    var hint = added ? 'Ярлык уже добавлен' : android ? 'Подтвердите в системном окне Android' : 'Открывайте бюджет в один тап';
    return '<div class="profile-menu profile-menu--shortcut">' +
      '<button type="button" class="profile-menu__item profile-menu__item--shortcut' + (added ? ' profile-menu__item--done' : '') + '" data-action="add-home-screen"' + (added ? ' aria-disabled="true"' : '') + '>' +
      '<span class="profile-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v6m-3-3h6M10 18h4"/></svg></span>' +
      '<span class="profile-menu__text"><strong>' + e(T(added ? 'Приложение на главном экране' : 'Добавить на главный экран')) + '</strong>' +
      '<small>' + e(T(hint)) + '</small></span>' +
      '<span class="profile-menu__arrow" aria-hidden="true">' + (added ? '✓' : '›') + '</span></button></div>';
  }

  function renderSettings(section) {
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
    var sections = [
      ['family', 'Семья и участники', 'Участники, общие траты и приглашение', '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/>'],
      ['budget', 'Бюджет и лимиты', 'Категории, лимиты и баланс карты', '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-5 5h5v3h-5z"/>'],
      ['appearance', 'Оформление и язык', 'Обложка, язык и обозначение валюты', '<path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h2a3 3 0 0 0 3-3 9 9 0 0 0-9-7z"/><path d="M7 10h.01M10 6h.01M15 7h.01"/>'],
      ['notifications', 'Уведомления', 'Напоминания, лимиты и отчёты в Telegram', '<path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4M12 2v2"/>'],
      ['subscription', 'Подписка и промокоды', 'Срок доступа, продление и промокоды', '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>'],
      ['about', 'О приложении и данные', 'Документы, обновление и управление данными', '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'],
    ];
    var current = sections.find(function (item) { return item[0] === section; });
    if (!current) {
      return '<div class="profile-page"><h1 class="profile-title">' + e(T('Профиль')) + '</h1>' +
        '<div class="profile-identity"><span class="profile-avatar">' + initLetter(m && m.name) + '</span><div><strong>' + e(m && m.name || T('Участник')) + '</strong>' +
        '<span>' + e(h.name || T('Наша семья')) + '</span></div></div>' +
        homeScreenRow(st.homeScreenStatus) +
        '<div class="profile-menu">' + sections.map(function (item) {
          return '<button type="button" class="profile-menu__item" data-action="open-profile-section" data-section="' + item[0] + '">' +
            '<span class="profile-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + item[3] + '</svg></span>' +
            '<span class="profile-menu__text"><strong>' + e(T(item[1])) + '</strong><small>' + e(T(item[2])) + '</small></span><span class="profile-menu__arrow" aria-hidden="true">›</span></button>';
        }).join('') + '</div></div>';
    }
    var content = '';
    if (section === 'family') {
      var effectiveSplit = h.month_split_mode || h.split_mode || 'proportional';
      var splitSegment = function (mode, label) {
        var active = effectiveSplit === mode;
        return '<button type="button" class="segment' + (active ? ' segment--active' : '') +
          '" data-action="split-mode" data-mode="' + e(mode) + '" aria-pressed="' + active + '">' + e(T(label)) + '</button>';
      };
      var splitSection = State.isSolo() ? '' :
        '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Деление общих трат')) + '</span></div>' +
        '<div class="card"><div class="segments">' + splitSegment('proportional', 'По доходу') + splitSegment('equal', 'Поровну') + splitSegment('none', 'Не делить') + '</div>' +
        '<p class="small muted">' + e(T('Действует с текущего месяца и на будущие. Прошлые месяцы не меняются.')) + '</p></div></div>';
      content = '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Имена')) + '</span></div>' +
        '<form class="card" data-form="profile" novalidate>' +
        '<label class="field"><span class="field__label">' + e(T('Ваше имя')) + '</span>' +
        '<input class="input" name="member_name" maxlength="40" autocomplete="name" placeholder="' + e(T('Как вас звать?')) + '" value="' + e(m ? m.name : '') + '"></label>' +
        '<label class="field"><span class="field__label">' + e(T('Название семьи')) + '</span>' +
        '<input class="input" name="household_name" maxlength="60" placeholder="' + e(T('Наша семья')) + '" value="' + e(h.name || '') + '"></label>' +
        '<div class="actions"><button type="submit" class="btn btn--primary btn--full">' + e(T('Сохранить')) + '</button></div>' +
        '</form></div>' +
        '<div class="card family-details"><div class="settings-row"><span class="settings-row__label">' + e(T('Деление общих трат')) + '</span><span class="settings-row__value">' + e(State.splitModeLabel(effectiveSplit)) + '</span></div></div>' +
        splitSection +
        (State.isSolo()
          ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Режим')) + '</span></div>' +
            '<div class="card"><p class="small muted">' + e(T('Личный бюджет: партнёр не подключён, расчёт между участниками не показывается.')) + '</p></div></div>'
          : '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Приглашение')) + '</span></div>' +
            '<div class="card"><p class="small muted">' + e(T('Передайте код партнёру — в приложении он выберет «Подключиться» и введёт его.')) + '</p>' +
            '<div class="invite"><span class="invite__code">' + e(h.invite_code || '—') + '</span>' +
            '<button type="button" class="btn btn--sm btn--primary" data-action="copy-invite">' + e(T('Копировать')) + '</button></div>' +
            '</div></div>');
    }
    if (section === 'budget') content = limitsCard();
    if (section === 'appearance') content = coverCard() + languageCard() + currencyCard();
    if (section === 'notifications') content = notificationsCard(notif);
    if (section === 'subscription') content = '<div class="card subscription-access"><div class="settings-row"><span class="settings-row__label">' + e(T('Доступ')) + '</span><span class="settings-row__value' + (left !== null && left < 0 ? ' amount--neg' : '') + '">' + e(planText) +
      (untilText ? e(T(' · до {date}', { date: untilText })) : '') + '</span></div></div>' + starsCard(st.tariffs, st.buying) + promoCard(st.promo);
    if (section === 'about') content = '<div class="section"><div class="section__head"><span class="section__title">' + e(T('О приложении')) + '</span></div>' +
      '<div class="card small muted">' + e(T('Данные видят только участники семьи. Telegram-бот принимает записи сообщением: «кофе 350», «+15000 подработка».')) + '</div></div>' +
      legalCard(st.deleting) +
      (Api.isDemo()
        ? '<div class="section"><div class="section__head"><span class="section__title">' + e(T('Демо-режим')) + '</span></div>' +
          '<div class="card"><p class="small muted">' + e(T('Приложение открыто вне Telegram, данные вымышленные и хранятся в памяти страницы.')) + '</p>' +
          '<button type="button" class="btn btn--ghost mt-8" data-action="demo-reset">' + e(T('Сбросить демо-данные')) + '</button></div></div>'
        : '') +
      '<div class="actions"><button type="button" class="btn btn--full" data-action="refresh">' + e(T('Обновить')) + '</button></div>';
    return '<div class="profile-page profile-detail"><div class="profile-detail__heading"><button type="button" class="profile-back" data-action="profile-home" aria-label="' + e(T('Назад в профиль')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h1>' + e(T(current[1])) + '</h1></div>' + content + '</div>';
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

    renderTxList: renderTxList,
    txResults: txResults,
    renderForm: renderForm,
    renderEditForm: renderEditForm,
    renderCoverEditor: renderCoverEditor,
    renderSettings: renderSettings,
    starsCard: starsCard,
    legalCard: legalCard,
    renderOnboarding: renderOnboarding,
    renderInvite: renderInvite,
    renderError: renderError,
  };
})(window);
