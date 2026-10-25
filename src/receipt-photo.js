/**
 * Поиск QR-кода на фото чека. Всё происходит на устройстве, файл никуда не отправляется.
 * Сначала встроенный BarcodeDetector (если есть), затем jsQR (подгружается только при выборе фото)
 * с несколькими попытками: чек целиком, нижняя часть, увеличение.
 */
(function (root) {
  var JSQR_SRC = 'src/vendor/jsqr.js?v=1';
  var loading = null;
  // [x, y, w, h] — доли кадра, последнее число — масштаб.
  // Сначала быстрые уменьшенные варианты: полный кадр телефона слишком тяжёл для jsQR.
  var ATTEMPTS = [
    [0, 0, 1, 1, 0.55], [0, 0.42, 1, 0.58, 0.8], [0, 0.45, 1, 0.55, 1.15],
    [0.1, 0.45, 0.8, 0.55, 1.4], [0, 0, 1, 1, 0.8], [0, 0.55, 1, 0.45, 1.5],
    [0.35, 0.5, 0.6, 0.5, 1.8], [0, 0, 1, 1, 1],
  ];
  var MAX_SIDE = 1800, TIME_LIMIT = 7000;

  function loadJsQr() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = root.document.createElement('script');
        s.src = JSQR_SRC;
        s.async = true;
        s.onload = function () {
          if (root.jsQR) resolve(root.jsQR);
          else { loading = null; reject(new Error('jsqr_load')); }
        };
        s.onerror = function () { loading = null; reject(new Error('jsqr_load')); };
        root.document.head.appendChild(s);
      });
    }
    return loading;
  }

  function tryDetector(image) {
    if (!root.BarcodeDetector) return Promise.resolve(null);
    try {
      return new root.BarcodeDetector({ formats: ['qr_code'] }).detect(image)
        .then(function (list) { return list && list[0] && list[0].rawValue ? list[0].rawValue : null; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function scan(jsQR, image) {
    var canvas = root.document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return Promise.resolve(null);
    var i = 0, t0 = Date.now();
    return new Promise(function (resolve) {
      function next() {
        if (i >= ATTEMPTS.length || Date.now() - t0 > TIME_LIMIT) return resolve(null);
        var a = ATTEMPTS[i++];
        try {
          var sx = Math.round(a[0] * image.width), sy = Math.round(a[1] * image.height);
          var sw = Math.max(1, Math.round(a[2] * image.width)), sh = Math.max(1, Math.round(a[3] * image.height));
          var k = Math.min(a[4], MAX_SIDE / Math.max(sw, sh));
          var w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
          canvas.width = w; canvas.height = h;
          ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
          var code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) return resolve(code.data);
        } catch (e) {}
        setTimeout(next, 0); // даём интерфейсу дышать между попытками
      }
      next();
    });
  }

  // createImageBitmap есть не во всех WebView и может синхронно бросить исключение.
  // В этом случае читаем файл через <img> и объектный URL.
  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      var url;
      try { url = root.URL.createObjectURL(file); } catch (e) { return reject(new Error('image_load')); }
      var img = new root.Image();
      function cleanup() {
        try { root.URL.revokeObjectURL(url); } catch (e) {}
      }
      img.onload = function () {
        resolve({
          source: img,
          release: function () { cleanup(); },
        });
      };
      img.onerror = function () {
        cleanup();
        reject(new Error('image_load'));
      };
      img.src = url;
    });
  }

  function loadSource(file) {
    if (typeof root.createImageBitmap === 'function') {
      try {
        return Promise.resolve(root.createImageBitmap(file)).then(function (bmp) {
          return {
            source: bmp,
            release: function () { if (bmp && typeof bmp.close === 'function') bmp.close(); },
          };
        }, function () { return loadImageElement(file); });
      } catch (e) { return loadImageElement(file); }
    }
    return loadImageElement(file);
  }

  // Возвращает Promise<string|null>: текст QR или null, если код не найден.
  function decode(file) {
    if (!file) return Promise.reject(new Error('image_missing'));
    var loaded = null;
    return loadSource(file).then(function (item) {
      loaded = item;
      return tryDetector(item.source);
    }).then(function (text) {
      if (text) return text;
      return loadJsQr().then(function (jsQR) { return scan(jsQR, loaded.source); });
    }).finally(function () {
      if (loaded && loaded.release) loaded.release();
    });
  }

  root.ReceiptPhoto = { decode: decode };
})(window);
