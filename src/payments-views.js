(function (root) {
  var C = root.PaymentsCalendar;
  function e(s) { return root.Fmt.escapeHtml(String(s == null ? '' : s)); }
  function money(n, currency) {
    return currency ? new Intl.NumberFormat(root.I18n ? root.I18n.locale() : 'ru', {style:'currency',currency:currency,maximumFractionDigits:2}).format(n) : root.Fmt.money(n);
  }
  function button(action, label, attrs) { return '<button type="button" class="payment-button" data-action="' + action + '" ' + (attrs || '') + '>' + e(label) + '</button>'; }
  function modules() {
    return '<section class="payments"><h1>Модули</h1><div class="module-grid">' + [
      ['payments', 'Платежи', 'Календарь обязательных расходов', '◷'],
      ['reminders', 'Напоминания', 'Важные даты и события', '♧'],
      ['tasks', 'Трекер задач', 'Дела и личные списки', '☑'],
      ['leisure', 'Развлечения и отдых', 'Скоро', '✧']
    ].map(function (m) { return '<button class="module-card" type="button" data-action="module-open" data-module="' + m[0] + '"' + (m[0] === 'leisure' ? ' disabled' : '') + '><span class="module-card__icon" aria-hidden="true">' + m[3] + '</span><strong>' + m[1] + '</strong><span>' + m[2] + '</span></button>'; }).join('') + '</div></section>';
  }
  function placeholder(name) { return '<section class="payments">' + button('modules-home', '← Модули') + '<h1>' + e(name) + '</h1><p>Модуль готовится к подключению.</p></section>'; }
  var labels = { overdue: 'Просрочен', today: 'Сегодня', planned: 'Запланирован', paused: 'Приостановлен' };
  function row(o, definitions) {
    var status = C.status(o, root.Fmt.todayIso()), p = definitions.find(function (p) { return p.id === o.payment_id; });
    return '<article class="payment-row payment-row--' + status + '"><div class="payment-row__head"><strong>' + e(o.name) + '</strong><b>' + e(money(o.amount, o.currency)) + '</b></div><p>' + e(o.due_on) + ' · <span class="payment-status payment-status--' + status + '">' + labels[status] + '</span>' + (p && p.paused ? ' · Повторение приостановлено' : '') + '</p>' + (o.description ? '<p>' + e(o.description) + '</p>' : '') + '<div class="payment-actions">' + button('payment-confirm', 'Оплачено', 'data-id="' + e(o.id) + '"') + (p ? button('payment-edit', 'Изменить', 'data-id="' + e(p.id) + '"') : '') + '</div></article>';
  }
  function calendar(s) {
    var today = root.Fmt.todayIso(), data = s.data || { payments: [], occurrences: [] }, rows = data.occurrences;
    var html = '<section class="payments">' + button('modules-home', '← Модули') + '<div class="payments-title"><h1>Платежи</h1>' + button('payment-new', '+ Добавить', root.PaymentsApi.available() ? '' : 'disabled') + '</div>';
    if (!root.PaymentsApi.available()) return html + '<p role="status">Модуль ожидает подключения серверного API. Платежи и расходы пока не изменяются.</p></section>';
    if (root.PaymentsApi.isMock()) html += '<p class="payments-notice">Демо: данные до перезагрузки. Telegram-уведомления и синхронизация партнёров недоступны.</p>';
    html += '<div class="payments-month" data-gesture-lock>' + button('payment-month', '‹', 'data-delta="-1" aria-label="Предыдущий месяц"') + '<h2>' + e(new Date(s.month + '-01T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })) + '</h2>' + button('payment-month', '›', 'data-delta="1" aria-label="Следующий месяц"') + '</div><div class="payments-calendar" data-gesture-lock>';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function (d) { html += '<span class="payments-weekday">' + d + '</span>'; });
    C.cells(s.month).forEach(function (day) {
      if (!day) { html += '<span></span>'; return; }
      var items = rows.filter(function (o) { return o.due_on === day; }), statuses = [];
      items.forEach(function (o) { var status = C.status(o, today); if (!statuses.includes(status)) statuses.push(status); });
      var totals = Object.create(null);
      items.forEach(function (o) { var key = o.currency || ''; totals[key] = (totals[key] || 0) + o.amount; });
      var total = Object.keys(totals).map(function (key) { return money(totals[key], key); }).join(' / ');
      html += '<button type="button" class="payments-day' + (day === today ? ' payments-day--today' : '') + (day === s.selected ? ' payments-day--selected' : '') + '" data-action="payment-day" data-date="' + day + '" aria-pressed="' + (day === s.selected) + '" aria-label="' + e(day + (items.length ? ', ' + total + ', ' + statuses.map(function (x) { return labels[x]; }).join(', ') : ', нет платежей')) + '"' + (day === today ? ' aria-current="date"' : '') + '><span>' + Number(day.slice(-2)) + '</span><small>' + (items.length ? e(total) : '&nbsp;') + '</small><span class="payments-dots">' + statuses.map(function (x) { return '<i class="payment-dot payment-dot--' + x + '"></i>'; }).join('') + '</span></button>';
    });
    html += '</div><p class="payments-legend"><span class="payment-status--overdue">● Просрочен</span> · <span class="payment-status--today">● Сегодня</span> · <span class="payment-status--planned">● Запланирован</span></p>';
    if (s.loading) html += '<p role="status">Обновляем платежи…</p>';
    if (s.error) html += '<p role="alert">' + e(s.error) + '</p>' + button('payment-retry', 'Повторить');
    var selected = rows.filter(function (o) { return o.due_on === s.selected; });
    html += '<h2>' + e(s.selected) + '</h2>' + (selected.length ? selected.map(function (o) { return row(o, data.payments); }).join('') : '<p>На этот день платежей нет</p>');
    var overdue = rows.filter(function (o) { return o.due_on < today && o.due_on !== s.selected; });
    if (overdue.length) html += '<details class="payments-overdue"><summary>Просроченные · ' + overdue.length + '</summary>' + overdue.map(function (o) { return row(o, data.payments); }).join('') + '</details>';
    html += '<details><summary>Управление платежами · ' + data.payments.length + '</summary>' + data.payments.map(function (p) {
      var attrs = 'data-id="' + e(p.id) + '"';
      return '<article class="payment-row"><strong>' + e(p.name) + '</strong><p>' + (p.repeat ? 'Каждые ' + p.repeat.interval + ' ' + ({day:'дн.',week:'нед.',month:'мес.',year:'лет'})[p.repeat.unit] : 'Разовый') + (p.paused ? ' · Приостановлен' : '') + '</p><div class="payment-actions">' + button('payment-edit', 'Изменить', attrs) + (p.repeat ? button('payment-pause', p.paused ? 'Возобновить' : 'Приостановить', attrs) : '') + button('payment-delete', 'Удалить', attrs) + '</div></article>';
    }).join('') + '</details></section>';
    return html;
  }
  function field(label, control) { return '<label class="payment-field"><span>' + e(label) + '</span>' + control + '</label>'; }
  function input(name, value, type, attrs) { return '<input class="input" name="' + name + '" type="' + (type || 'text') + '" value="' + e(value) + '" ' + (attrs || '') + '>'; }
  function categories(list, selected) {
    return '<select class="input" name="category_id" required><option value="">Выберите категорию</option>' + list.filter(function (c) { return c.kind === 'expense' && !c.archived; }).map(function (c) { return '<option value="' + e(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + e(c.icon || '') + ' ' + e(c.name) + '</option>'; }).join('') + '</select>';
  }
  function form(p, cats, selected) {
    p = p || {}; var repeat = p.repeat;
    return '<form class="payment-form" data-form="payment" data-id="' + e(p.id || '') + '"><h2>' + (p.id ? 'Изменить платёж' : 'Новый платёж') + '</h2>' +
      field('Название', input('name', p.name || '', 'text', 'required maxlength="120"')) +
      field('Описание (необязательно)', '<textarea class="input" name="description" maxlength="1000">' + e(p.description || '') + '</textarea>') +
      field('Плановая сумма', input('amount', p.amount || '', 'text', 'inputmode="decimal" required')) +
      field('Категория', categories(cats, p.category_id)) + field('Дата платежа', input('date', p.date || selected, 'date', 'required min="2000-01-01" max="2100-12-31"')) +
      field('Тип платежа', '<select class="input" name="type" data-payment-type><option value="once">Разовый</option><option value="regular"' + (repeat ? ' selected' : '') + '>Регулярный</option></select>') +
      '<fieldset class="payment-repeat"' + (repeat ? '' : ' hidden disabled') + '><legend>Повторение</legend>' + field('Каждые N', input('interval', repeat ? repeat.interval : 1, 'number', 'required min="1" max="' + (repeat ? ({day:365,week:365,month:12,year:10})[repeat.unit] : 365) + '" step="1"')) + field('Период', '<select class="input" name="unit" data-payment-unit>' + [['day','Дней'],['week','Недель'],['month','Месяцев'],['year','Лет']].map(function (r) { return '<option value="' + r[0] + '"' + (repeat && repeat.unit === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>') + '</fieldset>' +
      field('Уведомления за N дней (через запятую, 0 — в день оплаты)', input('reminders', (p.reminders || []).join(', '), 'text', 'placeholder="7, 3, 1" inputmode="numeric"')) +
      field('При просрочке повторять каждые N дней (пусто — выключено)', input('overdue_every', p.overdue_every || '', 'number', 'min="1" max="30" step="1"')) +
      '<p>Уведомления за 0–30 дней отправляет Telegram-бот обоим партнёрам. Для нового платежа — в 10:00 по таймзоне семьи, при просрочке — до 5 повторов.</p><p role="alert" class="payment-form-error"></p><button class="btn btn--primary" type="submit">Сохранить</button>' + button('payment-cancel', 'Отмена') + '</form>';
  }
  function confirm(o, cats) {
    return '<form class="payment-form" data-form="payment-confirm" data-id="' + e(o.id) + '"><h2>Подтвердить оплату</h2><p>' + e(o.name) + (o.currency ? ' · ' + e(o.currency) : '') + '</p>' + field('Фактическая сумма', input('amount', o.amount, 'text', 'inputmode="decimal" required')) + field('Дата оплаты', input('paid_on', root.Fmt.todayIso(), 'date', 'required min="2000-01-01" max="2100-12-31"')) + field('Категория', categories(cats, o.category_id)) + '<p role="alert" class="payment-form-error"></p><button class="btn btn--primary" type="submit">Оплачено</button>' + button('payment-cancel', 'Отмена') + '</form>';
  }
  root.PaymentsViews = { modules: modules, placeholder: placeholder, calendar: calendar, form: form, confirm: confirm };
})(window);
