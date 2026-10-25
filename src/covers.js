/** Обложки главной карточки на сводке. Выбор локальный, как валюта и язык. */

(function (root) {
  var KEY = 'budget.cover';
  var CUSTOM_ID = 'custom';
  var LIST = [
    { id: 'default', name: 'Стандартная' },
    { id: 'blue', name: 'Синий', file: 'covers/blue.webp', tone: 'dark' },
    { id: 'pink', name: 'Розовый', file: 'covers/pink.webp', tone: 'light' },
    { id: 'green', name: 'Зелёный', file: 'covers/green.webp', tone: 'dark' },
    { id: 'navy', name: 'Тёмный', file: 'covers/navy.webp', tone: 'dark' },
    { id: 'purple', name: 'Фиолетовый', file: 'covers/purple.webp', tone: 'light' },
    { id: 'beige', name: 'Бежевый', file: 'covers/beige.webp', tone: 'light' },
  ];
  var BY_ID = {};
  LIST.forEach(function (c) { BY_ID[c.id] = c; });

  var current = 'default';
  try {
    var saved = root.localStorage.getItem(KEY);
    if (saved === CUSTOM_ID || (saved && BY_ID[saved])) current = saved;
  } catch (e) {}

  // Своё фото хранится только на устройстве, в IndexedDB. В localStorage
  // остаётся лишь идентификатор выбранной обложки.
  var DB_NAME = 'budget-assets';
  var DB_VERSION = 1;
  var STORE = 'images';
  var CUSTOM_KEY = 'home-cover';
  var custom = null;
  var customUrl = '';
  var loadRequest = null;

  function codeError(code, message) {
    var err = new Error(message || code);
    err.code = code;
    return err;
  }

  function storageError(error) {
    if (error && error.code) return error;
    var err = new Error((error && error.message) || 'Storage error');
    var name = (error && error.name) || '';
    err.code = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
      ? 'storage_full'
      : name === 'SecurityError' || name === 'InvalidStateError'
        ? 'storage_blocked'
        : 'storage_error';
    return err;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(codeError('storage_unsupported', 'IndexedDB is unavailable'));
      var req;
      try {
        req = root.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        return reject(storageError(err));
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(storageError(req.error)); };
      req.onblocked = function () { reject(codeError('storage_blocked', 'IndexedDB is blocked')); };
    });
  }

  function dbRequest(mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var result;
        function fail(error) {
          if (done) return;
          done = true;
          try { db.close(); } catch (e) {}
          reject(storageError(error));
        }
        var tx;
        try {
          tx = db.transaction(STORE, mode);
        } catch (err) {
          return fail(err);
        }
        tx.oncomplete = function () {
          if (done) return;
          done = true;
          try { db.close(); } catch (e) {}
          resolve(result);
        };
        tx.onerror = function () { fail(tx.error); };
        tx.onabort = function () { fail(tx.error); };
        var req;
        try {
          req = run(tx.objectStore(STORE));
        } catch (err) {
          return fail(err);
        }
        req.onsuccess = function () { result = req.result; };
        req.onerror = function () { fail(req.error); };
      });
    });
  }

  function revokeUrl(url) {
    if (!url || !root.URL || typeof root.URL.revokeObjectURL !== 'function') return;
    try { root.URL.revokeObjectURL(url); } catch (e) {}
  }

  function urlFor(blob) {
    if (root.URL && typeof root.URL.createObjectURL === 'function') {
      try {
        return Promise.resolve(root.URL.createObjectURL(blob));
      } catch (err) {
        return Promise.reject(storageError(err));
      }
    }
    if (root.FileReader) {
      return new Promise(function (resolve, reject) {
        var reader = new root.FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(storageError(reader.error)); };
        reader.readAsDataURL(blob);
      });
    }
    return Promise.reject(codeError('storage_unsupported', 'Object URLs are unavailable'));
  }

  function replaceCustom(blob) {
    return urlFor(blob).then(function (url) {
      var previous = customUrl;
      customUrl = url;
      custom = { id: CUSTOM_ID, name: 'Своё фото', file: url, tone: 'dark', custom: true };
      if (previous && previous !== url) revokeUrl(previous);
      return custom;
    });
  }

  function persist() {
    try { root.localStorage.setItem(KEY, current); } catch (e) {}
  }

  function get(id) {
    return BY_ID[id] || null;
  }

  function set(id) {
    if (id === CUSTOM_ID) {
      if (!custom) return false;
    } else if (!BY_ID[id]) {
      return false;
    }
    current = id;
    persist();
    return true;
  }

  function currentCover() {
    if (current === CUSTOM_ID) return custom;
    return current === 'default' ? null : BY_ID[current];
  }

  function loadCustom() {
    if (custom) return Promise.resolve(custom);
    if (loadRequest) return loadRequest;
    loadRequest = dbRequest('readonly', function (store) {
      return store.get(CUSTOM_KEY);
    }).then(function (blob) {
      return blob ? replaceCustom(blob) : null;
    }).catch(function (err) {
      if (root.console && root.console.warn) root.console.warn('cover load failed', err && err.code);
      return null;
    }).then(function (item) {
      loadRequest = null;
      if (!item && current === CUSTOM_ID) {
        current = 'default';
        persist();
      }
      return item;
    });
    return loadRequest;
  }

  function saveCustom(blob) {
    if (!blob) return Promise.reject(codeError('image_empty', 'Empty image'));
    return dbRequest('readwrite', function (store) {
      return store.put(blob, CUSTOM_KEY);
    }).then(function () {
      return replaceCustom(blob);
    }).then(function (item) {
      current = CUSTOM_ID;
      persist();
      return item;
    });
  }

  function clearCustom() {
    return dbRequest('readwrite', function (store) {
      return store.delete(CUSTOM_KEY);
    }).then(function () {
      var old = customUrl;
      custom = null;
      customUrl = '';
      revokeUrl(old);
      if (current === CUSTOM_ID) {
        current = 'default';
        persist();
      }
      return true;
    });
  }

  root.Covers = {
    list: LIST,
    CUSTOM_ID: CUSTOM_ID,
    id: function () { return current; },
    current: currentCover,
    custom: function () { return custom; },
    hasCustom: function () { return !!custom; },
    get: get,
    set: set,
    loadCustom: loadCustom,
    saveCustom: saveCustom,
    clearCustom: clearCustom,
  };
})(window);
