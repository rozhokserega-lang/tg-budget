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

  function applyTheme() {
    if (!tg) return;
    var p = tg.themeParams || {};
    Object.keys(THEME_KEYS).forEach(function (k) {
      if (p[k]) document.documentElement.style.setProperty(THEME_KEYS[k], p[k]);
    });
    document.documentElement.setAttribute('data-theme', p.bg_color && isDark(p.bg_color) ? 'dark' : 'light');
    if (!p.bg_color && tg.colorScheme) {
      document.documentElement.setAttribute('data-theme', tg.colorScheme === 'dark' ? 'dark' : 'light');
    }
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
    if (!tg) return false;
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

  // Ярлык на главном экране: Bot API 8.0+, только мобильные клиенты.
  // Вне Telegram и на десктопе методы есть, но checkHomeScreenStatus вернёт unsupported.
  function canAddToHomeScreen() {
    var s = currentSdk();
    return !!(s && typeof s.addToHomeScreen === 'function' &&
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
    canAddToHomeScreen: canAddToHomeScreen,
    checkHomeScreenStatus: checkHomeScreenStatus,
    addToHomeScreen: addToHomeScreen,
    onHomeScreenAdded: onHomeScreenAdded,
    canScanQr: canScanQr,
    scanQr: scanQr,
    init: init,
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
