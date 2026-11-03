# Личные задачи и напоминания: передача frontend

## Версии и границы

Подготовленный контракт — **REST 1.2.0**, каноническая схема `openapi.v1.yaml`, типы `api-types.d.ts`. Существующие пути `/v1` сохранены; параллельного API нет. На момент аудита production отвечает **1.1.0**, функция `api` v20 и `notify` v10 ACTIVE. Версия1.2 не задеплоена: пользователь запретил production-деплой без отдельного подтверждения.

Frontend исходно проверен по main `d91d59e`, затем сверены новые адаптеры main `13f3793`: `src/tasks-api.js`, `src/reminders-api.js`, `docs/tasks-adapter.md`, `docs/reminders-adapter.md`. В main13f3793 уже есть `src/modules-rest.js` для1.1; при переключении на1.2 нужны перечисленные ниже изменения адаптера. В этой backend-задаче его код не переписывался и новая production-версия не включалась.

Базовый URL: `https://iqbbjkjzxtdqtuwhiadj.supabase.co/functions/v1/api/v1`. Все примеры ниже требуют `Authorization: tma <initData>`; подпись и срок проверяет сервер. Заголовок Idempotency-Key должен сохраняться при повторе исходного запроса. Никаких secret/service_role ключей в frontend.

## Дополнительная сверка frontend main13f3793

В конце работы main получил `modules-rest.js`. Контракт1.2 позволяет подключить модули без новых серверных endpoints, но текущий1.1-адаптер нельзя считать готовой1.2-интеграцией:

1. RemindersRest.list сейчас строит определение из вложенного summary `occurrence.reminder`. В нём нет startsAt/recurrenceRule/timezone, поэтому `reminder(summary)` не имеет корректной даты. Использовать отдельную полную выборку `GET /reminders?view=templates`, а не расширять summary на клиенте.
2. В list календаря передавать timezone, отображать scheduledAt в запрошенной зоне и собирать все страницы; paused/без событий определения брать из templates.
3. TasksRest.pref теряет orders и различие all/none; preferences отвергает q.order. Мэппинг1.2 ниже исправляет это через selectedTaskView/taskOrders или прежний reorder с view.
4. TasksRest.save всегда отправляет scope=instance, поэтому изменение повторения серии не применяется к серии. Выбирать scope=series для правки серии; отключение recurrenceRule:null также выполняется в series scope.
5. Контроллеры создают новые объекты формы без server snapshot. Сохранить исходные version/timezone/startsAt/dueAt и скрытые настройки при открытии формы. Иначе дата-only задача при правке заголовка потеряет исходное время, а версия конфликта не будет передана.
6. Для создания напоминаний/списков текущие контроллеры и адаптер не передают стабильный ключ; добавить его на срок формы. В задачах q.idempotency_key уже передаётся. Сохранять структурированные code/status/details ошибок для повторов409.
7. Функция utc() нового адаптера использует итеративное приближение и не подтверждена для gap/fold. Использовать согласованную политику кандидатов смещения (как проверенный backend instantFromLocal); ужесточить UI-валидацию до серверных лимитов.

Это изменения frontend-адаптера/форм, а не дальнейшее изменение серверной архитектуры. Production UI1.2 через браузер не тестировался; актуальные204 frontend-теста в основном проверяют mock/контроллеры, не доказывают правильность опубликованного1.1-адаптера.

## Мэппинг задач

| UI/mock | REST / хранение | Правило |
|---|---|---|
| list.name | TaskList.title / task_lists.title | Не посылать ownerId для авторизации |
| task.list_id | listId / list_id | null — без списка; чужой список404 |
| task.due_on | dueAt / due_at | Локальная полночь в IANA-зоне профиля → UTC instant; null без срока |
| repeat.unit | recurrenceRule.frequency | day→daily, week→weekly, month→monthly, year→yearly |
| repeat.interval, weekdays | recurrenceRule.interval, weekdays | ISO1=Пн; пустой массив→null (день якоря) |
| reminders[] | notificationRules[].offsetMinutes | Минуты до dueAt; не дни |
| created_at/completed_at/delete_after | createdAt/completedAt/deleteAfter | ISO UTC, nullable поля сохранять |
| completed_at != null | status=completed | GET /tasks/completed даёт отдельную страницу |
| preferences.selected=all/none/listId | selectedTaskView=all/none/list + selectedTaskListId | selectedTaskListId нужен только при list |
| preferences.sort | taskSortMode | due, priority, created, manual |
| preferences.orders[view] | taskOrders[view] | Отдельный порядок all, none и UUID списка |
| scope | не передаётся как право | Владелец всегда из проверенного Telegram initData |

Метод адаптера list собирает **все** страницы `/task-lists`, `/tasks` и `/tasks/completed` плюс `/module-preferences`. До объединения страниц не сортировать усечённый snapshot. При manual применять taskOrders текущего представления, неуказанные задачи добавлять в конец. Список `/task-lists` сейчас возвращает pageInfo.hasMore=false.

saveList→POST/PATCH /task-lists; removeList→DELETE /task-lists/{id}; save→POST/PATCH /tasks; complete/restore→соответствующие POST; remove→DELETE /tasks/{id}?scope=instance. Редактирование повторяющейся серии — PATCH ?scope=series. Scope query определяет объём изменения **своей** записи и не является правом доступа. При создании серии/переключении одноразовой задачи в повторяющуюся передать dueAt и recurrenceRule. Для выключения серии PATCH ?scope=series с recurrenceRule:null; текущий экземпляр становится разовым.

preferences→PATCH /module-preferences для selected/sort/orders. PATCH объединяет только присланные представления orders, остальные сохраняются. Сохранение ручной перестановки возможно также через прежний PATCH /tasks/reorder с view и items; без view действует прежний формат listId и sortOrder.

## Мэппинг напоминаний

| UI/mock | REST / хранение | Правило |
|---|---|---|
| reminder.date + time + timezone | startsAt + timezone / starts_at | Преобразовать локальное время в UTC с политикой DST ниже |
| repeat | recurrenceRule | Те же единицы/интервалы/ISO weekdays, что у задач |
| notifications[] | notificationRules[].offsetMinutes | Минуты; пустой массив означает без уведомлений |
| paused | status=paused | pause/resume endpoints; нельзя вычислять паузу по отсутствию события |
| occurrence.reminder_id | reminderId | Серверный UUID |
| occurrence.due_at | scheduledAt | Источник истины для date/time в зоне отображения |
| occurrence.date/time | local projection(scheduledAt, requested zone) | localDate — дата в зоне напоминания, не обязательно зоне экрана |
| list.until | query to | from/to и timezone задают границы календарных дней |

Адаптер list параллельно собирает **все** страницы `GET /reminders?view=templates` и `GET /reminders?from&to&timezone`. Первый режим возвращает все личные шаблоны, включая паузу и отсутствие событий. Второй — начисленные события и просроченные вне диапазона. Определения не синтезировать из событий. `nextOccurrence` в списке шаблонов null; подробности через GET /reminders/{id}. Завершённые события исключать из активного календаря. ID нельзя строить из даты или названия.

save→POST/PATCH /reminders; remove→DELETE /reminders/{id}; pause→POST /reminders/{id}/pause|resume; complete→POST /reminder-occurrences/{id}/complete. Параметры UI date/timezone в complete помогают отображению, но сервер завершает событие по id.

Разовое выполнение возвращает `{deleted:true, occurrenceId, reminderId}` и удаляет определение/события; повторное выполнение в пределах30дней возвращает сохранённую квитанцию только владельцу. Для повторяющегося завершается только экземпляр, определение сохраняется. При редактировании будущие события пересчитываются транзакционно (их UUID могут измениться; перечитать календарь), уже наступившие неоплаченные/незавершённые остаются. Пауза прекращает доставку; пропущенные за паузу повторения не материализуются при resume. Просроченный разовый экземпляр остаётся доступным для ручного выполнения.

## Примеры HTTP

Общие заголовки: `Authorization: tma <initData>`, JSON content-type для POST/PATCH. В примерах идентификаторы обозначены словами; подставлять реальные UUID из ответов.

```http
POST /task-lists
Idempotency-Key: list-form-20261103-1

{"title":"Личное"}
```

```json
{"id":"<listUuid>","title":"Личное","taskCount":0,"activeCount":0,"version":1,"createdAt":"<ISO>","updatedAt":"<ISO>"}
```

```http
POST /tasks
Idempotency-Key: task-form-20261103-1

{"title":"Тренировка","listId":"<listUuid>","dueAt":"2030-01-31T07:00:00Z","timezone":"Europe/Moscow","priority":"important","recurrenceRule":{"frequency":"monthly","interval":1},"notificationRules":[{"offsetMinutes":60}]}
```

Ответ201 — Task с ownerId, seriesId, status=active и version. POST /tasks/{id}/complete с отдельным стабильным ключом возвращает `{task: Task(status=completed, deleteAfter=completedAt+30d), nextTask: Task|null}`. Для указанного якоря следующий dueAt —2030-02-28T07:00:00Z. POST /tasks/{id}/restore возвращает `{task:Task(status=active)}`; повторное complete восстановленного родителя не создаёт второго преемника.

```http
PATCH /module-preferences

{"selectedTaskView":"none","taskSortMode":"manual","taskOrders":{"all":["<taskUuid>"],"none":[]}}
```

```json
{"selectedTaskView":"none","selectedTaskListId":null,"taskSortMode":"manual","taskOrders":{"all":["<taskUuid>"],"none":[]},"currency":"RUB","updatedAt":"<ISO>"}
```

```http
POST /reminders
Idempotency-Key: reminder-form-20261103-1

{"title":"Позвонить","startsAt":"2030-03-30T01:30:00Z","timezone":"Europe/Berlin","priority":"normal","recurrenceRule":{"frequency":"daily","interval":1},"notificationRules":[{"offsetMinutes":0}]}
```

Ответ201 — Reminder со startsAt, timezone, recurrenceRule, notificationRules, status и version. GET /reminders?from=2030-03-30&to=2030-04-02&timezone=Europe%2FBerlin вернёт страницу ReminderOccurrence; при весеннем переходе событие2030-03-31 с локальным02:30 сдвигается на03:30, то есть01:30Z. На следующий обычный день снова02:30 локально. Неоднозначное время осенью выбирает более ранний instant.

```http
GET /reminders?view=templates&limit=200
```

```json
{"data":[{"id":"<reminderUuid>","title":"Позвонить","status":"paused","nextOccurrence":null}],"pageInfo":{"hasMore":false,"nextCursor":null}}
```

Выше сокращённый пример; полная обязательность полей — OpenAPI. При hasMore=true повторять исходные параметры плюс cursor=nextCursor до hasMore=false.

## Ограничения и несовместимости

- UI mock шире сервера: напоминания160/4000 против120/1000 символов, даты1900 против2000, интервалы999 против daily/weekly365, monthly12, yearly10; уведомления525600 против43200 минут. Tasks UI title160/description2000 уже серверных200/4000, но интервалы месяцев/лет и уведомления тоже надо ограничить. UI в этой backend-задаче не менялся.
- GET диапазон from/to ≤370дней. Пагинация limit1–200; только задачи/list snapshot с полным сбором страниц воспроизводит локальные сортировки.
- orders: до200 UUID на представление, до100 представлений в одном PATCH; id должны принадлежать активным задачам владельца и соответствовать представлению. Более крупный список требует отдельно согласованного расширения, не молчаливой обрезки.
- Повтор DELETE может вернуть404 после успешного удаления; конечное состояние идемпотентно, UI может перечитать snapshot и считать отсутствующую запись удалённой.
- Ключи повторов хранятся24ч. Незавершённый параллельный запрос возвращает409 DUPLICATE_REQUEST, тот же ключ с другим endpoint/телом409 IDEMPOTENCY_KEY_REUSED. После неизвестного результата создания сохранять тело и ключ; новый ключ может создать новую сущность.
- Версия сущности проверяется под блокировкой для мутаций задач/напоминаний. При409 VERSION_CONFLICT перечитать запись и показать конфликт пользователю; не сохранять поверх чужих изменений автоматически.
- Очередь дедуплицирует постановку. Перед отправкой personal-событие и статус доставки перечитываются. Отмена не может отозвать уже переданный Telegram HTTP-запрос; после неизвестного результата внешней сети строгое exactly-once Telegram не гарантируется. Это ограничение Bot API, не обходить его клиентскими таймерами.
- При restore/update/resume возвращаются только подходящие будущие уведомления. Отменённые записи не оживают от обычного cron; ответ уже отправлявшегося задания не переводит canceled обратно в pending.
- Финансовые таблицы/расчёты не меняются. Старые платежи и legacy action-протокол сохраняются.

## Фактический аудит и rollout

В production read-only подтверждены миграции018–022 (версии20261103160734,160738,160747,160754,160801); семь таблиц существуют, RLS включена, политик прямого чтения нет. Табличные grants anon/authenticated обнаружены, RLS блокирует строки; новая миграция дополнительно отзывает сами grants. Публичное выполнение привилегированных RPC уже запрещено. Cron notify-hourly активен каждые5мин, последние прогоны succeeded. Подпись Telegram и срок проверяются на сервере, чужие id404.

Новая миграция `20261103170840_personal_modules_readiness.sql` создана CLI, **не применена к production**. Она дополняет preferences, successor_id, внутренние квитанции завершения, интервалы паузы/generation_from, транзакционные RPC и защиту очереди. При переходе сохраняются существующие события, а отсутствующие события до момента миграции не восстанавливаются автоматически: старые закрытые интервалы паузы достоверно восстановить нельзя. После отдельного подтверждения: адресно только новая миграция (не bulk db push, не включать чужую неприменённую018_pet_keywords.sql) → api1.2 и notify → проверка health/auth/preflight/очереди → подключение frontend-адаптеров. Внешние Telegram-тесты проводить только с согласованными тестовыми пользователями.

## Проверки

Проверено 2026-11-03, Node26.4.0; отдельный локальный PostgreSQL17 (embedded-postgres17.0.0-beta.12, native17.0.0-beta.14). Production URL и настоящие Telegram-ключи в тестах не используются.

| Проверка | Результат |
|---|---|
| Серверные unit-тесты | 58/58; после изменений UTC/очереди/паузы затронутые наборы перепроверены, все прошли |
| Реальный PostgreSQL + API + конкурентность | 11 сценариев; Node считает12 тестов с родительской группой,12/12, skipped0 |
| Актуальный frontend | 204/204, код UI в этой задаче не менялся |
| miniapp-зеркало | 204/204; Build22daa4d8d971,35 ресурсов |
| Deno check | api,bot,notify,admin прошли; после изменений общих модулей api/notify проверены повторно |
| OpenAPI/types | 23 пути,35 операций,45 схем; openapi-typescript7.13.0 успешно сгенерировал типы |
| JS syntax / git diff --check | Успешно |

SQL/API-сценарии выполняют настоящий handleV1 и настоящую проверку Telegram-подписи на фиктивном ключе. Тестовый Supabase query-adapter переводит вызовы в SQL реального PostgreSQL; пул12 соединений проверяет гонки создания и выполнения. Проверены CRUD, два владельца одной семьи, подмена ownerId/householdId, чужие id404, anon SELECT запрещён, выбранные списки/orders, атомарная ошибка reorder, replay endpoint/key, месячные/годовые якоря, restore→complete без дубля,30-дневный срок и purge, полный calendar pagination, Berlin DST/смена зоны, pause/resume без восстановления пропусков, отмена/восстановление уведомлений, retry/backoff, отмена между сообщениями и одна финансовая транзакция при оплате партнёрами.

Дополнительные unit-проверки охватывают NY DST, Berlin gap/fold и получасовой переход Lord Howe, выбранные дни недели и интервалы. Ошибки429/403/неизвестный исход Telegram имитируются транспортом; реальная отправка пользователям не выполнялась. Истечение30дней моделируется в изолированной БД изменением delete_after, без ожидания30дней.

Первая итоговая серия выявила UTC-сериализацию и европейский DST gap; они исправлены, добавлены регрессии и повторены затронутые проверки. Отдельный review выявил необходимость постоянной истории пауз и атомарной постановки уведомлений; соответствующие SQL/API-сценарии добавлены и прошли. Повторные запуски выполнялись для найденных проблем, не для увеличения числа проверок.

Воспроизведение (из backend checkout):

```sh
node --test tests/*.test.mjs
npm install --prefix /tmp/tg-pg17-test-runtime --no-audit --no-fund embedded-postgres@17.0.0-beta.12
TG_TEST_POSTGRES_RUNTIME=/tmp/tg-pg17-test-runtime node --test tests/personal-modules.integration.mjs
npx -y deno check supabase/functions/{api,bot,notify,admin}/index.ts
```

Интеграционный файл требует явного TG_TEST_POSTGRES_RUNTIME, не принимает произвольный DB URL, создаёт и останавливает локальный кластер port55439. Без переменной он пропускается: **это не успешная SQL-проверка**. В нашем прогоне переменная задана, skipped0. На других ОС нужен совместимый binary package; зависимости тестового PostgreSQL не включены в production-код.

Ограничение доказательств: HTTP PostgREST gateway не запускался локально; запросы ORM и реальные SQL/RPC проверялись адаптером. Production схема/cron/версии проверены read-only, но1.2 там не выполнялась. Подключение настоящих frontend-адаптеров и Telegram smoke после отдельно разрешённого rollout остаются задачей следующего этапа.
