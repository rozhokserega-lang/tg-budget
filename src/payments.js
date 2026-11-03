/** UI state and coordination. Cache/scope/finance invalidation are supplied by the existing app. */
(function (root) {
  root.Payments = { create: function (host) {
    var C = root.PaymentsCalendar, V = root.PaymentsViews;
    var s = { month: root.Fmt.todayIso().slice(0, 7), selected: root.Fmt.todayIso(), data: null, loading: false, error: null };
    var generation = 0, busy = false, scope = null, confirmationKeys = Object.create(null), formContext = null;
    function resetScope() {
      var next = host.scope();
      if (next !== scope) { scope = next; generation++; s.data = null; confirmationKeys = Object.create(null); }
    }
    function paint() { if (host.active()) host.render(V.calendar(s), true); }
    function load(force) {
      resetScope();
      var gen = ++generation, currentScope = scope, month = s.month;
      s.loading = true; s.error = null; paint();
      if (!root.PaymentsApi.available()) { s.loading = false; paint(); return Promise.resolve(); }
      return host.load('payments:' + month, function () { return root.PaymentsApi.invoke('list', { scope: currentScope, month: month }); }, force).then(function (data) {
        if (gen !== generation || currentScope !== host.scope()) return;
        s.data = data; s.loading = false; paint();
      }).catch(function (err) {
        if (gen !== generation || currentScope !== host.scope() || err.code === 'stale_response') return;
        s.loading = false; s.error = err.message || 'Не удалось загрузить платежи'; paint();
      });
    }
    function open() { host.enter(); resetScope(); return load(false); }
    function findPayment(id) { return s.data && s.data.payments.find(function (p) { return p.id === id; }); }
    function findOccurrence(id) { return s.data && s.data.occurrences.find(function (o) { return o.id === id; }); }
    function showForm(id, confirm) {
      if (busy) return;
      if (host.expired()) return host.toast('Срок доступа закончился');
      var current = confirm ? findOccurrence(id) : findPayment(id), currentScope = host.scope(), gen = generation;
      if (id && !current) return host.toast('Платёж уже изменился. Обновите календарь');
      host.categories().then(function (cats) {
        if (currentScope !== host.scope() || gen !== generation || !host.active()) return;
        formContext = { scope: currentScope, id: id, payment: confirm ? null : current };
        host.sheet(confirm ? V.confirm(current, cats) : V.form(current, cats, s.selected));
      }).catch(function (err) { host.toast(err.message); });
    }
    function mutate(method, payload, form) {
      if (busy) return Promise.resolve();
      if (host.expired()) { host.toast('Срок доступа закончился'); return Promise.resolve(); }
      busy = true; host.lock(true);
      var currentScope = host.scope();
      if (form) { form.querySelector('[type="submit"]').disabled = true; form.setAttribute('aria-busy', 'true'); form.querySelector('.payment-form-error').textContent = ''; }
      payload.scope = currentScope;
      return root.PaymentsApi.invoke(method, payload).then(function (result) {
        if (currentScope !== host.scope()) return;
        // Supersede old reads before loading either calendar or finance snapshots.
        generation++; host.invalidate(result, method); s.data = null;
        if (form) host.close();
        host.toast(method === 'confirm' ? 'Оплата записана' : 'Сохранено');
        return load(true);
      }).catch(function (err) {
        if (currentScope !== host.scope()) return;
        if (form && form.isConnected) form.querySelector('.payment-form-error').textContent = err.message || 'Не удалось сохранить';
        else host.toast(err.message || 'Не удалось сохранить');
      }).finally(function () {
        busy = false; host.lock(false);
        if (form) { form.querySelector('[type="submit"]').disabled = false; form.removeAttribute('aria-busy'); }
      });
    }
    function submit(form, confirm) {
      if (busy) return;
      var v = form.elements, id = form.getAttribute('data-id'), payload;
      try {
        if (formContext && formContext.scope !== host.scope()) throw new Error('Семья изменилась. Откройте форму заново.');
        var amount = root.Fmt.parseAmount(v.amount.value);
        if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) throw new Error('Проверьте сумму: положительное число, до двух знаков после запятой');
        var category = (root.State.get().categories || []).find(function (c) { return c.id === v.category_id.value && c.kind === 'expense' && !c.archived; });
        if (!category) throw new Error('Выберите категорию расхода');
        if (confirm) {
          if (!C.valid(v.paid_on.value)) throw new Error('Проверьте дату оплаты');
          // Stable across retry, including an unknown result after a network interruption.
          var signature = JSON.stringify([amount, v.paid_on.value, category.id]);
          if (!confirmationKeys[id] || confirmationKeys[id].signature !== signature) confirmationKeys[id] = { signature: signature, key: root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : 'confirm-' + Date.now() + '-' + Math.random().toString(36).slice(2) };
          payload = { occurrence_id: id, amount: amount, paid_on: v.paid_on.value, category_id: category.id, idempotency_key: confirmationKeys[id].key };
        } else {
          var reminders = v.reminders.value.trim();
          payload = { payment: root.PaymentsApi.validate({ id: id || undefined, name: v.name.value.trim(), description: v.description.value.trim(), amount: amount, category_id: category.id, date: v.date.value, repeat: v.type.value === 'regular' ? { interval: Number(v.interval.value), unit: v.unit.value } : null, reminders: reminders ? Array.from(new Set(reminders.split(',').map(function (n) { return n.trim() === '' ? NaN : Number(n.trim()); }))) : [], overdue_every: v.overdue_every.value === '' ? null : Number(v.overdue_every.value) }) };
          var original = formContext && formContext.id === id ? formContext.payment : id && findPayment(id);
          if (original && original.server) payload.payment.server = original.server;
        }
      } catch (err) { form.querySelector('.payment-form-error').textContent = err.message; return; }
      return mutate(confirm ? 'confirm' : 'save', payload, form);
    }
    function action(action, node) {
      if (busy) return;
      var id = node.getAttribute('data-id'), p;
      if (action === 'payment-new') return showForm();
      if (action === 'payment-edit') return showForm(id, false);
      if (action === 'payment-confirm') return showForm(id, true);
      if (action === 'payment-cancel') return host.close();
      if (action === 'payment-retry') return load(true);
      if (action === 'payment-day') { s.selected = node.getAttribute('data-date'); return paint(); }
      if (action === 'payment-month') {
        s.month = C.shift(s.month, Number(node.getAttribute('data-delta')));
        s.selected = s.month + '-01'; s.data = null; return load(false);
      }
      p = findPayment(id);
      if (!p) return;
      if (action === 'payment-pause') return mutate('pause', { id: id, paused: !p.paused });
      if (action === 'payment-delete') {
        var currentScope = host.scope();
        return host.confirm('Удалить платёж «' + p.name + '» и его неоплаченные начисления? Записанные расходы сохранятся.').then(function (ok) { if (ok && currentScope === host.scope()) return mutate('remove', { id: id }); });
      }
    }
    return { open: open, refresh: function () { return load(true); }, action: action, submit: submit, busy: function () { return busy; } };
  } };
})(window);
