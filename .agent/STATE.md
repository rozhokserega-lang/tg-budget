# Текущее состояние

2026-11-05. Подписки и пробный период временно отключены в production.

- Сервер: `api` v22 и `bot` v13 — ACTIVE. Секрет `SUBSCRIPTIONS_ENABLED` не задан, поэтому флаг выключен по умолчанию. Проверка `plan_until` в legacy API и v1 не блокирует записи; `plans` возвращает `[]`; `create_invoice`/`redeem_promo` — 403; бот не блокирует записи и не активирует `/промо`. `successful_payment` оставлен для старых счетов.
- Клиент: GitHub Pages build `4de9ca8c2172` — https://rozhokserega-lang.github.io/tg-budget/. Раздел «Подписка и промокоды», paywall и баннеры пробного периода скрыты; `State.isExpired()` всегда false.
- Данные `plan_until`, тарифы, промокоды и платежи сохранены. Рекуррентные платежи и напоминания не затронуты.
- Проверки: клиент 213/213, backend 58/58, Deno check api/bot/notify/admin OK. Production: функции ACTIVE, Pages отдаёт новый build.

2026-11-05, плашка предстоящих платежей: `renderSummary` снова вызывает `dueBanner(plans)` — вызов был потерян в 28985c4 (`src/views.js`). Регрессионный тест добавлен. Проверки: клиент 214/214, `node --check src/app.js` OK; версии ассетов пересчитаны (build `80f1232195eb`).

Не закрыто: Telegram smoke на семье с истёкшим `plan_until` (запись должна проходить), проверка скрытого раздела подписки и ответа `/промо`; Telegram smoke плашки (напоминание за N дней/в день платежа, крестик, кнопка оплаты).

Включение обратно: задать `SUBSCRIPTIONS_ENABLED=true` в секретах проекта, задеплоить `api` и `bot`, поставить `SUBSCRIPTIONS_ENABLED = true` в `src/state.js` и опубликовать клиент.

2026-11-05. «Задачи на сегодня»: реализована карточка после финансовых блоков в `feat/home-today-tasks`. Общие Tasks controller/cache/API, до 4 строк, сегодняшний прогресс без просрочки, завершение повторов существующим complete. Проверки: 217/217 Node tests; syntax и diff OK. Browser smoke заблокирован запуском Chromium (`socket() Operation not permitted`); Telegram/mobile visual smoke остаётся. Следующий шаг: PR в main, без слияния.

2026-11-05. Страница «Модули»: добавлены сетка/список, SVG-переключатель и четыре SVG-иконки. Выбор хранится локально в `tg-budget-modules-view`, применяется до отрисовки; переключение на существующих DOM-узлах с transform/opacity 180 мс и reduced-motion. Изменены app.js, payments-views.js, payments.css и версии ассетов index.html. Тесты и браузерные проверки не запускались по указанию пользователя. Следующий шаг: пользовательская проверка в Telegram.

2026-11-05. Редизайн «Напоминания»: Calendar & Timeline, палитра приложения, неделя/месяц, фильтры/дата, отдельный таймлайн, стабильный FAB, частичное обновление регионов DOM. CRUD/повторы/API сохранены, backend-контракты не менялись. Реализация готова к записи в main; следующий шаг — визуальный Telegram smoke 320/360/390/430 px. Проверки и ограничение среды: см. HANDOFF.

2026-11-09. Leisure: PR #26 переработан в серверный модуль; см. docs/leisure.md. Backend найден в rozhokserega-lang/tg-budget-app; настоящая схема сверена. Пакет backend/leisure содержит миграцию, Edge Function, offline OSM importer/worker и тесты. Реальный Kaliningrad PBF: 961 POI / 9 категорий. Node 227/228 (старый task-sort сбой воспроизведён на baseline), backend 2/2, новая функция Deno OK. Production не развёрнут; Chromium socket EPERM блокирует visual smoke. Следующий шаг: ревью парных PR, затем отдельное разрешение на миграцию/deploy/публикацию.
