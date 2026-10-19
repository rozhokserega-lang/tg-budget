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
    txFilter: null,
    summaryCache: {},
    txCache: {},
  };

  function displayName(m) {
    if (!m) return '';
    return (m.households && m.households.name) || 'Наша семья';
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

  function splitModeLabel() {
    var mode = state.member && state.member.households && state.member.households.split_mode;
    return mode === 'equal' ? 'Поровну' : 'Пропорционально доходу';
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
    isSolo: isSolo,
    planDaysLeft: planDaysLeft,
    isExpired: isExpired,
    splitModeLabel: splitModeLabel,
    isDueDismissed: isDueDismissed,
    dismissDue: dismissDue,
    remember: remember,
    reset: function () {
      state.member = null;
      state.categories = null;
      state.summaryCache = {};
      state.txCache = {};
      state.month = Fmt.currentMonth();
    },
  };
})(window);
