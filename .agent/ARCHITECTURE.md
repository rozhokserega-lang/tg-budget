# Карта проекта

Статический Telegram Mini App, Vanilla JS/HTML/CSS, без package.json и сборки. Скрипты используют браузерные глобальные объекты, а не ES imports.

- `index.html` — вход, подключение ресурсов и конфигурация API; `admin.html` — административная страница.
- `src/app.js` — управление интерфейсом/событиями; `views.js` — разметка; `state.js` — состояние и кэш.
- `src/api.js` — клиент Edge Function; `demo.js` — демо; `telegram.js` — Telegram SDK.
- `src/queue.js` — очередь записи с localStorage; `recurring.js` — календарные расчёты регулярных платежей.
- `src/cache.js` — memory-only TTL/dedup/epoch/scope; app зеркалит данные месяца в state для views и оптимистичных операций.
- `src/format.js`, `i18n.js`, `covers.js` — форматирование, переводы, обложки.
- `styles/`, `icons/`, `covers/`, `legal/` — оформление, ресурсы и юридические страницы.
- `tests/recurring.test.cjs` — Node test runner: `node --test tests/recurring.test.cjs` из репозитория.
- `scripts/version-assets.mjs` — версии ресурсов; изменяет HTML, поэтому не запускать для проверки памяти.

Бэкенд Supabase Edge Functions внешен этому checkout. README содержит ссылки на отсутствующие здесь `miniapp/` и `../files`; перед применением команд адаптировать пути. Точные API-контракты проверять адресно в коде при соответствующей задаче.
