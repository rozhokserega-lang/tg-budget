/** Personal module state; backend owns occurrence expansion in production. */
(function (root) {
  root.Reminders = { create: function (host) {
    var C = root.PaymentsCalendar, V = root.RemindersViews;
    var s = {
      month: root.Fmt.todayIso().slice(0, 7), selected: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      data: null, loading: false, error: null
    };
    var scope = null, generation = 0, busy = false, formScope = null;

    function reset() {
      var next = host.scope();
      if (next !== scope) {
        scope = next; generation++; s.data = null; s.selected = null;
        s.month = root.Fmt.todayIso().slice(0, 7); formScope = null;
      }
    }
    function paint() { if (host.active()) host.render(V.page(s), true); }
    function load() {
      reset();
      var gen = ++generation, owner = scope;
      s.loading = true; s.error = null; paint();
      if (!root.RemindersApi.available()) { s.loading = false; paint(); return Promise.resolve(); }
      // Include the visible month and a year ahead. Backend also returns every overdue event.
      var until = C.end(C.shift(root.Fmt.todayIso().slice(0, 7), 12));
      if (C.end(s.month) > until) until = C.end(s.month);
      return root.RemindersApi.invoke('list', {
        scope: owner, from: s.month + '-01', until: until, timezone: s.timezone
      }).then(function (data) {
        if (gen !== generation || owner !== host.scope()) return;
        s.data = data; s.loading = false; paint();
      }).catch(function (err) {
        if (gen !== generation || owner !== host.scope()) return;
        s.loading = false; s.error = err.message || 'Не удалось загрузить'; paint();
      });
    }
    function mutate(method, payload, form) {
      if (busy) return Promise.resolve();
      if (host.expired()) { host.toast('Срок доступа закончился'); return Promise.resolve(); }
      busy = true; host.lock(true);
      var owner = host.scope();
      payload.scope = owner;
      if (form) {
        form.querySelector('[type="submit"]').disabled = true;
        form.querySelector('.payment-form-error').textContent = '';
      }
      return root.RemindersApi.invoke(method, payload).then(function () {
        if (owner !== host.scope()) return;
        generation++; s.data = null;
        if (form) host.close();
        host.toast(method === 'complete' ? 'Выполнено' : 'Сохранено');
        return load();
      }).catch(function (err) {
        if (owner !== host.scope()) return;
        if (form && form.isConnected) form.querySelector('.payment-form-error').textContent = err.message;
        else host.toast(err.message || 'Не удалось сохранить');
      }).finally(function () {
        busy = false; host.lock(false);
        if (form) form.querySelector('[type="submit"]').disabled = false;
      });
    }
    function action(action, node) {
      if (busy) return;
      reset();
      var id = node.getAttribute('data-id');
      var p = s.data && s.data.reminders.find(function (x) { return x.id === id; });
      if (action === 'reminder-cancel') return host.close();
      if (action === 'reminder-retry') return load();
      if (action === 'reminder-day') { s.selected = node.getAttribute('data-date'); return paint(); }
      if (action === 'reminder-upcoming') {
        s.selected = null; s.month = root.Fmt.todayIso().slice(0, 7); return load();
      }
      if (action === 'reminder-month') {
        var month = C.shift(s.month, Number(node.getAttribute('data-delta')));
        if (month < '1900-01' || month > '2100-12') return;
        s.month = month; s.selected = month + '-01'; s.data = null; return load();
      }
      if (action === 'reminder-new' || action === 'reminder-edit') {
        if (host.expired()) return host.toast('Срок доступа закончился');
        if (id && !p) return;
        formScope = scope;
        return host.sheet(V.form(p, s.selected || root.Fmt.todayIso(), s.timezone));
      }
      if (action === 'reminder-complete') {
        var o = s.data && s.data.occurrences.find(function (x) { return x.id === id; });
        if (o) return mutate('complete', {
          occurrence_id: o.id, date: o.date, timezone: s.timezone, idempotency_key: o.id
        });
        return;
      }
      if (!p) return;
      if (action === 'reminder-pause') return mutate('pause', { id: id, paused: !p.paused });
      if (action === 'reminder-delete') {
        var owner = scope;
        return host.confirm('Удалить напоминание «' + p.title + '» и его будущие события?').then(function (ok) {
          if (ok && owner === host.scope()) return mutate('remove', { id: id });
        });
      }
    }
    function submit(form) {
      if (busy) return;
      if (formScope !== host.scope()) {
        host.close(); return host.toast('Пользователь изменился. Откройте форму заново');
      }
      var v = form.elements, p;
      try {
        var unit = v.repeat.value;
        var weekdays = Array.from(form.querySelectorAll('[name="weekday"]:checked')).map(function (n) { return Number(n.value); });
        p = root.RemindersApi.validate({
          id: form.getAttribute('data-id') || undefined,
          title: v.title.value.trim(), description: v.description.value.trim(),
          date: v.date.value, time: v.time.value, timezone: v.timezone.value.trim(),
          priority: v.priority.value,
          repeat: unit === 'once' ? null : {
            unit: unit, interval: Number(v.interval.value), weekdays: unit === 'week' ? weekdays : []
          },
          notifications: v.notifications.value.trim() ? Array.from(new Set(v.notifications.value.split(',').map(function (n) {
            return n.trim() === '' ? NaN : Number(n.trim());
          }))) : []
        });
      } catch (err) { form.querySelector('.payment-form-error').textContent = err.message; return; }
      return mutate('save', { reminder: p }, form);
    }
    return { open: function () { host.enter(); reset(); return load(); }, refresh: load, action: action, submit: submit };
  } };
})(window);
