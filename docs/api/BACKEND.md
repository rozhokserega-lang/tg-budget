# Backend v1 — модель данных, миграции, фоновые задачи, деплой

Статус: проект (Этап 2). Реализация — Этапы 4–5. Контракт: `FRONTEND_API_CONTRACT.md`, OpenAPI: `openapi.v1.yaml`.
Серверный исходник: `../teletreker` (`tg-budget-app`), `supabase/`.

## 1. Аудит: что уже есть

| Слой | Сейчас |
|---|---|
| API | одна Edge Function `api`: `POST /functions/v1/api` `{initData, action}`; ~40 действий |
| Авторизация | `verifyInitData` (HMAC `WebAppData` + BOT_TOKEN), `auth_date` ≤ 24 ч |
| Доступ к БД | `service_role`; RLS включён без политик |
| Семья | `households` (timezone, plan_until) + `members` (telegram_id, notifications jsonb) |
| Финансы | `transactions` (`amount numeric(14,2)`, `occurred_on date`, `deleted_at`), `categories` |
| Регулярные платежи | `recurring_payments` (`day_of_month`, `reminder_days`, `active`); `pay_recurring` сразу создаёт `transactions` |
| Уведомления | `notify` по pg_cron `*/5 * * * *` + `x-cron-secret`; маркеры `reminders_sent`, `limit_alerts`, `digests_sent` |
| Тесты | серверных нет; фронтовые — `miniapp/tests/*.test.cjs` (node) |

Чего нет: occurrence-моделей, общего движка повторений, личных напоминаний, задач, очереди уведомлений с ретраями/отменой, идемпотентности, OpenAPI.

## 2. Принципы реализации

- REST v1 добавляется **внутрь существующей функции `api`**: маршрутизация по `pathname` (`/api/v1/...`), старые action-запросы (`/` + body.action) не меняются.
- Единственный движок повторений — `supabase/functions/_shared/recurrence.ts` (чистый TS без зависимостей), используется `api` и `notify`. Тестируется через `node --test` (type stripping Node ≥ 22).
- Уведомления — одна очередь `notification_outbox`; старые `limit/digest/daily` не трогаем.
- Миграции аддитивные. `recurring_payments` не удаляем; старый UI продолжает работать через dual-write adapter.
- Суммы — `numeric(14,2)`. Валюта — ISO 4217, по умолчанию `RUB`; источник — `module_preferences.currency` (настройка пользователя), снимок пишется в шаблон и начисление. Конвертации нет: финансовая модель остаётся одновалютной, валюта — ярлык/снимок. Даты — `date`, моменты — `timestamptz` (UTC) + `timezone` сущности.
- Все проверки прав — по `member.id` из initData, `household_id` — из `members`; клиентские id игнорируются.
- Новые write-эндпоинты подчиняются существующему гейту `plan_until` (`402 SUBSCRIPTION_EXPIRED`).

## 3. Модель данных (проект DDL)

### 3.1. Общие

```
timezone            text not null default 'Europe/Moscow'   -- на households уже есть
recurrence_rule     jsonb null  CHECK (recurrence_rule is null or jsonb_typeof(...)='object')
notification_rules  jsonb not null default '[]'
version             int not null default 1
```

`recurrence_rule`: `{frequency, interval, weekdays?, timezone}`. Валидация — TS-валидатор до записи + `CHECK` на ключи.

### 3.2. Платежи

`payment_templates`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid PK | |
| household_id | uuid NN | FK households cascade |
| legacy_recurring_id | uuid null | FK `recurring_payments(id)` on delete set null, unique |
| title | text NN | 1…120 |
| description | text null | ≤ 1000 |
| planned_amount | numeric(14,2) NN | > 0 |
| currency | text NN default 'RUB' | ISO 4217 `^[A-Z]{3}$`, снимок |
| category_id | uuid null | FK categories on delete set null |
| recurrence_rule | jsonb null | |
| first_due_date | date NN | |
| timezone | text NN | |
| notification_rules | jsonb NN default '[]' | ≤ 10 |
| overdue_rule | jsonb null | `{everyDays,maxCount,time}` |
| status | text NN default 'active' | active \| paused |
| created_by | uuid NN | FK members |
| created_at/updated_at | timestamptz NN | |
| deleted_at | timestamptz null | soft delete |
| version | int NN default 1 | |

Индексы: `(household_id, deleted_at, status)`, `(household_id, first_due_date)`.

`payment_occurrences`

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid PK | |
| household_id | uuid NN | денормализация для выборок |
| template_id | uuid NN | FK templates cascade |
| due_date | date NN | unique `(template_id, due_date)` |
| planned_amount | numeric(14,2) NN | снимок на момент генерации |
| currency | text NN default 'RUB' | снимок из шаблона, `^[A-Z]{3}$` |
| status | text NN default 'pending' | pending \| overdue \| paid |
| paid_at | timestamptz null | |
| actual_amount | numeric(14,2) null | |
| actual_date | date null | |
| actual_category_id | uuid null | |
| expense_id | uuid null | FK transactions, **unique** |
| confirmed_by | uuid null | FK members |
| created_at/updated_at | timestamptz NN | |

Индексы: `(household_id, due_date)`, `(status, due_date)`, partial `(template_id) where status <> 'paid'`.
Правило: `expense_id` заполняется ровно один раз; `unique(expense_id)` — серверная защита от второго расхода.

### 3.3. Напоминания (личные)

`reminders`: id, owner_id (FK members cascade), title, description, starts_at timestamptz, timezone, priority (`normal|important`), recurrence_rule, notification_rules, status (`active|paused`), version, created_at, updated_at, deleted_at.

`reminder_occurrences`: id, reminder_id (FK cascade), scheduled_at timestamptz, local_date date, status (`pending|overdue|completed`), completed_at, created_at; unique `(reminder_id, scheduled_at)`; index `(reminder_id, status, scheduled_at)`.

Доступ: только `owner_id = current member`. Чужой id → `404`.

### 3.4. Задачи

`task_lists`: id, owner_id, title, version, created_at, updated_at, deleted_at; index `(owner_id, created_at)`.

`task_series` (шаблон повторения): id, owner_id, title, description, timezone, priority, recurrence_rule NN, notification_rules, anchor_at timestamptz, list_id null, active bool, created_at, updated_at. Не хранит историю и не имеет `completed_at`.

`tasks` (экземпляры):

| Колонка | Тип | Ограничения |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid NN | |
| list_id | uuid null | FK task_lists on delete set null |
| series_id | uuid null | FK task_series on delete set null |
| title, description | text | |
| due_at | timestamptz null | |
| timezone | text NN | |
| priority | text NN | normal \| important |
| recurrence_rule | jsonb null | null у экземпляров; в API подставляется из серии |
| notification_rules | jsonb NN | |
| status | text NN default 'active' | active \| completed |
| sort_order | int NN default 0 | |
| completed_at | timestamptz null | |
| delete_after | timestamptz null | `completed_at + 30 days` |
| created_at/updated_at | timestamptz NN | |
| deleted_at | timestamptz null | soft delete экземпляра |
| version | int NN | |

Индексы: `(owner_id, status, sort_order)`, `(owner_id, due_at)`, `(owner_id, completed_at desc)`, unique `(series_id, due_at)` — включая soft-deleted, чтобы удалённый экземпляр не возрождался.

`module_preferences`: `member_id` PK, `selected_task_list_id` uuid null, `task_sort_mode` text NN default `due` (`due|priority|created|manual`), `currency` text NN default `RUB` (`^[A-Z]{3}$`), `updated_at`.

### 3.5. Очередь уведомлений и идемпотентность

`notification_outbox`: id, recipient_member_id, household_id, kind (`payment|reminder|task`), entity_id, occurrence_id, scheduled_at, status (`pending|sent|failed|canceled`), attempts int default 0, last_error, locked_at, sent_at, dedupe_key text **unique**, created_at.

`dedupe_key` = `payment:<occurrenceId>:<offsetMinutes>` / `reminder:<occurrenceId>:<offsetMinutes>` / `<kind>:<occurrenceId>:overdue:<n>`.
Индексы: `(status, scheduled_at)`, `(entity_id)`, `(recipient_member_id, created_at)`.

`idempotency_keys`: `member_id`, `key`, `endpoint`, `request_hash`, `status_code`, `response jsonb`, `created_at`, `expires_at`; PK `(member_id, key)`. Хранить 24 ч, чистить фоновым обработчиком.

## 4. Генерация повторений

`_shared/recurrence.ts` (чистые функции, без Deno API):

- `validateRule(rule)` → нормализованное правило или ошибка.
- `nextOccurrence(after, anchor, rule, tz)` → локальная дата/момент.
- `occurrencesBetween(anchor, rule, tz, from, to, limit)` → массив.
- `localDate(instant, tz)`, `toUtc(localDateTime, tz)`.

Правила: clamp 29–31 числа, 29 февраля → 28.02, DST — сохранять локальное время; несуществующее время сдвигать вперёд, неоднозначное — раннее смещение.

Окна материализации (идемпотентно, `ON CONFLICT DO NOTHING`):

| Модуль | Назад | Вперёд | Лимит |
|---|---|---|---|
| payments | 366 дней (только overdue) | 90 дней | 500/запрос, 120/шаблон |
| reminders | 2 дня | 60 дней | 200/запрос |
| tasks | 0 | 30 дней, по 1 экземпляру на серию | 60/серия |

Триггеры генерации: чтение календаря (api), фоновый обработчик (notify), создание/изменение шаблона, подтверждение/выполнение.
При возобновлении напоминания/серии генерация начинается с ближайшего будущего события — пропущенное не рассылается.

## 5. API-слой

- `api/index.ts` получает `pathname`; если после `/api` идёт `/v1` — `handleV1(req, url, pathStart)` из `api/v1.ts`, иначе текущий action-протокол.
- Авторизация: `api/v1_http.ts`, `Authorization: tma <initData>` → тот же `verifyInitData`; `member` и `household` — из БД.
- Валидация: `api/v1_validate.ts` (типы, enum, даты, суммы, IANA, лимиты правил).
- Ошибки: `api/v1_errors.ts` + `api/v1_http.ts` → `{error:{code,message,details}}`, CORS, `X-Contract-Version`.
- Сериализация: `api/v1_serialize.ts` (snake_case БД → camelCase контракта).
- Идемпотентность: `idempotent()` в `api/v1_http.ts` читает `Idempotency-Key`, считает `sha256(body)`, ищет/пишет `idempotency_keys`.
- Транзакции подтверждения/выполнения/удаления списка/переупорядочивания — plpgsql-функции, вызываемые через `rpc`, а не серия PostgREST-запросов.

### Dual-write adapter (совместимость)

| Legacy | Новое поведение |
|---|---|
| `save_recurring` | upsert `payment_templates` по `legacy_recurring_id` (monthly, `first_due_date` = ближайшее число) + запись в `recurring_payments` |
| `delete_recurring` | soft-delete шаблона + удаление строки `recurring_payments` |
| `pay_recurring` | legacy-RPC создаёт `transactions`, адаптер `legacy_sync.ts` связывает её с ближайшим начислением (`expense_id`, `actual_*`), второй расход не создаётся; ответ сохраняет `{ok, transaction}` |
| `due_reminders` | исключает `recurring_payments`, у которых есть неудалённый `payment_templates.legacy_recurring_id` (их ведёт `notification_outbox`) |

## 6. Фоновые задачи

Edge Function `notify` (pg_cron `*/5 * * * *`, `x-cron-secret`):

1. Материализация повторений и просрочек (bounded, `skip locked`).
2. Постановка уведомлений в `notification_outbox` на 7 дней вперёд + overdue-повторы.
3. Отправка: claim 100 строк (`FOR UPDATE SKIP LOCKED`), проверка актуальности (шаблон active, событие не paid/completed, владелец существует), `sendMessage`, `sent`; ошибка → `attempts+1`, backoff `5 мин × 2^attempts`, после 5 попыток — `failed`.
4. Telegram `403 blocked` → `failed` без ретраев; `429` → `retry_after`.
5. Отмена: оплата/выполнение/удаление/пауза → `pending`→`canceled`.
6. Очистка: `completed tasks where delete_after <= now()` (≤ 500/цикл); `notification_outbox` старше 30 дней; `idempotency_keys` старше 24 ч.
7. Затем — существующие `limit_alert_queue`, `digest_queue`, `daily_report_queue` (без изменений).

Идемпотентность: `dedupe_key unique`; повторный запуск не создаёт дублей. Гарантия доставки at-least-once: падение между `sendMessage` и записью `sent` может дать повтор — документированный риск.

## 7. Миграции и бэкфилл

| № | Файл | Содержимое |
|---|---|---|
| 018 | `018_recurrence_and_outbox.sql` | `notification_outbox`, `idempotency_keys`, индексы, cleanup-функции |
| 019 | `019_payments_module.sql` | `payment_templates`, `payment_occurrences`, `confirm_payment_occurrence`; генерация начислений — `_shared/modules.ts` |
| 020 | `020_reminders_module.sql` | `reminders`, `reminder_occurrences`, `complete_reminder_occurrence` |
| 021 | `021_tasks_module.sql` | `task_lists`, `task_series`, `tasks`, `module_preferences`, reorder/cleanup |
| 022 | `022_backfill_payments.sql` | перенос `recurring_payments` → `payment_templates` + первое начисление |

Требования: `if not exists`, без `drop table`, без изменения старых колонок; RLS включить на новых таблицах (политик нет); `revoke execute` на новые функции у `public/anon/authenticated`, `grant execute … to service_role`.

Бэкфилл: `legacy_recurring_id` сохраняет связь; `first_due_date` = ближайшее `day_of_month`; `recurrence_rule = {frequency:'monthly',interval:1,weekdays:null,timezone:households.timezone}`; `reminder_days` → `notificationRules:[{offsetMinutes: reminder_days*1440, time:'10:00'}]`. Повторный запуск безопасен (`on conflict (legacy_recurring_id) do nothing`).

## 8. Rollback-план

1. До миграций: `pg_dump --schema-only` и `pg_dump --data-only` (или Supabase backup/PITR).
2. Откат функций: задеплоить предыдущую версию `api`/`notify` (Supabase хранит версии функции).
3. Откат схемы (обратный порядок 022→018): `drop function` новых RPC, `drop table notification_outbox, idempotency_keys, payment_occurrences, payment_templates, reminder_occurrences, reminders, tasks, task_series, task_lists, module_preferences cascade`.
4. `recurring_payments` не удаляется и не меняется — старый сценарий восстанавливается без потери данных.
5. Расходы, созданные при подтверждениях, остаются в `transactions` (это реальные финансовые записи); при откате их не удалять без согласования.
6. Проверка после отката: `GET /health`, старые действия `summary`, `list_tx`, `save_recurring`, `pay_recurring`.

Откат не выполняется автоматически. Разрушительные шаги — только по согласованию.

## 9. Деплой

Подготовка:

```bash
cd ../teletreker
git checkout -b feature/modules-v1
# 1. бэкап БД (dashboard → Database → Backups, или pg_dump)
# 2. миграции
supabase db push            # либо supabase migration up --include-all
# 3. функции
supabase functions deploy api
supabase functions deploy notify
# 4. секреты (если добавлялись): supabase secrets set ...
```

Проверка:

```bash
curl -sS "https://<ref>.supabase.co/functions/v1/api/v1/health"
# {"ok":true,"version":"1.0.0","time":"..."}
```

Если CLI/MCP недоступны (текущая среда): миграции применяются штатным механизмом проекта (Supabase MCP `apply_migration` / SQL editor), функции — `deploy_edge_function`. MCP сохраняет относительные пути: передаются `api/index.ts`, остальные `api/*.ts` и `_shared/*.ts` (entrypoint `api/index.ts`), для `notify` — `notify/index.ts` + `_shared/*.ts`; проверено на деплое. После деплоя: проверить `cron.job` (`notify-hourly`), логи `notify`, `getWebhookInfo` бота, `Advisors`.

Пошаговый порядок с проверками и rollback — `DEPLOY_CHECKLIST.md`.

## 10. План тестов (Этап 6)

| Файл | Покрытие |
|---|---|
| `tests/recurrence.test.mjs` | даты, interval, weekdays, clamp 29–31, 29.02, DST, границы, мусорные значения |
| `tests/modules.test.mjs` | материализация платежей/напоминаний/задач, overdue, дедупликация очереди, настройки уведомлений, отсутствие бэкфилла |
| `tests/validate.test.mjs` | типы, enum, даты, суммы, IANA, лимиты правил, диапазоны дат |
| `tests/serialize.test.mjs` | маппинг snake_case → camelCase, вложенные объекты, снимок валюты |
| `tests/notification-text.test.mjs` | тексты платежей/напоминаний/задач, локализация дат и сумм |
| `tests/api.test.mjs` | распознавание `/api/v1`, legacy и другие версии не перехватываются |
| `tests/legacy.test.mjs` | dual-write: создание/обновление шаблона из `recurring_payments`, soft-delete, связывание оплаты без второго расхода |
| `tests/fake-db.mjs` | in-memory двойник Supabase-клиента для unit-тестов |

Чистая логика (recurrence, валидация, маппинг, очередь) — `node --test tests/*.test.mjs`. SQL/конкурентность — интеграционные сценарии на тестовой БД (два параллельных `confirm`, `on conflict`, cleanup). Полный прогон — один раз после Этапа 5.

## 11. Согласованные решения

1. **Гейт подписки**: новые write-эндпоинты возвращают `402 SUBSCRIPTION_EXPIRED`, как остальные записи.
2. **`is_shared` при подтверждении платежа**: платёж семьи создаёт общий расход (`is_shared = true`).
3. **Валюта**: берётся из `module_preferences.currency` (настройка пользователя, по умолчанию `RUB`), снимок — в шаблоне и начислении. Конвертации нет.


## Дополнение 1.1.0: список шаблонов

`GET /v1/payment-templates?limit&cursor` читает неудалённые `payment_templates` текущей семьи, включая приостановленные и будущие без начислений. Ответ `PaymentTemplatePage`, сортировка по id; `nextOccurrence` в списке null. Реализация `api/v1_payments_read.ts`, маршрутизация после `getContext`. Новых миграций нет. Требуется обновление функции `api` перед публикацией REST-клиента платежей; legacy-протокол сохраняется. Порядок — `docs/payments-adapter.md`.
