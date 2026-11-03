/** REST v1 boundary. UI uses snake_case; the public contract uses camelCase. */
(function (root) {
  var frequencies = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };
  var units = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
  function fail(code, message, status, details) {
    var err = new Error(message); err.code = code; err.status = status || 0; err.details = details; throw err;
  }
  function request(path, method, body, key, initData) {
    var base = (root.Api.url || '').replace(/\/+$/, '');
    if (!base || base.indexOf('<project-ref>') !== -1) return Promise.reject(new root.Api.ApiError('no_config'));
    var headers = { authorization: 'tma ' + (initData === undefined ? root.Tg.initData() : initData) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (key) headers['idempotency-key'] = key;
    return root.fetch(base + '/v1' + path, { method: method || 'GET', headers: headers, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try { data = text ? JSON.parse(text) : null; }
        catch (_) { fail('invalid_json', 'Сервер вернул непонятный ответ.', res.status); }
        if (!res.ok || (data && data.error)) {
          var error = data && data.error || {}, messages = {
            UNAUTHORIZED: 'Сессия Telegram истекла. Откройте приложение заново.',
            FORBIDDEN: 'Нет доступа к данным семьи.', SUBSCRIPTION_EXPIRED: 'Срок доступа закончился.',
            NOT_FOUND: 'Платёж уже удалён. Обновите календарь.',
            CONFLICT: 'Данные изменились. Обновите календарь и повторите.',
            VALIDATION_ERROR: 'Проверьте заполненные поля.', INTERNAL_ERROR: 'Не удалось выполнить запрос. Повторите позже.'
          };
          fail(error.code || 'network', messages[error.code] || error.message || 'Не удалось выполнить запрос.', res.status, error.details);
        }
        return data;
      });
    }, function () { fail('network', 'Нет связи с сервером. Проверьте интернет и повторите.'); });
  }
  function pages(path, initData) {
    var rows = [], seen = Object.create(null);
    function next(cursor) {
      return request(path + (path.indexOf('?') === -1 ? '?' : '&') + 'limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), 'GET', undefined, undefined, initData).then(function (page) {
        if (!page || !Array.isArray(page.data) || !page.pageInfo) fail('invalid_json', 'Сервер вернул непонятный ответ.');
        rows = rows.concat(page.data);
        if (!page.pageInfo.hasMore) return rows;
        var key = page.pageInfo.nextCursor;
        if (!key || seen[key]) fail('invalid_json', 'Не удалось загрузить следующую страницу платежей.');
        seen[key] = true;
        return next(key);
      });
    }
    return next();
  }
  function payment(p) {
    return { id: p.id, name: p.title, description: p.description || '', amount: p.plannedAmount,
      currency: p.currency, category_id: p.categoryId, date: p.firstDueDate, paused: p.status === 'paused',
      repeat: p.recurrenceRule ? { unit: units[p.recurrenceRule.frequency], interval: p.recurrenceRule.interval } : null,
      reminders: (p.notificationRules || []).map(function (r) { return r.offsetMinutes / 1440; }),
      overdue_every: p.overdueNotificationRule ? p.overdueNotificationRule.everyDays : null,
      // Keep settings the compact form does not edit (time, weekdays, currency, maxCount).
      server: p };
  }
  function input(p) {
    var original = p.server || {}, oldRules = original.notificationRules || [];
    var rule = p.repeat ? Object.assign({}, original.recurrenceRule || {}, { frequency: frequencies[p.repeat.unit], interval: p.repeat.interval }) : null;
    if (rule && rule.frequency !== 'weekly') delete rule.weekdays;
    var body = { title: p.name, description: p.description || null, plannedAmount: p.amount,
      categoryId: p.category_id || null, firstDueDate: p.date, recurrenceRule: rule,
      notificationRules: p.reminders.map(function (n) {
        return oldRules.find(function (r) { return r.offsetMinutes === n * 1440; }) || { offsetMinutes: n * 1440, time: '10:00' };
      }), overdueNotificationRule: p.overdue_every === null ? null : Object.assign({}, original.overdueNotificationRule || { everyDays: p.overdue_every, maxCount: 5, time: '10:00' }, { everyDays: p.overdue_every }) };
    if (!p.id) body.currency = root.Fmt.currencyCode ? root.Fmt.currencyCode() : 'RUB';
    if (original.version) {
      Object.keys(body).forEach(function (key) {
        if (JSON.stringify(body[key]) === JSON.stringify(original[key])) delete body[key];
      });
      body.version = original.version;
    }
    return body;
  }
  var adapter = {
    list: function (q) {
      var initData = root.Tg.initData();
      return Promise.all([pages('/payment-templates', initData), pages('/payments?from=' + q.month + '-01&to=' + root.PaymentsCalendar.end(q.month), initData)]).then(function (results) {
        var definitions = results[0].map(payment), byId = Object.create(null);
        definitions.forEach(function (p) { byId[p.id] = p; });
        return { payments: definitions, occurrences: results[1].filter(function (o) { return o.status !== 'paid'; }).map(function (o) {
          var p = byId[o.templateId], summary = o.payment || {};
          return { id: o.id, payment_id: o.templateId, due_on: o.dueDate, amount: o.plannedAmount,
            name: summary.title || (p && p.name) || '', description: p ? p.description : '',
            currency: o.currency || summary.currency || (p && p.currency), category_id: summary.categoryId || (p && p.category_id), status: p && p.paused ? 'paused' : o.status };
        }) };
      });
    },
    save: function (q) { var p = q.payment; return request('/payments' + (p.id ? '/' + encodeURIComponent(p.id) : ''), p.id ? 'PATCH' : 'POST', input(p)).then(payment); },
    pause: function (q) { return request('/payments/' + encodeURIComponent(q.id) + (q.paused ? '/pause' : '/resume'), 'POST', {}).then(payment); },
    remove: function (q) { return request('/payments/' + encodeURIComponent(q.id), 'DELETE'); },
    confirm: function (q) {
      return request('/payment-occurrences/' + encodeURIComponent(q.occurrence_id) + '/confirm', 'POST', { actualAmount: q.amount, actualDate: q.paid_on, categoryId: q.category_id }, q.idempotency_key).then(function (r) {
        return { occurrence_id: r.occurrenceId, expense_id: r.expenseId };
      });
    }
  };
  root.PaymentsRest = adapter;
})(window);
