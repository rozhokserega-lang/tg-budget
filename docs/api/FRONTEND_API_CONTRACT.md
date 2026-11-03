# FRONTEND API CONTRACT — TG Budget v1

Версия контракта: **1.1.0** · Дата: 2026-11-03 · Статус: опубликован для frontend-разработки
Канонический источник: `docs/api/openapi.v1.yaml`. При расхождении приоритет у OpenAPI.

> Контракт не меняется без повышения версии. Ломающие изменения — только в `/v2`.
> Совместимые добавления полей и новых значений перечислений — версия `1.x`.

---

## 1. Базовый URL и авторизация

```
https://<project-ref>.supabase.co/functions/v1/api/v1
```

Локально/демо: тот же путь относительно mock-сервера. Legacy-эндпоинт
`POST /functions/v1/api` с телом `{ initData, action }` продолжает работать и не входит в этот контракт.

**Авторизация** — Telegram WebApp `initData`, проверяется на сервере:

```http
Authorization: tma <initData>
```

- Для `GET/DELETE` заголовок обязателен.
- Для `POST/PATCH` заголовок обязателен; дублирование `initData` в теле не требуется.
- `Authorization: tma` без значения, просроченный `auth_date` (> 24 ч) или неверная подпись → `401 UNAUTHORIZED`.
- `user_id`, `member_id`, `household_id`, `owner_id` из тела **игнорируются**. Сервер берёт их из подписи.

**CORS**: `GET, POST, PATCH, DELETE, OPTIONS`; заголовки `authorization, content-type, idempotency-key`.
Ответы содержат `X-Contract-Version: 1.1.0`.

**Общие заголовки запроса**

| Заголовок | Где | Назначение |
|---|---|---|
| `Authorization: tma <initData>` | все | авторизация |
| `Idempotency-Key` | подтверждение оплаты (обязательно), complete/restore/reorder (опционально) | защита от повторов, 8–128 символов `[A-Za-z0-9._:-]` |
| `Content-Type: application/json` | POST/PATCH | тело запроса |

**Формат данных**: JSON, `camelCase`. Время — ISO 8601 UTC (`2026-11-15T07:00:00.000Z`), календарные даты — `YYYY-MM-DD`, деньги — JSON number с максимум 2 знаками (сервер считает в `numeric`, без float). **Валюта** — ISO 4217 (`RUB`, `USD`, `EUR`, …), берётся из настроек пользователя (`currency` в `/module-preferences`), по умолчанию `RUB`. Конвертации нет: сумма — это число в выбранной валюте, смена настройки не пересчитывает прошлые записи.

---

## 2–4. Маршруты, методы, query-параметры

### Платежи

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/payment-templates?limit&cursor` | все неудалённые шаблоны семьи, включая паузы и будущие без начислений |
| GET | `/payments?from&to&status&templateId&limit&cursor` | календарь начислений (включая просроченные) |
| GET | `/payments/{id}` | шаблон платежа |
| POST | `/payments` | создать платёж (разовый или регулярный) |
| PATCH | `/payments/{id}` | изменить шаблон |
| DELETE | `/payments/{id}` | удалить шаблон |
| POST | `/payments/{id}/pause` | приостановить |
| POST | `/payments/{id}/resume` | возобновить |
| GET | `/payment-occurrences/{id}` | одно начисление |
| POST | `/payment-occurrences/{id}/confirm` | подтвердить оплату |

`GET /payment-templates` → `{data: Payment[], pageInfo}`; сортировка по `id`, обычная пагинация. `nextOccurrence` в списке `null`; подробности — через `GET /payments/{id}`. Добавлено в 1.1.0, требуется обновление серверной функции перед публикацией клиента.

`GET /payments`:

| Параметр | Тип | Обяз. | Правила |
|---|---|---|---|
| `from` | date | да | `YYYY-MM-DD` |
| `to` | date | да | `>= from`, диапазон ≤ 370 дней |
| `status` | enum | нет | `pending \| overdue \| paid` |
| `templateId` | uuid | нет | фильтр по шаблону |
| `limit` | int | нет | 1…200, по умолчанию 50 |
| `cursor` | string | нет | из `pageInfo.nextCursor` |

Все просроченные начисления попадают в ответ независимо от `from`, даже если их `dueDate` раньше диапазона. Ответ — `PaymentOccurrencePage`; в каждом элементе вложен краткий `payment` (шаблон).

### Напоминания

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/reminders?from&to&status&priority&limit&cursor` | календарь событий |
| GET | `/reminders/{id}` | напоминание |
| POST | `/reminders` | создать |
| PATCH | `/reminders/{id}` | изменить |
| DELETE | `/reminders/{id}` | удалить |
| POST | `/reminders/{id}/pause` | приостановить |
| POST | `/reminders/{id}/resume` | возобновить |
| GET | `/reminder-occurrences/{id}` | одно событие |
| POST | `/reminder-occurrences/{id}/complete` | отметить выполненным |

Параметры `GET /reminders`: `from`, `to` (обязательны, ≤ 370 дней), `status` (`pending|overdue|completed`), `priority` (`normal|important`), `limit`, `cursor`. Просроченные включаются всегда.

### Списки задач

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/task-lists` | списки пользователя |
| POST | `/task-lists` | создать список |
| PATCH | `/task-lists/{id}` | переименовать |
| DELETE | `/task-lists/{id}` | удалить список (задачи сохраняются) |

### Задачи

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/tasks?listId&status&sort&priority&dueFrom&dueTo&limit&cursor` | задачи |
| GET | `/tasks/completed?listId&limit&cursor` | выполненные за 30 дней |
| GET | `/tasks/{id}` | задача (экземпляр) |
| POST | `/tasks` | создать (с повторением — серия + первый экземпляр) |
| PATCH | `/tasks/{id}?scope=instance\|series` | изменить |
| DELETE | `/tasks/{id}?scope=instance\|series` | удалить |
| POST | `/tasks/{id}/complete` | выполнить |
| POST | `/tasks/{id}/restore` | восстановить |
| PATCH | `/tasks/reorder` | ручной порядок |

Параметры `GET /tasks`:

| Параметр | Тип | По умолчанию | Правила |
|---|---|---|---|
| `listId` | uuid | — | `none` — задачи без списка |
| `status` | enum | `active` | `active \| completed` |
| `sort` | enum | из preferences | `due \| priority \| created \| manual` |
| `priority` | enum | — | `normal \| important` |
| `dueFrom`, `dueTo` | date | — | фильтр по `dueAt` |
| `limit` | int | 50 | 1…200 |
| `cursor` | string | — | пагинация |

`GET /tasks/completed`: сортировка `completedAt desc`, только `deleteAfter > now()`.

### Настройки и служебное

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/module-preferences` | настройки модулей пользователя |
| PATCH | `/module-preferences` | изменить настройки |
| GET | `/health` | проверка доступности API (без авторизации) |

---

## 5–6. Тела запросов и форматы ответов

Одиночный ресурс возвращается объектом верхнего уровня. Списки — `{ "data": [...], "pageInfo": {...} }`.

### Payment (шаблон)

```json
{
  "id": "5f0c2e0e-6a1a-4e39-9c2f-6f8c1a2b3c4d",
  "title": "Аренда квартиры",
  "description": "Оплатить до 15 числа",
  "plannedAmount": 4200,
  "currency": "RUB",
  "categoryId": "0b6f9c1a-1f2e-4d3c-8a9b-7c6d5e4f3a2b",
  "recurrenceRule": { "frequency": "monthly", "interval": 1, "weekdays": null, "timezone": "Europe/Moscow" },
  "firstDueDate": "2026-11-15",
  "timezone": "Europe/Moscow",
  "notificationRules": [{ "offsetMinutes": 1440, "time": "10:00" }, { "offsetMinutes": 0, "time": "10:00" }],
  "overdueNotificationRule": { "everyDays": 3, "maxCount": 5, "time": "10:00" },
  "status": "active",
  "nextOccurrence": { "id": "9a1b...", "dueDate": "2026-11-15", "status": "pending", "plannedAmount": 4200 },
  "createdBy": "member-uuid",
  "createdAt": "2026-11-01T09:00:00.000Z",
  "updatedAt": "2026-11-01T09:00:00.000Z",
  "version": 1
}
```

`PaymentCreateRequest`

| Поле | Тип | Обяз. | Правила |
|---|---|---|---|
| `title` | string | да | 1…120 |
| `description` | string\|null | нет | ≤ 1000 |
| `plannedAmount` | number | да | > 0, ≤ 1e9, 2 знака |
| `currency` | ISO 4217 | нет | по умолчанию `currency` из `/module-preferences` (обычно `RUB`) |
| `categoryId` | uuid\|null | нет | категория своей семьи, `kind=expense`, не архивная |
| `recurrenceRule` | RecurrenceRule\|null | нет | `null` — разовый платёж |
| `firstDueDate` | date | да | для разового — дата платежа |
| `timezone` | IANA | нет | по умолчанию таймзона семьи |
| `notificationRules` | NotificationRule[] | нет | ≤ 10, по умолчанию `[]` |
| `overdueNotificationRule` | OverdueRule\|null | нет | `null` — без повторных |
| `status` | `active\|paused` | нет | по умолчанию `active` |

`PaymentUpdateRequest` — те же поля частично + `version?`; изменение `recurrenceRule`/`firstDueDate`/`plannedAmount` применяется только к **будущим** начислениям, оплаченные не меняются.

### PaymentOccurrence

```json
{
  "id": "9a1b2c3d-...",
  "templateId": "5f0c2e0e-...",
  "payment": { "id": "5f0c2e0e-...", "title": "Аренда квартиры", "categoryId": "...", "currency": "RUB", "status": "active" },
  "dueDate": "2026-11-15",
  "plannedAmount": 4200,
  "currency": "RUB",
  "status": "overdue",
  "paidAt": null,
  "actualAmount": null,
  "actualDate": null,
  "actualCategoryId": null,
  "expenseId": null,
  "confirmedBy": null,
  "createdAt": "2026-10-15T00:00:00.000Z",
  "updatedAt": "2026-11-16T00:05:00.000Z"
}
```

`PaymentConfirmRequest`:

```json
{ "actualAmount": 4200, "actualDate": "2026-11-15", "categoryId": "category-uuid" }
```

`categoryId` обязателен, если у шаблона нет категории; иначе можно не передавать — берётся категория шаблона.
`actualDate` — не в будущем (допуск +1 день по таймзоне), не раньше 2000-01-01. `actualAmount` > 0.

`PaymentConfirmResponse` (200, в т.ч. повторный запрос):

```json
{
  "occurrenceId": "9a1b2c3d-...",
  "status": "paid",
  "expenseId": "e7d6...",
  "actualAmount": 4200,
  "actualDate": "2026-11-15",
  "categoryId": "category-uuid",
  "confirmedBy": "member-uuid",
  "paidAt": "2026-11-15T12:00:00.000Z"
}
```

### Reminder

```json
{
  "id": "r-uuid",
  "title": "Забрать посылку",
  "description": null,
  "startsAt": "2026-11-10T15:00:00.000Z",
  "timezone": "Europe/Moscow",
  "priority": "normal",
  "recurrenceRule": null,
  "notificationRules": [{ "offsetMinutes": 60 }, { "offsetMinutes": 0 }],
  "status": "active",
  "nextOccurrence": { "id": "ro-uuid", "scheduledAt": "2026-11-10T15:00:00.000Z", "status": "pending" },
  "createdAt": "2026-11-01T09:00:00.000Z",
  "updatedAt": "2026-11-01T09:00:00.000Z",
  "version": 1
}
```

`ReminderCreateRequest`: `title`, `description?`, `startsAt` (ISO, обязателен), `timezone?`, `priority?`, `recurrenceRule?`, `notificationRules?`, `status?`.

`ReminderOccurrence`: `{ id, reminderId, reminder: {id,title,priority,status}, scheduledAt, localDate, status, completedAt }`.

`POST /reminder-occurrences/{id}/complete` — тело пустое, ответ `ReminderOccurrence`. Для разового напоминания сервер удаляет и событие, и напоминание, возвращая `{ "deleted": true, "occurrenceId": "...", "reminderId": "..." }`.

### TaskList

```json
{ "id": "l-uuid", "title": "Дом", "taskCount": 4, "activeCount": 3,
  "createdAt": "...", "updatedAt": "...", "version": 1 }
```

`POST /task-lists` → `{ "title": "Дом" }`; `PATCH` → `{ "title": "Дом и быт", "version": 1 }`.

`DELETE /task-lists/{id}` → `{ "deleted": true, "unassignedTasks": 4 }`. Задачи получают `listId: null`.

### Task (экземпляр)

```json
{
  "id": "t-uuid",
  "ownerId": "member-uuid",
  "listId": "l-uuid",
  "seriesId": "s-uuid",
  "title": "Оплатить интернет",
  "description": null,
  "dueAt": "2026-11-20T18:00:00.000Z",
  "timezone": "Europe/Moscow",
  "priority": "important",
  "recurrenceRule": { "frequency": "monthly", "interval": 1, "weekdays": null, "timezone": "Europe/Moscow" },
  "notificationRules": [],
  "status": "active",
  "sortOrder": 1,
  "completedAt": null,
  "deleteAfter": null,
  "createdAt": "2026-11-01T09:00:00.000Z",
  "updatedAt": "2026-11-01T09:00:00.000Z",
  "version": 1
}
```

Для непериодической задачи `seriesId: null`, `recurrenceRule: null`.
`TaskCreateRequest`: `title`, `description?`, `listId?`, `dueAt?`, `timezone?`, `priority?`, `recurrenceRule?`, `notificationRules?`, `sortOrder?`.
С `recurrenceRule` обязателен `dueAt` (якорь расписания); создаётся серия и первый экземпляр, в ответе — он же с `seriesId`.

`POST /tasks/{id}/complete` → `{ "task": Task, "nextTask": Task|null }`.
`POST /tasks/{id}/restore` → `{ "task": Task }`.
`PATCH /tasks/reorder`:

```json
{ "listId": "l-uuid", "items": [ { "id": "t1", "sortOrder": 0 }, { "id": "t2", "sortOrder": 1 } ] }
```

Ответ `{ "data": [Task, ...] }` в новом порядке. `listId: null` — для задач без списка.

### ModulePreferences

```json
{ "selectedTaskListId": "l-uuid", "taskSortMode": "manual", "currency": "RUB", "updatedAt": "2026-11-01T09:00:00.000Z" }
```

`PATCH` принимает `selectedTaskListId` (`null` допустим), `taskSortMode` (`due|priority|created|manual`) и/или `currency` (ISO 4217).

---

## 7. Ошибки

Единый формат:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid payment amount", "details": { "field": "plannedAmount" } } }
```

| HTTP | Код | Когда |
|---|---|---|
| 400 | `BAD_REQUEST` | битый JSON, неизвестный маршрут/метод |
| 401 | `UNAUTHORIZED` | нет/неверный/просроченный initData |
| 402 | `SUBSCRIPTION_EXPIRED` | истёк доступ семьи (только записи) |
| 403 | `FORBIDDEN` | действие запрещено (не владелец ресурса — отвечаем 404) |
| 404 | `NOT_FOUND` | объект не найден или чужой |
| 409 | `CONFLICT` | конфликт состояния (уже оплачено с другими данными, уже выполнено, версия устарела) |
| 422 | `VALIDATION_ERROR` | дата/сумма/интервал/перечисление вне правил |
| 429 | `RATE_LIMITED` | > 60 запросов/мин на участника |
| 500 | `INTERNAL_ERROR` | непредвиденная ошибка |
| 502 | `TELEGRAM_ERROR` | сбой Telegram Bot API |

Детализированные коды в `details.reason`: `ALREADY_PAID`, `ALREADY_COMPLETED`, `VERSION_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`, `DUPLICATE_REQUEST`, `LIST_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `SERIES_REQUIRED`.
Сообщения не раскрывают данные других пользователей: чужой объект всегда `404`.

---

## 8. Статусы сущностей

| Сущность | Значения | Переходы |
|---|---|---|
| Payment (шаблон) | `active`, `paused` | pause: active→paused; resume: paused→active; delete — необратимо |
| PaymentOccurrence | `pending`, `overdue`, `paid` | pending→overdue при `dueDate < today(tz)`; pending/overdue→paid только confirm |
| Reminder | `active`, `paused` | pause/resume; delete — необратимо |
| ReminderOccurrence | `pending`, `overdue`, `completed` | pending→overdue; pending/overdue→completed |
| Task (экземпляр) | `active`, `completed` | complete/restore; повторное complete → 409 |
| Task series | `active` (внутренняя) | деактивируется при `DELETE ?scope=series` |
| TaskList | — | удаление не трогает задачи |

Приостановка платежа не удаляет уже возникшие просроченные начисления и не создаёт новые.
Приостановка напоминания отменяет будущие уведомления; при возобновлении пропущенные периоды не рассылаются.

---

## 9. Формат повторений

```json
{ "frequency": "daily | weekly | monthly | yearly", "interval": 1, "weekdays": [1, 3, 5], "timezone": "Europe/Moscow" }
```

- `interval` — целое ≥ 1 (≤ 365 для daily/weekly, ≤ 12 для monthly, ≤ 10 для yearly).
- `weekdays` — только для `weekly`, 1 = понедельник … 7 = воскресенье, уникальные, 1…7; для остальных — `null` или отсутствует.
- `timezone` — IANA; при сохранении сервер приводит к таймзоне сущности (единый источник).
- `null` — без повторения.
- Неизвестные поля/значения → `422 VALIDATION_ERROR`.

Правила календаря:

| Случай | Поведение |
|---|---|
| 29–31 число месяца | прижимается к последнему дню месяца (31 января → 28/29 февраля) |
| 29 февраля, yearly | в невисокосный год — 28 февраля |
| Еженедельно с `weekdays` | все указанные дни каждой N-й недели от якоря |
| Переход на летнее/зимнее время | локальное время сохраняется; несуществующее локальное время сдвигается вперёд на величину разрыва, неоднозначное — берётся более раннее смещение |
| Смена таймзоны | уже созданные события не пересчитываются; новые — в новой таймзоне |
| Пропущенные периоды | платежи: сохраняются как `overdue` (окно до 366 дней, максимум 120 на шаблон); напоминания/задачи: пропуск без массовой рассылки, генерация продолжается с ближайшего будущего |
| Повторный запуск обработчика | генерация идемпотентна: уникальные `(templateId, dueDate)`, `(reminderId, scheduledAt)`, `(seriesId, dueAt)` |

Ограничения генерации: не более 500 начислений за запрос календаря и 60 экземпляров задач на серию; горизонт — 90 дней вперёд, 366 дней назад.

---

## 10. Формат уведомлений

```json
{ "offsetMinutes": 1440, "time": "10:00" }
```

- `offsetMinutes` — за сколько минут до события, 0…43200 (30 дней), 0 = в момент события.
- `time` — `HH:MM` локально; используется для платёжных начислений (у них только дата). По умолчанию `10:00`. Для напоминаний/задач игнорируется (берётся время события).
- Максимум 10 правил; дубликаты отбрасываются.

Повтор при просрочке (`overdueNotificationRule`):

```json
{ "everyDays": 3, "maxCount": 5, "time": "10:00" }
```

- `everyDays` 1…30, `maxCount` 1…30, отсчёт от `dueDate + 1`.
- Отправляется обоим партнёрам (платежи) или владельцу (напоминания/задачи).
- Учитываются `members.notifications`: `payments`, `reminders`, `tasks` (по умолчанию `true`).
- После оплаты/выполнения/удаления/паузы ожидающие уведомления отменяются; по оплаченному начислению повторов нет.

---

## 11. Пагинация

- Курсорная, непрозрачный `cursor` (base64url), не парсить на клиенте.
- `limit` 1…200, по умолчанию 50.
- `pageInfo: { "nextCursor": string|null, "hasMore": boolean }`.
- Порядок стабилен: для платежей/напоминаний — `dueDate/scheduledAt` по возрастанию, затем `id`; для задач — выбранная сортировка, затем `id`; для выполненных — `completedAt desc`.
- Изменение данных между страницами может пропустить/повторить элемент — это допустимо; клиент дедуплицирует по `id`.

Если `pageInfo.nextCursor = null`, следующей страницы нет.
`GET /task-lists` возвращает `{ data, pageInfo }` без параметров пагинации: списков немного, `nextCursor = null`.

---

## 12. Синхронизация и инвалидация кэша

Realtime не используется. Клиент кэширует ответы и инвалидирует по таблице ниже. `updatedAt`/`version` — для merge и обнаружения конфликтов.

| Операция | Инвалидировать |
|---|---|
| `POST/PATCH/DELETE /payments`, pause/resume | `payments` (календарь), `payment` (id), `/module-preferences` не нужен |
| `confirm` | `payments`, `payment-occurrences/{id}`, финансовые `summary`, `list_tx`, `categories` (факт) |
| `POST/PATCH/DELETE /reminders`, pause/resume | `reminders`, `reminder/{id}` |
| `complete`/`restore` напоминания | `reminders`, `reminder-occurrences/{id}` |
| `POST/PATCH/DELETE /task-lists` | `task-lists`, `tasks` (при удалении — все) |
| `POST/PATCH/DELETE /tasks`, complete/restore | `tasks`, `tasks/completed`, `task-lists` (счётчики) |
| `reorder` | `tasks`, `task-lists` (порядок/счётчики), `module-preferences` не нужен |
| `PATCH /module-preferences` | `module-preferences`, `tasks` (если сменился `taskSortMode`/`selectedTaskListId`) |

Рекомендации:

1. После мутации применяй оптимистичное обновление и помечай затронутые ключи stale; повторный `GET` — при следующем показе экрана/фокусе.
2. Одинаковые `Idempotency-Key` при повторе безопасны: сервер вернёт тот же результат.
3. Не отправляй параллельно `complete` и `PATCH` одной задачи — используй `version`; при `409 VERSION_CONFLICT` перечитай объект.
4. После `confirm` считай финансовые итоги устаревшими: расход создаётся на сервере.

---

## 13. Примеры по модулям

### Платежи

Создать регулярный платёж:

```http
POST /payments
Authorization: tma <initData>
Content-Type: application/json

{ "title": "Аренда", "plannedAmount": 4200, "categoryId": "cat-uuid",
  "firstDueDate": "2026-11-15", "timezone": "Europe/Moscow",
  "recurrenceRule": { "frequency": "monthly", "interval": 1 },
  "notificationRules": [{ "offsetMinutes": 1440, "time": "10:00" }],
  "overdueNotificationRule": { "everyDays": 3, "maxCount": 5 } }
```

```http
HTTP/1.1 201 Created
{ "id": "p-uuid", "title": "Аренда", "status": "active", "plannedAmount": 4200,
  "firstDueDate": "2026-11-15", "nextOccurrence": { "id": "o-uuid", "dueDate": "2026-11-15", "status": "pending", "plannedAmount": 4200 }, "version": 1, ... }
```

Подтвердить оплату:

```http
POST /payment-occurrences/o-uuid/confirm
Authorization: tma <initData>
Idempotency-Key: 7f3c1d9e-2026-11-15-o-uuid
Content-Type: application/json

{ "actualAmount": 4200, "actualDate": "2026-11-15" }
```

```json
{ "occurrenceId": "o-uuid", "status": "paid", "expenseId": "e-uuid",
  "actualAmount": 4200, "actualDate": "2026-11-15", "categoryId": "cat-uuid" }
```

Повтор с тем же ключом → тот же ответ, второй расход не создаётся. Другой партнёр подтверждает то же начисление → тот же `expenseId` (200). Другие сумма/дата/категория → `409 ALREADY_PAID`.

### Напоминания

```http
POST /reminders
{ "title": "Забрать посылку", "startsAt": "2026-11-10T15:00:00.000Z", "timezone": "Europe/Moscow",
  "notificationRules": [{ "offsetMinutes": 60 }, { "offsetMinutes": 0 }] }
```

```http
POST /reminder-occurrences/ro-uuid/complete
Idempotency-Key: complete-ro-uuid
```

Разовое → `{ "deleted": true, "occurrenceId": "ro-uuid", "reminderId": "r-uuid" }`.
Повторяющееся → `200 ReminderOccurrence` со `status: "completed"`, следующее событие создано.

### Задачи

Создать список и задачу:

```http
POST /task-lists   { "title": "Дом" }
POST /tasks        { "title": "Оплатить интернет", "listId": "l-uuid", "dueAt": "2026-11-20T18:00:00.000Z",
                     "priority": "important", "recurrenceRule": { "frequency": "monthly", "interval": 1 } }
```

```json
{ "id": "t-uuid", "seriesId": "s-uuid", "status": "active", "recurrenceRule": { "frequency": "monthly", "interval": 1, "timezone": "Europe/Moscow" }, ... }
```

Выполнить:

```http
POST /tasks/t-uuid/complete
```

```json
{ "task": { "id": "t-uuid", "status": "completed", "completedAt": "2026-11-20T18:05:00.000Z",
            "deleteAfter": "2026-12-20T18:05:00.000Z" },
  "nextTask": { "id": "t2-uuid", "status": "active", "dueAt": "2026-12-20T18:00:00.000Z" } }
```

`DELETE /task-lists/l-uuid` → `{ "deleted": true, "unassignedTasks": 3 }`, задачи остаются с `listId: null`.

### Настройки

```http
PATCH /module-preferences   { "taskSortMode": "manual", "selectedTaskListId": "l-uuid" }
```

---

## 14. Конкурентные операции

| Сценарий | Гарантия |
|---|---|
| Два партнёра подтверждают одно начисление одновременно | транзакция + `SELECT … FOR UPDATE`; создаётся ровно один расход; второй получает тот же `expenseId` |
| Повтор `confirm` с тем же `Idempotency-Key` | сохранённый ответ, без новых записей |
| Повтор `confirm` с другим ключом после оплаты | `200`, если сумма/дата/категория совпадают; иначе `409 ALREADY_PAID` |
| Повторное выполнение напоминания/задачи | `409 ALREADY_COMPLETED`; с тем же `Idempotency-Key` — исходный ответ |
| Параллельный `PATCH` | `version` в теле: несовпадение → `409 VERSION_CONFLICT` (без `version` — last-write-wins) |
| Удаление списка при параллельном добавлении задачи | одна транзакция: задача либо получает `listId: null`, либо добавление отклоняется `404 LIST_NOT_FOUND` |
| `reorder` при параллельном изменении | применяется целиком или отклоняется `409 VERSION_CONFLICT` (при переданных версиях) |
| Генерация начислений фоновым обработчиком и чтением | `ON CONFLICT DO NOTHING`, дубликатов нет |

---

## 15. Версия контракта

- Текущая: **1.1.0** (2026-11-03).
- `X-Contract-Version: 1.1.0` во всех ответах.
- Ломающие изменения — только `/v2`; добавление необязательных полей/значений — минорная версия.
- OpenAPI: `docs/api/openapi.v1.yaml`; TypeScript-типы: `npx -y openapi-typescript@7 docs/api/openapi.v1.yaml -o src/api-types.d.ts` (или `node docs/api/generate-types.mjs`). Референсный вывод: `docs/api/api-types.d.ts`.
