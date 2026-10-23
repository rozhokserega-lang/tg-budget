/**
 * Роутер и обработчики: онбординг → сводка / траты / добавление / настройки.
 * Разметка — в views.js, запросы — через Api.call(action, params).
 */

(function (root) {
  var T = I18n.t;
  var $ = function (sel) { return document.querySelector(sel); };
  var el = {
    header: $('#screen-header'),
    viewport: $('#screen-viewport'),
    screen: $('#screen'),
    tabs: $('#tabs'),
    loader: $('#loader'),
    toast: $('#toast'),
    dialog: $('#dialog'),
    dialogText: $('#dialog-text'),
    dialogOk: $('#dialog-ok'),
    dialogCancel: $('#dialog .dialog__btn[data-dialog-close]'),
    sheet: $('#sheet'),
    sheetBody: $('#sheet-body'),
  };

  var st = State.get();
  var route = { name: 'summary', tab: 'summary' };
  var form = {};
  var onboarding = { tab: 'create', member_name: '', code: '', household_name: '', mode: 'pair' };
  var reqSeq = 0;
  var dialogResolve = null;
  var catKind = 'expense';
  var pendingAdds = {};
  var editingTx = null;
  var editSaving = false;
  var editGeneration = 0;
  st.homeCategorySort = 'default';
  st.homeShowEmpty = false;
  st.homeScreenStatus = null;
  try { if (root.localStorage.getItem('budget.homeCategorySort') === 'amount') st.homeCategorySort = 'amount'; } catch (e) {}
  // Раскрытая категория на сводке: { id, rows } или null.
  var expandedCat = null;
  // Сетка/список категорий — выбор запоминается на устройстве.
  var categoryView = 'grid';
  try {
    var savedCategoryView = root.localStorage.getItem('budget.categoryView');
    if (savedCategoryView === 'grid' || savedCategoryView === 'list') categoryView = savedCategoryView;
  } catch (e) {}
  var quickActionsPage = 0;
  var QUICK_PAGES = 3;
  // Палец на странице быстрых действий: { x, y, dx, axis } или null.
  var qaSwipe = null;
  // Горизонтальный свайп между основными страницами.
  var pageSwipe = null;
  var pageSwipeClickUntil = 0;
  // Доезжающая страница: пока идёт анимация, новый жест её не ждёт.
  var pageSettle = null;
  // Категория, из которой открыли форму: после сохранения вернёмся к ней.
  var pendingFromCategory = null;
  var homeScreenCheckSeq = 0;
  var homeScreenAttemptSeq = 0;
  var homeScreenAttemptTimer = null;
  var homeScreenFallbackOpen = false;

  var ICON = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var TABS = [
    { id: 'summary', icon: ICON('<path d="m3 10 9-7 9 7v10H15v-7H9v7H3z"/>'), label: 'Главная' },
    { id: 'tx', icon: ICON('<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 13h5v4h-5zM6 5V3h12"/>'), label: 'Финансы' },
    { id: 'add', icon: ICON('<path d="M12 5v14M5 12h14"/>'), label: 'Добавить', primary: true },
    { id: 'plans', icon: ICON('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'), label: 'Планы' },
    { id: 'settings', icon: ICON('<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>'), label: 'Профиль' },
  ];
  var plansTab = 'goals';
  // Порядок основных страниц для горизонтального свайпа. «Добавить» —
  // действие, а не страница, поэтому в навигации не участвует.
  var MAIN_TABS = ['summary', 'tx', 'plans', 'settings'];

  // --- UI-помощники ---

  function themeLabel(mode) {
    return mode === 'light' ? 'Светлая' : mode === 'dark' ? 'Тёмная' : 'Система';
  }

  function setThemePreference(mode) {
    var next = State.setThemeMode(mode);
    if (root.Tg && typeof root.Tg.setThemeMode === 'function') root.Tg.setThemeMode(next);
    root.Tg.haptic('light');
    toast(T('Тема: {name}', { name: T(themeLabel(next)) }));
  }

  var toastTimer = null;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.hidden = false;
    requestAnimationFrame(function () { el.toast.classList.add('toast--visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('toast--visible');
      toastTimer = setTimeout(function () { el.toast.hidden = true; }, 250);
    }, 2200);
  }

  function dialog(text, okLabel) {
    return new Promise(function (resolve) {
      dialogResolve = resolve;
      el.dialogText.textContent = text;
      el.dialogOk.textContent = okLabel || T('Удалить');
      if (el.dialogCancel) {
        el.dialogCancel.textContent = T('Отмена');
        el.dialogCancel.hidden = false;
      }
      el.dialog.hidden = false;
    });
  }

  function infoDialog(text) {
    el.dialogText.textContent = text;
    el.dialogOk.textContent = T('Понятно');
    if (el.dialogCancel) el.dialogCancel.hidden = true;
    el.dialog.hidden = false;
  }

  function closeDialog(result) {
    el.dialog.hidden = true;
    homeScreenFallbackOpen = false;
    if (dialogResolve) dialogResolve(result);
    dialogResolve = null;
  }

  function openSheet(html) {
    clearTimeout(sheetTimer);
    resetSheetDrag();
    el.sheet.classList.remove('sheet--closing');
    el.sheetBody.innerHTML = html;
    setQuickActionLayer(!!el.sheetBody.querySelector('.quick-actions'));
    el.sheet.hidden = false;
    root.Tg.backButton(closeSheet);
  }

  var sheetTimer = null;
  function closeSheet() {
    if (editingTx) return;
    clearTimeout(sheetTimer);
    qaSwipe = null;
    qaMouse = null;
    qaMouseDragging = false;
    if (el.sheet.hidden) {
      setQuickActionLayer(false);
      el.sheetBody.innerHTML = '';
    } else {
      // Плавное закрытие: панель уезжает вниз, фон гаснет (см. polish.css).
      el.sheet.classList.add('sheet--closing');
      sheetTimer = setTimeout(function () {
        el.sheet.hidden = true;
        setQuickActionLayer(false);
        el.sheet.classList.remove('sheet--closing');
        el.sheetBody.innerHTML = '';
        resetSheetDrag();
      }, 170);
    }
    syncBackButton();
  }

  var sheetDrag = null;
  var sheetSnapTimer = null;
  var sheetClickUntil = 0;
  function resetSheetDrag() {
    clearTimeout(sheetSnapTimer);
    sheetDrag = null;
    var panel = el.sheet.querySelector('.sheet__panel');
    panel.style.removeProperty('transform');
    panel.style.removeProperty('transition');
    panel.style.removeProperty('animation');
    panel.style.removeProperty('--sheet-drag');
    el.sheet.classList.remove('sheet--dragging');
  }
  function beginSheetDrag(target, x, y, id) {
    if (editingTx) return;
    var panel = target.closest('.sheet__panel');
    if (!panel || el.sheet.hidden || el.sheet.classList.contains('sheet--closing')) return;
    if (target.closest('input,select,textarea,a,[contenteditable]') || panel.scrollTop > 0) return;
    resetSheetDrag();
    sheetDrag = { panel: panel, x: x, y: y, id: id, distance: 0, active: false, at: performance.now() };
  }
  function moveSheetDrag(x, y, ev) {
    if (!sheetDrag) return;
    var dx = x - sheetDrag.x, dy = y - sheetDrag.y;
    if (!sheetDrag.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { sheetDrag = null; return; }
      if (dy < -8 || sheetDrag.panel.scrollTop > 0) { sheetDrag = null; return; }
      if (dy < 8 || dy < Math.abs(dx) * 1.2) return;
      sheetDrag.active = true;
      qaSwipe = null;
      qaMouse = null;
      qaMouseDragging = false;
      sheetDrag.panel.style.animation = 'none';
      sheetDrag.panel.style.transition = 'none';
      el.sheet.classList.add('sheet--dragging');
      if (sheetDrag.id != null) el.sheet.setPointerCapture(sheetDrag.id);
    }
    if (ev.cancelable) ev.preventDefault();
    sheetDrag.distance = Math.max(0, dy);
    sheetDrag.panel.style.setProperty('--sheet-drag', sheetDrag.distance + 'px');
    sheetDrag.panel.style.transform = 'translateY(' + sheetDrag.distance + 'px)';
  }
  function endSheetDrag(cancelled) {
    if (!sheetDrag) return;
    var drag = sheetDrag;
    sheetDrag = null;
    if (!drag.active) return;
    if (drag.id != null && el.sheet.hasPointerCapture(drag.id)) el.sheet.releasePointerCapture(drag.id);
    el.sheet.classList.remove('sheet--dragging');
    sheetClickUntil = Date.now() + 350;
    var fast = drag.distance / Math.max(1, performance.now() - drag.at) > .55;
    if (!cancelled && (drag.distance > Math.min(110, drag.panel.offsetHeight * .24) || (drag.distance > 35 && fast))) {
      drag.panel.style.removeProperty('animation');
      closeSheet();
    } else {
      drag.panel.style.transition = 'transform 220ms cubic-bezier(.22,1,.36,1)';
      drag.panel.style.transform = 'translateY(0)';
      sheetSnapTimer = setTimeout(resetSheetDrag, 220);
    }
  }
  el.sheet.addEventListener('touchstart', function (ev) {
    if (ev.touches.length === 1) beginSheetDrag(ev.target, ev.touches[0].clientX, ev.touches[0].clientY, null);
  }, { passive: true });
  el.sheet.addEventListener('touchmove', function (ev) {
    if (ev.touches.length === 1) moveSheetDrag(ev.touches[0].clientX, ev.touches[0].clientY, ev);
    else endSheetDrag(true);
  }, { passive: false });
  el.sheet.addEventListener('touchend', function () { endSheetDrag(false); });
  el.sheet.addEventListener('touchcancel', function () { endSheetDrag(true); });
  el.sheet.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType !== 'touch' && ev.button === 0) beginSheetDrag(ev.target, ev.clientX, ev.clientY, ev.pointerId);
  });
  document.addEventListener('pointermove', function (ev) {
    if (ev.pointerType !== 'touch' && sheetDrag && sheetDrag.id === ev.pointerId) moveSheetDrag(ev.clientX, ev.clientY, ev);
  });
  document.addEventListener('pointerup', function (ev) {
    if (ev.pointerType !== 'touch' && sheetDrag && sheetDrag.id === ev.pointerId) endSheetDrag(false);
  });
  document.addEventListener('pointercancel', function (ev) {
    if (ev.pointerType !== 'touch' && sheetDrag && sheetDrag.id === ev.pointerId) endSheetDrag(true);
  });
  el.sheet.addEventListener('click', function (ev) {
    if (Date.now() < sheetClickUntil) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);

  function setQuickActionLayer(active) {
    active = !!active;
    el.sheet.classList.toggle('sheet--quick-actions', active);
    el.tabs.classList.toggle('tabs--quick-actions', active);
    var addButton = el.tabs.querySelector('[data-tab="add"]');
    if (!addButton) return;
    var icon = addButton.querySelector('.tab__icon');
    var label = addButton.querySelector('span:last-child');
    if (icon) {
      icon.innerHTML = active
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    }
    if (label) label.textContent = T(active ? 'Закрыть' : 'Добавить');
    addButton.setAttribute('aria-label', T(active ? 'Закрыть меню быстрых действий' : 'Добавить'));
    addButton.setAttribute('aria-expanded', active ? 'true' : 'false');
    addButton.classList.toggle('tab--primary-open', active);
  }

  function hideLoader() {
    el.loader.hidden = true;
  }

  // Системная «Назад» ведёт из формы добавления на сводку, из остальных мест — недоступна.
  function syncBackButton() {
    if (editingTx) return root.Tg.backButton(function () {});
    if (st.homeEdit) return root.Tg.backButton(cancelHomeEdit);
    if (route.name === 'add') return root.Tg.backButton(goHome);
    // Лимиты — подэкран настроек: «Назад» возвращает к ним.
    if (route.name === 'limits') return root.Tg.backButton(function () { openSettings('budget'); });
    if (route.name === 'settings' && route.section) return root.Tg.backButton(function () { openSettings(); });
    root.Tg.backButton(null);
  }

  function applyRouteUi() {
    var inApp = !!st.member;
    el.header.hidden = true;
    el.tabs.hidden = !inApp;
    document.body.classList.toggle('app--has-tabs', inApp);
    if (!inApp) {
      el.tabs.innerHTML = '';
      return;
    }
    // «Добавить» — не место, а действие: подсвечиваем вкладку, с которой пришли.
    var active = route.name === 'add' ? 'summary'
      : route.name === 'limits' ? 'settings'
      : route.name;
    // Меню создаём один раз: перерисовка на каждом переходе вызывала мигание иконок.
    if (el.tabs.children.length !== TABS.length) {
      el.tabs.innerHTML = TABS.map(function (t) {
        return '<button type="button" class="tab' + (t.primary ? ' tab--primary' : '') + '" data-tab="' + t.id + '" aria-label="' + Fmt.escapeHtml(T(t.label)) + '">' +
          '<span class="tab__icon">' + t.icon + '</span><span>' + T(t.label) + '</span></button>';
      }).join('');
    }
    var activeIdx = 0;
    Array.prototype.forEach.call(el.tabs.children, function (b, i) {
      var on = b.getAttribute('data-tab') === active;
      b.classList.toggle('tab--active', on);
      if (on) activeIdx = i;
    });
    el.tabs.style.setProperty('--tab-i', activeIdx);
    syncBackButton();
  }

  var lastScreen = null;
  var enterTimer = null;
  var fadeTimer = null;
  var renderToken = 0;
  // Переход свайпом уже отыгран руками — новую страницу показываем без
  // повторного затухания и каскада появления.
  var instantRender = false;
  // Асинхронные дорисовки сразу после свайпа тоже не перезапускают анимации.
  var instantUntil = 0;
  function screenKey() {
    return route.name + (route.name === 'settings' ? ':' + (route.section || 'home') : route.name === 'plans' ? ':' + plansTab : '');
  }
  function render(html) {
    // Смена экрана: старое содержимое мягко гаснет, потом появляется новое.
    // Мгновенная подмена DOM и анимация только нового и давала «рывок».
    var token = ++renderToken;
    clearTimeout(fadeTimer);
    var switching = !instantRender && screenKey() !== lastScreen && lastScreen !== null && el.screen.firstChild;
    if (switching) {
      el.screen.classList.add('screen--fading');
      // Панель вкладок и «назад» переключаем сразу — отклик не ждёт анимации.
      applyRouteUi();
      fadeTimer = setTimeout(function () {
        el.screen.classList.remove('screen--fading');
        if (token === renderToken) renderContent(html);
      }, 110);
      return;
    }
    renderContent(html);
  }

  function renderContent(html) {
    el.screen.innerHTML = html;
    el.screen.scrollTop = 0;
    el.screen.classList.remove('screen--fading');
    var instant = instantRender || Date.now() < instantUntil;
    el.screen.classList.toggle('screen--instant', instant);
    // Каскад появления — только при смене экрана, не при каждом обновлении данных.
    if (screenKey() !== lastScreen) {
      lastScreen = screenKey();
      el.screen.classList.remove('screen--in');
      if (!instant) {
        void el.screen.offsetWidth;
        el.screen.classList.add('screen--in');
        clearTimeout(enterTimer);
        enterTimer = setTimeout(function () { el.screen.classList.remove('screen--in'); }, 900);
      }
    }
    applyRouteUi();
    pendingScrollTxFilter();
  }

  // Предупреждение сверху экрана (подписка и т. п.).
  function banner(text) {
    var div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML = '<span>⌛</span><span>' + Fmt.escapeHtml(text) + '</span>';
    el.screen.insertBefore(div, el.screen.firstChild);
  }

  function errorView(err) {
    var code = err && (err.code || err.message);
    if (code === 'no_household') {
      adoptMember(null);
      return false;
    }
    var opts = {
      icon: '📡',
      title: T('Не удалось загрузить'),
      text: (err && err.message) || T('Проверьте соединение и попробуйте ещё раз.'),
      retry: true,
    };
    if (code === 'unauthorized') {
      adoptMember(null);
      opts = {
        icon: '🔒',
        title: T('Нужен доступ из бота'),
        text: T('Откройте приложение кнопкой «Открыть бюджет» в Telegram-боте.'),
        retry: false,
      };
    } else if (code === 'no_config') {
      opts = {
        icon: '⚙️',
        title: T('Не настроено'),
        text: T('В index.html укажите APP_API_URL — адрес Edge Function `api`.'),
        retry: false,
      };
    } else if (code === 'subscription_expired') {
      opts = {
        icon: '⌛',
        title: T('Пробный период закончился'),
        text: T('Добавлять записи нельзя. Активируйте промокод, чтобы восстановить доступ.'),
        retry: true,
        promo: true,
      };
    }
    render(Views.renderError(opts));
    return true;
  }

  function fail(err) {
    if (!errorView(err)) {
      render(Views.renderOnboarding(onboarding));
      return;
    }
  }

  // --- Данные ---

  var resourceCache = BudgetCache.create();
  var dataEpoch = 0;
  var memberRequest = 0;
  var lifecycleRequest = null;

  function memberScope(member) {
    return member ? String(member.id) + ':' + String(member.household_id || (member.households || {}).id || '') : 'anonymous';
  }

  function adoptMember(member) {
    if (memberScope(st.member) !== memberScope(member)) {
      memberRequest++;
      clearCache();
      st.categories = null;
      st.plans = null;
      st.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
      st.txChart = 'expense';
      pendingAdds = {};
      deletingTx = {};
      expandedCat = null;
      editingTx = null;
      editSaving = false;
      editGeneration++;
      st.homeEdit = false;
      st.homeDraft = null;
      el.screen.inert = false;
      el.tabs.inert = false;
      closeSheet();
      reqSeq++;
    }
    resourceCache.setScope(memberScope(member));
    st.member = member;
  }

  function loadMember() {
    var request = ++memberRequest;
    return Api.call('me').then(function (res) {
      if (request !== memberRequest) throw obsoleteResponse();
      adoptMember(res && res.member || null);
      st.promo = res && Array.isArray(res.promo) ? res.promo : [];
      return st.member;
    }).catch(function (err) { handleAccessFailure(err); throw err; });
  }

  function handleAccessFailure(err) {
    if (err.code === 'unauthorized' || err.code === 'no_household') {
      adoptMember(null);
      fail(err);
    }
  }

  function mutate(action, payload) {
    var scope = memberScope(st.member);
    return Api.call(action, payload).then(function (result) {
      if (scope !== memberScope(st.member)) throw obsoleteResponse();
      clearCache();
      return result;
    });
  }

  // Планы подтягиваем лениво и мягко: сводка не должна падать из-за них.
  function obsoleteResponse() {
    var err = new Error('Obsolete response');
    err.code = 'stale_response';
    return err;
  }

  function loadResource(key, loader, force, commit) {
    var epoch = dataEpoch;
    return resourceCache.fetch(key, loader, { force: !!force }).then(function (data) {
      if (epoch !== dataEpoch || resourceCache.read(key, true) !== data) throw obsoleteResponse();
      if (commit) commit(data);
      return data;
    }).catch(function (err) { handleAccessFailure(err); throw err; });
  }

  function loadPlans(force) {
    return loadResource('plans', function () {
      return Promise.all([Api.call('list_plans'), Api.call('list_recurring')]).then(function (res) {
        var p = res[0] || {};
        return { goals: p.goals || [], debts: p.debts || [], wishes: p.wishes || [], recurring: res[1] || [] };
      });
    }, force, function (plans) { st.plans = plans; });
  }

  function loadCategories(force) {
    if (!force && st.categories) return Promise.resolve(st.categories);
    return loadResource('categories', function () { return Api.call('categories'); }, force, function (list) {
      st.categories = Array.isArray(list) ? list : [];
    }).then(function () { return st.categories; });
  }

  function clearCache() {
    dataEpoch++;
    resourceCache.invalidate();
    Object.keys(st).forEach(function (k) {
      if (k.indexOf('summaryCache:') === 0 || k.indexOf('txCache:') === 0) delete st[k];
    });
    st.lastSummary = null;
  }

  // Stale data remains renderable; TTL only governs ordinary network reads.
  function cached(key, value) {
    if (value === undefined) return st[key] ? st[key].data : null;
    resourceCache.write(key, value);
    st[key] = { data: value, at: Date.now() };
  }

  function fetchSummary(month, force) {
    var key = 'summaryCache:' + month;
    if (root.Queue && Queue.size() && cached(key)) return Promise.resolve(cached(key));
    return loadResource(key, function () { return Api.call('summary', { month: month }); }, force, function (s) {
      st[key] = { data: s, at: Date.now() };
    });
  }

  function loadSummary(month, force) {
    return fetchSummary(month, force).then(function (s) {
      if (month === st.month && cached('summaryCache:' + month) === s) st.lastSummary = s;
      return s;
    });
  }

  function loadTx(month, force) {
    var key = 'txCache:' + month;
    return loadResource(key, function () {
      return Api.call('list_tx', { month: month }).then(function (list) {
        var data = (Array.isArray(list) ? list : []).filter(function (t) { return !deletingTx[t.id]; });
        Object.keys(pendingAdds).forEach(function (id) {
          var tx = pendingAdds[id];
          if (Fmt.sameMonth(tx.occurred_on, month) && !data.some(function (row) { return row.id === tx.id || row.id === tx._serverId; })) data.unshift(tx);
        });
        return data;
      });
    }, force, function (data) { st[key] = { data: data, at: Date.now() }; });
  }

  // --- Экраны ---

  function openSummary(force) {
    route = { name: 'summary' };
    var seq = ++reqSeq;
    var month = st.month;
    var previous = cached('summaryCache:' + month);
    var lastPaint = null;
    function current() { return seq === reqSeq && route.name === 'summary' && month === st.month; }
    function paint() {
      if (!current()) return;
      var summary = cached('summaryCache:' + month);
      if (!summary) return;
      var snapshot = [summary, st.plans, expandedCat, cached('txCache:' + month)];
      if (lastPaint && snapshot.every(function (value, index) { return value === lastPaint[index]; })) return;
      lastPaint = snapshot;
      st.lastSummary = summary;
      render(Views.renderSummary(summary, st.plans, expandedCat, cached('txCache:' + month), categoryView));
      if (State.isExpired()) banner(T('Пробный период закончился — новые записи недоступны.'));
    }
    if (previous) paint(); else render(Views.skeletonSummary());
    // Parallel critical data; no speculative neighbouring-month requests.
    var txRequest = loadTx(month, force);
    var summaryRequest = loadSummary(month, force);
    summaryRequest.then(function () {
      if (!current()) return;
      paint();
      return txRequest.then(function (rows) {
        if (!current()) return;
        if (expandedCat) expandedCat = { id: expandedCat.id, rows: rows.filter(function (t) { return t.category_id === expandedCat.id; }) };
        paint();
      });
    }).catch(function (err) {
      if (!current() || err.code === 'stale_response') return;
      if (cached('summaryCache:' + month)) { paint(); toast(T('Не удалось обновить — показываем сохранённое')); }
      else fail(err);
    });
    // Attach immediately to avoid an unhandled rejection when summary is slower.
    txRequest.catch(function (err) {
      if (current() && err.code !== 'stale_response') toast(T('Не удалось обновить операции'));
    });
    Promise.allSettled([summaryRequest, txRequest]).then(function () {
      if (!current()) return;
      loadPlans(force).then(paint).catch(function (err) {
        if (current() && err.code !== 'stale_response') toast(T('Не удалось обновить планы'));
      });
    });
  }

  function changeMonth(delta) {
    var next = Fmt.shiftMonth(st.month, delta);
    if (next > Fmt.currentMonth()) return;
    st.month = next;
    expandedCat = null;
    root.Tg.haptic('light');
    if (route.name === 'tx') openTx();
    else openSummary();
  }

  function goHome() {
    if (!st.member) return render(Views.renderOnboarding(onboarding));
    openSummary();
  }

  // categoryId — показать только записи этой категории (переход со сводки).
  // Любой явный переход сбрасывает поиск и фильтры участника.
  function openTx(categoryId, force, scrollToFilter) {
    route = { name: 'tx' };
    if (categoryId !== undefined) st.txFilter = { kind: null, category_id: categoryId || null, member_id: null, q: '' };
    if (!st.txFilter) st.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
    if (st.txChart !== 'income' && st.txChart !== 'expense' && st.txChart !== 'balance') st.txChart = 'expense';
    if (categoryId) {
      var category = (st.categories || []).filter(function (c) { return c.id === categoryId; })[0];
      if (!category && st.lastSummary) {
        category = (st.lastSummary.categories || []).filter(function (c) { return c.id === categoryId; })[0];
      }
      if (category && category.kind === 'income') st.txChart = 'income';
      else if (category) st.txChart = 'expense';
    }
    var seq = ++reqSeq;
    var month = st.month;
    var previous = cached('txCache:' + month);
    if (scrollToFilter) txFilterScrollPending = true;
    if (previous) render(Views.renderTxList(previous, st.txFilter, st.txChart)); else render(Views.skeletonList());
    pendingScrollTxFilter();
    loadTx(month, force).then(function (all) {
      if (seq !== reqSeq || route.name !== 'tx' || month !== st.month) return;
      render(Views.renderTxList(all, st.txFilter, st.txChart));
      pendingScrollTxFilter();
      if (State.isExpired()) banner(T('Пробный период закончился — новые записи недоступны.'));
    }).catch(function (err) {
      txFilterScrollPending = false;
      if (seq !== reqSeq || err.code === 'stale_response') return;
      if (cached('txCache:' + month)) toast(T('Не удалось обновить — показываем сохранённое'));
      else fail(err);
    });
  }

  // Прокрутка к фильтру категории после перехода «Посмотреть все» с главной.
  // Экран финансов может отрисоваться отложенно (анимация смены экрана),
  // поэтому флаг сбрасывается только когда фильтр уже оказался в DOM.
  var txFilterScrollPending = false;
  function pendingScrollTxFilter() {
    if (!txFilterScrollPending) return;
    var node = el.screen.querySelector('.tx-filter');
    if (!node) return;
    txFilterScrollPending = false;
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  // Переход с главной по карточке доходов или расходов.
  function openTxKind(kind) {
    st.txChart = kind === 'income' ? 'income' : 'expense';
    st.txFilter = { kind: kind === 'income' ? 'income' : 'expense', category_id: null, member_id: null, q: '' };
    openTx();
  }

  // params: { category_id, kind } — подставляем категорию, если форма открыта из раздела.
  function openAdd(params) {
    if (State.isExpired()) {
      fail(new Api.ApiError('subscription_expired', 402));
      return;
    }
    var saved = formValues();
    route = { name: 'add' };
    // Открытие из раздела: категория уже выбрана, поля формы начинаем с чистого листа.
    var preset = params && params.category_id;
    var kind = params && (params.kind === 'income' || params.kind === 'expense') ? params.kind : (saved.kind || 'expense');
    form = {
      category_id: preset || (kind === saved.kind ? saved.category_id : null),
      kind: kind,
      amount: preset ? '' : saved.amount,
      note: preset ? '' : saved.note,
      date: preset ? Fmt.todayIso() : saved.date,
      is_shared: State.isSolo() ? false : (preset ? true : saved.is_shared),
      receipt: null,
    };
    var seq = ++reqSeq;
    render(Views.skeletonList());
    loadCategories().then(function () {
      if (seq !== reqSeq || route.name !== 'add') return;
      pendingFromCategory = preset || null;
      render(Views.renderForm(form));
      if (State.isExpired()) banner(T('Пробный период закончился — добавлять записи нельзя.'));
    }).catch(function (err) {
      if (seq !== reqSeq || route.name !== 'add') return;
      fail(err);
    });
  }

  function formValues() {
    var f = el.screen.querySelector('[data-form="add"]');
    if (!f) return form;
    var shared = f.elements.is_shared;
    return {
      amount: f.elements.amount ? f.elements.amount.value : '',
      note: f.elements.note ? f.elements.note.value : '',
      date: f.elements.occurred_on ? f.elements.occurred_on.value : Fmt.todayIso(),
      kind: form.kind,
      category_id: form.category_id,
      is_shared: State.isSolo() ? false : (shared ? shared.checked : true),
      receipt: form.receipt || null,
    };
  }

  function isAndroidHomeScreen() {
    var platform = root.Tg && root.Tg.platform ? root.Tg.platform() : '';
    return platform === 'android' || platform === 'android_x';
  }

  function clearHomeScreenAttempt() {
    homeScreenAttemptSeq++;
    if (homeScreenAttemptTimer) {
      clearTimeout(homeScreenAttemptTimer);
      homeScreenAttemptTimer = null;
    }
  }

  function showHomeScreenFallback() {
    homeScreenFallbackOpen = true;
    infoDialog(T('Системное окно не появилось. Откройте чат с ботом, нажмите ⋮ и выберите «Добавить на главный экран». Если ярлык уже есть, удалите старый и добавьте заново.'));
  }

  // Android не присылает homeScreenFailed, если лаунчер не умеет закреплять
  // ярлыки. Поэтому после вызова проверяем статус и подсказываем ручной путь.
  function watchHomeScreenAttempt() {
    if (!isAndroidHomeScreen()) return;
    var seq = ++homeScreenAttemptSeq;
    clearTimeout(homeScreenAttemptTimer);
    homeScreenAttemptTimer = setTimeout(function () {
      if (seq !== homeScreenAttemptSeq || st.homeScreenStatus === 'added') return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      var check = root.Tg && root.Tg.checkHomeScreenStatus;
      if (typeof check !== 'function') {
        showHomeScreenFallback();
        return;
      }
      check(function (status) {
        if (seq !== homeScreenAttemptSeq) return;
        if (status === 'added') {
          st.homeScreenStatus = 'added';
          if (route.name === 'settings' && !route.section) render(Views.renderSettings());
          return;
        }
        showHomeScreenFallback();
      });
    }, 4000);
  }

  // Статус ярлыка на главном экране. На десктопе и в старых клиентах
  // checkHomeScreenStatus вернёт unsupported — тогда строку в профиле не рисуем.
  function refreshHomeScreenStatus() {
    var check = root.Tg && root.Tg.checkHomeScreenStatus;
    if (typeof check !== 'function') {
      st.homeScreenStatus = 'unsupported';
      return;
    }
    var seq = ++homeScreenCheckSeq;
    check(function (status) {
      if (seq !== homeScreenCheckSeq) return;
      var next = status === 'added' || status === 'missed' || status === 'unknown' ? status : 'unsupported';
      var changed = st.homeScreenStatus !== next;
      st.homeScreenStatus = next;
      if (next === 'added') {
        clearHomeScreenAttempt();
        if (homeScreenFallbackOpen) closeDialog(true);
      }
      if (changed && route.name === 'settings' && !route.section) render(Views.renderSettings());
    });
  }

  function addHomeScreen() {
    if (st.homeScreenStatus === 'added') {
      root.Tg.haptic('light');
      toast(T('Ярлык уже добавлен'));
      return;
    }
    if (st.homeScreenStatus === 'unsupported' ||
      (typeof root.Tg.canAddToHomeScreen === 'function' && !root.Tg.canAddToHomeScreen())) {
      toast(T('Недоступно на этом устройстве'));
      return;
    }
    root.Tg.haptic('light');
    if (typeof root.Tg.addToHomeScreen !== 'function' || !root.Tg.addToHomeScreen()) {
      toast(T('Не удалось добавить ярлык'));
      return;
    }
    if (isAndroidHomeScreen()) {
      toast(T('Подтвердите добавление в системном окне'));
      watchHomeScreenAttempt();
    }
  }

  function openSettings(section) {
    var allowed = ['family', 'budget', 'appearance', 'notifications', 'subscription', 'about'];
    route = { name: 'settings', section: allowed.indexOf(section) !== -1 ? section : null };
    render(Views.renderSettings(route.section));
    if (!route.section) refreshHomeScreenStatus();
    if (route.section === 'subscription') loadTariffs();
    if (route.section === 'budget') {
      loadCategories().then(function () {
        if (route.name === 'settings' && route.section === 'budget') render(Views.renderSettings(route.section));
      }).catch(function () {});
    }
  }

  function loadTariffs() {
    return Api.call('plans').then(function (list) {
      st.tariffs = Array.isArray(list) ? list : [];
    }).catch(function () {
      st.tariffs = st.tariffs || [];
    }).then(function () {
      if (route.name === 'settings' && route.section === 'subscription') render(Views.renderSettings(route.section));
    });
  }

  // Покупка доступа за Telegram Stars: счёт создаёт сервер, оплату открывает Telegram,
  // доступ продлевает бот по successful_payment — здесь только ждём и обновляем.
  function buyTariff(code) {
    if (st.buying) return;
    st.buying = true;
    render(Views.renderSettings(route.section));
    Api.call('create_invoice', { plan: code }).then(function (res) {
      var tg = root.Tg.sdk();
      if (!tg || !tg.openInvoice) {
        st.buying = false;
        render(Views.renderSettings(route.section));
        toast(T('Оплата доступна только в Telegram'));
        return;
      }
      tg.openInvoice(res.url, function (status) {
        st.buying = false;
        if (status === 'paid') {
          // Вебхук бота может прийти на секунду позже — перечитываем статус.
          setTimeout(function () {
            loadMember().then(function () {
              if (st.member && st.member.households) clearCache();
              toast(T('Спасибо! Доступ продлён'));
              if (route.name === 'settings') render(Views.renderSettings(route.section));
            });
          }, 1500);
        } else {
          toast(status === 'cancelled' ? T('Оплата отменена') : T('Оплата не прошла'));
          if (route.name === 'settings') render(Views.renderSettings(route.section));
        }
      });
    }).catch(function (err) {
      st.buying = false;
      if (route.name === 'settings') render(Views.renderSettings(route.section));
      if (err.code === 'telegram_error') return toast(T('Не удалось создать счёт'));
      toast(err.message || T('Не удалось создать счёт'));
    });
  }

  // --- Планы ---

  function openPlans(tab) {
    if (tab) plansTab = tab;
    route = { name: 'plans' };
    if (st.plans) render(Views.renderPlans(st.plans, plansTab)); else render(Views.skeletonList());
    var seq = ++reqSeq;
    loadPlans(true).then(function (plans) {
      if (seq !== reqSeq) return;
      render(Views.renderPlans(plans, plansTab));
      if (State.isExpired()) banner(T('Пробный период закончился — изменения недоступны.'));
    }).catch(function (err) {
      if (seq !== reqSeq || err.code === 'stale_response') return;
      if (st.plans) toast(T('Не удалось обновить — показываем сохранённое')); else fail(err);
    });
  }

  function openPlanForm(kind, current) {
    if (State.isExpired()) return fail(new Api.ApiError('subscription_expired', 402));
    if (kind === 'recurring') {
      openSheet(Views.renderRecurringForm(current));
      return;
    }
    openSheet(Views.renderPlanForm(kind, current));
    var input = el.sheetBody.querySelector('input[name="name"]');
    if (input) setTimeout(function () { input.focus(); }, 250);
  }

  function submitRecurring(formEl) {
    var scope = memberScope(st.member);
    var id = formEl.getAttribute('data-id') || undefined;
    var v = formEl.elements;
    var amt = Fmt.parseAmount(v.amount.value);
    var day = parseInt(v.day.value, 10);
    var reminderDays = v.reminder_days.value.trim() === '' ? NaN : Number(v.reminder_days.value);
    if (!v.name.value.trim()) return badInput(T('Введите название'), v.name);
    if (!(amt > 0)) return badInput(T('Укажите сумму'), v.amount);
    if (!(day >= 1 && day <= 31)) return badInput(T('День от 1 до 31'), v.day);
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) return badInput(T('Укажите целое число от 0 до 30'), v.reminder_days);
    var catId = v.category_id && v.category_id.value ? v.category_id.value : null;
    // Оптимистично: платёж появляется в списке сразу.
    var plans = st.plans || { goals: [], debts: [], wishes: [], recurring: [] };
    var cat = (st.categories || []).find(function (c) { return c.id === catId; });
    var row = {
      id: id || 'local-' + Math.random().toString(36).slice(2),
      _local: !id,
      name: v.name.value,
      amount: amt,
      day_of_month: day,
      reminder_days: reminderDays,
      category_id: catId,
      active: true,
      categories: cat ? { name: cat.name, icon: cat.icon } : null,
    };
    st.plans = Object.assign({}, plans, {
      recurring: id
        ? (plans.recurring || []).map(function (r) { return r.id === id ? Object.assign({}, r, row) : r; })
        : (plans.recurring || []).concat([row]),
    });
    root.Tg.haptic('success');
    closeSheet();
    toast(T('Платёж сохранён'));
    plansTab = 'recurring';
    route = { name: 'plans' };
    render(Views.renderPlans(st.plans, plansTab));

    var op = Queue.push('save_recurring', { id: id, name: v.name.value, amount: amt, day_of_month: day, reminder_days: reminderDays, category_id: catId });
    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      if (scope !== memberScope(st.member)) return;
      clearCache();
      st.plans = null;
      if (route.name === 'plans') openPlans();
      else if (route.name === 'summary') openSummary();
    });
    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      if (scope !== memberScope(st.member)) return;
      clearCache();
      st.plans = null;
      root.Tg.haptic('error');
      toast(ev.detail.error && ev.detail.error.message || T('Не сохранилось'));
      openPlans();
    });
  }

  function submitPlan(formEl) {
    if (formEl.getAttribute('data-kind') === 'recurring') return submitRecurring(formEl);
    var kind = formEl.getAttribute('data-kind');
    var id = formEl.getAttribute('data-id') || undefined;
    var v = formEl.elements;
    var btn = formEl.querySelector('[type="submit"]');
    var payload = { id: id, name: v.name.value };
    var action;
    if (kind === 'goals') {
      action = 'save_goal';
      payload.target = Fmt.parseAmount(v.target.value);
      payload.saved = v.saved.value ? Fmt.parseAmount(v.saved.value) : 0;
      payload.monthly = v.monthly.value ? Fmt.parseAmount(v.monthly.value) : 0;
      if (!(payload.target > 0)) return badInput(T('Укажите сумму цели'), v.target);
      if (isNaN(payload.saved) || isNaN(payload.monthly)) return badInput(T('Проверьте суммы'), v.saved);
      if (payload.saved > payload.target) return badInput(T('Накоплено не может быть больше цели'), v.saved);
    } else if (kind === 'debts') {
      action = 'save_debt';
      payload.total = Fmt.parseAmount(v.total.value);
      payload.remaining = v.remaining.value ? Fmt.parseAmount(v.remaining.value) : payload.total;
      payload.monthly = v.monthly.value ? Fmt.parseAmount(v.monthly.value) : 0;
      payload.creditor = v.creditor.value.trim();
      if (!(payload.total > 0)) return badInput(T('Укажите сумму долга'), v.total);
      if (isNaN(payload.remaining) || isNaN(payload.monthly)) return badInput(T('Проверьте суммы'), v.remaining);
      if (payload.remaining > payload.total) return badInput(T('Остаток больше суммы долга'), v.remaining);
    } else {
      action = 'save_wish';
      payload.price = Fmt.parseAmount(v.price.value);
      payload.priority = v.priority.value;
      payload.goal_id = v.goal_id && v.goal_id.value ? v.goal_id.value : null;
      if (!(payload.price > 0)) return badInput(T('Укажите цену'), v.price);
    }
    if (!payload.name.trim()) return badInput(T('Введите название'), v.name);

    btn.disabled = true;
    mutate(action, payload).then(function () {
      root.Tg.haptic('success');
      closeSheet();
      toast(T('Сохранено'));
      openPlans();
    }).catch(function (err) {
      btn.disabled = false;
      root.Tg.haptic('error');
      if (err.code === 'subscription_expired') { closeSheet(); fail(err); return; }
      toast(err.message || T('Не удалось сохранить'));
    });
  }

  function badInput(text, field) {
    root.Tg.haptic('error');
    toast(text);
    if (field && field.focus) field.focus();
  }

  // Быстрое действие с деньгами внутри карточки: сумма → API → перерисовка.
  function planAction(action, id, amount, label) {
    if (State.isExpired()) return fail(new Api.ApiError('subscription_expired', 402));
    if (!(amount > 0) || isNaN(amount)) return toast(T('Введите сумму'));
    mutate(action, { id: id, amount: amount }).then(function () {
      root.Tg.haptic('success');
      toast(label);
      openPlans();
    }).catch(function (err) {
      root.Tg.haptic('error');
      if (err.code === 'subscription_expired') return fail(err);
      toast(err.message || T('Не получилось'));
    });
  }

  function removePlan(kind, id) {
    var labels = { goals: [T('Удалить цель?'), 'delete_goal'], debts: [T('Удалить долг?'), 'delete_debt'], wishes: [T('Удалить желание?'), 'delete_wish'] };
    var l = labels[kind];
    dialog(l[0], T('Удалить')).then(function (ok) {
      if (!ok) return;
      mutate(l[1], { id: id }).then(function () {
        root.Tg.haptic('success');
        toast(T('Удалено'));
        openPlans();
      }).catch(function (err) {
        root.Tg.haptic('error');
        if (err.code === 'subscription_expired') return fail(err);
        toast(err.message || T('Не удалось удалить'));
      });
    });
  }

  // --- Удаление аккаунта ---

  function deleteAccount() {
    if (st.deleting) return;
    dialog(T('Удалить аккаунт вместе со всей семьёй и записями? Это необратимо.'), T('Удалить')).then(function (ok) {
      if (!ok) return;
      st.deleting = true;
      if (route.name === 'settings') render(Views.renderSettings(route.section));
      Api.call('delete_my_account').then(function () {
        root.Tg.haptic('success');
        adoptMember(null);
        State.reset();
        st.plans = null;
        st.promo = [];
        st.tariffs = null;
        st.deleting = false;
        onboarding = { tab: 'create', member_name: '', code: '', household_name: '' };
        toast(T('Аккаунт удалён'));
        render(Views.renderOnboarding(onboarding));
      }).catch(function (err) {
        st.deleting = false;
        if (route.name === 'settings') render(Views.renderSettings(route.section));
        root.Tg.haptic('error');
        toast(err.message || T('Не удалось удалить аккаунт'));
      });
    });
  }

  // Добавляем запись в локальный кэш месяца и пересчитываем сводку без сети.
  // Сервер знает запись по local_id — убираем локальную копию и оставляем серверную.
  function reconcileTx(list) {
    var ids = {};
    list.forEach(function (t) { ids[t.id] = true; });
    return list.filter(function (t) { return !t._local || !ids[t.id]; });
  }

  function applyLocalTx(tx) {
    var month = String(tx.occurred_on || '').slice(0, 7);
    var list = cached('txCache:' + month);
    if (Array.isArray(list)) cached('txCache:' + month, [tx].concat(list));

    var s = cached('summaryCache:' + month);
    if (!s) return;
    var cat = (st.categories || []).find(function (c) { return c.id === tx.category_id; }) || {};
    var isIncome = cat.kind === 'income';
    var next = Object.assign({}, s);
    next.income = Number(s.income || 0) + (isIncome ? tx.amount : 0);
    next.expense = Number(s.expense || 0) + (isIncome ? 0 : tx.amount);
    next.balance = next.income - next.expense;
    next.categories = (s.categories || []).map(function (c) {
      return c.id === tx.category_id ? Object.assign({}, c, { fact: Number(c.fact || 0) + tx.amount }) : c;
    });
    var members = (s.members || []).map(function (m) {
      if (m.id !== tx.member_id) return m;
      var paid = Number(m.paid_shared || 0) + (!isIncome && tx.is_shared ? tx.amount : 0);
      var personal = Number(m.personal || 0) + (!isIncome && !tx.is_shared ? tx.amount : 0);
      return Object.assign({}, m, {
        income: Number(m.income || 0) + (isIncome ? tx.amount : 0),
        paid_shared: paid,
        personal: personal,
        balance: paid - Number(m.share || 0),
      });
    });
    next.members = members;
    cached('summaryCache:' + month, next);
    st.lastSummary = next;
  }

  // Убирает запись из кэшей и пересчитывает сводку на месте (без запроса).
  function removeOptimisticTx(tx) {
    removeLocalTx(tx.id);
    var month = String(tx.occurred_on || '').slice(0, 7);
    var s = st.lastSummary;
    if (!s || month !== st.month) return;
    var isIncome = (tx.categories && tx.categories.kind) === 'income';
    var next = Object.assign({}, s);
    next.income = Math.max(0, Number(s.income || 0) - (isIncome ? tx.amount : 0));
    next.expense = Math.max(0, Number(s.expense || 0) - (isIncome ? 0 : tx.amount));
    next.balance = next.income - next.expense;
    next.categories = (s.categories || []).map(function (c) {
      return c.id === tx.category_id ? Object.assign({}, c, { fact: Math.max(0, Number(c.fact || 0) - tx.amount) }) : c;
    });
    cached('summaryCache:' + st.month, next);
    st.lastSummary = next;
  }

  // Копия сводки для отката оптимистичного удаления: меняем только те массивы,
  // которые пересчитываются на клиенте.
  function cloneSummary(s) {
    if (!s) return s;
    return Object.assign({}, s, {
      categories: (s.categories || []).map(function (c) { return Object.assign({}, c); }),
      members: (s.members || []).map(function (m) { return Object.assign({}, m); }),
    });
  }

  // Пересчёт сводки без запроса к серверу: убираем сумму записи из итогов,
  // категории и личных/общих сумм участника.
  function summaryAfterRemoval(s, tx) {
    var isIncome = (tx.categories && tx.categories.kind) === 'income';
    var amount = Number(tx.amount) || 0;
    var next = Object.assign({}, s);
    next.income = Math.max(0, Number(s.income || 0) - (isIncome ? amount : 0));
    next.expense = Math.max(0, Number(s.expense || 0) - (isIncome ? 0 : amount));
    next.balance = next.income - next.expense;
    next.categories = (s.categories || []).map(function (c) {
      return c.id === tx.category_id
        ? Object.assign({}, c, { fact: Math.max(0, Number(c.fact || 0) - amount) })
        : c;
    });
    next.members = (s.members || []).map(function (m) {
      if (m.id !== tx.member_id) return m;
      var paid = Number(m.paid_shared || 0) - (!isIncome && tx.is_shared ? amount : 0);
      var personal = Number(m.personal || 0) - (!isIncome && !tx.is_shared ? amount : 0);
      return Object.assign({}, m, {
        income: Math.max(0, Number(m.income || 0) - (isIncome ? amount : 0)),
        paid_shared: Math.max(0, paid),
        personal: Math.max(0, personal),
        balance: paid - Number(m.share || 0),
      });
    });
    return next;
  }

  // Переключение графика и типа операций по карточкам на экране финансов.
  // Режим графика хранится отдельно: «Остаток» не фильтрует историю.
  function setTxKind(kind) {
    if (!st.txFilter) st.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
    var mode = kind === 'income' || kind === 'expense' ? kind : 'balance';
    st.txChart = mode;
    st.txFilter.kind = mode === 'balance' ? null : mode;
    if (route.name !== 'tx') return;
    var scroll = el.screen.scrollTop;
    render(Views.renderTxList(cached('txCache:' + st.month) || [], st.txFilter, st.txChart));
    el.screen.scrollTop = scroll;
  }

  // Сброс фильтров: кнопка «Сбросить» в списке.
  function clearTxFilter() {
    st.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
    openTx();
  }

  // Перерисовываем только результаты: поле поиска и селекты не теряют фокус.
  function refreshTxResults() {
    if (route.name !== 'tx') return;
    var all = cached('txCache:' + st.month) || [];
    var box = el.screen.querySelector('#tx-results');
    if (!box) return;
    box.innerHTML = Views.txResults(all, st.txFilter);
  }

  function clearTxSearch() {
    if (!st.txFilter) return;
    st.txFilter.q = '';
    var input = el.screen.querySelector('#tx-search');
    if (input) {
      input.value = '';
      input.focus();
    }
    var clear = el.screen.querySelector('[data-action="tx-search-clear"]');
    if (clear) clear.hidden = true;
    refreshTxResults();
  }

  // Убираем запись из локальных кэшей: для оптимистичного удаления и после отправки.
  // Записи, удаление которых уже отправлено, но сервер мог ещё не обработать.
  var deletingTx = {};

  function removeLocalTx(id) {
    deletingTx[id] = true;
    clearCache();
    st.lastSummary = null;
  }

  // --- Категории и лимиты ---

  // id = null → создание новой категории, kind задаёт начальный тип.
  function openCategoryForm(id, kind) {
    if (!id) {
      catKind = kind === 'income' ? 'income' : 'expense';
      openSheet(Views.renderCategoryForm(null));
      el.sheetBody.querySelectorAll('[data-action="cat-kind"]').forEach(function (b) {
        b.classList.toggle('segment--active', b.getAttribute('data-kind') === catKind);
      });
      var nameInput = el.sheetBody.querySelector('input[name="name"]');
      if (nameInput) setTimeout(function () { nameInput.focus(); }, 250);
      return;
    }
    var cat = (st.categories || []).find(function (c) { return c.id === id; });
    // st.categories мог ещё не загрузиться — ищем в сводке.
    if (!cat) {
      var fromSummary = (cached('summaryCache:' + st.month) || { categories: [] }).categories || [];
      var row = fromSummary.find(function (c) { return c.id === id; });
      if (row) cat = { id: row.id, name: row.name, icon: row.icon, kind: 'expense', plan_monthly: row.plan };
    }
    if (!cat) {
      loadCategories().then(function () { openCategoryForm(id); });
      return;
    }
    openSheet(Views.renderCategoryForm(cat));
  }

  function submitCategory(formEl) {
    var scope = memberScope(st.member);
    var id = formEl.getAttribute('data-id') || undefined;
    var v = formEl.elements;
    var raw = String(v.plan.value || '').trim();
    var plan = raw ? Fmt.parseAmount(raw) : 0;
    var btn = formEl.querySelector('[type="submit"]');
    if (isNaN(plan) || plan < 0) return badInput(T('Проверьте лимит'), v.plan);
    if (!id && !v.name.value.trim()) return badInput(T('Введите название'), v.name);
    // Оптимистично: обновляем локальную копию и закрываем панель сразу.
    var categories = st.categories || [];
    if (id) {
      categories = categories.map(function (c) {
        return c.id === id ? Object.assign({}, c, { name: v.name.value || c.name, icon: v.icon.value || c.icon, plan_monthly: plan }) : c;
      });
    } else {
      categories = categories.concat([{
        id: 'local-' + Math.random().toString(36).slice(2),
        _local: true,
        kind: catKind,
        name: v.name.value,
        icon: v.icon.value || '🏷️',
        plan_monthly: plan,
        sort: 999,
      }]);
    }
    st.categories = categories;
    clearCache();
    root.Tg.haptic('success');
    closeSheet();
    toast(id ? T('Лимит сохранён') : T('Категория добавлена'));
    if (route.name === 'limits') openLimits();
    else openSummary();

    var payload = { id: id, kind: id ? undefined : catKind, name: v.name.value, icon: v.icon.value, plan_monthly: plan };
    var op = Queue.push('save_category', payload);
    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      if (scope !== memberScope(st.member)) return;
      clearCache();
      st.categories = null;   // подтянем реальные id с сервера
      if (route.name === 'limits') openLimits();
      else if (route.name === 'summary') openSummary();
    });
    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      if (scope !== memberScope(st.member)) return;
      var code = ev.detail.error && ev.detail.error.code;
      st.categories = null;      // перечитаем с сервера — локальная правка откатилась
      clearCache();
      root.Tg.haptic('error');
      if (code === 'category_exists') toast(T('Такая категория уже есть'));
      else toast(ev.detail.error && ev.detail.error.message || T('Не сохранилось'));
      if (route.name === 'limits') openLimits();
      else if (route.name === 'summary') openSummary();
    });
  }

  function removeRecurring(id) {
    dialog(T('Удалить напоминание о платеже?'), T('Удалить')).then(function (ok) {
      if (!ok) return;
      mutate('delete_recurring', { id: id }).then(function () {
        root.Tg.haptic('success');
        st.plans = null;
        toast(T('Удалено'));
        openPlans();
      }).catch(function (err) { toast(err.message || T('Не удалось удалить')); });
    });
  }

  function deleteCategory(id) {
    var msg = T('Удалить категорию? Траты этой категории останутся в истории, а категория скроется из списка.');
    dialog(msg, T('Удалить')).then(function (ok) {
      if (!ok) return;
      mutate('archive_category', { id: id }).then(function (res) {
        root.Tg.haptic('success');
        st.categories = null;
        clearCache();
        closeSheet();
        toast(res.archived ? T('Категория скрыта') : T('Категория удалена'));
        if (route.name === 'limits') openLimits();
        else openSummary();
      }).catch(function (err) {
        root.Tg.haptic('error');
        toast(err.message || T('Не удалось удалить'));
      });
    });
  }

  // focusId: сразу открыть редактор нужной категории (переход из списка трат).
  function openLimits(focusId) {
    route = { name: 'limits' };
    render(Views.skeletonList());
    loadCategories().then(function () {
      if (route.name !== 'limits') return;
      render(Views.renderLimits());
      if (focusId) openCategoryForm(focusId);
    }).catch(function (err) {
      fail(err);
    });
  }

  // --- Уведомления ---

  function notificationDefaults(n) {
    return Object.assign({ payments: true, limits: true, digest: false, daily: false, daily_time: '22:00' }, n || {});
  }

  function localTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      return '';
    }
  }

  function dailyTimeValue(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '22:00';
  }

  function dailyTimeWrap(el) {
    var card = el.closest('.card');
    return card ? card.querySelector('[data-notif-time-wrap]') : null;
  }

  function toggleNotification(el) {
    var key = el.getAttribute('data-notif');
    var current = notificationDefaults(st.member && st.member.notifications);
    var next = Object.assign({}, current);
    next[key] = !!el.checked;
    next.timezone = localTimezone();
    // Оптимистично: переключатель уже нажат.
    st.member = Object.assign({}, st.member, { notifications: next });
    var wrap = key === 'daily' ? dailyTimeWrap(el) : null;
    if (wrap) wrap.hidden = !next.daily;
    Api.call('save_notifications', { notifications: next }).then(function (res) {
      if (res && res.notifications) {
        st.member = Object.assign({}, st.member, { notifications: res.notifications });
      }
      if (wrap) wrap.hidden = st.member.notifications.daily !== true;
      root.Tg.haptic('light');
      toast(next[key] ? T('Включено') : T('Выключено'));
    }).catch(function (err) {
      el.checked = !el.checked;
      st.member = Object.assign({}, st.member, { notifications: current });
      if (wrap) wrap.hidden = current.daily !== true;
      root.Tg.haptic('error');
      toast(err.message || T('Не удалось сохранить'));
    });
  }

  function saveNotificationTime(input) {
    var current = notificationDefaults(st.member && st.member.notifications);
    var previous = dailyTimeValue(current.daily_time);
    var value = String(input.value || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      input.value = previous;
      return;
    }
    if (value === previous) return;
    var next = Object.assign({}, current, { daily_time: value });
    next.timezone = localTimezone();
    st.member = Object.assign({}, st.member, { notifications: next });
    Api.call('save_notifications', { notifications: next }).then(function (res) {
      var saved = value;
      if (res && res.notifications) {
        st.member = Object.assign({}, st.member, { notifications: res.notifications });
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(res.notifications.daily_time || '')) {
          saved = res.notifications.daily_time;
          input.value = saved;
        }
      }
      root.Tg.haptic('light');
      toast(T('Время отчёта: {time}', { time: saved }));
    }).catch(function (err) {
      input.value = previous;
      st.member = Object.assign({}, st.member, { notifications: current });
      root.Tg.haptic('error');
      toast(err.message || T('Не удалось сохранить'));
    });
  }

  // --- Деление общих трат ---

  // Переключатель в профиле меняет режим с текущего месяца и на будущие.
  // Прошлые месяцы сохраняют прежний режим: более позднее изменение на них не влияет.
  function setSplitMode(mode) {
    if (!st.member || !st.member.households) return;
    if (mode !== 'equal' && mode !== 'proportional' && mode !== 'none') return;
    var month = Fmt.currentMonth();
    var current = st.member.households.month_split_mode || st.member.households.split_mode || 'proportional';
    if (current === mode) return;
    st.member.households = Object.assign({}, st.member.households, { month_split_mode: mode });
    if (route.name === 'settings') render(Views.renderSettings(route.section));
    mutate('set_split_mode', { month: month, mode: mode }).then(function (res) {
      if (res && res.split_mode) {
        st.member.households = Object.assign({}, st.member.households, { month_split_mode: res.split_mode });
      }
      root.Tg.haptic('success');
      toast(T('Способ деления сохранён'));
      if (route.name === 'settings') render(Views.renderSettings(route.section));
    }).catch(function (err) {
      st.member.households = Object.assign({}, st.member.households, { month_split_mode: current });
      root.Tg.haptic('error');
      toast(err.message || T('Не удалось сохранить'));
      if (route.name === 'settings') render(Views.renderSettings(route.section));
    });
  }

  // Имя участника и название семьи сохраняются отдельным действием API.
  function submitProfile(formEl) {
    if (!st.member) return;
    var v = formEl.elements;
    var memberName = String(v.member_name.value || '').trim();
    var householdName = String(v.household_name.value || '').trim();
    if (!memberName) return badInput(T('Введите имя'), v.member_name);
    if (!householdName) return badInput(T('Введите название'), v.household_name);
    var previous = {
      name: st.member.name,
      household: st.member.households && st.member.households.name,
    };
    if (memberName === previous.name && householdName === previous.household) {
      root.Tg.haptic('light');
      toast(T('Сохранено'));
      return;
    }
    var btn = formEl.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    // Оптимистично: имя сразу доступно главной и профилю, без ожидания сети.
    st.member = Object.assign({}, st.member, {
      name: memberName,
      households: Object.assign({}, st.member.households, { name: householdName }),
    });
    mutate('save_profile', { member_name: memberName, household_name: householdName }).then(function (res) {
      if (res && res.member_name) st.member = Object.assign({}, st.member, { name: res.member_name });
      if (res && res.household_name && st.member.households) {
        st.member.households = Object.assign({}, st.member.households, { name: res.household_name });
      }
      root.Tg.haptic('success');
      toast(T('Сохранено'));
      if (route.name === 'settings') render(Views.renderSettings(route.section));
    }).catch(function (err) {
      st.member = Object.assign({}, st.member, {
        name: previous.name,
        households: Object.assign({}, st.member.households, { name: previous.household }),
      });
      if (btn) btn.disabled = false;
      root.Tg.haptic('error');
      toast(err.message || T('Не удалось сохранить'));
      if (route.name === 'settings') render(Views.renderSettings(route.section));
    });
  }

  // --- Промокод ---

  function redeemPromo(code) {
    code = String(code || '').trim();
    if (!code) return toast(T('Введите промокод'));
    return Api.call('redeem_promo', { code: code }).then(function (res) {
      root.Tg.haptic('success');
      clearCache();
      return loadMember().then(function () {
        toast(T('Доступ до {date}', { date: Fmt.dayLabel(res.plan_until) }));
        if (route.name === 'settings') render(Views.renderSettings(route.section));
      });
    }).catch(function (err) {
      root.Tg.haptic('error');
      if (err.code === 'bad_promo') return toast(T('Такого промокода нет'));
      if (err.code === 'promo_used') return toast(T('Этот код уже активирован'));
      toast(err.message || T('Не удалось активировать'));
    });
  }

  function openTab(tab) {
    if (editingTx) return;
    if (!st.member) return;
    // Переход по вкладке отменяет недоехавший свайп: пользователь выбрал другое.
    if (!instantRender) dropPageSettle();
    if (st.homeEdit) {
      st.homeEdit = false;
      st.homeDraft = null;
    }
    if (tab === 'summary') openSummary();
    else if (tab === 'tx') openTx(null);
    else if (tab === 'plans') openPlans();
    else if (tab === 'add') {
      if (el.sheet.classList.contains('sheet--quick-actions') && !el.sheet.classList.contains('sheet--closing')) closeSheet();
      else openQuickActions(0);
    }
    else if (tab === 'settings') openSettings();
  }

  function swipeTarget(name, direction) {
    var index = MAIN_TABS.indexOf(name);
    if (index === -1) return null;
    var next = index + (direction < 0 ? -1 : 1);
    return next >= 0 && next < MAIN_TABS.length ? MAIN_TABS[next] : null;
  }

  function pageSwipeAllowed(target) {
    if (!st.member || editingTx || st.homeEdit) return false;
    if (route.name === 'add' || route.name === 'limits') return false;
    if (route.name === 'settings' && route.section) return false;
    if (MAIN_TABS.indexOf(route.name) === -1) return false;
    if (el.sheet && !el.sheet.hidden) return false;
    if (el.dialog && !el.dialog.hidden) return false;
    if (target && target.closest &&
        target.closest('input,textarea,select,button,a,label,[contenteditable],.tx,.cat-tx,.finance-operation,.sheet,.dialog,.quick-actions,details')) {
      return false;
    }
    return true;
  }

  function navigateBySwipe(direction) {
    if (!pageSwipeAllowed(null)) return false;
    var target = swipeTarget(route.name, direction);
    if (!target) return false;
    closeSwipes();
    root.Tg.haptic('light');
    openTab(target);
    return true;
  }

  // Превью соседней страницы для свайпа: собираем из уже загруженных данных,
  // чтобы страница подъезжала под палец без запроса и ожидания.
  function pagePreviewHtml(name) {
    if (name === 'summary') {
      var summary = cached('summaryCache:' + st.month) || st.lastSummary;
      return summary
        ? Views.renderSummary(summary, st.plans, expandedCat, cached('txCache:' + st.month), categoryView)
        : Views.skeletonSummary();
    }
    if (name === 'tx') {
      var rows = cached('txCache:' + st.month);
      var filter = st.txFilter || { kind: null, category_id: null, member_id: null, q: '' };
      return rows ? Views.renderTxList(rows, filter, st.txChart || 'expense') : Views.skeletonList();
    }
    if (name === 'plans') return st.plans ? Views.renderPlans(st.plans, plansTab) : Views.skeletonList();
    if (name === 'settings') return Views.renderSettings(null);
    return '';
  }

  function pageViewport() {
    return el.viewport || (el.screen && el.screen.parentNode) || null;
  }

  function pageSwipeWidth() {
    var viewport = pageViewport();
    if (viewport && viewport.getBoundingClientRect) {
      var width = viewport.getBoundingClientRect().width;
      if (width) return width;
    }
    return el.screen.clientWidth || 320;
  }

  function buildPagePeek(name) {
    var viewport = pageViewport();
    if (!viewport || !document.createElement) return null;
    var html = pagePreviewHtml(name);
    if (!html) return null;
    // На всякий случай убираем превью прошлого жеста, если оно не успело уехать.
    if (viewport.querySelectorAll) {
      Array.prototype.forEach.call(viewport.querySelectorAll('.screen--peek'), function (node) {
        if (node.parentNode === viewport) viewport.removeChild(node);
      });
    }
    var pane = document.createElement('div');
    pane.className = 'screen screen--peek';
    // Копия не должна спорить с настоящей страницей за id, фокус и жесты.
    pane.setAttribute('aria-hidden', 'true');
    pane.setAttribute('inert', '');
    pane.innerHTML = html;
    Array.prototype.forEach.call(pane.querySelectorAll('[id]'), function (node) { node.removeAttribute('id'); });
    viewport.appendChild(pane);
    return pane;
  }

  // Доля пути или быстрый рывок решают, доедет ли страница до соседней.
  function pageSwipeFlip(gesture) {
    if (!gesture || gesture.edge) return false;
    // Развернули палец обратно — страница остаётся на месте.
    if (gesture.dx && gesture.dir && Math.sign(gesture.dx) !== gesture.dir) return false;
    var width = gesture.width || pageSwipeWidth();
    var moved = Math.abs(gesture.shift === undefined ? gesture.dx : gesture.shift);
    return moved > width / 4 || (!!gesture.fast && moved > 24);
  }

  function clearPageSwipeStyles(gesture) {
    if (gesture && gesture.peek && gesture.peek.parentNode) gesture.peek.parentNode.removeChild(gesture.peek);
    // Экран уже ведёт новый жест — старый не должен дёргать его назад.
    if (pageSwipe && pageSwipe !== gesture) return;
    el.screen.classList.remove('screen--dragging');
    el.screen.style.transition = 'none';
    el.screen.style.transform = '';
    void el.screen.offsetWidth;
    el.screen.style.transition = '';
  }

  // Страница ещё доезжает, а палец уже начал новый жест: доводим переход
  // сразу, чтобы маршрут и превью не разошлись.
  function flushPageSettle() {
    var settle = pageSettle;
    if (!settle) return;
    pageSettle = null;
    clearTimeout(settle.timer);
    if (settle.flip) finishPageSwipe(settle.gesture);
    else clearPageSwipeStyles(settle.gesture);
  }

  // Переход отменили извне (например, нажали другую вкладку) — просто убираем.
  function dropPageSettle() {
    var settle = pageSettle;
    if (!settle) return;
    pageSettle = null;
    clearTimeout(settle.timer);
    clearPageSwipeStyles(settle.gesture);
  }

  function finishPageSwipe(gesture) {
    var canGo = gesture.target && route.name === gesture.from && pageSwipeAllowed(null);
    if (!canGo) { clearPageSwipeStyles(gesture); return; }
    root.Tg.haptic('light');
    closeSwipes();
    // Новую страницу уже показало превью: без повторного затухания и каскада.
    instantRender = true;
    instantUntil = Date.now() + 800;
    try { openTab(gesture.target); } finally { instantRender = false; }
    clearPageSwipeStyles(gesture);
  }

  function settlePageSwipe(gesture, flip) {
    var width = gesture.width || pageSwipeWidth();
    var duration = 240;
    var dir = gesture.dir || (gesture.dx < 0 ? -1 : 1);
    el.screen.style.transition = 'transform ' + duration + 'ms cubic-bezier(.22,.61,.36,1)';
    if (gesture.peek) gesture.peek.style.transition = el.screen.style.transition;
    if (!flip) {
      el.screen.style.transform = 'translate3d(0,0,0)';
      if (gesture.peek) gesture.peek.style.transform = 'translate3d(' + (-dir * width) + 'px,0,0)';
    } else {
      el.screen.style.transform = 'translate3d(' + (dir * width) + 'px,0,0)';
      if (gesture.peek) gesture.peek.style.transform = 'translate3d(0,0,0)';
    }
    // Один незавершённый переход за раз: по таймеру проверяем, что он всё ещё актуален.
    var timer = setTimeout(function () {
      if (!pageSettle || pageSettle.timer !== timer) return;
      pageSettle = null;
      if (flip) finishPageSwipe(gesture);
      else clearPageSwipeStyles(gesture);
    }, duration + (flip ? 10 : 20));
    pageSettle = { gesture: gesture, timer: timer, flip: flip };
  }

  function openQuickActions(page) {
    quickActionsPage = Math.max(0, Math.min(QUICK_PAGES - 1, Number(page) || 0));
    openSheet(Views.renderQuickActions(quickActionsPage));
  }

  // --- Листание страниц быстрых действий (свайп влево/вправо) ---

  function qaRoot() {
    return el.sheetBody.querySelector('.quick-actions');
  }

  function qaSetPage(page) {
    var rootEl = qaRoot();
    if (!rootEl) return;
    var next = Math.max(0, Math.min(QUICK_PAGES - 1, page));
    var track = rootEl.querySelector('.quick-actions__track');
    if (!track) return;
    track.classList.remove('quick-actions__track--edge');
    track.style.transform = 'translateX(' + (-100 * next) + '%)';
    var changed = next !== quickActionsPage;
    quickActionsPage = next;
    rootEl.setAttribute('data-page', next);
    Array.prototype.forEach.call(rootEl.querySelectorAll('.quick-actions__page'), function (p, i) {
      if (i === next) p.removeAttribute('inert');
      else p.setAttribute('inert', '');
    });
    Array.prototype.forEach.call(rootEl.querySelectorAll('.quick-actions__dot'), function (dot, i) {
      dot.classList.toggle('quick-actions__dot--active', i === next);
      dot.setAttribute('aria-selected', i === next ? 'true' : 'false');
    });
    if (changed) root.Tg.haptic('light');
  }

  function qaReset() {
    qaSwipe = null;
    var track = el.sheetBody.querySelector('.quick-actions__track');
    if (track) track.classList.remove('quick-actions__track--dragging', 'quick-actions__track--edge');
  }

  function qaPageWidth() {
    var view = el.sheetBody.querySelector('.quick-actions__view');
    return view ? view.getBoundingClientRect().width : 0;
  }

  // Свайп страницы: первый сдвиг по горизонтали запирает жест, вертикаль отдаём прокрутке.
  el.sheet.addEventListener('touchstart', function (ev) {
    if (!qaRoot() || ev.touches.length !== 1) return;
    var t = ev.touches[0];
    qaSwipe = { x: t.clientX, y: t.clientY, dx: 0, axis: '', lastX: t.clientX, lastT: performance.now() };
  }, { passive: true });

  el.sheet.addEventListener('touchmove', function (ev) {
    if (!qaSwipe || ev.touches.length !== 1) return;
    var t = ev.touches[0];
    var dx = t.clientX - qaSwipe.x;
    var dy = t.clientY - qaSwipe.y;
    if (!qaSwipe.axis) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) qaSwipe.axis = 'x';
      else if (Math.abs(dy) > 8) qaSwipe.axis = 'y';
      else return;
    }
    if (qaSwipe.axis !== 'x') return;
    ev.preventDefault();
    var atEdge = (quickActionsPage === 0 && dx > 0) || (quickActionsPage === QUICK_PAGES - 1 && dx < 0);
    // На крайних страницах тянем с сопротивлением и гасим яркость, чтобы граница чувствовалась.
    qaSwipe.dx = atEdge ? dx * 0.28 : dx;
    var track = el.sheetBody.querySelector('.quick-actions__track');
    if (!track) return;
    track.classList.toggle('quick-actions__track--edge', atEdge);
    // Скорость пальца к отпусканию: по ней решаем, перелистнуть ли на коротком рывке.
    var now = performance.now();
    if (now - qaSwipe.lastT > 0) {
      qaFast = Math.abs(t.clientX - qaSwipe.lastX) / (now - qaSwipe.lastT) > 0.5;
      qaSwipe.lastX = t.clientX;
      qaSwipe.lastT = now;
    }
    if (!qaSwipe.axisLocked) {
      qaSwipe.axisLocked = true;
      // Модификатор — без transition: иначе лента «догоняет» палец с задержкой.
      track.classList.add('quick-actions__track--dragging');
    }
    track.style.transform = 'translateX(calc(' + (-100 * quickActionsPage) + '% + ' + qaSwipe.dx.toFixed(1) + 'px))';
  }, { passive: false });

  // Страница считается «вытянутой», если прошли четверть или быстро рванули пальцем.
  var qaFlip = function (dx) {
    var width = qaPageWidth() || 300;
    return Math.abs(dx) > width / 4 || (qaFast && Math.abs(dx) > 24);
  };
  var qaFast = false;

  function qaEnd() {
    if (!qaSwipe) return;
    var dx = qaSwipe.dx;
    var flip = qaFlip(dx);
    qaFast = false;
    qaSwipe = null;
    var track = el.sheetBody.querySelector('.quick-actions__track');
    if (track) track.classList.remove('quick-actions__track--dragging');
    // Возвращаем короткую пружину: сразу после отпускания анимация чуть энергичнее.
    if (track) track.style.transitionDuration = flip ? '.34s' : '.3s';
    if (flip && dx < 0) qaSetPage(quickActionsPage + 1);
    else if (flip && dx > 0) qaSetPage(quickActionsPage - 1);
    else qaSetPage(quickActionsPage);
  }
  el.sheet.addEventListener('touchend', qaEnd, { passive: true });
  el.sheet.addEventListener('touchcancel', function () {
    if (!qaSwipe) return;
    qaSwipe.dx = 0;
    qaEnd();
  }, { passive: true });

  // Тем же жестом с мышью (десктоп и браузер): тянем, отпускаем — страница переключается.
  var qaMouse = null;
  var qaMouseDragging = false;
  el.sheet.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'touch' || !qaRoot()) return;
    qaMouse = { x: ev.clientX, y: ev.clientY, dx: 0, id: ev.pointerId };
    qaMouseDragging = false;
  });
  function qaMouseMove(ev) {
    if (!qaMouse || ev.pointerType === 'touch') return;
    var dx = ev.clientX - qaMouse.x;
    var dy = ev.clientY - qaMouse.y;
    if (!qaMouseDragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      qaMouseDragging = true;
      // Захватываем палец/мышь, чтобы события шли до sheet даже вне него.
      try { el.sheet.setPointerCapture(qaMouse.id); } catch (e) {}
      var track = el.sheetBody.querySelector('.quick-actions__track');
      if (track) track.classList.add('quick-actions__track--dragging');
    }
    qaMouse.dx = dx;
    var trackEl = el.sheetBody.querySelector('.quick-actions__track');
    if (trackEl) trackEl.style.transform = 'translateX(calc(' + (-100 * quickActionsPage) + '% + ' + dx.toFixed(1) + 'px))';
  }
  function qaMouseEnd() {
    if (!qaMouse) return;
    var dx = qaMouse.dx;
    var dragged = qaMouseDragging;
    qaMouse = null;
    qaMouseDragging = false;
    var track = el.sheetBody.querySelector('.quick-actions__track');
    if (track) track.classList.remove('quick-actions__track--dragging');
    if (!dragged) return;
    var width = qaPageWidth() || 300;
    if (dx < -width / 4) qaSetPage(quickActionsPage + 1);
    else if (dx > width / 4) qaSetPage(quickActionsPage - 1);
    else qaSetPage(quickActionsPage);
    // Гасим клик, который браузер дошлёт после перетаскивания: иначе он
    // нажмёт кнопку с несовпадающими страницами и закроет меню.
    el.sheet.addEventListener('click', function (c) { c.stopPropagation(); c.preventDefault(); }, { capture: true, once: true });
  }
  // pointermove слушаем на document: если указатель ушёл за панель, жест не рвётся.
  document.addEventListener('pointermove', qaMouseMove);
  document.addEventListener('pointerup', qaMouseEnd);
  document.addEventListener('pointercancel', qaMouseEnd);

  // Клавиатура: стрелки листают, Esc закрывает — как в Telegram Desktop.
  document.addEventListener('keydown', function (ev) {
    if (!qaRoot()) return;
    if (ev.key === 'ArrowLeft') { qaSetPage(quickActionsPage - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { qaSetPage(quickActionsPage + 1); ev.preventDefault(); }
    else if (ev.key === 'Escape') { closeSheet(); ev.preventDefault(); }
  });

  function runQuickAction(action) {
    switch (action) {
      case 'expense':
        closeSheet();
        openAdd({ kind: 'expense' });
        break;
      case 'income':
        closeSheet();
        openAdd({ kind: 'income' });
        break;
      case 'receipt-photo':
        closeSheet();
        openAdd({ kind: 'expense' });
        pickReceiptPhoto({ fromQuick: true });
        break;
      case 'recurring-new':
        loadCategories().then(function () {
          if (el.sheet.classList.contains('sheet--quick-actions')) openPlanForm('recurring');
        }).catch(fail);
        break;
      case 'goal-new':
        openPlanForm('goals');
        break;
      case 'debt-new':
        openPlanForm('debts');
        break;
      case 'wish-new':
        loadPlans().then(function () {
          if (el.sheet.classList.contains('sheet--quick-actions')) openPlanForm('wishes');
        });
        break;
      case 'transactions':
        closeSheet();
        openTx(null);
        break;
      case 'plans':
        closeSheet();
        openPlans();
        break;
      case 'recurring-list':
        closeSheet();
        openPlans('recurring');
        break;
      case 'expense-category':
        openCategoryForm(null, 'expense');
        break;
      case 'income-category':
        openCategoryForm(null, 'income');
        break;
      case 'settings':
        closeSheet();
        openSettings();
        break;
    }
  }

  // Обложка главной карточки: выбор хранится на устройстве, как валюта и язык.
  // Своё фото лежит в IndexedDB и никогда не отправляется на сервер.
  var coverDraft = null;
  var coverSaving = false;

  function refreshCoverSettings() {
    if (route.name !== 'settings' || route.section !== 'appearance') return;
    var scroll = el.screen.scrollTop;
    render(Views.renderSettings(route.section));
    el.screen.scrollTop = scroll;
  }

  function setCover(id) {
    if (!root.Covers || !root.Covers.set(id)) return;
    root.Tg.haptic('light');
    refreshCoverSettings();
    toast(T('Обложка обновлена'));
  }

  function coverStorageMessage(err) {
    if (err && err.code === 'storage_full') return T('На устройстве не хватает места для фона. Освободите память и попробуйте снова.');
    if (err && (err.code === 'storage_unsupported' || err.code === 'storage_blocked')) return T('Хранилище изображений недоступно. Проверьте настройки приватности.');
    if (err && err.code === 'image_decode') return T('Не удалось открыть изображение. Выберите JPG или PNG.');
    return T('Не удалось сохранить фон на устройстве');
  }

  function openCoverFilePicker() {
    var input = el.screen.querySelector('[data-cover-file]');
    if (input) input.click();
  }

  function readCoverFile(file) {
    if (!file) return;
    if (!/^image\//.test(String(file.type || ''))) return toast(T('Выберите изображение'));
    if (Number(file.size) > 12 * 1024 * 1024) return toast(T('Файл слишком большой — до 12 МБ'));
    if (!root.FileReader) return toast(T('Не удалось прочитать изображение'));
    var reader = new root.FileReader();
    reader.onload = function () { openCoverDraft(String(reader.result || '')); };
    reader.onerror = function () { toast(T('Не удалось прочитать изображение')); };
    reader.readAsDataURL(file);
  }

  function openCoverDraft(src) {
    if (!src || !root.Image) return;
    var image = new root.Image();
    image.onload = function () {
      coverDraft = { image: image, zoom: 1, x: 50, y: 50 };
      coverSaving = false;
      openSheet(Views.renderCoverEditor());
      drawCoverPreview();
    };
    image.onerror = function () {
      var err = new Error('Image decode failed');
      err.code = 'image_decode';
      toast(coverStorageMessage(err));
    };
    image.src = src;
  }

  // Кадр под пропорции карточки: заполняем по большей стороне и даём
  // пользователю выбрать масштаб и положение. Тот же расчёт используется
  // для превью и для финального сжатого изображения.
  function drawCoverCrop(canvas, image, zoom, x, y) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return false;
    var tw = canvas.width, th = canvas.height;
    var iw = Number(image.naturalWidth || image.width) || 0;
    var ih = Number(image.naturalHeight || image.height) || 0;
    if (!iw || !ih) return false;
    var scale = Math.max(tw / iw, th / ih) * Math.max(1, Number(zoom) || 1);
    var sw = Math.min(iw, tw / scale);
    var sh = Math.min(ih, th / scale);
    var sx = Math.max(0, iw - sw) * Math.max(0, Math.min(100, Number(x) || 0)) / 100;
    var sy = Math.max(0, ih - sh) * Math.max(0, Math.min(100, Number(y) || 0)) / 100;
    ctx.clearRect(0, 0, tw, th);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, tw, th);
    return true;
  }

  function drawCoverPreview() {
    if (!coverDraft) return;
    var canvas = el.sheetBody.querySelector('[data-cover-preview]');
    if (!canvas) return;
    drawCoverCrop(canvas, coverDraft.image, coverDraft.zoom, coverDraft.x, coverDraft.y);
  }

  function updateCoverDraft(input) {
    if (!coverDraft || !input || !input.matches) return;
    if (input.matches('[data-cover-zoom]')) coverDraft.zoom = Math.max(1, Number(input.value) / 100);
    else if (input.matches('[data-cover-x]')) coverDraft.x = Number(input.value);
    else if (input.matches('[data-cover-y]')) coverDraft.y = Number(input.value);
    drawCoverPreview();
  }

  function coverBlob(canvas, done) {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(done, 'image/jpeg', 0.82);
      return;
    }
    try {
      var data = canvas.toDataURL('image/jpeg', 0.82);
      var binary = root.atob(data.split(',')[1] || '');
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      done(new Blob([bytes], { type: 'image/jpeg' }));
    } catch (e) {
      done(null);
    }
  }

  function applyCoverDraft() {
    if (!coverDraft || coverSaving || !root.Covers || !root.Covers.saveCustom) return;
    var canvas = document.createElement('canvas');
    canvas.width = 1500;
    canvas.height = 600;
    if (!drawCoverCrop(canvas, coverDraft.image, coverDraft.zoom, coverDraft.x, coverDraft.y)) {
      return toast(T('Не удалось подготовить изображение'));
    }
    var button = el.sheetBody.querySelector('[data-action="apply-cover"]');
    var label = button ? button.textContent : '';
    coverSaving = true;
    if (button) {
      button.disabled = true;
      button.textContent = T('Сохраняем…');
    }
    function unlock() {
      coverSaving = false;
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
    }
    coverBlob(canvas, function (blob) {
      if (!blob) {
        unlock();
        return toast(T('Не удалось подготовить изображение'));
      }
      root.Covers.saveCustom(blob).then(function () {
        coverSaving = false;
        coverDraft = null;
        closeSheet();
        root.Tg.haptic('success');
        if (route.name === 'summary') renderSummaryFromCache();
        else refreshCoverSettings();
        toast(T('Фон обновлён'));
      }).catch(function (err) {
        unlock();
        root.Tg.haptic('error');
        toast(coverStorageMessage(err));
      });
    });
  }

  function resetCustomCover() {
    if (!root.Covers || !root.Covers.clearCustom) return;
    root.Covers.clearCustom().then(function () {
      root.Tg.haptic('success');
      refreshCoverSettings();
      toast(T('Свой фон убран'));
    }).catch(function (err) {
      root.Tg.haptic('error');
      toast(coverStorageMessage(err));
    });
  }

  // --- Действия ---

  // --- Сканер чека: QR кассового чека подставляет сумму, дату и тип операции ---
  // Сервер принимает ключ чека после миграции receipt_key и деплоя supabase/functions/api/receipt.ts.
  var SEND_RECEIPT_KEY = true;

  function demoQr() {
    var day = Fmt.todayIso().replace(/-/g, '');
    return 't=' + day + 'T1200&s=187.98&fn=7380440700187177&i=83702&fp=1425956587&n=1';
  }

  function receiptScope() {
    return memberScope(st.member);
  }

  function receiptStore() {
    return root.ReceiptStore || null;
  }

  function receiptErrorMessage(reason) {
    if (reason === 'not_receipt') return T('Это не QR-код чека');
    if (reason === 'bad_date') return T('В чеке некорректная дата');
    if (reason === 'bad_sum') return T('В чеке некорректная сумма');
    if (reason === 'bad_fiscal') return T('В чеке нет реквизитов');
    return T('Не удалось прочитать данные чека');
  }

  function receiptStillRelevant(scope) {
    return route.name === 'add' && scope === receiptScope();
  }

  function receiptIsKnown(scope, key) {
    return !!(key && receiptStore() && receiptStore().has(scope, key));
  }

  function acceptReceipt(text, state, scope) {
    if (!receiptStillRelevant(scope)) {
      state.got = true;
      return true;
    }
    var result = root.Receipt ? root.Receipt.parse(text) : { ok: false, reason: 'not_receipt' };
    state.reason = result.reason || null;
    if (!result.ok) return false;
    state.got = true;

    if (!result.kind) {
      root.Tg.haptic('error');
      toast(T('Этот тип чека не поддерживается'));
      return true;
    }
    if (result.date > Fmt.todayIso()) {
      root.Tg.haptic('error');
      toast(T('Дата чека в будущем. Проверьте дату.'));
      return true;
    }
    if (result.sum > 1e9) {
      root.Tg.haptic('error');
      toast(T('Сумма чека слишком большая.'));
      return true;
    }
    if (receiptIsKnown(scope, result.key)) {
      root.Tg.haptic('error');
      toast(T('Этот чек уже записан'));
      return true;
    }

    var values = formValues();
    form = Object.assign({}, values, {
      kind: result.kind,
      amount: String(result.sum),
      date: result.date,
      receipt: {
        key: result.key, date: result.date, sum: result.sum, kind: result.kind,
        fn: result.fn, i: result.i, fp: result.fp,
      },
      category_id: values.kind === result.kind ? values.category_id : '',
    });
    render(Views.renderForm(form));
    root.Tg.haptic('success');
    toast(T('Чек распознан'));
    return true;
  }

  function scanReceipt() {
    if (route.name !== 'add' || !root.Receipt) return;
    var scope = receiptScope();
    var state = { got: false, reason: null };
    function finish() {
      if (state.got || !receiptStillRelevant(scope)) return;
      toast(receiptErrorMessage(state.reason));
    }

    if (root.Tg && typeof root.Tg.canScanQr === 'function' && root.Tg.canScanQr()) {
      var opened = typeof root.Tg.scanQr === 'function' && root.Tg.scanQr(
        T('Наведите камеру на QR-код чека'),
        function (text) { return acceptReceipt(text, state, scope); },
        finish
      );
      if (opened) return;
    }
    if (root.Tg && typeof root.Tg.isInsideTelegram === 'function' && root.Tg.isInsideTelegram()) {
      toast(T('Сканер QR недоступен. Обновите Telegram или распознайте QR с фото.'));
      return;
    }

    // В браузере сканера Telegram нет — подставляем демонстрационный чек.
    setTimeout(function () {
      if (!receiptStillRelevant(scope)) return;
      if (!acceptReceipt(demoQr(), state, scope)) toast(receiptErrorMessage(state.reason));
    }, 120);
  }

  function pickReceiptPhoto(opts) {
    if (route.name !== 'add' || !root.ReceiptPhoto || !root.document) return;
    var scope = receiptScope();
    var input = root.document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    function cleanup() {
      if (input.parentNode) input.parentNode.removeChild(input);
    }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      cleanup();
      if (!file || !receiptStillRelevant(scope)) return;
      toast(T('Ищем QR-код на фото…'));
      var state = { got: false, reason: null };
      root.ReceiptPhoto.decode(file).then(function (text) {
        if (!receiptStillRelevant(scope)) return;
        if (!text) {
          toast(T('QR-код на фото не найден. Сфотографируйте чек целиком.'));
          return;
        }
        if (!acceptReceipt(text, state, scope)) toast(receiptErrorMessage(state.reason));
      }).catch(function (err) {
        if (!receiptStillRelevant(scope)) return;
        root.Tg.haptic('error');
        toast(err && err.message === 'jsqr_load'
          ? T('Не удалось загрузить сканер QR. Проверьте связь.')
          : T('Не удалось открыть фото. Попробуйте другое.'));
      });
    });
    input.addEventListener('cancel', function () {
      cleanup();
      // Из быстрого меню отмена выбора фото возвращает на главную, а не оставляет
      // пользователя в пустой форме. В самой форме отмена просто закрывает выбор.
      if (opts && opts.fromQuick && receiptStillRelevant(scope)) openSummary();
    });
    (root.document.body || root.document.documentElement).appendChild(input);
    input.click();
  }

  // Если add_tx ушёл из очереди после перезагрузки, привязываем локальный id к серверному.
  root.addEventListener('queue-sent', function (ev) {
    var detail = ev.detail || {};
    var op = detail.op;
    var tx = detail.result;
    if (!op || op.action !== 'add_tx' || !tx || !tx.id || !receiptStore()) return;
    var localId = op.payload && op.payload.local_id;
    if (localId) receiptStore().link(receiptScope(), localId, tx.id, null);
  });

  function openEditTx(id) {
    if (editingTx || State.isExpired()) return;
    var tx = ((st['txCache:' + st.month] || {}).data || []).find(function (t) { return t.id === id; });
    if (!tx || tx._local || !tx.categories || tx.categories.kind !== 'expense') return;
    closeSwipes();
    var seq = reqSeq;
    loadCategories().then(function () {
      if (seq !== reqSeq || editingTx) return;
      editingTx = Object.assign({}, tx);
      openSheet(Views.renderEditForm(tx));
      el.screen.inert = true;
      el.tabs.inert = true;
      var input = el.sheetBody.querySelector('[name="amount"]');
      if (input) input.focus();
      syncBackButton();
    }).catch(function (err) { toast(err.message || T('Не удалось загрузить категории')); });
  }

  function cancelEditTx() {
    if (editSaving) return;
    editingTx = null;
    el.screen.inert = false;
    el.tabs.inert = false;
    closeSheet();
  }

  function submitEditTx(f) {
    if (!editingTx || editSaving) return;
    var scope = memberScope(st.member);
    var original = editingTx;
    var amount = Fmt.parseAmount(f.elements.amount.value);
    var date = f.elements.occurred_on.value;
    if (!(amount > 0) || !Number.isFinite(amount) || amount > 1e9) return toast(T('Введите сумму цифрами'));
    if (!date || Fmt.isoDate(Fmt.parseDate(date)) !== date) return toast(T('Укажите корректную дату'));
    var category = State.categoryById(f.elements.category_id.value);
    if (!category && f.elements.category_id.value === editingTx.category_id) {
      category = Object.assign({ id: editingTx.category_id }, editingTx.categories);
    }
    if (!category || category.kind !== 'expense') return toast(T('Выберите категорию'));
    var payload = { id: editingTx.id, amount: amount, category_id: category.id,
      note: f.elements.note.value.trim() || null, occurred_on: date, is_shared: editingTx.is_shared };
    editSaving = true;
    var request = ++editGeneration;
    f.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    Api.updateTx(payload).then(function (tx) {
      if (request !== editGeneration || scope !== memberScope(st.member) || editingTx !== original) return;
      if (!tx || tx.id !== payload.id) throw new Error(T('Сервер не подтвердил изменение'));
      clearCache();
      st.lastSummary = null;
      expandedCat = null;
      editingTx = null;
      el.screen.inert = false;
      el.tabs.inert = false;
      closeSheet();
      toast(T('Сохранено'));
      root.Tg.haptic('success');
      if (route.name === 'tx') openTx(); else openSummary();
    }).catch(function (err) {
      if (request !== editGeneration || scope !== memberScope(st.member) || editingTx !== original) return;
      var error = f.querySelector('.edit-tx-error');
      if (error) { error.textContent = err.message || T('Не удалось сохранить'); error.hidden = false; }
      toast(err.message || T('Не удалось сохранить'));
      root.Tg.haptic('error');
    }).finally(function () {
      if (request !== editGeneration) return;
      editSaving = false;
      f.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    });
  }

  function submitAdd(formEl) {
    var scope = memberScope(st.member);
    var values = formValues();
    var amount = Fmt.parseAmount(values.amount);
    var btn = formEl.querySelector('[type="submit"]');
    if (!(amount > 0) || amount > 1e9) {
      root.Tg.haptic('error');
      toast(T('Введите сумму цифрами'));
      formEl.elements.amount.focus();
      return;
    }
    if (!values.category_id) {
      root.Tg.haptic('error');
      toast(T('Выберите категорию'));
      return;
    }
    var receipt = values.receipt;
    var receiptKey = receipt && receipt.key;
    if (receiptKey && receiptIsKnown(scope, receiptKey)) {
      root.Tg.haptic('error');
      toast(T('Этот чек уже записан'));
      return;
    }
    var occurred = values.date || Fmt.todayIso();
    var fromCategory = pendingFromCategory || null;
    pendingFromCategory = null;
    var payload = {
      amount: amount,
      category_id: values.category_id,
      note: values.note.trim() || null,
      occurred_on: occurred,
      is_shared: values.kind === 'expense' ? values.is_shared : false,
    };
    if (SEND_RECEIPT_KEY && receipt) payload.receipt = { fn: receipt.fn, i: receipt.i, fp: receipt.fp };
    // Оптимистично: форма закрывается сразу, запись уже на экране.
    var local = optimisticTx(payload);
    if (receiptKey) {
      local._receiptKey = receiptKey;
      if (receiptStore()) receiptStore().remember(scope, receiptKey, { txId: local.id, date: occurred, sum: amount });
    }
    applyLocalTx(local);
    st.month = occurred.slice(0, 7);
    if (fromCategory && fromCategory === values.category_id) expandedCat = { id: fromCategory, rows: null };
    form = {};
    btn.disabled = true;
    root.Tg.haptic('success');
    toast(T('Записано'));
    openSummary();

    var op = Queue.push('add_tx', Object.assign({ local_id: local.id }, payload));
    pendingAdds[op.id] = local;

    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      if (scope !== memberScope(st.member)) return;
      delete pendingAdds[op.id];
      var tx = ev.detail.result;
      if (tx && tx.id) local._serverId = tx.id;
      if (receiptKey && tx && tx.id && receiptStore()) {
        receiptStore().link(scope, local.id, tx.id, receiptKey);
      }
      if (tx && tx.receipt_key && receiptStore()) {
        receiptStore().remember(scope, tx.receipt_key, { txId: tx.id, date: occurred, sum: amount });
      }
      clearCache();
      // Сервер подтвердил — перерисовываем, чтобы убрать «отправляется».
      if (route.name === 'summary') openSummary();
      if (route.name === 'tx') openTx();
    });

    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      if (scope !== memberScope(st.member)) return;
      delete pendingAdds[op.id];
      root.Tg.haptic('error');
      var code = ev.detail.error && ev.detail.error.code;
      // Откатываем локальную запись: сервер её не принял.
      removeOptimisticTx(local);
      // Дубль на сервере — чек уже есть, отметку оставляем. Остальные ошибки снимают блокировку.
      if (receiptKey && code !== 'duplicate_receipt' && receiptStore()) receiptStore().forget(scope, receiptKey);
      if (code === 'subscription_expired') fail(ev.detail.error);
      else if (code === 'duplicate_receipt') toast(T('Этот чек уже записан'));
      else toast(T('Не сохранилось: {error}', { error: (ev.detail.error && ev.detail.error.message) || T('ошибка') }));
      if (route.name === 'summary') openSummary();
      if (route.name === 'tx') openTx();
    });
  }

  // Локальная копия записи: показывается сразу, пока сервер не подтвердил.
  function optimisticTx(payload) {
    var cat = (st.categories || []).find(function (c) { return c.id === payload.category_id; }) || {};
    var me = st.member || {};
    return {
      id: 'local-' + Math.random().toString(36).slice(2),
      _local: true,
      amount: payload.amount,
      category_id: payload.category_id,
      is_shared: !!payload.is_shared,
      note: payload.note,
      occurred_on: payload.occurred_on,
      member_id: me.id,
      categories: { name: cat.name, icon: cat.icon, kind: cat.kind },
      members: { name: me.name },
    };
  }

  function deleteTx(id) {
    var scope = memberScope(st.member);
    dialog(T('Удалить эту запись?'), T('Удалить')).then(function (ok) {
      if (!ok || scope !== memberScope(st.member)) return;
      // Оптимистично: убираем запись из локальных кэшей и сразу пересчитываем
      // сводку, не дожидаясь ответа сервера и не показывая скелетон.
      var removed = null;
      var positions = [];
      Object.keys(st).forEach(function (k) {
        if (k.indexOf('txCache:') !== 0) return;
        var list = (st[k] && st[k].data) || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].id !== id) continue;
          removed = removed || list[i];
          positions.push({ key: k, index: i, tx: list[i] });
          cached(k, list.slice(0, i).concat(list.slice(i + 1)));
          break;
        }
      });
      var pendingRestore = [];
      Object.keys(pendingAdds).forEach(function (opId) {
        var t = pendingAdds[opId];
        if (!t || (t.id !== id && t._serverId !== id)) return;
        pendingRestore.push({ opId: opId, tx: t });
        delete pendingAdds[opId];
      });

      var month = removed && removed.occurred_on ? String(removed.occurred_on).slice(0, 7) : st.month;
      var summarySnapshot = removed ? cloneSummary(cached('summaryCache:' + month)) : null;
      var expandedSnapshot = expandedCat
        ? { id: expandedCat.id, rows: expandedCat.rows ? expandedCat.rows.slice() : null }
        : null;
      deletingTx[id] = true;

      if (removed) {
        var summary = cached('summaryCache:' + month);
        if (summary) {
          var nextSummary = summaryAfterRemoval(summary, removed);
          cached('summaryCache:' + month, nextSummary);
          if (month === st.month) st.lastSummary = nextSummary;
        }
        if (expandedCat && expandedCat.rows) {
          expandedCat = {
            id: expandedCat.id,
            rows: expandedCat.rows.filter(function (t) { return t.id !== id; }),
          };
        }
      }

      // Ставим операцию в очередь до перерисовки: пока она не отправлена,
      // fetchSummary отдаёт локальную сводку и не успевает вернуть удалённую запись.
      var op = Queue.push('delete_tx', { id: id });
      root.Tg.haptic('success');
      toast(T('Удалено'));
      closeSwipes();
      if (route.name === 'tx') openTx();
      else if (route.name === 'summary') openSummary();

      root.addEventListener('queue-sent', function onSent(ev) {
        if (ev.detail.id !== op.id) return;
        root.removeEventListener('queue-sent', onSent);
        if (scope !== memberScope(st.member)) return;
        delete deletingTx[id];
        // Только после подтверждения сервера освобождаем чек: при ошибке
        // запись вернётся, и защита от повторного добавления должна остаться.
        if (removed && receiptStore()) receiptStore().forgetForTx(scope, removed);
      });
      root.addEventListener('queue-failed', function onFailed(ev) {
        if (ev.detail.op.id !== op.id) return;
        root.removeEventListener('queue-failed', onFailed);
        if (scope !== memberScope(st.member)) return;
        delete deletingTx[id];
        positions.forEach(function (pos) {
          var current = (cached(pos.key) || []).slice();
          current.splice(Math.min(pos.index, current.length), 0, pos.tx);
          cached(pos.key, current);
        });
        pendingRestore.forEach(function (item) { pendingAdds[item.opId] = item.tx; });
        if (summarySnapshot) {
          cached('summaryCache:' + month, summarySnapshot);
          if (month === st.month) st.lastSummary = summarySnapshot;
        }
        expandedCat = expandedSnapshot;
        root.Tg.haptic('error');
        toast(T('Не удалилось: {error}', { error: (ev.detail.error && ev.detail.error.message) || T('ошибка') }));
        if (route.name === 'tx') openTx();
        else if (route.name === 'summary') openSummary();
      });
    });
  }

  function pickCategory(id, chip) {
    form.category_id = id;
    form.amount = formValues().amount;
    root.Tg.haptic('light');
    el.screen.querySelectorAll('.cat-chip').forEach(function (c) { c.classList.remove('cat-chip--active'); c.setAttribute('aria-pressed', 'false'); });
    chip.classList.add('cat-chip--active');
    chip.setAttribute('aria-pressed', 'true');
  }

  function pickKind(kind) {
    var values = formValues();
    // Чек прихода нельзя записать как расход и наоборот: при смене типа убираем отметку.
    var receipt = values.receipt && values.receipt.kind === kind ? values.receipt : null;
    form = Object.assign({}, values, { kind: kind, category_id: '', receipt: receipt });
    form._fromCategory = null;   // сменили тип — возвращаемся на общую сводку
    render(Views.renderForm(form));
  }

  function submitOnboarding(formEl, action) {
    var btn = formEl.querySelector('[type="submit"]');
    var name = formEl.elements.member_name.value.trim();
    var payload = { member_name: name || undefined };
    if (action === 'join') {
      payload.code = formEl.elements.code.value.trim();
      if (!payload.code) {
        toast(T('Введите код приглашения'));
        formEl.elements.code.focus();
        return;
      }
    } else {
      payload.name = formEl.elements.name.value.trim() || undefined;
      payload.mode = onboarding.mode || 'pair';
    }
    btn.disabled = true;
    Api.call(action === 'join' ? 'join' : 'create_household', payload).then(function (res) {
      root.Tg.haptic('success');
      onboarding = { tab: 'create', member_name: name, code: '', household_name: '' };
      return loadMember().then(function (me) {
        if (!me) {
          toast(T('Семья не найдена, попробуйте ещё раз'));
          btn.disabled = false;
          return;
        }
        if (res && res.invite_code) {
          render(Views.renderInvite(res.invite_code));
        } else {
          openSummary();
        }
      });
    }).catch(function (err) {
      btn.disabled = false;
      root.Tg.haptic('error');
      toast(err.message || T('Не получилось'));
    });
  }

  // --- События ---

  el.screen.addEventListener('toggle', function (ev) {
    var picker = ev.target;
    if (!picker.matches('.category-picker') || !picker.open) return;
    var rect = picker.getBoundingClientRect();
    picker.classList.toggle('category-picker--up', root.innerHeight - rect.bottom < 370 && rect.top > 300);
  }, true);

  document.addEventListener('click', function (ev) {
    var choice = ev.target.closest('[data-tx-choice]');
    if (choice && route.name === 'tx') {
      st.txFilter.category_id = choice.getAttribute('data-tx-choice') || null;
      var picker = choice.closest('.category-picker');
      picker.querySelector('.category-picker__current').innerHTML = choice.innerHTML;
      picker.querySelectorAll('[data-tx-choice]').forEach(function (option) {
        option.setAttribute('aria-pressed', String(option === choice));
      });
      picker.open = false;
      picker.querySelector('summary').focus({ preventScroll: true });
      root.Tg.haptic('light');
      refreshTxResults();
    }
    el.screen.querySelectorAll('.category-picker[open]').forEach(function (picker) {
      if (!picker.contains(ev.target)) picker.open = false;
    });
  });
  el.screen.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var picker = ev.target.closest('.category-picker');
    if (picker) { picker.open = false; picker.querySelector('summary').focus(); }
  });


  function setHomeCategorySort(value) {
    st.homeCategorySort = value === 'amount' ? 'amount' : 'default';
    st.homeShowEmpty = false;
    try { root.localStorage.setItem('budget.homeCategorySort', st.homeCategorySort); } catch (e) {}
    renderSummaryFromCache();
  }

  // Перерисовка сводки из кэша без запроса — нужна для раскрытия/сворачивания.
  // render() сбрасывает прокрутку вверх, поэтому запоминаем позицию и
  // держим раскрытую строку на том же месте экрана.
  function renderSummaryFromCache() {
    if (route.name !== 'summary') return;
    var s = cached('summaryCache:' + st.month) || st.lastSummary;
    if (!s) return openSummary();

    var sel = expandedCat
      ? '[data-action="toggle-cat"][data-id="' + expandedCat.id + '"]'
      : null;
    var btn = sel ? el.screen.querySelector(sel) : null;
    var scroll = el.screen.scrollTop;
    // Насколько строка уже ушла вверх за пределы экрана: прокрутку уменьшаем на эту величину,
    // чтобы заголовок категории оказался виден вместе с раскрытым списком.
    var hiddenAbove = btn ? Math.max(0, -btn.getBoundingClientRect().top + 8) : 0;

    render(Views.renderSummary(s, st.plans, expandedCat, cached('txCache:' + st.month), categoryView));
    if (State.isExpired()) banner(T('Пробный период закончился — новые записи недоступны.'));
    el.screen.scrollTop = Math.max(0, scroll - hiddenAbove);
  }

  // Режим редактирования главной: меняем только черновик, сохраняем явно.
  // Порядок блоков локальный и не синхронизируется между устройствами.
  function startHomeEdit() {
    if (route.name !== 'summary' || st.homeEdit) return;
    st.homeEdit = true;
    st.homeDraft = State.homeOrder();
    expandedCat = null;
    root.Tg.haptic('light');
    renderSummaryFromCache();
  }

  function saveHomeEdit() {
    if (!st.homeEdit) return;
    State.setHomeOrder(st.homeDraft || State.homeOrder());
    st.homeEdit = false;
    st.homeDraft = null;
    root.Tg.haptic('success');
    renderSummaryFromCache();
    toast(T('Порядок сохранён'));
  }

  function resetHomeEdit() {
    if (!st.homeEdit) return;
    st.homeDraft = State.defaultHomeOrder();
    root.Tg.haptic('light');
    renderSummaryFromCache();
    toast(T('Порядок сброшен — сохраните изменения'));
  }

  function cancelHomeEdit() {
    if (!st.homeEdit) return;
    st.homeEdit = false;
    st.homeDraft = null;
    renderSummaryFromCache();
  }

  function moveHomeBlock(id, direction) {
    if (!st.homeEdit) return;
    var order = (st.homeDraft || State.homeOrder()).slice();
    var from = order.indexOf(id);
    var to = from + (direction === 'down' ? 1 : -1);
    if (from < 0 || to < 0 || to >= order.length) return;
    var moved = order.splice(from, 1)[0];
    order.splice(to, 0, moved);
    st.homeDraft = order;
    root.Tg.haptic('light');
    renderSummaryFromCache();
    // После перерисовки возвращаем фокус на ту же кнопку — управление с клавиатуры.
    setTimeout(function () {
      var dir = direction === 'down' ? 'down' : 'up';
      var next = el.screen.querySelector('[data-action="home-move"][data-id="' + id + '"][data-dir="' + dir + '"]');
      if (!next || next.disabled) {
        dir = dir === 'up' ? 'down' : 'up';
        next = el.screen.querySelector('[data-action="home-move"][data-id="' + id + '"][data-dir="' + dir + '"]');
      }
      if (next && !next.disabled && next.focus) next.focus({ preventScroll: true });
    }, 0);
  }

  function changeCategoryView(button) {
    var categories = el.screen.querySelector('.categories--' + categoryView);
    if (!categories) return;
    var tiles = Array.prototype.slice.call(categories.querySelectorAll('.cat-wrap'));
    var before = tiles.map(function (tile) { return tile.getBoundingClientRect(); });
    tiles.forEach(function (tile) {
      if (tile.categoryMotion) tile.categoryMotion.cancel();
    });
    categoryView = button.getAttribute('data-view') === 'list' ? 'list' : 'grid';
    try { root.localStorage.setItem('budget.categoryView', categoryView); } catch (e) {}
    root.Tg.haptic('light');
    // Keep the existing cards and the open category while changing layout.
    categories.classList.toggle('categories--grid', categoryView === 'grid');
    categories.classList.toggle('categories--list', categoryView === 'list');
    var label = T(categoryView === 'grid' ? 'Показать списком' : 'Показать сеткой');
    button.setAttribute('data-view', categoryView === 'grid' ? 'list' : 'grid');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', categoryView === 'list' ? 'true' : 'false');
    button.querySelector('svg').innerHTML = categoryView === 'grid'
      ? '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
      : '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
    if (root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // FLIP: start at each card's previous rectangle and settle into the new one.
    tiles.forEach(function (tile, index) {
      if (!tile.animate) return;
      var old = before[index];
      var after = tile.getBoundingClientRect();
      if (!after.width || !after.height) return;
      tile.categoryMotion = tile.animate([
        { transformOrigin: 'top left', transform: 'translate(' + (old.left - after.left) + 'px,' +
          (old.top - after.top) + 'px) scale(' + (old.width / after.width) + ',' + (old.height / after.height) + ')' },
        { transformOrigin: 'top left', transform: 'none' },
      ], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
  }

  // Категория на сводке: открыть траты по ней, фильтр выставляем до загрузки списка.

  // Защита от ложных тапов: при скролле клик не должен раскрывать категорию.
  // Отслеживаем факт прокрутки контейнера между touchstart и click.
  var TOUCH_MOVE_LIMIT = 10;
  var scrollAtTouch = null;

  document.addEventListener('touchstart', function () {
    scrollAtTouch = el.screen ? el.screen.scrollTop : 0;
  }, { passive: true, capture: true });

  function isScrollGesture() {
    if (scrollAtTouch === null) return false;
    var delta = Math.abs((el.screen ? el.screen.scrollTop : 0) - scrollAtTouch);
    // 2px: даже небольшой сдвиг контейнера означает прокрутку, а не тап.
    return delta > 2 && delta > TOUCH_MOVE_LIMIT / 5;
  }

  // Крестик на баннере платежа: скрываем до конца дня и убираем узел без
  // перерисовки экрана, чтобы не сбить прокрутку.
  var duePayments = {};
  function payDue(button) {
    var id = button.getAttribute('data-id');
    if (!id || duePayments[id]) return;
    duePayments[id] = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    mutate('pay_recurring', { id: id }).then(function () {
      clearCache();
      st.lastSummary = null;
      root.Tg.haptic('success');
      toast(T('Оплата записана'));
      // Load the new transaction before rebuilding the reminder and balance.
      return loadTx(Fmt.currentMonth()).catch(function () {}).then(function () {
        if (route.name === 'summary') openSummary();
      });
    }).catch(function (err) {
      root.Tg.haptic('error');
      toast(err.message || T('Не удалось записать'));
    }).finally(function () {
      delete duePayments[id];
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });
  }

  function dismissDueBanner() {
    State.dismissDue();
    var due = el.screen.querySelector('.due');
    if (due) due.remove();
    root.Tg.haptic('light');
    toast(T('Напоминание скрыто до завтра'));
  }

  // Делегирование на document: кнопки часто перерисовываются самим обработчиком,
  // и слушатель, привязанный к контейнеру экрана, может не дожить до клика.
  document.addEventListener('click', function (ev) {
    var tabBtn = ev.target.closest('[data-tab]');
    if (tabBtn) {
      if (st.homeEdit) {
        st.homeEdit = false;
        st.homeDraft = null;
      }
      openTab(tabBtn.getAttribute('data-tab'));
      return;
    }

    var actionBtn = ev.target.closest('[data-action]');
    if (!actionBtn) return;
    var action = actionBtn.getAttribute('data-action');

    // В режиме редактирования главной работают только его собственные кнопки:
    // карточки, месяц и баннеры не должны уводить со страницы.
    if (st.homeEdit && route.name === 'summary' && !actionBtn.hasAttribute('data-home-edit')) return;

    // Раскрытие категории не должно срабатывать на скролле.
    var scrolled = isScrollGesture();
    scrollAtTouch = null;
    if (action === 'toggle-cat' && scrolled) return;

    switch (action) {
      case 'home-edit': startHomeEdit(); break;
      case 'home-edit-save': saveHomeEdit(); break;
      case 'home-edit-reset': resetHomeEdit(); break;
      case 'home-edit-cancel': cancelHomeEdit(); break;
      case 'home-move': moveHomeBlock(actionBtn.getAttribute('data-id'), actionBtn.getAttribute('data-dir')); break;
      case 'edit-tx': openEditTx(actionBtn.getAttribute('data-id')); break;
      case 'cancel-edit-tx': cancelEditTx(); break;
      case 'home-empty-toggle': st.homeShowEmpty = !st.homeShowEmpty; renderSummaryFromCache(); break;
      case 'month-prev': changeMonth(-1); break;
      case 'month-next': changeMonth(1); break;
      case 'go-tx': openTx(null); break;
      case 'go-tx-kind':
        root.Tg.haptic('light');
        openTxKind(actionBtn.getAttribute('data-kind'));
        break;
      case 'go-add-kind':
        root.Tg.haptic('light');
        openAdd({ kind: actionBtn.getAttribute('data-kind') });
        break;
      case 'tx-kind':
        root.Tg.haptic('light');
        setTxKind(actionBtn.getAttribute('data-kind'));
        break;
      case 'toggle-category-view':
        changeCategoryView(actionBtn);
        break;
      case 'quick-actions-page':
        // Точки переключают без перерисовки листа, чтобы лента анимировалась.
        qaReset();
        qaSetPage(Number(actionBtn.getAttribute('data-page')) || 0);
        break;
      case 'quick-action': runQuickAction(actionBtn.getAttribute('data-quick')); break;
      case 'tx-clear-filter': clearTxFilter(); break;
      case 'tx-search-clear': clearTxSearch(); break;

      case 'toggle-cat': toggleCategory(actionBtn.getAttribute('data-id')); break;
      case 'add-in-cat': openAdd({ category_id: actionBtn.getAttribute('data-id'), kind: 'expense' }); break;
      case 'open-cat-tx':
        openTx(actionBtn.getAttribute('data-id'), undefined, true);
        break;
      case 'go-add': openAdd(); break;
      case 'refresh':
        clearCache();
        st.categories = null;
        toast(T('Обновлено'));
        if (route.name === 'settings') openSettings(route.section);
        else openTab(route.name);
        break;
      case 'retry':
            goHome();
        break;
      case 'start': goHome(); break;
      case 'go-plans': openPlans(actionBtn.getAttribute('data-plans-tab') || undefined); break;
      case 'go-recurring': openPlans('recurring'); break;
      case 'dismiss-due': dismissDueBanner(); break;
      case 'pay-due': payDue(actionBtn); break;
      case 'go-settings': openSettings('subscription'); break;
      case 'open-profile-section': openSettings(actionBtn.getAttribute('data-section')); break;
      case 'profile-home': openSettings(); break;
      case 'add-home-screen': addHomeScreen(); break;
      case 'buy': buyTariff(actionBtn.getAttribute('data-buy')); break;
      case 'delete-account': deleteAccount(); break;
      case 'edit-cat': openCategoryForm(actionBtn.getAttribute('data-id')); break;
      case 'open-cat': openLimits(actionBtn.getAttribute('data-id')); break;
      case 'add-cat': openCategoryForm(null, actionBtn.getAttribute('data-kind')); break;
      case 'go-limits': openLimits(); break;
      case 'pick-cover': setCover(actionBtn.getAttribute('data-cover')); break;
      case 'pick-cover-file': openCoverFilePicker(); break;
      case 'clear-custom-cover': resetCustomCover(); break;
      case 'apply-cover': applyCoverDraft(); break;
      case 'split-mode': setSplitMode(actionBtn.getAttribute('data-mode')); break;
      case 'cat-kind':
        catKind = actionBtn.getAttribute('data-kind');
        el.sheetBody.querySelectorAll('[data-action="cat-kind"]').forEach(function (b) {
          b.classList.toggle('segment--active', b === actionBtn);
        });
        break;
      case 'delete-cat': deleteCategory(actionBtn.getAttribute('data-id')); break;
      case 'plans-tab':
        var nextPlansTab = actionBtn.getAttribute('data-plans');
        if (nextPlansTab === plansTab) break;
        plansTab = nextPlansTab;
        if (st.plans) { ++reqSeq; render(Views.renderPlans(st.plans, plansTab)); }
        else openPlans();
        break;
      case 'plan-add': openPlanForm(actionBtn.getAttribute('data-kind') || plansTab); break;
      case 'onb-mode':
        onboarding.mode = actionBtn.getAttribute('data-mode');
        onboarding.member_name = (el.screen.querySelector('[name="member_name"]') || {}).value || '';
        onboarding.household_name = (el.screen.querySelector('[name="name"]') || {}).value || '';
        render(Views.renderOnboarding(onboarding));
        break;
      case 'onb-tab':
        onboarding.tab = actionBtn.getAttribute('data-onb');
        onboarding.member_name = (el.screen.querySelector('[name="member_name"]') || {}).value || '';
        onboarding.code = (el.screen.querySelector('[name="code"]') || {}).value || '';
        onboarding.household_name = (el.screen.querySelector('[name="name"]') || {}).value || '';
        render(Views.renderOnboarding(onboarding));
        break;
      case 'pick-cat': pickCategory(actionBtn.getAttribute('data-id'), actionBtn); break;
      case 'pick-kind': pickKind(actionBtn.getAttribute('data-kind')); break;
      case 'scan-receipt': scanReceipt(); break;
      case 'scan-receipt-home':
        root.Tg.haptic('light');
        openAdd({ kind: 'expense' });
        scanReceipt();
        break;
      case 'pick-receipt-photo': pickReceiptPhoto(); break;
      case 'clear-receipt': form = formValues(); form.receipt = null; render(Views.renderForm(form)); break;
      case 'copy-invite':
        root.Tg.copy((st.member && st.member.households && st.member.households.invite_code) || '');
        break;
      case 'copy-code':
        root.Tg.copy(actionBtn.getAttribute('data-code') || '');
        break;
      case 'open-promo':
        var promoInput = el.screen.querySelector('[name="code"]');
        if (promoInput) { promoInput.focus(); }
        break;
      case 'demo-reset':
        if (root.DEMO_API) root.DEMO_API.reset();
        clearCache();
        st.categories = null;
        toast(T('Демо-данные сброшены'));
        goHome();
        break;
    }
  });

  // Блокируем «призрачный» клик после тапа по кнопкам: на iOS/Telegram он прилетал
  // в ту же точку уже после перерисовки и нажимал чужую кнопку.
  function guardGhost(ev) {
    var btn = ev.target.closest && ev.target.closest('button, .segment, .cat-chip, [data-tab]');
    if (!btn || btn.disabled) return;
    // Синтетический клик по тому же элементу заменил бы настоящий tap —
    // отдаём событие обычному обработчику click, только гасим возможный дубль.
    var isGhost = ev.cancelable === false;
    if (isGhost) ev.preventDefault();
  }
  el.screen.addEventListener('touchend', guardGhost, {
    capture: true, passive: false,
  });

  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (!f.matches('form')) return;
    ev.preventDefault();
    var kind = f.getAttribute('data-form');
    if (kind === 'add') submitAdd(f);
    else if (kind === 'edit-tx') submitEditTx(f);
    else if (kind === 'plan') submitPlan(f);
    else if (kind === 'category') submitCategory(f);
    else if (kind === 'promo') redeemPromo(f.elements.code.value);
    else if (kind === 'profile') submitProfile(f);
    else if (kind === 'create' || kind === 'join') submitOnboarding(f, kind);
  });

  // Тап по названию категории в тратах ведёт к её лимиту в настройках.
  el.screen.addEventListener('click', function (ev) {
    var catBtn = ev.target.closest('[data-cat-link]');
    if (catBtn) {
      ev.stopPropagation();
      openLimits(catBtn.getAttribute('data-cat-link'));
      return;
    }
  }, true);

  el.screen.addEventListener('click', function (ev) {
    // Карточка повторяющегося платежа: «···» удаляет, кнопка проводит оплату.
    var recCard = ev.target.closest('[data-recurring]');
    if (recCard) {
      var recId = recCard.getAttribute('data-recurring');
      if (ev.target.closest('[data-recurring-more]')) return removeRecurring(recId);
      if (ev.target.closest('[data-recurring-edit]')) {
        var rec = ((st.plans && st.plans.recurring) || []).find(function (r) { return r.id === recId; });
        if (!rec) return;
        // Категории нужны для выбора в форме — подгружаем, если ещё не загружены.
        return loadCategories().then(function () {
          openPlanForm('recurring', {
            id: rec.id, name: rec.name, amount: rec.amount, day: rec.day_of_month,
            reminder_days: rec.reminder_days,
            category_id: rec.category_id, categories: rec.categories,
          });
        });
      }
      if (ev.target.closest('[data-recurring-pay]')) {
        // Оптимистично: платеж уходит в очередь, список обновляется сразу.
        root.Tg.haptic('success');
        clearCache();
        toast(T('Оплата записана'));
        var payOp = Queue.push('pay_recurring', { id: recId });
        var payScope = memberScope(st.member);
        root.addEventListener('queue-sent', function onSent(e2) {
          if (e2.detail.id !== payOp.id) return;
          root.removeEventListener('queue-sent', onSent);
          if (payScope !== memberScope(st.member)) return;
          clearCache();
          st.plans = null;
          if (route.name === 'plans') openPlans(); else if (route.name === 'summary') openSummary(); else if (route.name === 'tx') openTx();
        });
        root.addEventListener('queue-failed', function onFailed(e2) {
          if (e2.detail.op.id !== payOp.id) return;
          root.removeEventListener('queue-failed', onFailed);
          if (payScope !== memberScope(st.member)) return;
          clearCache();
          root.Tg.haptic('error');
          toast(e2.detail.error && e2.detail.error.message || T('Не удалось записать'));
        });
        st.plans = null;
        openPlans();
      }
      return;
    }

    var del = ev.target.closest('[data-tx-delete]');
    if (del) {
      deleteTx(del.getAttribute('data-tx-delete'));
      return;
    }
    // «···» открывает то же меню удаления, что свайп и удержание.
    var more = ev.target.closest('[data-tx-more]');
    if (more) {
      var tx = more.closest('.tx');
      if (tx) {
        if (tx.classList.contains('tx--open')) closeSwipes();
        else openTxRow(tx);
      }
      return;
    }
  });

  // Поиск по истории: обновляем только результаты, чтобы поле не теряло фокус.
  var txSearchTimer = null;
  el.screen.addEventListener('input', function (ev) {
    var input = ev.target;
    if (!input || input.id !== 'tx-search') return;
    var value = input.value;
    clearTimeout(txSearchTimer);
    txSearchTimer = setTimeout(function () {
      if (route.name !== 'tx') return;
      var current = el.screen.querySelector('#tx-search');
      if (!current || current.value !== value) return;
      if (!st.txFilter) st.txFilter = { kind: null, category_id: null, member_id: null, q: '' };
      st.txFilter.q = value;
      var clear = el.screen.querySelector('[data-action="tx-search-clear"]');
      if (clear) clear.hidden = !value;
      refreshTxResults();
    }, 120);
  });

  el.screen.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !t.matches) return;
    if (t.matches('[data-cover-file]')) {
      var file = t.files && t.files[0];
      t.value = '';
      readCoverFile(file);
      return;
    }
    if (t.matches('[data-notif]')) {
      toggleNotification(t);
      return;
    }
    if (t.matches('[data-notif-time]')) {
      saveNotificationTime(t);
      return;
    }
    if (t.matches('[data-theme-pref]')) {
      setThemePreference(t.value);
      return;
    }
    if (t.matches('[data-home-category-sort]')) {
      setHomeCategorySort(t.value);
      return;
    }
    if (t.matches('[data-locale]')) {
      if (!I18n.setLocale(t.value)) return;
      root.Tg.haptic('light');
      // Вкладки создаются один раз — пересобираем их на новом языке.
      el.tabs.innerHTML = '';
      var scroll = el.screen.scrollTop;
      render(Views.renderSettings(route.section));
      el.screen.scrollTop = scroll;
      document.documentElement.lang = I18n.locale();
      document.title = T('Бюджет пары');
      toast(t.options[t.selectedIndex].text);
      return;
    }
    if (t.matches('[data-currency]')) {
      if (!Fmt.setCurrency(t.value)) return;
      root.Tg.haptic('light');
      var scroll = el.screen.scrollTop;
      render(Views.renderSettings(route.section));
      el.screen.scrollTop = scroll;
      toast(T('Валюта: {name}', { name: T(Fmt.currencyName()) }));
      return;
    }
    if (!st.txFilter) return;
    if (t.matches('[data-tx-category]')) {
      st.txFilter.category_id = t.value || null;
      root.Tg.haptic('light');
      refreshTxResults();
    }
  });

  el.sheet.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-sheet-close]')) closeSheet();
  });

  el.sheet.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.matches) return;
    if (t.matches('[data-cover-zoom], [data-cover-x], [data-cover-y]')) updateCoverDraft(t);
  });

  // Карточки планов: «···» → удалить, «+ Пополнить» / «− 1000» → сумма и API.
  el.screen.addEventListener('click', function (ev) {
    var card = ev.target.closest('[data-plan]');
    if (!card) return;
    var kind = card.getAttribute('data-plan');
    var id = card.getAttribute('data-id');

    if (ev.target.closest('[data-plan-more]')) {
      card.classList.toggle('plan--open');
      var more = card.querySelector('.plan__more');
      if (more) more.textContent = card.classList.contains('plan--open') ? T('Удалить') : '···';
      return;
    }
    if (card.classList.contains('plan--open') && ev.target.closest('.plan__more') === null &&
        !ev.target.closest('[data-plan-add]') && !ev.target.closest('[data-debt-pay]') && !ev.target.closest('[data-wish-buy]')) {
      card.classList.remove('plan--open');
      var m2 = card.querySelector('.plan__more');
      if (m2) m2.textContent = '···';
      var confirm = card.querySelector('.plan__confirm');
      if (confirm && !ev.target.closest('.plan__confirm')) confirm.hidden = true;
      return;
    }

    var addBtn = ev.target.closest('[data-plan-add]');
    if (addBtn) {
      var box = card.querySelector('.plan__confirm');
      box.hidden = !box.hidden;
      var input = box.querySelector('[data-plan-amount]');
      if (!box.hidden && input) setTimeout(function () { input.focus(); }, 100);
      return;
    }
    if (ev.target.closest('[data-plan-cancel]')) {
      var c = card.querySelector('.plan__confirm');
      if (c) c.hidden = true;
      return;
    }
    if (ev.target.closest('[data-plan-save]')) {
      var amountField = card.querySelector('[data-plan-amount]');
      var value = amountField ? Fmt.parseAmount(amountField.value) : NaN;
      if (kind === 'goal') planAction('add_to_goal', id, value, T('Добавлено'));
      else planAction('pay_debt', id, value, T('Выплачено'));
      return;
    }

    var pay = ev.target.closest('[data-debt-pay]');
    if (pay) {
      var raw = pay.getAttribute('data-debt-pay');
      // «весь остаток» — сумма берётся из data-remaining на карточке.
      var amt = raw === 'all' ? Number(card.getAttribute('data-remaining') || 0) : Number(raw);
      planAction('pay_debt', id, amt, T('Выплачено'));
      return;
    }

    var buy = ev.target.closest('[data-wish-buy]');
    if (buy) {
      mutate('buy_wish', { id: id }).then(function () {
        root.Tg.haptic('success');
        toast(T('Отмечено купленным'));
        openPlans();
      }).catch(function (err) { toast(err.message || T('Не удалось')); });
    }
  });

  el.dialog.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-dialog-close]')) closeDialog(false);
    if (ev.target.closest('[data-dialog-ok]')) closeDialog(true);
  });

  // Свайп по строке траты влево — открывает кнопку «Удалить».
  var swipe = null;
  var swipeDx = 0;

  function closeSwipes(except) {
    el.screen.querySelectorAll('.tx--open').forEach(function (tx) {
      if (tx === except) return;
      tx.classList.remove('tx--open');
      var r = tx.querySelector('[data-tx-row]');
      if (r) r.style.transform = '';
      tx.querySelectorAll('[data-tx-delete],.tx__edit-inline').forEach(function (b) { b.tabIndex = -1; });
    });
  }

  el.screen.addEventListener('touchstart', function (ev) {
    var row = ev.target.closest('[data-tx-row]');
    if (!row || ev.touches.length !== 1) return;
    if (row.closest('.finance-operation')) return;
    swipe = { row: row, x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, active: false };
  }, { passive: true });

  el.screen.addEventListener('touchmove', function (ev) {
    if (!swipe) return;
    var dx = ev.touches[0].clientX - swipe.x;
    var dy = ev.touches[0].clientY - swipe.y;
    if (!swipe.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) swipe.active = true;
      else return;
    }
    closeSwipes(swipe.row.closest('.tx'));
    swipe.dx = Math.max(-96, Math.min(0, dx));
    swipe.row.style.transition = 'none';
    swipe.row.style.transform = 'translateX(' + swipe.dx + 'px)';
  }, { passive: true });

  el.screen.addEventListener('touchend', function () {
    if (!swipe) return;
    var tx = swipe.row.closest('.tx');
    var open = swipe.dx < -40;
    swipe.row.style.transition = '';
    swipe.row.style.transform = open ? 'translateX(-88px)' : '';
    if (tx) tx.classList.toggle('tx--open', open);
    swipe = null;
  }, { passive: true });

  // Pointer gestures support touch, pen and mouse with the same animation.
  var financeSwipe = null;
  var swipeClickUntil = 0;
  el.screen.addEventListener('pointerdown', function (ev) {
    var row = ev.target.closest('.finance-operation [data-tx-row]');
    if (!row || !ev.isPrimary || ev.button !== 0) return;
    financeSwipe = { row: row, tx: row.closest('.tx'), id: ev.pointerId,
      x: ev.clientX, y: ev.clientY, base: row.closest('.tx').classList.contains('tx--open') ? -txActionWidth(row.closest('.tx')) : 0,
      dx: 0, active: false };
  });
  el.screen.addEventListener('pointermove', function (ev) {
    var gesture = financeSwipe;
    if (!gesture || gesture.id !== ev.pointerId) return;
    var dx = ev.clientX - gesture.x, dy = ev.clientY - gesture.y;
    if (!gesture.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { financeSwipe = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      gesture.active = true;
      closeSwipes(gesture.tx);
      gesture.row.setPointerCapture(ev.pointerId);
      gesture.row.classList.add('tx__row--dragging');
      gesture.tx.classList.add('tx--dragging');
    }
    ev.preventDefault();
    gesture.dx = dx;
    var position = Math.max(-txActionWidth(gesture.tx), Math.min(0, gesture.base + dx));
    gesture.row.style.transform = 'translateX(' + position + 'px)';
  });
  function finishFinanceSwipe(ev) {
    var gesture = financeSwipe;
    if (!gesture || gesture.id !== ev.pointerId) return;
    financeSwipe = null;
    if (!gesture.active) return;
    var open = ev.type !== 'pointercancel' && gesture.base + gesture.dx < -36;
    gesture.row.classList.remove('tx__row--dragging');
    gesture.tx.classList.remove('tx--dragging');
    gesture.tx.classList.toggle('tx--open', open);
    gesture.row.style.transform = open ? 'translateX(-' + txActionWidth(gesture.tx) + 'px)' : '';
    gesture.tx.querySelectorAll('[data-tx-delete],.tx__edit-inline').forEach(function (b) { b.tabIndex = open ? 0 : -1; });
    swipeClickUntil = Date.now() + 350;
    if (gesture.row.hasPointerCapture(ev.pointerId)) gesture.row.releasePointerCapture(ev.pointerId);
    if (open) root.Tg.haptic('light');
  }
  el.screen.addEventListener('pointerup', finishFinanceSwipe);
  el.screen.addEventListener('pointercancel', finishFinanceSwipe);
  el.screen.addEventListener('click', function (ev) {
    if (Date.now() < swipeClickUntil && ev.target.closest('.finance-operation')) {
      ev.preventDefault(); ev.stopImmediatePropagation();
    }
  }, true);
  el.screen.addEventListener('keydown', function (ev) {
    var tx = ev.target.closest('.finance-operation');
    if (!tx) return;
    var row = tx.querySelector('[data-tx-row]');
    if (ev.key === 'ArrowLeft' && ev.target === row) {
      ev.preventDefault(); openTxRow(tx);
      var del = tx.querySelector('[data-tx-delete]');
      del.tabIndex = 0; del.focus();
    }
    if (ev.key === 'ArrowRight' || ev.key === 'Escape') { ev.preventDefault(); closeSwipes(); row.focus(); }
  });

  // Горизонтальный свайп по основным страницам: экран едет за пальцем, а сбоку
  // подъезжает превью соседней вкладки. Стартуем только на неинтерактивных
  // участках экрана: строки трат, кнопки, поля и открытые шторки имеют
  // собственные жесты и не должны переключать страницу.
  //
  // Жест ведём pointer-событиями с захватом на viewport: он не перерисовывается,
  // поэтому быстрый второй свайп не теряется, даже если первую страницу уже
  // успели заменить.
  var pageSurface = pageViewport() || el.screen;

  function releasePagePointer(gesture) {
    if (!gesture || gesture.id === undefined) return;
    try {
      if (pageSurface.releasePointerCapture) pageSurface.releasePointerCapture(gesture.id);
    } catch (e) {}
  }

  function capturePagePointer(gesture) {
    if (!gesture || gesture.captured) return;
    try {
      if (pageSurface.setPointerCapture) pageSurface.setPointerCapture(gesture.id);
      gesture.captured = true;
    } catch (e) {}
  }

  pageSurface.addEventListener('pointerdown', function (ev) {
    if (ev.isPrimary === false) return;
    if (pageSwipe) {
      // Предыдущий pointerup потерялся (отпустили за окном) — не залипаем.
      releasePagePointer(pageSwipe);
      if (pageSwipe.axis === 'x') clearPageSwipeStyles(pageSwipe);
      pageSwipe = null;
    }
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (!pageSwipeAllowed(ev.target)) return;
    // Если предыдущая страница ещё доезжает — сначала захватываем указатель,
    // затем доводим её: перерисовка не должна оборвать новый жест.
    var resuming = !!pageSettle;
    var next = {
      id: ev.pointerId,
      x: ev.clientX, y: ev.clientY,
      lastX: ev.clientX, lastT: performance.now(),
      dx: 0, axis: '', from: route.name, target: null, peek: null, edge: false, fast: false, armed: false,
      captured: false,
    };
    if (resuming) {
      capturePagePointer(next);
      flushPageSettle();
      next.from = route.name;
    }
    pageSwipe = next;
  });

  document.addEventListener('pointermove', function (ev) {
    var gesture = pageSwipe;
    if (!gesture || ev.pointerId !== gesture.id) return;
    var dx = ev.clientX - gesture.x;
    var dy = ev.clientY - gesture.y;
    if (!gesture.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) < Math.abs(dy) * 1.2) {
        pageSwipe = null;
        releasePagePointer(gesture);
        return;
      }
      gesture.axis = 'x';
      capturePagePointer(gesture);
      gesture.dir = dx < 0 ? -1 : 1;
      gesture.width = pageSwipeWidth();
      gesture.target = swipeTarget(route.name, -gesture.dir);
      gesture.edge = !gesture.target;
      if (gesture.target) gesture.peek = buildPagePeek(gesture.target);
      el.screen.classList.add('screen--dragging');
    }
    gesture.dx = dx;
    if (ev.cancelable) ev.preventDefault();
    // Скорость пальца к отпусканию: короткий рывок тоже перелистывает.
    var now = performance.now();
    if (now - gesture.lastT > 0) {
      gesture.fast = Math.abs(ev.clientX - gesture.lastX) / (now - gesture.lastT) > 0.55;
      gesture.lastX = ev.clientX;
      gesture.lastT = now;
    }
    // На краю списка страниц экран тянется с сопротивлением, без соседа.
    // В обратную сторону экран не уезжает: иначе между страницами появлялся бы зазор.
    var shift = gesture.edge ? dx * 0.24 : dx;
    if (!gesture.edge) shift = gesture.dir < 0 ? Math.min(0, shift) : Math.max(0, shift);
    var limit = gesture.edge ? gesture.width * 0.24 : gesture.width;
    shift = Math.max(-limit, Math.min(limit, shift));
    gesture.shift = shift;
    el.screen.style.transform = 'translate3d(' + shift.toFixed(1) + 'px,0,0)';
    if (gesture.peek) {
      var base = -gesture.dir * gesture.width;
      gesture.peek.style.transform = 'translate3d(' + (base + shift).toFixed(1) + 'px,0,0)';
    }
    if (!gesture.edge && !gesture.armed && Math.abs(shift) > gesture.width / 4) {
      gesture.armed = true;
      root.Tg.haptic('light');
    }
  });

  function pagePointerEnd(ev) {
    var gesture = pageSwipe;
    if (!gesture || ev.pointerId !== gesture.id) return;
    pageSwipe = null;
    releasePagePointer(gesture);
    if (ev.type === 'pointercancel' || gesture.axis !== 'x') {
      if (gesture.axis === 'x') clearPageSwipeStyles(gesture);
      return;
    }
    if (ev.cancelable) ev.preventDefault();
    if (Math.abs(gesture.dx) > 8) pageSwipeClickUntil = Date.now() + 350;
    settlePageSwipe(gesture, pageSwipeFlip(gesture));
  }
  document.addEventListener('pointerup', pagePointerEnd);
  document.addEventListener('pointercancel', pagePointerEnd);
  window.addEventListener('blur', function () {
    var gesture = pageSwipe;
    if (!gesture) return;
    pageSwipe = null;
    releasePagePointer(gesture);
    if (gesture.axis === 'x') clearPageSwipeStyles(gesture);
  });

  pageSurface.addEventListener('click', function (ev) {
    if (Date.now() < pageSwipeClickUntil) {
      ev.preventDefault(); ev.stopImmediatePropagation();
    }
  }, true);

  // Долгое нажатие на строке — путь удаления для мыши (на таче — свайп).
  // Слушаем document: перерисовка экрана не теряет состояние удержания.
  var hold = null;
  var holdStart = null;
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'touch') return;
    var tx = ev.target.closest && ev.target.closest('.tx');
    if (!tx) return;
    if (tx.classList.contains('finance-operation')) return;
    clearTimeout(hold);
    holdStart = { x: ev.clientX, y: ev.clientY };
    hold = setTimeout(function () {
      root.Tg.haptic('medium');
      openTxRow(tx);
    }, 450);
  });
  document.addEventListener('pointermove', function (ev) {
    if (!hold) return;
    if (holdStart && (Math.abs(ev.clientX - holdStart.x) > 8 || Math.abs(ev.clientY - holdStart.y) > 8)) {
      clearTimeout(hold);
    }
  });
  ['pointerup', 'pointercancel', 'scroll'].forEach(function (type) {
    root.addEventListener(type, function () { clearTimeout(hold); }, { passive: true });
  });

  // Открывает строку программно (без залипания в hover-состоянии мыши).
  function txActionWidth(tx) { return tx.querySelector('.tx__edit-inline') ? 176 : 88; }
  function openTxRow(tx) {
    closeSwipes(tx);
    tx.classList.add('tx--open');
    var r = tx.querySelector('[data-tx-row]');
    if (r) r.style.transform = 'translateX(-' + txActionWidth(tx) + 'px)';
    tx.querySelectorAll('[data-tx-delete],.tx__edit-inline').forEach(function (b) { b.tabIndex = 0; });
  }

  // Короткий тап по открытой строке закрывает её (долгий уже отработал).
  el.screen.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-tx-delete]') || ev.target.closest('[data-tx-more]')) return;
    if (ev.target.closest('.tx--open')) {
      clearTimeout(hold);
      closeSwipes();
    }
  });

  // --- Сводка: раскрытие категории ---

  // Категория на сводке: ищем обёртку по id, чтобы менять класс на месте.
  function categoryWrap(id) {
    var list = el.screen.querySelectorAll('.cat-wrap[data-cat-id]');
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute('data-cat-id') === id) return list[i];
    }
    return null;
  }

  // Класс переключаем на уже существующем узле, без полной перерисовки:
  // только так CSS-переход grid-template-rows успевает проиграть анимацию.
  function setCategoryOpen(wrap, open) {
    if (!wrap) return;
    wrap.classList.toggle('cat-wrap--open', open);
    var header = wrap.querySelector('[data-action="toggle-cat"]');
    if (header) header.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // Раскрыть/свернуть записи категории прямо на сводке.
  function toggleCategory(id) {
    var wrap = categoryWrap(id);
    if (!wrap) return;
    var grid = wrap.parentElement;
    var tiles = grid.classList.contains('categories--grid')
      ? Array.prototype.slice.call(grid.children) : [];
    var animate = !root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capture current visual positions, including an interrupted animation.
    var before = tiles.map(function (tile) { return tile.getBoundingClientRect(); });
    tiles.forEach(function (tile) {
      if (tile.categoryMotion) tile.categoryMotion.cancel();
    });
    if (expandedCat && expandedCat.id === id) {
      expandedCat = null;
      setCategoryOpen(wrap, false);
    } else {
      var prev = el.screen.querySelector('.cat-wrap--open');
      if (prev && prev !== wrap) setCategoryOpen(prev, false);
      root.Tg.haptic('light');
      expandedCat = { id: id, rows: null };
      setCategoryOpen(wrap, true);
      fillExpandedCat(null, id);
    }
    // Animate from the original tile edge; the existing accordion handles height.
    // Moving neighbours use the same transition when opening, closing or switching.
    tiles.forEach(function (tile, index) {
      if (!animate || !tile.animate) return;
      var after = tile.getBoundingClientRect();
      var old = before[index];
      var right = index % 2 === 1;
      var dx = right ? old.right - after.right : old.left - after.left;
      var dy = old.top - after.top;
      if (!after.width) return;
      tile.categoryMotion = tile.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scaleX(' + (old.width / after.width) + ')' },
        { transform: 'none' },
      ], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
  }

  // Догрузка строк раскрытой категории. Обновляем только список внутри
  // открытой карточки — шапка и остальная сводка не пересоздаются.
  function fillExpandedCat(s, id) {
    var month = st.month, seq = reqSeq, scope = memberScope(st.member);
    function current() { return month === st.month && seq === reqSeq && scope === memberScope(st.member) && expandedCat && expandedCat.id === id; }
    loadTx(month).then(function (all) {
      if (!current()) return;
      var rows = (all || []).filter(function (t) { return t.category_id === id; });
      expandedCat = { id: id, rows: rows };
      var wrap = categoryWrap(id);
      var rowsEl = wrap && wrap.querySelector('.cat-tx__rows');
      if (!rowsEl || !wrap.classList.contains('cat-wrap--open')) return;
      // Если в разметке уже тот же набор строк из кэша — не трогаем узлы,
      // иначе каскад строк запустится повторно.
      var sameCount = rowsEl.getAttribute('data-count') === String(rows.length);
      if (sameCount && (rows.length > 0 || rowsEl.querySelector('.cat-tx__empty'))) return;
      rowsEl.innerHTML = Views.categoryTxList(rows, true, id);
      rowsEl.setAttribute('data-count', String(rows.length));
    }).catch(function (err) {
      if (!current() || err.code === 'stale_response') return;
      expandedCat = { id: id, rows: [] };
      var wrap = categoryWrap(id);
      var rowsEl = wrap && wrap.querySelector('.cat-tx__rows');
      if (!rowsEl || !wrap.classList.contains('cat-wrap--open')) return;
      if (!rowsEl.querySelector('.cat-tx__row') && !rowsEl.querySelector('.cat-tx__empty')) {
        rowsEl.innerHTML = Views.categoryTxList([], true);
        rowsEl.setAttribute('data-count', '0');
      }
    });
  }

  root.AppState = {
    isDeleting: function (id) { return !!deletingTx[id]; },
  };

  function refreshOnReturn() {
    if (!st.member || lifecycleRequest) return lifecycleRequest;
    var seq = reqSeq;
    lifecycleRequest = loadMember().then(function (me) {
      if (!me) { reqSeq++; return render(Views.renderOnboarding(onboarding)); }
      if (editingTx || route.name === 'add') return;
      if (seq !== reqSeq && route.name !== 'summary' && route.name !== 'tx') return;
      if (route.name === 'summary') openSummary(true);
      else if (route.name === 'tx') openTx(undefined, true);
      else if (route.name === 'plans') openPlans();
      // Categories may have changed on another device; refresh after critical loads start.
      loadCategories(true).catch(function (err) { if (err.code !== 'stale_response') toast(T('Не удалось обновить категории')); });
    }).catch(function (err) { if (err.code !== 'stale_response') toast(T('Не удалось обновить — показываем сохранённое')); })
      .finally(function () { lifecycleRequest = null; });
    return lifecycleRequest;
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshOnReturn(); });
  root.addEventListener('pageshow', function (ev) { if (ev.persisted) refreshOnReturn(); });

  // --- Старт ---

  function markHomeScreenAdded() {
    clearHomeScreenAttempt();
    st.homeScreenStatus = 'added';
    if (homeScreenFallbackOpen) closeDialog(true);
    if (route.name === 'settings' && !route.section) render(Views.renderSettings());
    toast(T('Ярлык добавлен'));
  }

  function boot() {
    document.documentElement.lang = I18n.locale();
    document.title = T('Бюджет пары');
    var loaderText = document.querySelector('.loader__text');
    if (loaderText) loaderText.textContent = T('Загружаем бюджет…');
    if (typeof root.Tg.onHomeScreenAdded === 'function') root.Tg.onHomeScreenAdded(markHomeScreenAdded);
    if (typeof root.Tg.setThemeMode === 'function') root.Tg.setThemeMode(State.themeMode());
    var coversReady = root.Covers && typeof root.Covers.loadCustom === 'function'
      ? root.Covers.loadCustom().catch(function () { return null; })
      : Promise.resolve(null);
    root.Tg.init().then(function () {
      refreshHomeScreenStatus();
      if (!root.Tg.isInsideTelegram()) {
        console.info(T('Mini App открыт вне Telegram — демо-режим.'));
      }
      return Promise.all([loadMember(), coversReady]);
    }).then(function (result) {
      var me = result[0];
      hideLoader();
      if (!me) render(Views.renderOnboarding(onboarding));
      else openSummary(true);
    }).catch(function (err) {
      hideLoader();
      fail(err);
    });
  }

  boot();
})(window);
