# Общая сводка по месяцам (2026-10-29)

- [x] Экран `months`: период 3/6/12, итоги и суммы по месяцам, переход к месяцу.
- [x] Кнопка-месяц, BackButton, i18n, CSS, README, версии ассетов.
- [x] Тесты и проверки: 168/168, syntax/diff.
- [ ] Визуальный smoke в Telegram и review перед публикацией.

# UI/UX v2

- [x] Этапы 0–5 локально.
- [x] Интеграция с origin/main515ac88, сохранение новых функций.
- [x] Push feature/ui-ux-v2 и merge/push main: b7bdae6.
- [ ] Telegram Android/iOS/Desktop: touch/offline/background/reduced motion/FPS.

- [x] Исправить home-only плюс/повторную анимацию/4 равные области; 134 теста, browser320/375.
- [x] Публикация исправления в main (07c8886, 229bcac).

# Платежи / Напоминания / Задачи (2026-11-03)

- [x] Этап 1 — аудит репозитория, схемы, авторизации, финансов, уведомлений.
- [x] Этап 2 — модели данных, OpenAPI 3.1, FRONTEND_API_CONTRACT, генератор TS-типов: `docs/api/`.
- [x] Этап 3 — согласование и публикация контракта для frontend.
- [x] Этап 4 — миграции 018–022, серверная реализация, валидация.
- [x] Этап 5 — интеграция с финансами и уведомлениями (dual-write, outbox).
- [x] Этап 6 — тесты: 48/48 на `node --test tests/*.test.mjs`.
- [x] Этап 7 — документация, rollback/деплой-план, деплой-чеклист `docs/api/DEPLOY_CHECKLIST.md`.
- [x] Деплой: миграции 018–022, `api` v18, `notify` v10, cron восстановлен.
- [ ] Smoke старого UI пользователем: создание/оплата/удаление регулярного платежа.
- [ ] Наблюдение 48 ч: outbox failed/attempts, дубли расходов, логи `api`/`notify`.
- [ ] Фронтенд: платежи, напоминания, задачи по контракту.

# SWR / производительность (2026-10-26)

- [x] Аудит текущего main и исходный замер.
- [x] Исправления SWR, инвалидации, рендеринга и гонок.
- [x] Автотесты сценариев и VM benchmark.
- [x] Один итоговый прогон: 152/152, syntax/diff; отчёт и локальный пакет (без push).
- [ ] Ручной Telegram Android/iOS и проверка реального backend.


# Демо-анимация (2026-10-28)
- [x] Перенести поведение «Старая (приблизительно)» и выровнять кромку панели.
- [x] Проверить отскоки, прерывания и reduced motion; 160/160 тестов.
- [ ] Review и визуальная проверка Telegram перед merge.

# История по 3 дня (2026-10-30)
- [x] Ограничить историю 3 днями и догружать по 3 дня при прокрутке.
- [x] Тест батчей в tests/views.test.cjs; 169/169.
- [x] Пересчитать `?v=` ассетов (build f12eb25c6e3d).
- [ ] Проверить ленту в Telegram.

# Редактирование расхода (2026-11-02)
- [x] Real-mode `Api.updateTx` отправляет `update_tx`.
- [x] Тесты real-mode, README, версии ассетов (build d8ad8a2ee103).
- [x] Merge/deploy: backend PR #2, api v16, Pages run 41398606587.
- [ ] Ручной smoke в Telegram: перенести расход в другую категорию.


# Интеграция платежей REST v1

- [x] Объединение актуального frontend и контракта в рабочей ветке.
- [x] REST-адаптер и список всех шаблонов, ограничения формы, тесты.
- [x] Зеркало miniapp, frontend 188/188, backend 51/51, Deno check, browser demo smoke.
- [ ] Проверка в Telegram и согласованный rollout.

## Личный трекер задач — 2026-11-03
- [x] Frontend и demo-адаптер, формы/сортировка/повторы, интеграция навигации/кэша.
- [x] Автотесты и требования подключения backend: docs/tasks-adapter.md.
- [ ] Согласовать backend API и подключить APP_TASKS_ADAPTER; Telegram smoke (touch, уведомления, server purge).

# Плашка предстоящих платежей — 2026-11-05
- [x] Вернуть вызов `dueBanner(plans)` в `renderSummary` (потерян в 28985c4).
- [x] Регрессионный тест в `tests/views.test.cjs`; 214/214.
- [x] Пересчитать `?v=` ассетов (build `80f1232195eb`).
- [ ] Telegram smoke: окно `reminder_days`, день платежа, крестик до завтра, кнопка оплаты.

# Напоминания — PR #16
- [x] Календарь, CRUD, repeat, pause/resume/complete, уведомления-настройки, demo mock.
- [ ] Production-адаптер с актуальным docs/api и Telegram smoke.

# Задачи на сегодня (2026-11-05)
- [x] Аудит, карточка на главной, единый контроллер/API/cache, прогресс, повторы, защита от гонок, ошибки и смена дня.
- [x] Node 217/217, JS syntax, asset versioning, diff.
- [ ] Telegram/mobile visual smoke (Chromium socket permission в среде), PR review и merge.

# Редизайн напоминаний — 2026-11-05
- [x] Calendar & Timeline, палитра приложения, неделя/месяц, фильтры и дата, стабильный FAB, частичный рендер; существующие формы/API сохранены.
- [x] Регрессии reminders/modules-rest 19/19, syntax/diff; исходный сбой теста трекера подтверждён отдельно (см. HANDOFF).
- [ ] Telegram visual smoke 320/360/390/430 px и production CRUD/complete.

## Leisure — 9 ноября 2026

- [x] Аудит PR #26 и настоящего backend, real PBF import, backend/frontend, security/DB tests.
- [ ] Ревью PR и визуальный Telegram smoke; production migration/deploy и первый импорт после отдельного разрешения.

- [x] Реальный импорт Воронежа: 1203 уникальных OSM POI, 9 категорий; оптимизированный streaming importer + Python integration test.
- [ ] Разрешённые пользователем migration/deploy/import: ожидают подключения Supabase/доступа к хосту; CLI MCP config read-only. Main merge не разрешён.

- [x] Production migration leisure 20261109121747, deploy leisure v1, Voronezh1203 bootstrap, DB rollback security/functional tests.
- [ ] Полный GeoNames registry + регулярный worker: нужен существующий server/SSH. Telegram end-to-end + публикация frontend после отдельного разрешения.

- [x] 2026-11-09 Фон приложения: реализация, IDB/настройки, тесты и документация (feature/app-background-customization).
- [ ] Фон: PR review и Telegram visual/gesture smoke; main merge только по отдельному разрешению.
