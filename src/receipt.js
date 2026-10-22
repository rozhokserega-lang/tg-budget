/**
 * Разбор строки из QR-кода кассового чека (формат ФНС: t, s, fn, i, fp, n).
 * Достаёт только дату, сумму и ключ чека; название магазина и товары в QR нет.
 * Время в QR — местное время кассы, поэтому дату берём как есть, без пересчёта часовых поясов.
 */
(function (root) {
  // n: 1 — приход (покупка), 2 — возврат прихода. Чеки на расход (3, 4) в бюджете не поддерживаются.
  var KINDS = { 1: 'expense', 2: 'income' };

  function fail(reason) { return { ok: false, reason: reason }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parseDate(t) {
    var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(t);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (y < 2000 || y > 2100 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59) return null;
    return { date: y + '-' + pad(mo) + '-' + pad(d), time: pad(h) + ':' + pad(mi) };
  }

  function parse(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return fail('empty');
    var q = raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?') + 1) : raw;   // на случай ссылки с параметрами
    var map = {};
    q.split('&').forEach(function (part) {
      var i = part.indexOf('=');
      if (i < 1) return;
      var v = part.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) {}
      map[part.slice(0, i).trim().toLowerCase()] = v.trim();
    });
    if (!map.t || !map.s || !map.fn || !map.i || !map.fp) return fail('not_receipt');

    var when = parseDate(map.t.toUpperCase());
    if (!when) return fail('bad_date');
    if (!/^\d{1,9}([.,]\d{1,2})?$/.test(map.s)) return fail('bad_sum');
    var sum = Math.round(Number(map.s.replace(',', '.')) * 100) / 100;
    if (!(sum > 0)) return fail('bad_sum');
    if (!/^\d{16}$/.test(map.fn) || !/^\d{1,10}$/.test(map.i) || !/^\d{1,10}$/.test(map.fp)) return fail('bad_fiscal');

    var op = map.n === undefined || map.n === '' ? 1 : Number(map.n);
    return { ok: true, date: when.date, time: when.time, sum: sum, op: op, kind: KINDS[op] || null,
      fn: map.fn, i: map.i, fp: map.fp, key: map.fn + ':' + map.i + ':' + map.fp };
  }

  root.Receipt = { parse: parse };
})(window);
