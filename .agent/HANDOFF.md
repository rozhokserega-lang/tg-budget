# Передача

## Статус

Подписки/пробный период временно отключены и выкачены. Ветки PR #21 (клиент) и #9 (сервер) смержены в main; production обновлён.

## Production

- `api` v22 ACTIVE.
- `bot` v13 ACTIVE.
- Клиент: GitHub Pages build `4de9ca8c2172`, https://rozhokserega-lang.github.io/tg-budget/.
- `SUBSCRIPTIONS_ENABLED` в секретах отсутствует → серверный флаг false.

## Изменённые пути

- Текущая задача (плашка предстоящих платежей): `src/views.js` — вернули `dueBanner(plans)` в `renderSummary`; `tests/views.test.cjs` — регрессионный тест и подключение `recurring.js` в setup; `index.html` — пересчитаны версии ассетов (build `80f1232195eb`).
- Клиент: `src/state.js`, `src/views.js`, `src/app.js`, `src/api.js`, `tests/views.test.cjs`, `index.html`, `README.md`.
- Сервер: `supabase/functions/api/index.ts`, `supabase/functions/api/v1_http.ts`, `supabase/functions/bot/index.ts`.
- Документация/зеркало: `docs/PROJECT.md`, `miniapp/`.

## Проверки

- Клиент: syntax OK, 214/214 (`node --test`), `git diff --check` OK.
- Backend: 58/58, Deno check api/bot/notify/admin OK.
- Деплой: `api` и `bot` ACTIVE; Pages отдаёт `app-build=4de9ca8c2172`.
- Не проверено: Telegram smoke с истёкшим `plan_until` и `/промо`.

## Откат/включение

Включить подписки: `SUBSCRIPTIONS_ENABLED=true` в секретах `api`/`bot`, задеплоить обе функции, затем `SUBSCRIPTIONS_ENABLED = true` в `src/state.js` и опубликовать клиент. Данные и таблицы не удалялись.

## «Задачи на сегодня» (2026-11-05)
- Ветка `feat/home-today-tasks`: src/app.js, tasks-model.js, tasks-views.js, tasks.js, views.js; styles/tasks.css, index.html, tests/tasks.test.cjs, tests/app.test.cjs, README.md.
- Карточка внизу дашборда, общий контроллер и BudgetCache, существующий complete с ключом повтора; прогресс по исходному due_on сегодня, просрочка отдельно в списке. Нового API/хранилища нет.
- 217/217 Node tests после исправления timer/API stubs тестовой среды; JS syntax и diff OK. Версии ресурсов пересчитаны.
- Browser/Telegram smoke не выполнен: Chromium в среде не запускается (socket permission). Проверить 320/375 px, анимации, реальные backend complete/restore, смену дня и фон.

## Редизайн «Напоминания» — 2026-11-05
- Пути: src/reminders-views.js, src/reminders.js, styles/reminders.css, src/app.js (только host/рендер напоминаний), index.html (версии 4 ресурсов), tests/reminders.test.cjs.
- Календарь: неделя по умолчанию, месяц раскрывается; смена недели/месяца, сохранение даты, индикаторы серверных occurrences. Фильтры today/upcoming/overdue; выбор дня — явный date-режим без активного сегмента. Upcoming ограничен существующим горизонтом загрузки (год вперёд), расчёт повторов остаётся на сервере.
- Частичное обновление регионов сохраняет FAB/scroll/details; подтверждение показывает галочку после успеха, защищено busy/idempotency. Расписания и pause/resume/delete доступны из details и формы; paused исключены из активной просрочки.
- Проверки: общий прогон 220/221; единственный сбой task module opens in app… (/value="manual" selected/) воспроизведён на исходном src/app.js main. Итоговый полный прогон после новых тестов: 223/224, тот же исходный сбой. Адресный прогон reminders/modules-rest: 19/19; JS syntax и diff check OK.
- Chromium не запускается: socket() Operation not permitted. Визуальный/интерактивный Telegram smoke 320/360/390/430 px, safe area, реальный backend и reduced motion остаются непроверенными. Backend/API/DB не менялись.

## Leisure — 9 ноября 2026

- Публичная ветка feature/leisure-mvp, PR #26: src/leisure.js, app.js, styles/leisure.css, index.html; backend/leisure — deployable package; tests/leisure.test.cjs, docs/leisure.md, README.
- Backend-схема проверена через GitHub в приватном tg-budget-app; новая функция зеркалируется в supabase/functions/leisure, SQL — 20261109120000_leisure.sql, config verify_jwt=false с HMAC внутри.
- Проверки: 227/228 клиент (старый task-sort expectation, baseline также падает), 2/2 backend PGlite/HMAC, Deno новой функции и Python compile PASS. Geofabrik Kaliningrad real parse 961 POI, 9 категорий. Overpass 406. Chromium socket EPERM; visual/Telegram NOT RUN.
- Main/production не трогали. Требуются отдельные разрешения на миграцию/deploy по backend AGENTS.md и на merge по пользователю. Региональные источники конфигурируются; города без импорта честно показывают ожидание. Полный отчёт/запуск: docs/leisure.md.

### Запуск разрешён; доступ пока не подключён

- «Приступай» = разрешение пользователя на migration/deploy и импорт Воронежа; не на main merge. Не просить это разрешение повторно.
- Real Central district PBF: Voronezh 1203 unique IDs / 9 категорий (категории и SHA в docs/leisure.md). Optimized importer FileProcessor + KeyFilter, sparse_file_array; Python fixture PASS, Kaliningrad same 961 IDs.
- Клиент Supabase MCP не добавлен: codex config read-only, mcp list empty/login no server. Supabase plugin найден и предложен; ещё не подключён. Доступов Supabase/DB/SSH нет, production leisure NOT_FOUND. Следующий шаг после подключения — production схема → миграция → deploy → импорт → регулярный worker на доступном существующем хосте.

### Production bootstrap выполнен
- Supabase миграция leisure version20261109121747, Edge leisure v1 ACTIVE; функция сама проверяет Telegram HMAC.
- В БД1203 real Voronezh POI,1203unique city-place links, справочник пока1city. Персональные данные не менялись, rollback tests реальной БД PASS; отсутствие авторизации401, catalog GET200; RLS/grants проверены.
- Синхронизировать canonical backend migration filename с actual20261109121747 (старый20261109120000 не применять). Пакет tools/leisure/migrations/001 остаётся копией SQL для тестов.
- Блокер только server/SSH для cron worker + full GeoNames registry; Telegram end-to-end не проверен, frontend main не публиковать без отдельного разрешения. Подробности docs/leisure.md.

### Публикация завершена
- Явное разрешение «Запускай все в продакшн»: PR22 backend и PR26 frontend merged в main; frontend f07456d, backend e925349.
- Pages run42617519559 success; live index leisure JS/CSS присутствуют, catalog API200. Production rollout выполнен для Воронежа.
- Нужны пользовательский Telegram smoke и existing host/SSH для регулярного импорта + полный registry; source-refresh пока не автоматизирован. Daily recommendation rotation SQL от этого не зависит.

### Leisure UI: A–D mix
- src/leisure.js, styles/leisure.css, tests/leisure.test.cjs, index.html assets, docs/leisure.md. Новые локальные view/filter/deck/calendar состояния; API без изменений. Категорийные SVG-сцены подписаны «Иллюстрация». D — честная координатная схема, без имитации улиц/платных tiles, external Yandex link.
- Leisure6/6 PASS. Cloud Browser localhost не увидел приложение: invalid bearer token; CUA завершён. Visual Telegram smoke нужен.
