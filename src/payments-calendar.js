/** Date-only calendar arithmetic. Monthly/yearly repeats keep the original anchor. */
(function (root) {
  function iso(d) { return d.toISOString().slice(0, 10); }
  function date(s) { return new Date(s + 'T12:00:00Z'); }
  function valid(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(date(s)) && iso(date(s)) === s; }
  function shift(month, n) { var d = date(month + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d).slice(0, 7); }
  function end(month) { var d = date(shift(month, 1) + '-01'); d.setUTCDate(0); return iso(d); }
  function occurrence(p, index) {
    var d = date(p.date), r = p.repeat, n = index * (r ? r.interval : 1);
    if (!r) return p.date;
    if (r.unit === 'day' || r.unit === 'week') d.setUTCDate(d.getUTCDate() + n * (r.unit === 'week' ? 7 : 1));
    else {
      var anchor = d.getUTCDate(); d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + n * (r.unit === 'year' ? 12 : 1));
      var last = date(end(iso(d).slice(0, 7))).getUTCDate();
      d.setUTCDate(Math.min(anchor, last));
    }
    return iso(d);
  }
  function dates(p, until) {
    var out = [], day, i = 0;
    do { day = occurrence(p, i++); if (day > until) break; out.push(day); } while (p.repeat && i < 100000);
    return out;
  }
  function cells(month) {
    var first = date(month + '-01'), offset = (first.getUTCDay() + 6) % 7, out = [];
    for (var i = 0; i < offset; i++) out.push(null);
    for (var n = 1; n <= date(end(month)).getUTCDate(); n++) out.push(month + '-' + String(n).padStart(2, '0'));
    while (out.length % 7) out.push(null);
    return out;
  }
  function status(o, today) { if (o.status === 'paused' && o.due_on > today) return 'paused'; return o.due_on < today ? 'overdue' : o.due_on === today ? 'today' : 'planned'; }
  root.PaymentsCalendar = { valid: valid, shift: shift, end: end, dates: dates, cells: cells, status: status };
})(window);
