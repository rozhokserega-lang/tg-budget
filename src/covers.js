/** Обложки главной карточки на сводке. Выбор локальный, как валюта и язык. */

(function (root) {
  var KEY = 'budget.cover';
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
    if (saved && BY_ID[saved]) current = saved;
  } catch (e) {}

  function get(id) {
    return BY_ID[id] || null;
  }

  function set(id) {
    if (!BY_ID[id]) return false;
    current = id;
    try { root.localStorage.setItem(KEY, id); } catch (e) {}
    return true;
  }

  root.Covers = {
    list: LIST,
    id: function () { return current; },
    current: function () { return current === 'default' ? null : BY_ID[current]; },
    set: set,
  };
})(window);
