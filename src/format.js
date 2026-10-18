/** Форматирование сумм, дат и месяцев. Без зависимостей. */

(function (root) {
  var nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  // «1234.5» → «1 234,50 ₽». Знак передаётся отдельно, чтобы раскрасить сумму.
  function money(n) {
    var v = Number(n) || 0;
    var hasCents = Math.abs(v % 1) > 0.004;
    return nf.format(hasCents ? v : Math.round(v)) + ' ₽';
  }

  function signedMoney(n, isIncome) {
    return (isIncome ? '+' : '−') + money(Math.abs(Number(n) || 0));
  }

  // «2026-10-17» → Date без сдвига часового пояса
  function parseDate(s) {
    var d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date().toISOString().slice(0, 10);
    var p = d.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function todayIso() {
    return isoDate(new Date());
  }

  function currentMonth() {
    return todayIso().slice(0, 7);
  }

  // «2026-10» → «октябрь 2026»
  function monthTitle(ym) {
    var p = ym.split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }

  function monthTitleShort(ym) {
    var p = ym.split('-');
    return MONTHS[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0];
  }

  function shiftMonth(ym, delta) {
    var p = ym.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return isoDate(d).slice(0, 7);
  }

  function sameMonth(iso, ym) {
    return String(iso || '').slice(0, 7) === ym;
  }

  // «2026-10-17» → «сегодня» / «вчера» / «пн, 15 октября» / «пн, 15 октября 2025»
  function dayLabel(iso) {
    var d = parseDate(iso);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    var label = d.getDate() + ' ' + monthGenitive(d.getMonth()) + ', ' + WEEKDAYS[d.getDay()];
    if (d.getFullYear() !== now.getFullYear()) label += ' ' + d.getFullYear();
    return label;
  }

  function dayFull(iso) {
    var d = parseDate(iso);
    return DAYS_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + monthGenitive(d.getMonth()) + ' ' + d.getFullYear();
  }

  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var DAYS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  function monthGenitive(i) {
    return MONTHS_GEN[i];
  }

  function weekdayShort(iso) {
    return WEEKDAYS[parseDate(iso).getDay()];
  }

  // «2 400», «350,50» → 2400 / 350.5. Возвращает NaN при мусоре.
  function parseAmount(raw) {
    var s = String(raw || '')
      .replace(/[\s\u00a0]/g, '')
      .replace(/[₽р]/gi, '')
      .replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
    return Number(s);
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100;
    var b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  root.Fmt = {
    money: money,
    signedMoney: signedMoney,
    parseDate: parseDate,
    isoDate: isoDate,
    todayIso: todayIso,
    currentMonth: currentMonth,
    monthTitle: monthTitle,
    monthTitleShort: monthTitleShort,
    shiftMonth: shiftMonth,
    sameMonth: sameMonth,
    dayLabel: dayLabel,
    dayFull: dayFull,
    weekdayShort: weekdayShort,
    parseAmount: parseAmount,
    plural: plural,
    escapeHtml: escapeHtml,
  };
})(window);
