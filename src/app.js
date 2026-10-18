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
  };

  var st = State.get();
  var route = { name: 'summary', tab: 'summary' };
  var form = {};
  var onboarding = { tab: 'create', member_name: '', code: '', household_name: '' };
  var reqSeq = 0;
  var dialogResolve = null;

  var TABS = [
    { id: 'summary', icon: '📊', label: 'Сводка' },
    { id: 'tx', icon: '🧾', label: 'Траты' },
    { id: 'add', icon: '＋', label: 'Добавить', primary: true },
    { id: 'settings', icon: '⚙️', label: 'Ещё' },
  ];

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

  function hideLoader() {
    el.loader.hidden = true;
  }

  // Системная «Назад» ведёт из формы добавления на сводку, из остальных мест — недоступна.
  function syncBackButton() {
    root.Tg.backButton(route.name === 'add' && !!st.member ? goHome : null);
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
    var active = route.name === 'add' ? 'add' : route.name;
    el.tabs.innerHTML = TABS.map(function (t) {
      var cls = 'tab' + (t.primary ? ' tab--primary' : '') + (t.id === active ? ' tab--active' : '');
      return '<button type="button" class="' + cls + '" data-tab="' + t.id + '">' +
        '<span class="tab__icon">' + t.icon + '</span><span>' + t.label + '</span></button>';
    }).join('');
    syncBackButton();
  }

  function render(html) {
    el.screen.innerHTML = html;
    el.screen.scrollTop = 0;
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
        text: 'Добавлять записи нельзя. Продлите доступ, чтобы продолжить.',
        retry: true,
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
      return st.member;
    });
  }

  function loadCategories() {
    if (st.categories) return Promise.resolve(st.categories);
    return Api.call('categories').then(function (list) {
      st.categories = Array.isArray(list) ? list : [];
      return st.categories;
    });
  }

  function loadSummary(month) {
    if (st.summaryCache[month]) return Promise.resolve(st.summaryCache[month]);
    return Api.call('summary', { month: month }).then(function (s) {
      st.summaryCache[month] = s;
      return s;
    });
  }

  function loadTx(month) {
    if (st.txCache[month]) return Promise.resolve(st.txCache[month]);
    return Api.call('list_tx', { month: month }).then(function (list) {
      st.txCache[month] = Array.isArray(list) ? list : [];
      return st.txCache[month];
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
      render(Views.renderSummary(s));
      if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      fail(err);
    });
  }

  function changeMonth(delta) {
    var next = Fmt.shiftMonth(st.month, delta);
    if (next > Fmt.currentMonth()) return;
    st.month = next;
    root.Tg.haptic('light');
    if (route.name === 'tx') openTx();
    else openSummary();
  }

  function goHome() {
    if (!st.member) return render(Views.renderOnboarding(onboarding));
    openSummary();
  }

  function openTx() {
    route = { name: 'tx' };
    render(Views.skeletonList());
    var seq = ++reqSeq;
    var month = st.month;
    loadTx(month).then(function (list) {
      if (seq !== reqSeq) return;
      render(Views.renderTxList(list));
      if (State.isExpired()) banner('Пробный период закончился — новые записи недоступны.');
    }).catch(function (err) {
      if (seq !== reqSeq) return;
      fail(err);
    });
  }

  function openAdd(params) {
    if (State.isExpired()) {
      fail(new Api.ApiError('subscription_expired', 402));
      return;
    }
    var saved = formValues();
    route = { name: 'add' };
    form = {
      category_id: params && params.category_id ? params.category_id : saved.category_id,
      kind: params && params.kind ? params.kind : saved.kind || 'expense',
      amount: saved.amount,
      note: saved.note,
      date: saved.date,
      is_shared: saved.is_shared,
    };
    render(Views.skeletonList());
    loadCategories().then(function () {
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
    render(Views.renderSettings());
  }

  function openTab(tab) {
    if (!st.member) return;
    if (tab === 'summary') openSummary();
    else if (tab === 'tx') openTx();
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
    var payload = {
      amount: amount,
      category_id: values.category_id,
      note: values.note.trim() || null,
      occurred_on: occurred,
      is_shared: values.kind === 'expense' ? values.is_shared : false,
    };
    btn.disabled = true;
    Api.call('add_tx', payload).then(function () {
      root.Tg.haptic('success');
      State.remember('add_tx', payload);
      st.month = occurred.slice(0, 7);
      form = {};
      toast('Записано');
      openSummary();
    }).catch(function (err) {
      btn.disabled = false;
      root.Tg.haptic('error');
      if (err.code === 'subscription_expired') fail(err);
      else toast(err.message || 'Не получилось сохранить');
    });
  }

  function deleteTx(id) {
    dialog('Удалить эту запись?', 'Удалить').then(function (ok) {
      if (!ok) return;
      Api.call('delete_tx', { id: id }).then(function () {
        root.Tg.haptic('success');
        State.remember('delete_tx', {});
        toast('Удалено');
        closeSwipes();
        if (route.name === 'tx') openTx();
        else openSummary();
      }).catch(function (err) {
        root.Tg.haptic('error');
        if (err.code === 'subscription_expired') fail(err);
        else toast(err.message || 'Не удалось удалить');
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

    switch (action) {
      case 'month-prev': changeMonth(-1); break;
      case 'month-next': changeMonth(1); break;
      case 'go-tx': openTx(); break;
      case 'go-add': openAdd(); break;
      case 'refresh':
        st.summaryCache = {};
        st.txCache = {};
        st.categories = null;
        toast('Обновлено');
        openTab(route.name === 'settings' ? 'summary' : route.name);
        break;
      case 'retry': goHome(); break;
      case 'start': goHome(); break;
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
      case 'demo-reset':
        if (root.DEMO_API) root.DEMO_API.reset();
        st.summaryCache = {};
        st.txCache = {};
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
    ev.preventDefault();
    ev.stopPropagation();
    btn.click();
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
    else if (kind === 'create' || kind === 'join') submitOnboarding(f, kind);
  });

  el.screen.addEventListener('click', function (ev) {
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
