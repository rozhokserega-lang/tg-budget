/**
 * Роутер и обработчики: онбординг → сводка / траты / добавление / настройки.
 * Разметка — в views.js, запросы — через Api.call(action, params).
 */

(function (root) {
  var $ = function (sel) { return document.querySelector(sel); };
  var el = {
    header: $('#screen-header'),
    screen: $('#screen'),
    tabs: $('#tabs'),
    loader: $('#loader'),
    toast: $('#toast'),
    dialog: $('#dialog'),
    dialogText: $('#dialog-text'),
    dialogOk: $('#dialog-ok'),
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
  // Раскрытая категория на сводке: { id, rows } или null.
  var expandedCat = null;
  // Категория, из которой открыли форму: после сохранения вернёмся к ней.
  var pendingFromCategory = null;

  var ICON = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var TABS = [
    { id: 'summary', icon: ICON('<path d="M5 20v-7M12 20V5M19 20v-10"/>'), label: 'Сводка' },
    { id: 'tx', icon: ICON('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'), label: 'Траты' },
    { id: 'plans', icon: ICON('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'), label: 'Планы' },
    { id: 'add', icon: ICON('<path d="M12 5v14M5 12h14"/>'), label: 'Добавить', primary: true },
    { id: 'settings', icon: ICON('<path d="M3 7h11M18 7h3M3 17h3M10 17h11"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'), label: 'Ещё' },
  ];
  var plansTab = 'goals';

  // --- UI-помощники ---

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
      el.dialogOk.textContent = okLabel || 'Удалить';
      el.dialog.hidden = false;
    });
  }

  function closeDialog(result) {
    el.dialog.hidden = true;
    if (dialogResolve) dialogResolve(result);
    dialogResolve = null;
  }

  function openSheet(html) {
    el.sheetBody.innerHTML = html;
    el.sheet.hidden = false;
    root.Tg.backButton(closeSheet);
  }

  var sheetTimer = null;
  function closeSheet() {
    clearTimeout(sheetTimer);
    if (el.sheet.hidden) {
      el.sheetBody.innerHTML = '';
    } else {
      // Плавное закрытие: панель уезжает вниз, фон гаснет (см. polish.css).
      el.sheet.classList.add('sheet--closing');
      sheetTimer = setTimeout(function () {
        el.sheet.hidden = true;
        el.sheet.classList.remove('sheet--closing');
        el.sheetBody.innerHTML = '';
      }, 170);
    }
    syncBackButton();
  }

  function hideLoader() {
    el.loader.hidden = true;
  }

  // Системная «Назад» ведёт из формы добавления на сводку, из остальных мест — недоступна.
  function syncBackButton() {
    if (route.name === 'add') return root.Tg.backButton(goHome);
    // Лимиты — подэкран настроек: «Назад» возвращает к ним.
    if (route.name === 'limits') return root.Tg.backButton(openSettings);
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
    var active = route.name === 'add' ? 'summary' : route.name;
    // Меню создаём один раз: перерисовка на каждом переходе вызывала мигание иконок.
    if (el.tabs.children.length !== TABS.length) {
      el.tabs.innerHTML = TABS.map(function (t) {
        return '<button type="button" class="tab' + (t.primary ? ' tab--primary' : '') + '" data-tab="' + t.id + '">' +
          '<span class="tab__icon">' + t.icon + '</span><span>' + t.label + '</span></button>';
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
  function render(html) {
    el.screen.innerHTML = html;
    el.screen.scrollTop = 0;
    // Анимация появления — только при смене экрана, не при каждом обновлении данных.
    if (route.name !== lastScreen) {
      lastScreen = route.name;
      el.screen.classList.remove('screen--in');
      void el.screen.offsetWidth;
      el.screen.classList.add('screen--in');
      clearTimeout(enterTimer);
      enterTimer = setTimeout(function () { el.screen.classList.remove('screen--in'); }, 700);
    }
    applyRouteUi();
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
      st.member = null;
      return false;
    }
    var opts = {
      icon: '📡',
      title: 'Не удалось загрузить',
      text: (err && err.message) || 'Проверьте соединение и попробуйте ещё раз.',
      retry: true,
    };
    if (code === 'unauthorized') {
      opts = {
        icon: '🔒',
        title: 'Нужен доступ из бота',
        text: 'Откройте приложение кнопкой «Открыть бюджет» в Telegram-боте.',
        retry: false,
      };
    } else if (code === 'no_config') {
      opts = {
        icon: '⚙️',
        title: 'Не настроено',
        text: 'В index.html укажите APP_API_URL — адрес Edge Function `api`.',
        retry: false,
      };
    } else if (code === 'subscription_expired') {
      opts = {
        icon: '⌛',
        title: 'Пробный период закончился',
        text: 'Добавлять записи нельзя. Активируйте промокод, чтобы восстановить доступ.',
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

  function loadMember() {
    return Api.call('me').then(function (res) {
      if (!res || !res.member) {
        // Пустой ответ `{}` (me) значит, что пользователь ещё не в семье, а не ошибку сети.
        st.member = null;
        return null;
      }
      st.member = res.member;
      st.promo = Array.isArray(res.promo) ? res.promo : [];
      return st.member;
    });
  }

  // Планы подтягиваем лениво и мягко: сводка не должна падать из-за них.
  function loadPlans(force) {
    if (!force && st.plans) return Promise.resolve(st.plans);
    return Promise.all([
      Api.call('list_plans'),
      Api.call('list_recurring').catch(function () { return []; }),
    ]).then(function (res) {
      var p = res[0];
      var rec = Array.isArray(res[1]) ? res[1] : [];
      st.plans = {
        goals: Array.isArray(p.goals) ? p.goals : [],
        debts: Array.isArray(p.debts) ? p.debts : [],
        wishes: Array.isArray(p.wishes) ? p.wishes : [],
        recurring: rec,
      };
      return st.plans;
    }).catch(function () {
      return st.plans || { goals: [], debts: [], wishes: [], recurring: [] };
    });
  }

  function loadCategories() {
    if (st.categories) return Promise.resolve(st.categories);
    return Api.call('categories').then(function (list) {
      st.categories = Array.isArray(list) ? list : [];
      return st.categories;
    });
  }

  // Нет очереди — можно отдать кэш; иначе запрашиваем свежее (сервер уже учёл запись).
  function fresh() {
    return !(root.Queue && Queue.size());
  }

  // Кэш сводок на 5 минут: повторный листинг месяцев не ходит на сервер.
  var CACHE_TTL = 5 * 60 * 1000;

  function clearCache() {
    Object.keys(st).forEach(function (k) {
      if (k.indexOf('summaryCache:') === 0 || k.indexOf('txCache:') === 0) delete st[k];
    });
  }

  function cached(key, value) {
    if (value === undefined) {
      var hit = st[key];
      return hit && Date.now() - hit.at < CACHE_TTL ? hit.data : null;
    }
    st[key] = { data: value, at: Date.now() };
  }

  function loadSummary(month) {
    var hit = cached('summaryCache:' + month);
    if (hit && fresh()) return Promise.resolve(hit);
    return Api.call('summary', { month: month }).then(function (s) {
      cached('summaryCache:' + month, s);
      st.lastSummary = s;
      return s;
    });
  }

  // Тихо подгружаем соседние месяцы, чтобы листание было мгновенным.
  function prefetchMonths(month) {
    ['-1', '1'].forEach(function (step) {
      var next = Fmt.shiftMonth(month, Number(step));
      if (next > Fmt.currentMonth()) return;
      if (cached('summaryCache:' + next) || cached('txCache:' + next)) return;
      Api.call('summary', { month: next }).then(function (s) { cached('summaryCache:' + next, s); }).catch(function () {});
      Api.call('list_tx', { month: next }).then(function (list) { cached('txCache:' + next, list || []); }).catch(function () {});
    });
  }

  function loadTx(month) {
    var hit = cached('txCache:' + month);
    if (hit && fresh()) return Promise.resolve(hit);
    return Api.call('list_tx', { month: month }).then(function (list) {
      var data = Array.isArray(list) ? list : [];
      cached('txCache:' + month, data);
      return data;
    });
  }

  // --- Экраны ---

  function openSummary() {
    route = { name: 'summary' };
    render(Views.skeletonSummary());
    var seq = ++reqSeq;
    var month = st.month;
    loadSummary(month).then(function (s) {
      if (seq !== reqSeq) return;
      render(Views.renderSummary(s, null, expandedCat));
      prefetchMonths(month);
      // Категория была раскрыта (например, только что добавили запись) — догружаем её строки.
      if (expandedCat && !expandedCat.rows) fillExpandedCat(s, expandedCat.id);
      if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
      // Планы подтягиваем вторым шагом, чтобы не задерживать сводку.
      loadPlans().then(function (plans) {
        if (seq === reqSeq && route.name === 'summary') {
          render(Views.renderSummary(s, plans, expandedCat));
          // banner() вставляет узел в DOM — повторный render() его стёр бы.
          if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
        }
      });
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      // Сеть недоступна: показываем кэш (если он есть) и плашку «нет связи»,
      // чтобы только что добавленная запись не исчезла.
      var cachedS = cached('summaryCache:' + month) || st.lastSummary;
      if (cachedS) {
        render(Views.renderSummary(cachedS));
        banner('Нет связи с сервером — показываем сохранённое');
        return;
      }
      fail(err);
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
  function openTx(categoryId) {
    route = { name: 'tx' };
    if (categoryId !== undefined) st.txFilter = categoryId || null;
    render(Views.skeletonList());
    var seq = ++reqSeq;
    var month = st.month;
    loadTx(month).then(function (all) {
      if (seq !== reqSeq) return;
      var list = filterTx(all, st.txFilter);
      render(Views.renderTxList(list, st.txFilter));
      if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      fail(err);
    });
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
    form = {
      category_id: preset || saved.category_id,
      kind: preset ? (params.kind || 'expense') : (saved.kind || 'expense'),
      amount: preset ? '' : saved.amount,
      note: preset ? '' : saved.note,
      date: preset ? Fmt.todayIso() : saved.date,
      is_shared: preset ? true : saved.is_shared,
    };
    render(Views.skeletonList());
    loadCategories().then(function () {
      pendingFromCategory = preset || null;
      render(Views.renderForm(form));
      if (State.isExpired()) banner('Пробный период закончился — добавлять записи нельзя.');
    }).catch(function (err) {
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
      is_shared: shared ? shared.checked : true,
    };
  }

  function openSettings() {
    route = { name: 'settings' };
    loadPlans().then(function () {
      if (route.name === 'settings') render(Views.renderSettings());
    });
    loadTariffs();
    // Категории нужны для счётчика лимитов в настройках и экрана лимитов.
    loadCategories().then(function () {
      if (route.name === 'settings') render(Views.renderSettings());
    }).catch(function () {});
    render(Views.renderSettings());
  }

  function loadTariffs() {
    return Api.call('plans').then(function (list) {
      st.tariffs = Array.isArray(list) ? list : [];
    }).catch(function () {
      st.tariffs = st.tariffs || [];
    }).then(function () {
      if (route.name === 'settings') render(Views.renderSettings());
    });
  }

  // Покупка доступа за Telegram Stars: счёт создаёт сервер, оплату открывает Telegram,
  // доступ продлевает бот по successful_payment — здесь только ждём и обновляем.
  function buyTariff(code) {
    if (st.buying) return;
    st.buying = true;
    render(Views.renderSettings());
    Api.call('create_invoice', { plan: code }).then(function (res) {
      var tg = root.Tg.sdk();
      if (!tg || !tg.openInvoice) {
        st.buying = false;
        render(Views.renderSettings());
        toast('Оплата доступна только в Telegram');
        return;
      }
      tg.openInvoice(res.url, function (status) {
        st.buying = false;
        if (status === 'paid') {
          // Вебхук бота может прийти на секунду позже — перечитываем статус.
          setTimeout(function () {
            loadMember().then(function () {
              if (st.member && st.member.households) clearCache();
              toast('Спасибо! Доступ продлён');
              if (route.name === 'settings') render(Views.renderSettings());
            });
          }, 1500);
        } else {
          toast(status === 'cancelled' ? 'Оплата отменена' : 'Оплата не прошла');
          if (route.name === 'settings') render(Views.renderSettings());
        }
      });
    }).catch(function (err) {
      st.buying = false;
      if (route.name === 'settings') render(Views.renderSettings());
      if (err.code === 'telegram_error') return toast('Не удалось создать счёт');
      toast(err.message || 'Не удалось создать счёт');
    });
  }

  // --- Планы ---

  function openPlans(tab) {
    if (tab) plansTab = tab;
    route = { name: 'plans' };
    render(Views.skeletonList());
    var seq = ++reqSeq;
    loadPlans(true).then(function (plans) {
      if (seq !== reqSeq) return;
      render(Views.renderPlans(plans, plansTab));
      if (State.isExpired()) banner('Пробный период закончился — изменения недоступны.');
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      fail(err);
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
    var id = formEl.getAttribute('data-id') || undefined;
    var v = formEl.elements;
    var amt = Fmt.parseAmount(v.amount.value);
    var day = parseInt(v.day.value, 10);
    if (!v.name.value.trim()) return badInput('Введите название', v.name);
    if (!(amt > 0)) return badInput('Укажите сумму', v.amount);
    if (!(day >= 1 && day <= 31)) return badInput('День от 1 до 31', v.day);
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
    toast('Платёж сохранён');
    openPlans();

    var op = Queue.push('save_recurring', { id: id, name: v.name.value, amount: amt, day_of_month: day, category_id: catId });
    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      st.plans = null;
    });
    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      st.plans = null;
      root.Tg.haptic('error');
      toast(ev.detail.error && ev.detail.error.message || 'Не сохранилось');
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
      if (!(payload.target > 0)) return badInput('Укажите сумму цели', v.target);
      if (isNaN(payload.saved) || isNaN(payload.monthly)) return badInput('Проверьте суммы', v.saved);
      if (payload.saved > payload.target) return badInput('Накоплено не может быть больше цели', v.saved);
    } else if (kind === 'debts') {
      action = 'save_debt';
      payload.total = Fmt.parseAmount(v.total.value);
      payload.remaining = v.remaining.value ? Fmt.parseAmount(v.remaining.value) : payload.total;
      payload.monthly = v.monthly.value ? Fmt.parseAmount(v.monthly.value) : 0;
      payload.creditor = v.creditor.value.trim();
      if (!(payload.total > 0)) return badInput('Укажите сумму долга', v.total);
      if (isNaN(payload.remaining) || isNaN(payload.monthly)) return badInput('Проверьте суммы', v.remaining);
      if (payload.remaining > payload.total) return badInput('Остаток больше суммы долга', v.remaining);
    } else {
      action = 'save_wish';
      payload.price = Fmt.parseAmount(v.price.value);
      payload.priority = v.priority.value;
      payload.goal_id = v.goal_id && v.goal_id.value ? v.goal_id.value : null;
      if (!(payload.price > 0)) return badInput('Укажите цену', v.price);
    }
    if (!payload.name.trim()) return badInput('Введите название', v.name);

    btn.disabled = true;
    Api.call(action, payload).then(function () {
      root.Tg.haptic('success');
      closeSheet();
      toast('Сохранено');
      openPlans();
    }).catch(function (err) {
      btn.disabled = false;
      root.Tg.haptic('error');
      if (err.code === 'subscription_expired') { closeSheet(); fail(err); return; }
      toast(err.message || 'Не удалось сохранить');
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
    if (!(amount > 0) || isNaN(amount)) return toast('Введите сумму');
    Api.call(action, { id: id, amount: amount }).then(function () {
      root.Tg.haptic('success');
      toast(label);
      openPlans();
    }).catch(function (err) {
      root.Tg.haptic('error');
      if (err.code === 'subscription_expired') return fail(err);
      toast(err.message || 'Не получилось');
    });
  }

  function removePlan(kind, id) {
    var labels = { goals: ['Удалить цель?', 'delete_goal'], debts: ['Удалить долг?', 'delete_debt'], wishes: ['Удалить желание?', 'delete_wish'] };
    var l = labels[kind];
    dialog(l[0], 'Удалить').then(function (ok) {
      if (!ok) return;
      Api.call(l[1], { id: id }).then(function () {
        root.Tg.haptic('success');
        toast('Удалено');
        openPlans();
      }).catch(function (err) {
        root.Tg.haptic('error');
        if (err.code === 'subscription_expired') return fail(err);
        toast(err.message || 'Не удалось удалить');
      });
    });
  }

  // --- Удаление аккаунта ---

  function deleteAccount() {
    if (st.deleting) return;
    dialog('Удалить аккаунт вместе со всей семьёй и записями? Это необратимо.', 'Удалить').then(function (ok) {
      if (!ok) return;
      st.deleting = true;
      if (route.name === 'settings') render(Views.renderSettings());
      Api.call('delete_my_account').then(function () {
        root.Tg.haptic('success');
        State.reset();
        st.member = null;
        st.plans = null;
        st.promo = [];
        st.tariffs = null;
        st.deleting = false;
        onboarding = { tab: 'create', member_name: '', code: '', household_name: '' };
        toast('Аккаунт удалён');
        render(Views.renderOnboarding(onboarding));
      }).catch(function (err) {
        st.deleting = false;
        if (route.name === 'settings') render(Views.renderSettings());
        root.Tg.haptic('error');
        toast(err.message || 'Не удалось удалить аккаунт');
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

  // Показываем только выбранную категорию, если фильтр включён.
  function filterTx(list, categoryId) {
    if (!categoryId) return list;
    return (list || []).filter(function (t) { return t.category_id === categoryId; });
  }

  // Сброс фильтра: кнопка «Все траты» в шапке списка.
  function clearTxFilter() {
    st.txFilter = null;
    openTx();
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
    var id = formEl.getAttribute('data-id') || undefined;
    var v = formEl.elements;
    var raw = String(v.plan.value || '').trim();
    var plan = raw ? Fmt.parseAmount(raw) : 0;
    var btn = formEl.querySelector('[type="submit"]');
    if (isNaN(plan) || plan < 0) return badInput('Проверьте лимит', v.plan);
    if (!id && !v.name.value.trim()) return badInput('Введите название', v.name);
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
    toast(id ? 'Лимит сохранён' : 'Категория добавлена');
    if (route.name === 'limits') openLimits();
    else openSummary();

    var payload = { id: id, kind: id ? undefined : catKind, name: v.name.value, icon: v.icon.value, plan_monthly: plan };
    var op = Queue.push('save_category', payload);
    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      st.categories = null;   // подтянем реальные id с сервера
    });
    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      var code = ev.detail.error && ev.detail.error.code;
      st.categories = null;      // перечитаем с сервера — локальная правка откатилась
      clearCache();
      root.Tg.haptic('error');
      if (code === 'category_exists') toast('Такая категория уже есть');
      else toast(ev.detail.error && ev.detail.error.message || 'Не сохранилось');
      if (route.name === 'limits') openLimits();
    });
  }

  function removeRecurring(id) {
    dialog('Удалить напоминание о платеже?', 'Удалить').then(function (ok) {
      if (!ok) return;
      Api.call('delete_recurring', { id: id }).then(function () {
        root.Tg.haptic('success');
        st.plans = null;
        toast('Удалено');
        openPlans();
      }).catch(function (err) { toast(err.message || 'Не удалось удалить'); });
    });
  }

  function deleteCategory(id) {
    var msg = 'Удалить категорию? Траты этой категории останутся в истории, а категория скроется из списка.';
    dialog(msg, 'Удалить').then(function (ok) {
      if (!ok) return;
      Api.call('archive_category', { id: id }).then(function (res) {
        root.Tg.haptic('success');
        st.categories = null;
        clearCache();
        closeSheet();
        toast(res.archived ? 'Категория скрыта' : 'Категория удалена');
        if (route.name === 'limits') openLimits();
        else openSummary();
      }).catch(function (err) {
        root.Tg.haptic('error');
        toast(err.message || 'Не удалось удалить');
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

  function toggleNotification(el) {
    var key = el.getAttribute('data-notif');
    var current = (st.member && st.member.notifications) || { payments: true, limits: true, digest: false };
    var next = Object.assign({}, current);
    next[key] = !!el.checked;
    // Оптимистично: переключатель уже нажат.
    st.member = Object.assign({}, st.member, { notifications: next });
    Api.call('save_notifications', { notifications: next }).then(function (res) {
      if (res && res.notifications) {
        st.member = Object.assign({}, st.member, { notifications: res.notifications });
      }
      root.Tg.haptic('light');
      toast(next[key] ? 'Включено' : 'Выключено');
    }).catch(function (err) {
      el.checked = !el.checked;
      st.member = Object.assign({}, st.member, { notifications: current });
      root.Tg.haptic('error');
      toast(err.message || 'Не удалось сохранить');
    });
  }

  // --- Промокод ---

  function redeemPromo(code) {
    code = String(code || '').trim();
    if (!code) return toast('Введите промокод');
    return Api.call('redeem_promo', { code: code }).then(function (res) {
      root.Tg.haptic('success');
      clearCache();
      return loadMember().then(function () {
        toast('Доступ до ' + Fmt.dayLabel(res.plan_until));
        if (route.name === 'settings') render(Views.renderSettings());
      });
    }).catch(function (err) {
      root.Tg.haptic('error');
      if (err.code === 'bad_promo') return toast('Такого промокода нет');
      if (err.code === 'promo_used') return toast('Этот код уже активирован');
      toast(err.message || 'Не удалось активировать');
    });
  }

  function openTab(tab) {
    if (!st.member) return;
    if (tab === 'summary') openSummary();
    else if (tab === 'tx') openTx(null);
    else if (tab === 'plans') openPlans();
    else if (tab === 'add') openAdd();
    else if (tab === 'settings') openSettings();
  }

  // --- Действия ---

  function submitAdd(formEl) {
    var values = formValues();
    var amount = Fmt.parseAmount(values.amount);
    var btn = formEl.querySelector('[type="submit"]');
    if (!(amount > 0) || amount > 1e9) {
      root.Tg.haptic('error');
      toast('Введите сумму цифрами');
      formEl.elements.amount.focus();
      return;
    }
    if (!values.category_id) {
      root.Tg.haptic('error');
      toast('Выберите категорию');
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
    // Оптимистично: форма закрывается сразу, запись уже на экране.
    var local = optimisticTx(payload);
    applyLocalTx(local);
    st.month = occurred.slice(0, 7);
    if (fromCategory && fromCategory === values.category_id) expandedCat = { id: fromCategory, rows: null };
    form = {};
    btn.disabled = true;
    root.Tg.haptic('success');
    toast('Записано');
    openSummary();

    var op = Queue.push('add_tx', Object.assign({ local_id: local.id }, payload));
    pendingAdds[op.id] = local;

    root.addEventListener('queue-sent', function onSent(ev) {
      if (ev.detail.id !== op.id) return;
      root.removeEventListener('queue-sent', onSent);
      delete pendingAdds[op.id];
      var tx = ev.detail.result;
      if (tx && tx.id) local._serverId = tx.id;
      clearCache();
      // Сервер подтвердил — перерисовываем, чтобы убрать «отправляется».
      if (route.name === 'summary') openSummary();
      if (route.name === 'tx') openTx();
    });

    root.addEventListener('queue-failed', function onFailed(ev) {
      if (ev.detail.op.id !== op.id) return;
      root.removeEventListener('queue-failed', onFailed);
      delete pendingAdds[op.id];
      root.Tg.haptic('error');
      var code = ev.detail.error && ev.detail.error.code;
      // Откатываем локальную запись: сервер её не принял.
      removeOptimisticTx(local);
      if (code === 'subscription_expired') fail(ev.detail.error);
      else toast('Не сохранилось: ' + ((ev.detail.error && ev.detail.error.message) || 'ошибка'));
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
    dialog('Удалить эту запись?', 'Удалить').then(function (ok) {
      if (!ok) return;
      // Оптимистично: убираем из кэшей сразу, сервер догонит.
      var removed = null;
      Object.keys(st).forEach(function (k) {
        if (k.indexOf('txCache:') !== 0) return;
        ((st[k] || {}).data || []).forEach(function (t) { if (t.id === id) removed = t; });
      });
      // Кэш месяца инвалидируем в любом случае (removeLocalTx) — список перерисуется
      // с сервера с учётом отправленной операции.
      if (removed) removeOptimisticTx(removed);
      removeLocalTx(id);
      root.Tg.haptic('success');
      toast('Удалено');
      closeSwipes();
      if (route.name === 'tx') openTx();
      else openSummary();

      var op = Queue.push('delete_tx', { id: id });
      root.addEventListener('queue-sent', function onSent(ev) {
        if (ev.detail.id !== op.id) return;
        root.removeEventListener('queue-sent', onSent);
        delete deletingTx[id];
      });
      root.addEventListener('queue-failed', function onFailed(ev) {
        if (ev.detail.op.id !== op.id) return;
        root.removeEventListener('queue-failed', onFailed);
        delete deletingTx[id];
        root.Tg.haptic('error');
        toast('Не удалилось: ' + ((ev.detail.error && ev.detail.error.message) || 'ошибка'));
        clearCache();
        if (route.name === 'tx') openTx();
      });
    });
  }

  function pickCategory(id, chip) {
    form.category_id = id;
    form.amount = formValues().amount;
    root.Tg.haptic('light');
    el.screen.querySelectorAll('.cat-chip').forEach(function (c) { c.classList.remove('cat-chip--active'); });
    chip.classList.add('cat-chip--active');
  }

  function pickKind(kind) {
    var values = formValues();
    form = Object.assign({}, values, { kind: kind, category_id: '' });
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
        toast('Введите код приглашения');
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
          toast('Семья не найдена, попробуйте ещё раз');
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
      toast(err.message || 'Не получилось');
    });
  }

  // --- События ---

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

    render(Views.renderSummary(s, st.plans, expandedCat));
    if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
    el.screen.scrollTop = Math.max(0, scroll - hiddenAbove);
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

  // Делегирование на document: кнопки часто перерисовываются самим обработчиком,
  // и слушатель, привязанный к контейнеру экрана, может не дожить до клика.
  document.addEventListener('click', function (ev) {
    var tabBtn = ev.target.closest('[data-tab]');
    if (tabBtn) {
      openTab(tabBtn.getAttribute('data-tab'));
      return;
    }

    var actionBtn = ev.target.closest('[data-action]');
    if (!actionBtn) return;
    var action = actionBtn.getAttribute('data-action');

    // Раскрытие категории не должно срабатывать на скролле.
    var scrolled = isScrollGesture();
    scrollAtTouch = null;
    if (action === 'toggle-cat' && scrolled) return;

    switch (action) {
      case 'month-prev': changeMonth(-1); break;
      case 'month-next': changeMonth(1); break;
      case 'go-tx': openTx(null); break;
      case 'tx-clear-filter': clearTxFilter(); break;

      case 'toggle-cat': toggleCategory(actionBtn.getAttribute('data-id')); break;
      case 'add-in-cat': openAdd({ category_id: actionBtn.getAttribute('data-id'), kind: 'expense' }); break;
      case 'open-cat-tx':
        openTx(actionBtn.getAttribute('data-id'));
        break;
      case 'go-add': openAdd(); break;
      case 'refresh':
        clearCache();
        st.categories = null;
        toast('Обновлено');
        openTab(route.name === 'settings' ? 'summary' : route.name);
        break;
      case 'retry': goHome(); break;
      case 'start': goHome(); break;
      case 'go-plans': openPlans(); break;
      case 'go-recurring': openPlans('recurring'); break;
      case 'go-settings': openSettings(); break;
      case 'buy': buyTariff(actionBtn.getAttribute('data-buy')); break;
      case 'delete-account': deleteAccount(); break;
      case 'edit-cat': openCategoryForm(actionBtn.getAttribute('data-id')); break;
      case 'open-cat': openLimits(actionBtn.getAttribute('data-id')); break;
      case 'add-cat': openCategoryForm(null, actionBtn.getAttribute('data-kind')); break;
      case 'go-limits': openLimits(); break;
      case 'cat-kind':
        catKind = actionBtn.getAttribute('data-kind');
        el.sheetBody.querySelectorAll('[data-action="cat-kind"]').forEach(function (b) {
          b.classList.toggle('segment--active', b === actionBtn);
        });
        break;
      case 'delete-cat': deleteCategory(actionBtn.getAttribute('data-id')); break;
      case 'plans-tab': plansTab = actionBtn.getAttribute('data-plans'); openPlans(); break;
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
        toast('Демо-данные сброшены');
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
    else if (kind === 'plan') submitPlan(f);
    else if (kind === 'category') submitCategory(f);
    else if (kind === 'promo') redeemPromo(f.elements.code.value);
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
            category_id: rec.category_id, categories: rec.categories,
          });
        });
      }
      if (ev.target.closest('[data-recurring-pay]')) {
        // Оптимистично: платеж уходит в очередь, список обновляется сразу.
        root.Tg.haptic('success');
        clearCache();
        toast('Оплата записана');
        var payOp = Queue.push('pay_recurring', { id: recId });
        root.addEventListener('queue-failed', function onFailed(e2) {
          if (e2.detail.op.id !== payOp.id) return;
          root.removeEventListener('queue-failed', onFailed);
          root.Tg.haptic('error');
          toast(e2.detail.error && e2.detail.error.message || 'Не удалось записать');
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

  el.screen.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t && t.matches && t.matches('[data-notif]')) toggleNotification(t);
  });

  el.sheet.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-sheet-close]')) closeSheet();
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
      if (more) more.textContent = card.classList.contains('plan--open') ? 'Удалить' : '···';
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
      if (kind === 'goal') planAction('add_to_goal', id, value, 'Добавлено');
      else planAction('pay_debt', id, value, 'Выплачено');
      return;
    }

    var pay = ev.target.closest('[data-debt-pay]');
    if (pay) {
      var raw = pay.getAttribute('data-debt-pay');
      // «весь остаток» — сумма берётся из data-remaining на карточке.
      var amt = raw === 'all' ? Number(card.getAttribute('data-remaining') || 0) : Number(raw);
      planAction('pay_debt', id, amt, 'Выплачено');
      return;
    }

    var buy = ev.target.closest('[data-wish-buy]');
    if (buy) {
      Api.call('buy_wish', { id: id }).then(function () {
        root.Tg.haptic('success');
        toast('Отмечено купленным');
        openPlans();
      }).catch(function (err) { toast(err.message || 'Не удалось'); });
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
    });
  }

  el.screen.addEventListener('touchstart', function (ev) {
    var row = ev.target.closest('[data-tx-row]');
    if (!row || ev.touches.length !== 1) return;
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

  // Долгое нажатие на строке — путь удаления для мыши (на таче — свайп).
  // Слушаем document: перерисовка экрана не теряет состояние удержания.
  var hold = null;
  var holdStart = null;
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'touch') return;
    var tx = ev.target.closest && ev.target.closest('.tx');
    if (!tx) return;
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
  function openTxRow(tx) {
    closeSwipes(tx);
    tx.classList.add('tx--open');
    var r = tx.querySelector('[data-tx-row]');
    if (r) r.style.transform = 'translateX(-88px)';
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

  // Раскрыть/свернуть записи категории прямо на сводке.
  function toggleCategory(id) {
    if (expandedCat && expandedCat.id === id) {
      expandedCat = null;
      renderSummaryFromCache();
      return;
    }
    root.Tg.haptic('light');
    expandedCat = { id: id, rows: null };
    renderSummaryFromCache();      // заголовок разворачиваем сразу, записи догрузим
    fillExpandedCat(null, id);
  }

  // Догрузка строк раскрытой категории.
  function fillExpandedCat(s, id) {
    loadTx(st.month).then(function (all) {
      if (!expandedCat || expandedCat.id !== id) return;
      expandedCat = { id: id, rows: (all || []).filter(function (t) { return t.category_id === id; }) };
      renderSummaryFromCache();
    }).catch(function () {
      if (!expandedCat || expandedCat.id !== id) return;
      expandedCat = { id: id, rows: [] };
      renderSummaryFromCache();
    });
  }

  root.AppState = {
    isDeleting: function (id) { return !!deletingTx[id]; },
  };

  // --- Старт ---

  function boot() {
    root.Tg.init().then(function () {
      if (!root.Tg.isInsideTelegram()) {
        console.info('Mini App открыт вне Telegram — демо-режим.');
      }
      return loadMember();
    }).then(function (me) {
      hideLoader();
      if (!me) render(Views.renderOnboarding(onboarding));
      else openSummary();
    }).catch(function (err) {
      hideLoader();
      fail(err);
    });
  }

  boot();
})(window);
