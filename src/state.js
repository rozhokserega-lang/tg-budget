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
    month: Fmt.currentMonth(),
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

  function splitModeLabel() {
    var mode = state.member && state.member.households && state.member.households.split_mode;
    return mode === 'equal' ? 'Поровну' : 'Пропорционально доходу';
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
    planDaysLeft: planDaysLeft,
    isExpired: isExpired,
    splitModeLabel: splitModeLabel,
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
