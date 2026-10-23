/** Состояние приложения: участник, семья, выбранный месяц и кэш загрузок. */

(function (root) {
  var state = {
    member: null,
    memberName: '',
    categories: null,
    plans: null,
    promo: [],
    tariffs: null,
    buying: false,
    deleting: false,
    month: Fmt.currentMonth(),
    txFilter: { kind: null, category_id: null, member_id: null, q: '' },
    txChart: 'expense',
    summaryCache: {},
    txCache: {},
    homeEdit: false,
    homeOrder: [],
    homeDraft: null,
  };

  // Порядок блоков главной. Хранится только на устройстве: у каждого
  // участника может быть свой удобный экран.
  var HOME_ORDER_KEY = 'budget.homeOrder';
  var DEFAULT_HOME_ORDER = ['balance', 'categories', 'forecast', 'plans', 'partners'];

  function normalizeHomeOrder(list) {
    var seen = {};
    var next = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (DEFAULT_HOME_ORDER.indexOf(id) === -1 || seen[id]) return;
      seen[id] = true;
      next.push(id);
    });
    DEFAULT_HOME_ORDER.forEach(function (id) {
      if (!seen[id]) next.push(id);
    });
    return next;
  }

  function readHomeOrder() {
    try {
      var saved = JSON.parse(root.localStorage.getItem(HOME_ORDER_KEY) || '[]');
      return normalizeHomeOrder(saved);
    } catch (e) {
      return DEFAULT_HOME_ORDER.slice();
    }
  }

  var homeOrder = readHomeOrder();
  state.homeOrder = homeOrder.slice();

  // Тема оформления: системная (по умолчанию), светлая или тёмная.
  // Выбор общий для всех участников на этом устройстве, поэтому не сбрасывается.
  var THEME_KEY = 'budget.theme';
  var THEME_MODES = ['system', 'light', 'dark'];

  function normalizeThemeMode(mode) {
    return THEME_MODES.indexOf(mode) !== -1 ? mode : 'system';
  }

  var themeMode = 'system';
  try { themeMode = normalizeThemeMode(root.localStorage.getItem(THEME_KEY)); } catch (e) {}

  function displayName(m) {
    if (!m) return '';
    return (m.households && m.households.name) || (root.I18n ? root.I18n.t('Наша семья') : 'Наша семья');
  }

  function planDaysLeft() {
    var until = state.member && state.member.households && state.member.households.plan_until;
    if (!until) return null;
    return Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
  }

  // Сравниваем точное время, а не дни: Math.ceil съедает до суток.
  function isExpired() {
    var until = state.member && state.member.households && state.member.households.plan_until;
    return !!until && new Date(until).getTime() < Date.now();
  }

  // Режим «только я»: семья без партнёра, блок расчёта и приглашение скрыты.
  function isSolo() {
    var h = state.member && state.member.households;
    return !!(h && h.mode === 'solo');
  }

  function splitModeLabel(mode) {
    var value = mode || (state.member && state.member.households &&
      (state.member.households.month_split_mode || state.member.households.split_mode));
    var label = value === 'none' ? 'Не делить' : value === 'equal' ? 'Поровну' : 'Пропорционально доходу';
    return root.I18n ? root.I18n.t(label) : label;
  }

  // Баннер «Сегодня/Завтра платёж» можно скрыть крестиком.
  // Запоминаем дату, чтобы после перезапуска Mini App он не вернулся в тот же день.
  var DUE_STORAGE_KEY = 'budget.dueDismissedOn';
  var dueDismissedOn = '';

  function isDueDismissed() {
    var stored = dueDismissedOn;
    try { stored = root.localStorage.getItem(DUE_STORAGE_KEY) || ''; } catch (e) {}
    return stored === Fmt.todayIso();
  }

  function dismissDue() {
    dueDismissedOn = Fmt.todayIso();
    try { root.localStorage.setItem(DUE_STORAGE_KEY, dueDismissedOn); } catch (e) {}
  }

  function remember(action, payload) {
    if (action !== 'add_tx' && action !== 'delete_tx') return;
    var month = (payload && payload.occurred_on) || '';
    state.summaryCache = {};
    state.txCache = {};
    state.month = month ? month.slice(0, 7) : state.month;
  }

  root.State = {
    get: function () { return state; },
    setMember: function (m) {
      state.member = m;
    },
    setCategories: function (list) {
      state.categories = list;
    },
    categoryById: function (cid) {
      return (state.categories || []).find(function (c) { return c.id === cid; }) || null;
    },
    displayName: displayName,
    themeMode: function () { return themeMode; },
    setThemeMode: function (mode) {
      themeMode = normalizeThemeMode(mode);
      try { root.localStorage.setItem(THEME_KEY, themeMode); } catch (e) {}
      return themeMode;
    },
    isSolo: isSolo,
    planDaysLeft: planDaysLeft,
    isExpired: isExpired,
    splitModeLabel: splitModeLabel,
    isDueDismissed: isDueDismissed,
    dismissDue: dismissDue,
    remember: remember,
    homeOrder: function () {
      var order = state.homeEdit && state.homeDraft ? state.homeDraft : homeOrder;
      return normalizeHomeOrder(order);
    },
    defaultHomeOrder: function () {
      return DEFAULT_HOME_ORDER.slice();
    },
    setHomeOrder: function (list) {
      homeOrder = normalizeHomeOrder(list);
      state.homeOrder = homeOrder.slice();
      try { root.localStorage.setItem(HOME_ORDER_KEY, JSON.stringify(homeOrder)); } catch (e) {}
      return homeOrder.slice();
    },
    resetHomeOrder: function () {
      homeOrder = DEFAULT_HOME_ORDER.slice();
      state.homeOrder = homeOrder.slice();
      try { root.localStorage.removeItem(HOME_ORDER_KEY); } catch (e) {}
      return homeOrder.slice();
    },
    reset: function () {
      state.member = null;
      state.categories = null;
      state.summaryCache = {};
      state.txCache = {};
      state.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
      state.month = Fmt.currentMonth();
      state.homeEdit = false;
      state.homeDraft = null;
    },
  };
})(window);
