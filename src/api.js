/**
 * Клиент Edge Function `api`: POST { initData, action, ... }.
 * Все данные семьи доступны только через неё — прямой доступ к Supabase не нужен.
 * Вне Telegram (нет initData) работает демо-режим: DEMO_API из state.js.
 */

(function (root) {
  var params = new URLSearchParams(root.location.search);
  var apiUrl = params.get('api') || root.APP_API_URL || '';
  var demo = params.has('demo');

  function ApiError(code, status, data) {
    this.name = 'ApiError';
    this.code = code || 'network';
    this.status = status || 0;
    this.data = data || null;
    this.message = MESSAGES[this.code] || 'Что-то пошло не так. Попробуйте ещё раз.';
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  // Сообщения для ошибок, которые приложение не обрабатывает отдельно.
  // no_household и unauthorized обрабатываются в app.js, поэтому здесь их нет.
  var MESSAGES = {
    network: 'Нет связи с сервером. Проверьте интернет и повторите.',
    no_config: 'Не настроен адрес API — укажите APP_API_URL в index.html.',
    bad_code: 'Такого кода нет. Проверьте, что скопировали его полностью.',
    household_full: 'В этой семье уже двое участников.',
    subscription_expired: 'Пробный период закончился. Добавлять записи пока нельзя.',
    bad_amount: 'Проверьте сумму: нужно положительное число.',
    bad_category: 'Такой категории нет в вашей семье.',
    unknown_action: 'Приложение устарело — обновите его.',
    invalid_json: 'Сервер вернул непонятный ответ.',
    bad_promo: 'Такого промокода нет.',
    promo_used: 'Этот промокод уже активирован.',
    bad_name: 'Введите название.',
    bad_goal: 'Выбранной цели нет в вашей семье.',
    not_found: 'Запись уже удалена или не найдена.',
  };

  function isDemo() {
    return demo || !root.Tg.isInsideTelegram();
  }

  function call(action, payload) {
    if (isDemo()) return root.DEMO_API.call(action, payload || {});
    if (!apiUrl || apiUrl.indexOf('<project-ref>') !== -1) {
      return Promise.reject(new ApiError('no_config'));
    }
    var body = Object.assign({ initData: root.Tg.initData(), action: action }, payload || {});
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(
      function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            if (!res.ok) throw new ApiError('network', res.status);
            throw new ApiError('invalid_json', res.status);
          }
          // Функция иногда отвечает 200 с { error: ... } — считаем это ошибкой.
          if (data && data.error) throw new ApiError(data.error, res.status, data);
          if (!res.ok) throw new ApiError('network', res.status, data);
          return data;
        });
      },
      function () {
        throw new ApiError('network');
      }
    );
  }

  root.Api = {
    call: call,
    ApiError: ApiError,
    isDemo: isDemo,
    url: apiUrl,
  };
})(window);
