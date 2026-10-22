/**
 * Локальная память о чеках, уже добавленных с этого устройства.
 * Нужна, чтобы повторное сканирование не создавало дубль, пока сервер не ответил
 * или когда приложение работает без сети. Серверная защита от дублей остаётся главной.
 *
 * Ключи хранятся отдельно для каждой семьи и участника: на одном устройстве могут
 * открываться разные аккаунты, и чужой чек не должен блокировать добавление.
 */
(function (root) {
  var PREFIX = 'budget.receipts.v2:';
  var LIMIT = 200;

  function storageKey(scope) {
    return PREFIX + String(scope || 'anonymous').replace(/[^\w:.-]/g, '_');
  }

  function read(scope) {
    try {
      var list = JSON.parse(root.localStorage.getItem(storageKey(scope)) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function (row) {
        return row && typeof row.key === 'string' && row.key;
      });
    } catch (e) {
      return [];
    }
  }

  function write(scope, list) {
    try {
      root.localStorage.setItem(storageKey(scope), JSON.stringify(list.slice(-LIMIT)));
    } catch (e) {}
  }

  function normalizeSum(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  function has(scope, key) {
    if (!key) return false;
    return read(scope).some(function (row) { return row.key === key; });
  }

  function remember(scope, key, meta) {
    if (!key) return;
    var rows = read(scope).filter(function (row) { return row.key !== key; });
    var row = { key: String(key) };
    meta = meta || {};
    if (meta.txId) row.txId = String(meta.txId);
    if (meta.date) row.date = String(meta.date).slice(0, 10);
    var sum = normalizeSum(meta.sum);
    if (sum !== null) row.sum = sum;
    rows.push(row);
    write(scope, rows);
  }

  function forget(scope, key) {
    if (!key) return;
    var rows = read(scope);
    var next = rows.filter(function (row) { return row.key !== key; });
    if (next.length !== rows.length) write(scope, next);
  }

  // После ответа сервера локальный id заменяется серверным: сохраняем эту связь,
  // чтобы удаление записи могло снять и локальную отметку о чеке.
  function link(scope, fromId, toId, key) {
    if (!toId) return;
    var rows = read(scope);
    var row = null;
    rows.forEach(function (item) {
      if ((key && item.key === key) || (fromId && item.txId === String(fromId))) row = item;
    });
    if (!row) {
      if (!key) return;
      row = { key: String(key) };
      rows.push(row);
    }
    row.txId = String(toId);
    write(scope, rows);
  }

  // Удаление записи должно освобождать чек: иначе повторно добавить его будет нельзя.
  // Если сервер не вернул receipt_key, ищем самую свежую локальную запись по дате и сумме.
  function forgetForTx(scope, tx) {
    if (!tx) return;
    var keys = [];
    if (tx.receipt_key) keys.push(String(tx.receipt_key));
    if (tx._receiptKey) keys.push(String(tx._receiptKey));

    var rows = read(scope);
    if (tx.id) {
      rows.forEach(function (row) {
        if (row.txId === String(tx.id)) keys.push(row.key);
      });
    }

    if (!keys.length && tx.occurred_on != null) {
      var date = String(tx.occurred_on).slice(0, 10);
      var sum = normalizeSum(tx.amount);
      for (var i = rows.length - 1; i >= 0; i--) {
        if (rows[i].date === date && sum !== null && rows[i].sum === sum) {
          keys.push(rows[i].key);
          break;
        }
      }
    }

    var seen = {};
    keys.forEach(function (key) {
      if (!key || seen[key]) return;
      seen[key] = true;
      forget(scope, key);
    });
  }

  root.ReceiptStore = {
    storageKey: storageKey,
    list: read,
    has: has,
    remember: remember,
    forget: forget,
    link: link,
    forgetForTx: forgetForTx,
  };
})(window);
