/** Форматирование сумм, дат и месяцев. Без зависимостей. */

(function (root) {
  // Валюта — только обозначение в интерфейсе. Суммы в базе не конвертируются.
  var CURRENCY_KEY = 'budget.currency';
  var CURRENCY_LIST = [
    { code: 'RUB', symbol: '₽', name: 'Российский рубль' },
    { code: 'USD', symbol: '$', name: 'Доллар США' },
    { code: 'EUR', symbol: '€', name: 'Евро' },
    { code: 'KZT', symbol: '₸', name: 'Казахстанский тенге' },
    { code: 'UAH', symbol: '₴', name: 'Украинская гривна' },
    { code: 'GEL', symbol: '₾', name: 'Грузинский лари' },
    { code: 'BYN', symbol: 'Br', name: 'Белорусский рубль' },
    { code: 'AMD', symbol: '֏', name: 'Армянский драм' },
    { code: 'TRY', symbol: '₺', name: 'Турецкая лира' },
    { code: 'CNY', symbol: '¥', name: 'Китайский юань' },
  ];
  var CURRENCY_BY_CODE = {};
  CURRENCY_LIST.forEach(function (c) { CURRENCY_BY_CODE[c.code] = c; });
  var currencyCode = 'RUB';
  try {
    var savedCurrency = root.localStorage.getItem(CURRENCY_KEY);
    if (savedCurrency && CURRENCY_BY_CODE[savedCurrency]) currencyCode = savedCurrency;
  } catch (e) {}

  var moneyCache = null;
  var dateCache = {};

  function locale() {
    return root.I18n ? root.I18n.locale() : 'ru';
  }

  function currency() {
    return CURRENCY_BY_CODE[currencyCode] || CURRENCY_LIST[0];
  }

  function currencySymbol() {
    return currency().symbol;
  }

  function setCurrency(code) {
    if (!CURRENCY_BY_CODE[code]) return false;
    currencyCode = code;
    try { root.localStorage.setItem(CURRENCY_KEY, code); } catch (e) {}
    return true;
  }

  function moneyFormatter() {
    var loc = locale();
    if (!moneyCache || moneyCache.loc !== loc) {
      moneyCache = {
        loc: loc,
        nf: new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }),
      };
    }
    return moneyCache.nf;
  }

  // «1234.5» → «1 234,5 ₽» / «$1,234.5» / «1.234,5 €» в зависимости от языка.
  function money(n) {
    var v = Number(n) || 0;
    var num = moneyFormatter().format(v);
    var sym = currencySymbol();
    if (locale() === 'en') return sym.length > 1 ? sym + ' ' + num : sym + num;
    return num + ' ' + sym;
  }

  function signedMoney(n, isIncome) {
    return (isIncome ? '+' : '−') + money(Math.abs(Number(n) || 0));
  }

  // «2026-10-17» → Date без сдвига часового пояса
  function parseDate(s) {
    var d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : todayIso();
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

  function monthDate(ym) {
    var p = String(ym).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, 1);
  }

  function dateFormatter(opts) {
    var key = locale() + '|' + JSON.stringify(opts);
    if (!dateCache[key]) dateCache[key] = new Intl.DateTimeFormat(locale(), opts);
    return dateCache[key];
  }

  // «2026-10» → «октябрь 2026» / «October 2026» / «octubre 2026»
  function monthTitle(ym) {
    return dateFormatter({ month: 'long' }).format(monthDate(ym)) + ' ' + String(ym).slice(0, 4);
  }

  function monthName(ym) {
    return dateFormatter({ month: 'long' }).format(monthDate(ym));
  }

  function monthShort(ym) {
    return dateFormatter({ month: 'short' }).format(monthDate(ym)).replace(/\.$/, '');
  }

  function monthTitleShort(ym) {
    return monthShort(ym) + ' ' + String(ym).slice(0, 4);
  }

  // «31 октября» / «October 31» / «31 de octubre»
  function dayMonth(day, monthIndex) {
    var d = new Date(new Date().getFullYear(), monthIndex, day);
    return dateFormatter({ day: 'numeric', month: 'long' }).format(d);
  }

  function shiftMonth(ym, delta) {
    var p = ym.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return isoDate(d).slice(0, 7);
  }

  function sameMonth(iso, ym) {
    return String(iso || '').slice(0, 7) === ym;
  }

  // «2026-10-17» → «Сегодня» / «Вчера» / «пн, 15 октября»
  function dayLabel(iso) {
    var d = parseDate(iso);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return root.I18n ? root.I18n.t('Сегодня') : 'Сегодня';
    if (diff === 1) return root.I18n ? root.I18n.t('Вчера') : 'Вчера';
    var opts = { weekday: 'short', day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return dateFormatter(opts).format(d);
  }

  function dayFull(iso) {
    var d = parseDate(iso);
    var out = dateFormatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return out.replace(/ г\.$/, '');
  }

  function weekdayShort(iso) {
    return dateFormatter({ weekday: 'short' }).format(parseDate(iso));
  }

  // «2 400», «350,50», «$1,234.5» → 2400 / 350.5. Возвращает NaN при мусоре.
  function parseAmount(raw) {
    var s = String(raw || '')
      .replace(/[\s\u00a0\u202f]/g, '')
      .replace(/(?:руб|rub|usd|eur|kzt|uah|gel|byn|amd|try|cny|br|р)\.?/gi, '')
      .replace(/[₽$€₸₴₾¥֏₺]/g, '');
    var lastComma = s.lastIndexOf(',');
    var lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      s = locale() === 'en' ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    }
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
    return Number(s);
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
    currencyCode: function () { return currencyCode; },
    currencySymbol: currencySymbol,
    currencyList: CURRENCY_LIST,
    currencyName: function (code) {
      var c = CURRENCY_BY_CODE[code || currencyCode];
      return c ? c.name : '';
    },
    setCurrency: setCurrency,
    parseDate: parseDate,
    isoDate: isoDate,
    todayIso: todayIso,
    currentMonth: currentMonth,
    monthTitle: monthTitle,
    monthTitleShort: monthTitleShort,
    monthName: monthName,
    monthShort: monthShort,
    dayMonth: dayMonth,
    shiftMonth: shiftMonth,
    sameMonth: sameMonth,
    dayLabel: dayLabel,
    dayFull: dayFull,
    weekdayShort: weekdayShort,
    parseAmount: parseAmount,
    escapeHtml: escapeHtml,
  };
})(window);
