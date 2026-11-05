(function (root) {
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0,10) === s; }
  function validate(t) {
    if (!t.title || !t.title.trim() || t.title.length > 200) throw new Error('Введите название до 200 символов');
    if ((t.description || '').length > 4000) throw new Error('Описание до 4000 символов');
    if (t.due_on && (!validDate(t.due_on) || t.due_on < '2000-01-01' || t.due_on > '2100-12-31')) throw new Error('Проверьте срок');
    if (!['normal','important'].includes(t.priority)) throw new Error('Проверьте приоритет');
    var r = t.repeat;
    if (r && (!t.due_on || !['day','week','month','year'].includes(r.unit) || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > ({day:365,week:365,month:12,year:10})[r.unit] || !Array.isArray(r.weekdays) || r.weekdays.some(function (n) { return !Number.isInteger(n) || n < 1 || n > 7; }) || (r.weekdays.length && r.unit !== 'week'))) throw new Error('Для повторения укажите срок, период и интервал 1–365');
    if (!Array.isArray(t.reminders) || t.reminders.length > 10 || t.reminders.some(function (n) { return !Number.isInteger(n) || n < 0 || n > 43200; }) || (t.reminders.length && !t.due_on)) throw new Error('Для уведомлений укажите срок и до 10 интервалов в минутах');
    return t;
  }
  function nextDate(t) {
    var r = t.repeat, base = new Date(t.due_on + 'T12:00:00Z'), d = new Date(base), anchor = t.anchor_day || base.getUTCDate(), month = t.anchor_month == null ? base.getUTCMonth() : t.anchor_month;
    if (r.unit === 'day') d.setUTCDate(d.getUTCDate() + r.interval);
    if (r.unit === 'week') {
      if (!r.weekdays.length) d.setUTCDate(d.getUTCDate() + 7 * r.interval);
      else { var start = new Date(base); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay()+6)%7)); do { d.setUTCDate(d.getUTCDate()+1); } while (!r.weekdays.includes(d.getUTCDay() || 7) || Math.floor((d-start)/604800000) % r.interval !== 0); }
    }
    if (r.unit === 'month' || r.unit === 'year') {
      d.setUTCDate(1);
      if (r.unit === 'month') d.setUTCMonth(d.getUTCMonth() + r.interval);
      else { d.setUTCFullYear(d.getUTCFullYear() + r.interval); d.setUTCMonth(month); }
      var end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate(); d.setUTCDate(Math.min(anchor,end));
    }
    return d.toISOString().slice(0,10);
  }
  function overdue(t, today) { return !t.completed_at && !!t.due_on && t.due_on < today; }
  function rows(s, today) {
    var items = s.data.tasks.filter(function(t) { return !!t.completed_at === s.completed && (s.selected === 'all' || (t.list_id || 'none') === s.selected); });
    var order = s.data.preferences.orders[s.selected] || [];
    return items.sort(function(a,b) {
      if (!s.completed && s.selected === 'all' && overdue(a,today) !== overdue(b,today)) return overdue(a,today) ? -1 : 1;
      var n = 0;
      if (s.sort === 'due') n = (a.due_on || '9999').localeCompare(b.due_on || '9999');
      if (s.sort === 'priority') n = Number(b.priority === 'important') - Number(a.priority === 'important');
      if (s.sort === 'created') n = b.created_at.localeCompare(a.created_at);
      if (s.sort === 'manual') n = (order.includes(a.id) ? order.indexOf(a.id) : 1e9) - (order.includes(b.id) ? order.indexOf(b.id) : 1e9);
      return n || a.id.localeCompare(b.id);
    });
  }
  // Count plan occurrences by their original due date, never completion date.
  function todayPlan(data, today) {
    var seen = Object.create(null), plan = [], active = [];
    ((data && data.tasks) || []).forEach(function(t) {
      if (seen[t.id] || !t.due_on || t.deleted_at || (t.server && t.server.deletedAt)) return;
      seen[t.id] = true;
      if (t.due_on === today) plan.push(t);
      if (!t.completed_at && t.due_on <= today) active.push(t);
    });
    active.sort(function(a,b) {
      var ga = a.due_on < today ? 0 : a.priority === 'important' ? 1 : 2;
      var gb = b.due_on < today ? 0 : b.priority === 'important' ? 1 : 2;
      return ga - gb || a.due_on.localeCompare(b.due_on) ||
        String(a.server && a.server.dueAt || '').localeCompare(String(b.server && b.server.dueAt || '')) || a.id.localeCompare(b.id);
    });
    var done = plan.filter(function(t) { return !!t.completed_at; }).length;
    return {rows:active, total:plan.length, done:done, percent:plan.length ? Math.round(done / plan.length * 100) : 0};
  }
  root.TasksModel = {validate:validate, nextDate:nextDate, overdue:overdue, rows:rows, todayPlan:todayPlan};
})(window);
