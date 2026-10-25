/**
 * Обёртка над Telegram.WebApp: initData, тема, кнопки, хаптики.
 * Если SDK ещё не загрузился (скрипт подключается async) — ждём до 5 секунд.
 * Вне Telegram всё продолжает работать с пустым initData (в браузере — демо-режим).
 */

(function (root) {
  var THEME_KEYS = {
    bg_color: '--tg-bg',
    secondary_bg_color: '--tg-secondary-bg',
    text_color: '--tg-text',
    hint_color: '--tg-hint',
    link_color: '--tg-link',
    button_color: '--tg-button',
    button_text_color: '--tg-button-text',
    separator_color: '--tg-separator',
    destructive_text_color: '--tg-destructive',
  };
  var tg = null;
  var backHandler = null;
  var homeScreenAddedHandlers = [];
  var HOME_SCREEN_MOBILE = { ios: true, android: true, android_x: true };
  var themeMode = 'system';

  function systemPrefersDark() {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) {
      return false;
    }
  }

  // Ручной выбор темы важнее темы Telegram: убираем inline-переменные,
  // чтобы вступила в силу палитра из CSS для data-theme="light"/"dark".
  function clearThemeVars() {
    var style = document.documentElement.style;
    if (!style || typeof style.removeProperty !== 'function') return;
    Object.keys(THEME_KEYS).forEach(function (k) {
      style.removeProperty(THEME_KEYS[k]);
    });
  }

  function setThemeAttribute(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-mode', themeMode);
  }

  // Ручная тема должна совпадать с системными панелями Mini App, иначе
  // светлый экран остаётся в тёмной «рамке» Telegram.
  function syncTelegramChrome() {
    if (!tg) return;
    var color = themeMode === 'light' ? '#f7f5fb' : themeMode === 'dark' ? '#111116' : 'secondary_bg_color';
    try { if (tg.setHeaderColor) tg.setHeaderColor(color); } catch (e) {}
    try { if (tg.setBackgroundColor) tg.setBackgroundColor(color); } catch (e) {}
  }

  function applyTheme() {
    if (themeMode === 'light' || themeMode === 'dark') {
      clearThemeVars();
      setThemeAttribute(themeMode);
      syncTelegramChrome();
      return;
    }

    if (!tg) {
      clearThemeVars();
      setThemeAttribute(systemPrefersDark() ? 'dark' : 'light');
      return;
    }

    var p = tg.themeParams || {};
    clearThemeVars();
    Object.keys(THEME_KEYS).forEach(function (k) {
      if (p[k]) document.documentElement.style.setProperty(THEME_KEYS[k], p[k]);
    });
    var dark = p.bg_color
      ? isDark(p.bg_color)
      : tg.colorScheme
        ? tg.colorScheme === 'dark'
        : systemPrefersDark();
    setThemeAttribute(dark ? 'dark' : 'light');
    syncTelegramChrome();
  }

  function setThemeMode(mode) {
    themeMode = mode === 'light' || mode === 'dark' ? mode : 'system';
    applyTheme();
    return themeMode;
  }

  if (root.matchMedia) {
    try {
      var themeMedia = root.matchMedia('(prefers-color-scheme: dark)');
      if (themeMedia && themeMedia.addEventListener) {
        themeMedia.addEventListener('change', function () {
          if (themeMode === 'system' && !tg) applyTheme();
        });
      }
    } catch (e) {}
  }

  function isDark(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    var n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 128;
  }

  function currentSdk() {
    return (root.Telegram && root.Telegram.WebApp) || tg;
  }

  function waitForSdk() {
    return new Promise(function (resolve) {
      var tries = 0;
      (function poll() {
        tg = root.Telegram && root.Telegram.WebApp;
        if (tg || tries++ > 50) resolve(tg);
        else setTimeout(poll, 100);
      })();
    });
  }

  async function init() {
    await waitForSdk();
    if (!tg) {
      applyTheme();
      return false;
    }
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color');
      if (tg.setBackgroundColor) tg.setBackgroundColor('secondary_bg_color');
      tg.onEvent('themeChanged', applyTheme);
      tg.onEvent('backButtonClicked', function () {
        if (backHandler) backHandler();
      });
      tg.onEvent('homeScreenAdded', function () {
        homeScreenAddedHandlers.slice().forEach(function (fn) {
          try { fn(); } catch (e) {}
        });
      });
    } catch (e) {}
    document.documentElement.classList.add('tg-miniapp');
    if (document.body) document.body.classList.add('tg-miniapp');
    applyTheme();
    return true;
  }

  function initData() {
    var sdk = (root.Telegram && root.Telegram.WebApp) || tg;
    return (sdk && sdk.initData) || '';
  }

  function isInsideTelegram() {
    var sdk = (root.Telegram && root.Telegram.WebApp) || tg;
    return !!(sdk && sdk.initData);
  }

  function haptic(type) {
    try {
      var h = tg && tg.HapticFeedback;
      if (!h) return;
      if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
      else h.impactOccurred(type || 'light');
    } catch (e) {}
  }

  /** Показывает системную «Назад» и вызывает cb. cb = null — скрыть. */
  function backButton(cb) {
    backHandler = cb;
    try {
      if (!tg || !tg.BackButton) return;
      if (cb) tg.BackButton.show();
      else tg.BackButton.hide();
    } catch (e) {}
  }

  function close() {
    try {
      if (tg && tg.close) tg.close();
    } catch (e) {}
  }

  function showAlert(message, cb) {
    if (tg && tg.showAlert) {
      try {
        tg.showAlert(message, cb);
        return;
      } catch (e) {}
    }
    root.alert(message);
    if (cb) cb();
  }

  function confirm(message, cb) {
    if (tg && tg.showConfirm) {
      try {
        tg.showConfirm(message, cb);
        return;
      } catch (e) {}
    }
    cb(root.confirm(message));
  }

  /** Копирует текст, возвращает Promise<boolean>. */
  function copy(text) {
    if (navigator.clipboard && root.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(text); }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // Платформа Telegram WebApp. На десктопе/в вебе ярлык на главный экран
  // недоступен, даже если SDK формально знает метод addToHomeScreen.
  function platform() {
    var s = currentSdk();
    return (s && s.platform) || '';
  }

  function canUseHomeScreenPlatform() {
    var p = platform();
    return !p || p === 'unknown' || !!HOME_SCREEN_MOBILE[p];
  }

  // Ярлык на главном экране: Bot API 8.0+, только мобильные клиенты.
  // Вне Telegram и на десктопе методы есть, но checkHomeScreenStatus вернёт unsupported.
  function canAddToHomeScreen() {
    var s = currentSdk();
    return !!(s && canUseHomeScreenPlatform() &&
      typeof s.addToHomeScreen === 'function' &&
      typeof s.checkHomeScreenStatus === 'function' &&
      (!s.isVersionAtLeast || s.isVersionAtLeast('8.0')));
  }

  function checkHomeScreenStatus(cb) {
    if (!canAddToHomeScreen()) {
      if (typeof cb === 'function') cb('unsupported');
      return false;
    }
    try {
      currentSdk().checkHomeScreenStatus(function (status) {
        if (typeof cb === 'function') cb(status);
      });
      return true;
    } catch (e) {
      if (typeof cb === 'function') cb('unsupported');
      return false;
    }
  }

  function addToHomeScreen() {
    if (!canAddToHomeScreen()) return false;
    try {
      currentSdk().addToHomeScreen();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Событие homeScreenAdded может не прийти на устройствах, где нельзя
  // определить статус установки, поэтому UI перепроверяет статус при открытии.
  function onHomeScreenAdded(handler) {
    if (typeof handler === 'function') homeScreenAddedHandlers.push(handler);
  }

  // Сканер QR: нативное окно Telegram (Bot API 6.4+). onResult(text) вернёт true — окно закроется.
  function canScanQr() {
    var s = (root.Telegram && root.Telegram.WebApp) || tg;
    return !!(s && typeof s.showScanQrPopup === 'function' && (!s.isVersionAtLeast || s.isVersionAtLeast('6.4')));
  }

  function scanQr(text, onResult, onClose) {
    var s = (root.Telegram && root.Telegram.WebApp) || tg;
    if (!s || typeof s.showScanQrPopup !== 'function' || (s.isVersionAtLeast && !s.isVersionAtLeast('6.4'))) return false;
    var closed = null;
    try {
      if (onClose && typeof s.onEvent === 'function') {
        closed = function () {
          if (typeof s.offEvent === 'function') s.offEvent('scanQrPopupClosed', closed);
          onClose();
        };
        s.onEvent('scanQrPopupClosed', closed);
      }
      s.showScanQrPopup({ text: text || '' }, function (value) {
        return onResult(String(value)) === true;
      });
      return true;
    } catch (e) {
      if (closed && typeof s.offEvent === 'function') s.offEvent('scanQrPopupClosed', closed);
      return false;
    }
  }

  root.Tg = {
    platform: platform,
    canAddToHomeScreen: canAddToHomeScreen,
    checkHomeScreenStatus: checkHomeScreenStatus,
    addToHomeScreen: addToHomeScreen,
    onHomeScreenAdded: onHomeScreenAdded,
    canScanQr: canScanQr,
    scanQr: scanQr,
    init: init,
    setThemeMode: setThemeMode,
    themeMode: function () { return themeMode; },
    initData: initData,
    isInsideTelegram: isInsideTelegram,
    haptic: haptic,
    backButton: backButton,
    close: close,
    showAlert: showAlert,
    confirm: confirm,
    copy: copy,
    // SDK из CDN грузится асинхронно и может перезаписать window.Telegram позже нас —
    // поэтому всегда берём актуальный объект.
    sdk: function () { return (root.Telegram && root.Telegram.WebApp) || tg; },
  };
})(window);
