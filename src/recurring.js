/** Calendar dates, independent of daylight-saving changes. */
(function (root) {
  function reminderDays(value) {
    var days = value == null ? 1 : Number(value);
    return Number.isInteger(days) && days >= 0 && days <= 30 ? days : 1;
  }
  function upcoming(payment, now) {
    now = now || new Date();
    var year = now.getFullYear(), month = now.getMonth();
    var today = Date.UTC(year, month, now.getDate());
    var day = Math.min(31, Math.max(1, Number(payment.day_of_month) || 1));
    function due(offset) {
      var last = new Date(Date.UTC(year, month + offset + 1, 0)).getUTCDate();
      return Date.UTC(year, month + offset, Math.min(day, last));
    }
    var date = due(0);
    if (date < today) date = due(1);
    var diff = Math.round((date - today) / 86400000);
    return { date: new Date(date).toISOString().slice(0, 10), diff: diff,
      visible: payment.active !== false && diff <= reminderDays(payment.reminder_days) };
  }
  root.Recurring = { reminderDays: reminderDays, upcoming: upcoming };
})(window);
