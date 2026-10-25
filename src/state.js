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
    txFilter: { category_id: null, member_id: null, q: '' },
    summaryCache: {},
    txCache: {},
  };

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

  function splitModeLabel() {
    var mode = state.member && state.member.households && state.member.households.split_mode;
    var label = mode === 'equal' ? 'Поровну' : 'Пропорционально доходу';
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

  var HOME_BLOCKS = ['balance', 'categories', 'forecast', 'plans', 'partners'];
  function homeOrder() {
    var saved = [];
    try { saved = JSON.parse(root.localStorage.getItem('budget.homeOrder.' + (state.member && state.member.id)) || '[]'); } catch (e) {}
    if (!Array.isArray(saved)) saved = [];
    return saved.filter(function (id, i) { return HOME_BLOCKS.indexOf(id) !== -1 && saved.indexOf(id) === i; })
      .concat(HOME_BLOCKS.filter(function (id) { return saved.indexOf(id) === -1; }));
  }
  function moveHomeBlock(id, direction) {
    var order = homeOrder(), from = order.indexOf(id), to = from + direction;
    if (!state.member || from < 0 || to < 0 || to >= order.length || Math.abs(direction) !== 1) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    root.localStorage.setItem('budget.homeOrder.' + state.member.id, JSON.stringify(order));
  }

  root.State = {
    homeOrder: homeOrder,
    moveHomeBlock: moveHomeBlock,
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
      state.txFilter = { category_id: null, member_id: null, q: '' };
      state.month = Fmt.currentMonth();
    },
  };
})(window);
