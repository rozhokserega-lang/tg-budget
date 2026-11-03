/** No speculative network actions. Inject APP_PAYMENTS_ADAPTER after backend contract approval. */
(function (root) {
  var stores = Object.create(null), seq = 0;
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function error(code, message) { var e = new Error(message); e.code = code; throw e; }
  function store(scope) { scope = scope.indexOf(':') === -1 ? scope : scope.slice(scope.indexOf(':') + 1); return stores[scope] || (stores[scope] = { payments: [], due: {}, paid: {} }); }
  function key(p, day) { return p.id + ':' + day; }
  function project(s, until) {
    var rows = Object.assign({}, s.due);
    s.payments.forEach(function (p) {
      root.PaymentsCalendar.dates(p, until).forEach(function (day) {
        var id = key(p, day);
        var skipped = (p.pauses || []).some(function (span) { return day > span.from && (!span.to || day < span.to); });
        if (!rows[id] && !s.paid[id] && !skipped) rows[id] = { id: id, payment_id: p.id, due_on: day, name: p.name, description: p.description, amount: p.amount, category_id: p.category_id };
      });
    });
    return Object.keys(rows).map(function (id) { return rows[id]; }).filter(function (o) { return !s.paid[o.id] && o.due_on <= until; });
  }
  function freeze(s) { project(s, root.Fmt.todayIso()).forEach(function (o) { s.due[o.id] = o; }); }
  function validate(p) {
    if (!p.name || !p.name.trim() || p.name.length > 160) error('bad_name', 'Введите название до 160 символов');
    if (!Number.isFinite(p.amount) || p.amount <= 0 || Math.abs(Math.round(p.amount * 100) - p.amount * 100) > 1e-7) error('bad_amount', 'Укажите положительную сумму, не более двух знаков после запятой');
    if (!root.PaymentsCalendar.valid(p.date) || p.date < '1900-01-01' || p.date > '2100-12-31') error('bad_date', 'Укажите корректную дату');
    if (!p.category_id) error('bad_category', 'Выберите категорию расхода');
    if (p.repeat && (!['day', 'week', 'month', 'year'].includes(p.repeat.unit) || !Number.isSafeInteger(p.repeat.interval) || p.repeat.interval < 1 || p.repeat.interval > 365)) error('bad_repeat', 'Интервал должен быть целым числом от 1 до 365');
    if (!Array.isArray(p.reminders) || p.reminders.length > 10 || p.reminders.some(function (n) { return !Number.isInteger(n) || n < 0 || n > 365; })) error('bad_reminders', 'Укажите до 10 уведомлений от 0 до 365 дней');
    if (p.overdue_every !== null && (!Number.isInteger(p.overdue_every) || p.overdue_every < 1 || p.overdue_every > 365)) error('bad_reminders', 'Повтор при просрочке: от 1 до 365 дней');
    return p;
  }
  var mock = {
    list: function (q) { var s = store(q.scope); freeze(s); return { payments: copy(s.payments), occurrences: copy(project(s, root.PaymentsCalendar.end(q.month))) }; },
    save: function (q) {
      var s = store(q.scope), p = validate(q.payment), old = s.payments.find(function (x) { return x.id === p.id; });
      if (p.id && !old) error('not_found', 'Платёж уже удалён');
      freeze(s);
      if (old) Object.assign(old, copy(p));
      else { p = Object.assign({}, copy(p), { id: 'payment-' + ++seq, paused: false, pauses: [] }); s.payments.push(p); }
      return copy(old || p);
    },
    pause: function (q) {
      var s = store(q.scope), p = s.payments.find(function (x) { return x.id === q.id; });
      if (!p || !p.repeat) error('not_found', 'Регулярный платёж не найден');
      freeze(s);
      if (q.paused !== p.paused) {
        if (q.paused) p.pauses.push({ from: root.Fmt.todayIso(), to: null });
        else p.pauses[p.pauses.length - 1].to = root.Fmt.todayIso();
        p.paused = q.paused;
      }
      return copy(p);
    },
    remove: function (q) {
      var s = store(q.scope); s.payments = s.payments.filter(function (p) { return p.id !== q.id; });
      Object.keys(s.due).forEach(function (id) { if (s.due[id].payment_id === q.id) delete s.due[id]; });
      return { ok: true };
    },
    confirm: function (q) {
      var s = store(q.scope);
      if (s.paid[q.occurrence_id]) return copy(s.paid[q.occurrence_id]);
      if (!root.PaymentsCalendar.valid(q.occurrence_id.slice(-10))) error('not_found', 'Начисление не найдено');
      var o = project(s, q.occurrence_id.slice(-10)).find(function (x) { return x.id === q.occurrence_id; });
      if (!o) error('not_found', 'Начисление уже удалено');
      if (!Number.isFinite(q.amount) || q.amount <= 0 || !root.PaymentsCalendar.valid(q.paid_on)) error('bad_payment', 'Проверьте сумму и дату');
      var demo = root.DEMO_API.state(), category = demo.categories.find(function (c) { return c.id === q.category_id && c.kind === 'expense' && !c.archived; });
      if (!category) error('bad_category', 'Категория расхода недоступна');
      // One synchronous mock transaction, no independent add_tx request.
      var tx = { id: 'payment-expense-' + ++seq, member_id: demo.member.id, category_id: q.category_id, amount: q.amount, occurred_on: q.paid_on, is_shared: true, note: o.name, payment_occurrence_id: o.id, created_at: new Date().toISOString() };
      var result = { occurrence_id: o.id, transaction: tx };
      demo.tx.push(tx); s.paid[o.id] = result; delete s.due[o.id];
      return copy(result);
    }
  };
  function adapter() { return root.APP_PAYMENTS_ADAPTER || (root.Api.isDemo() ? mock : null); }
  function invoke(method, payload) {
    return Promise.resolve().then(function () {
      var a = adapter();
      if (!a || typeof a[method] !== 'function') error('payments_unavailable', 'Модуль ожидает подключения серверного API');
      return a[method](payload);
    });
  }
  root.PaymentsApi = { invoke: invoke, available: function () { return !!adapter(); }, isMock: function () { return !root.APP_PAYMENTS_ADAPTER && root.Api.isDemo(); }, validate: validate };
})(window);
