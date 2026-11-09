/** Global appearance. Preferences are small JSON; photographs never leave IndexedDB. */
(function (root) {
  'use strict';
  var doc = root.document, key = 'budget.appearance', url = '', busy = false, revision = 0;
  var presets = [['default', 'Стандартный'], ['dark', 'Тёмный'], ['light', 'Светлый'], ['gradient', 'Градиент'], ['waves', 'Волны'], ['geometry', 'Геометрия'], ['texture', 'Текстура']];
  var defaults = { preset: 'default', dim: 0, blur: 0, cards: 88, fit: 'cover', x: 50, y: 50 };
  function clamp(v, min, max, fallback) { v = Number(v); return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; }
  function normalize(s) {
    s = s || {};
    return { preset: presets.some(function (p) { return p[0] === s.preset; }) || s.preset === 'custom' ? s.preset : 'default',
      dim: clamp(s.dim, 0, 80, 0), blur: clamp(s.blur, 0, 20, 0), cards: clamp(s.cards, 60, 100, 88),
      fit: ['cover', 'width', 'height'].indexOf(s.fit) >= 0 ? s.fit : 'cover', x: clamp(s.x, 0, 100, 50), y: clamp(s.y, 0, 100, 50) };
  }
  var state;
  try { state = normalize(JSON.parse(root.localStorage.getItem(key))); } catch (_) { state = normalize(); }
  function apply() {
    var style = doc.documentElement.style;
    doc.documentElement.dataset.appBackground = state.preset;
    style.setProperty('--app-bg-image', url ? 'url("' + url + '")' : 'none');
    style.setProperty('--app-bg-dim', state.dim / 100);
    style.setProperty('--app-bg-blur', state.blur + 'px');
    style.setProperty('--app-card-opacity', state.cards + '%');
    style.setProperty('--app-bg-size', state.fit === 'width' ? '100% auto' : state.fit === 'height' ? 'auto 100%' : 'cover');
    style.setProperty('--app-bg-position', state.x + '% ' + state.y + '%');
  }
  function save() {
    try { root.localStorage.setItem(key, JSON.stringify(state)); return true; }
    catch (_) { message('Не удалось сохранить настройки. Проверьте доступ к хранилищу.'); return false; }
  }
  function message(text) { var el = doc.querySelector('[data-bg-status]'); if (el) el.textContent = text; }
  function storage(mode, value) {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error('Хранилище изображений недоступно'));
      var request = root.indexedDB.open('budget-assets', 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('images')) request.result.createObjectStore('images'); };
      request.onerror = function () { reject(request.error); };
      request.onblocked = function () { reject(new Error('Хранилище заблокировано. Закройте другие окна приложения.')); };
      request.onsuccess = function () {
        var db = request.result, tx, result, requestError;
        try {
          tx = db.transaction('images', mode === 'read' ? 'readonly' : 'readwrite');
          var store = tx.objectStore('images');
          var req = mode === 'read' ? store.get('app-background') : mode === 'delete' ? store.delete('app-background') : store.put(value, 'app-background');
          req.onsuccess = function () { result = req.result; };
          req.onerror = function () { requestError = req.error; };
          tx.oncomplete = function () { db.close(); resolve(result); };
          tx.onerror = tx.onabort = function () { db.close(); reject(requestError || tx.error || new Error('Ошибка хранения изображения')); };
        } catch (err) { db.close(); reject(err); }
      };
    });
  }
  function decode(blob) {
    return new Promise(function (resolve, reject) {
      var temporary = root.URL.createObjectURL(blob), img = new root.Image();
      img.onload = function () { root.URL.revokeObjectURL(temporary); resolve(img); };
      img.onerror = function () { root.URL.revokeObjectURL(temporary); reject(new Error('Не удалось открыть изображение')); };
      img.src = temporary;
    });
  }
  function replaceUrl(next) { if (url) root.URL.revokeObjectURL(url); url = next; }
  async function upload(file) {
    if (busy || !file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return message('Выберите JPG, PNG или WebP.');
    if (file.size > 10 * 1024 * 1024) return message('Максимальный размер файла — 10 МБ.');
    busy = true; var ticket = ++revision;
    message('Обрабатываем изображение…');
    try {
      var img = await decode(file);
      var scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = doc.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var context = canvas.getContext('2d');
      if (!context) throw new Error('Обработка изображений недоступна');
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/webp', 0.82); });
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error('Не удалось сжать изображение');
      if (ticket !== revision) return;
      await storage('write', blob);
      if (ticket !== revision) return;
      replaceUrl(root.URL.createObjectURL(blob));
      state.preset = 'custom'; state.dim = 35; state.blur = 0;
      apply(); save(); refresh(); message('Фон сохранён на этом устройстве.');
    } catch (err) { message(err.name === 'QuotaExceededError' ? 'На устройстве недостаточно места.' : err.message || 'Не удалось сохранить изображение.'); }
    finally { busy = false; }
  }
  function range(name, label, min, max, suffix) {
    return '<label class="appearance-control"><span>' + label + ' <output data-bg-output="' + name + '">' + state[name] + suffix + '</output></span><input type="range" min="' + min + '" max="' + max + '" value="' + state[name] + '" data-bg-setting="' + name + '" data-unit="' + suffix + '"></label>';
  }
  function render() {
    return '<section class="section appearance" data-appearance data-gesture-lock><div class="section__head"><span class="section__title">Фон приложения</span></div>' +
      '<div class="appearance-preview" aria-label="Предпросмотр оформления"><div class="appearance-preview__background"></div><div class="appearance-preview__content"><span class="small">ВАШ ДЕНЬ · TG BUDGET</span><div class="appearance-preview__card"><span>Баланс</span><strong>24 580 ₽</strong><span>Все важное — под рукой</span></div><div class="appearance-preview__card"><span>✓ Задачи на сегодня</span><span>Прогулка · 18:00</span></div></div></div>' +
      '<p class="small muted mt-8">Единый фон для всех разделов. Изменения применяются сразу.</p><div class="appearance-grid">' + presets.map(function (p) {
        return '<button type="button" class="appearance-option" data-bg-preset="' + p[0] + '" aria-pressed="' + (state.preset === p[0]) + '"><span class="appearance-swatch" data-bg-swatch="' + p[0] + '"></span>' + p[1] + '</button>';
      }).join('') + (url ? '<button type="button" class="appearance-option" data-bg-preset="custom" aria-pressed="' + (state.preset === 'custom') + '"><span class="appearance-swatch appearance-swatch--custom"></span>Своё фото</button>' : '') + '</div>' +
      '<div class="card"><label class="btn appearance-upload">Загрузить фон<input type="file" accept="image/jpeg,image/png,image/webp" data-bg-file></label><p class="small muted mt-8">JPG, PNG, WebP · до 10 МБ. Только на этом устройстве, без отправки на сервер.</p><p class="small mt-8" data-bg-status role="status"></p></div>' +
      '<div class="card appearance-controls"><div data-bg-image-controls' + (state.preset !== 'custom' ? ' hidden' : '') + '><label class="appearance-control">Масштаб<select class="input" data-bg-setting="fit"><option value="cover"' + (state.fit === 'cover' ? ' selected' : '') + '>На весь экран</option><option value="width"' + (state.fit === 'width' ? ' selected' : '') + '>По ширине</option><option value="height"' + (state.fit === 'height' ? ' selected' : '') + '>По высоте</option></select></label>' + range('x', 'По горизонтали', 0, 100, '%') + range('y', 'По вертикали', 0, 100, '%') + range('blur', 'Размытие', 0, 20, ' px') + '</div>' + range('dim', 'Затемнение', 0, 80, '%') + range('cards', 'Непрозрачность карточек', 60, 100, '%') + '</div><button type="button" class="btn btn--ghost" data-bg-reset>Восстановить стандартное оформление</button></section>';
  }
  function refresh() { var el = doc.querySelector('[data-appearance]'); if (el) el.outerHTML = render(); }
  apply();
  // Only the loader is present during asynchronous image restoration. Never block startup.
  var restoreRevision = revision;
  var restoration = state.preset === 'custom' ? storage('read').then(async function (blob) {
    if (!(blob instanceof root.Blob)) throw new Error('Missing background');
    await decode(blob);
    if (revision === restoreRevision) { replaceUrl(root.URL.createObjectURL(blob)); apply(); refresh(); }
  }).catch(function () { if (revision === restoreRevision) { state = normalize(); apply(); save(); refresh(); } }) : Promise.resolve();
  var ready = Promise.race([restoration, new Promise(function (resolve) {
    root.setTimeout(function () {
      if (state.preset === 'custom' && !url && revision === restoreRevision) { ++revision; state = normalize(); apply(); save(); }
      resolve();
    }, 1800);
  })]);
  doc.addEventListener('click', function (event) {
    var button = event.target.closest('[data-bg-preset], [data-bg-reset]');
    if (!button || busy) return;
    ++revision;
    if (button.hasAttribute('data-bg-reset')) {
      state = normalize(); replaceUrl('');
      storage('delete').catch(function () { message('Настройки сброшены, но удалить фото из хранилища не удалось.'); });
    } else { state.preset = button.dataset.bgPreset; state.dim = state.preset === 'custom' ? 35 : 0; }
    apply(); save(); refresh();
  });
  doc.addEventListener('input', function (event) {
    var input = event.target, name = input.dataset.bgSetting;
    if (!name) return;
    state[name] = name === 'fit' ? input.value : Number(input.value); state = normalize(state); apply();
    var output = doc.querySelector('[data-bg-output="' + name + '"]'); if (output) output.textContent = state[name] + (input.dataset.unit || '');
  });
  doc.addEventListener('change', function (event) {
    if (event.target.hasAttribute('data-bg-file')) { upload(event.target.files[0]); event.target.value = ''; }
    if (event.target.dataset.bgSetting) save();
  });
  root.Appearance = { render: render, ready: ready, normalize: normalize };
})(window);
