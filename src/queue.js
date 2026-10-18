/**
 * Очередь записи: изменения сразу появляются в интерфейсе и уходят на сервер.
 * Если связи нет — операция остаётся в localStorage и уходит позже.
 * Ошибка данных (неверная сумма, нет доступа) откатывает локальное изменение.
 */

(function (root) {
  var KEY = 'tt.queue.v1';
  var listeners = [];
  var busy = false;
  var lastError = null;
  var TERMINAL = ['bad_amount', 'bad_category', 'bad_name', 'bad_goal', 'bad_day', 'no_category',
    'subscription_expired', 'not_found', 'forbidden', 'unauthorized'];

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
    listeners.forEach(function (fn) { try { fn(list); } catch (e) {} });
  }

  // Отправка стартует после текущего тика: push не должен ловить busy посреди других обработчиков.
  function enqueue(action, payload) {
    var list = load();
    var op = { id: 'op-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), action: action, payload: payload, at: Date.now() };
    list.push(op);
    save(list);
    setTimeout(flush, 0);
    return op;
  }

  function remove(id) {
    save(load().filter(function (x) { return x.id !== id; }));
  }

  // Отправляем строго по порядку: «удалить» не должно обогнать «создать».
  function flush() {
    if (busy) return Promise.resolve();
    var list = load();
    if (!list.length) return Promise.resolve();
    busy = true;
    var op = list[0];

    var promise;
    try {
      promise = root.Api.call(op.action, op.payload);
      if (promise && typeof promise.then !== 'function') promise = Promise.resolve(promise);
    } catch (e) {
      promise = Promise.reject(e);
    }
    return promise.then(function (result) {
      remove(op.id);
      lastError = null;
      busy = false;
      root.dispatchEvent(new CustomEvent('queue-sent', { detail: { id: op.id, action: op.action, result: result } }));
      if (load().length) return flush();
    }).catch(function (err) {
      busy = false;
      lastError = err;
      var code = (err && err.code) || 'network';
      if (TERMINAL.indexOf(code) !== -1) {
        // Повторять бессмысленно — снимаем операцию и просим интерфейс откатиться.
        remove(op.id);
        root.dispatchEvent(new CustomEvent('queue-failed', { detail: { op: op, error: err } }));
        return;
      }
      root.dispatchEvent(new CustomEvent('queue-pending', { detail: { op: op, error: err } }));
    });
  }

  root.addEventListener('online', function () { flush(); });
  setInterval(function () { if (load().length) flush(); }, 15000);

  root.Queue = {
    push: function (action, payload) { return enqueue(action, payload); },
    remove: remove,
    flush: flush,
    size: function () { return load().length; },
    onChange: function (fn) { listeners.push(fn); },
    lastError: function () { return lastError; },
  };
})(window);
