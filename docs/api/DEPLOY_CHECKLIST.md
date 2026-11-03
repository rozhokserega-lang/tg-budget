# Чеклист деплоя модулей v1

Ниже исходный rollout 1.0.0. Для интеграции клиента 1.1.0 дополнительно нужен GET /payment-templates: порядок и проверки — `docs/payments-adapter.md`. Новых миграций для дополнения нет.

Ветка `feature/modules-v1`, коммит `d64f282`, PR #5. Проект Supabase: `iqbbjkjzxtdqtuwhiadj`.
Контракт: 22 пути, 34 операции, 42 схемы. Тесты перед деплоем: `node --test tests/*.test.mjs` → 48/48.

Деплой выполняется из `../teletreker`. Все шаги — по порядку; после каждого блока фиксируйте результат.

## 0. Предусловия

- [ ] PR #5 проверен и влит в `main` (или деплой согласован с ветки).
- [ ] Есть доступ: Supabase Dashboard (owner) и хотя бы один путь — Supabase CLI или MCP.
- [ ] Окно низкой активности: cron `notify-hourly` ходит каждые 5 минут.
- [ ] Нет незакоммиченных серверных правок: `git status --short` чист (кроме пользовательских `miniapp/.agent/`, `miniapp/AGENTS.md`).
- [ ] `docs/api/DEPLOY_CHECKLIST.md` и `docs/api/BACKEND.md` §8–9 прочитаны.

## 1. Preflight

```bash
cd ../teletreker
git fetch origin
git checkout feature/modules-v1
git log -1 --oneline          # ожидается d64f282
node --test tests/*.test.mjs  # 48/48
git diff --check              # без вывода
```

- [ ] Коммит совпадает, тесты зелёные.
- [ ] Зафиксировать текущие версии функций: Dashboard → Edge Functions → `api`, `notify` → Versions (записать номера/время). Это точка отката кода.
- [ ] Проверить `supabase migration list` (CLI) или `select * from supabase_migrations.schema_migrations order by version desc limit 5;` — миграций 018–022 быть не должно.

## 2. Бэкап

Dashboard → Database → Backups (PITR, если включён) **или**:

```bash
export DB_URL='postgresql://postgres:<password>@db.iqbbjkjzxtdqtuwhiadj.supabase.co:5432/postgres'
pg_dump "$DB_URL" -Fc -f "backup-$(date +%F-%H%M).dump"
pg_restore -l "backup-$(date +%F-%H%M).dump" | head   # файл читается
```

- [ ] Бэкап создан и проверен.
- [ ] Записаны: размер БД, число строк `transactions`, `recurring_payments`, `reminders_sent` (для сверки после).

## 3. Пауза cron

Перед миграциями остановить обработчик, чтобы он не читал полуприменённую схему:

```sql
select jobid, jobname, schedule, command
  from cron.job where jobname = 'notify-hourly';   -- сохранить command целиком
select cron.unschedule('notify-hourly');
```

- [ ] Команда job сохранена.
- [ ] Job снят: `select count(*) from cron.job where jobname = 'notify-hourly';` → 0.
- [ ] Если сохранённый `command` содержит `$$`, восстановить его через Dashboard или `cron.schedule_in_database`, а не вставлять в `$$ … $$`.

## 4. Миграции 018 → 022

Порядок обязателен: `018` создаёт очередь и идемпотентность, `019`–`021` — таблицы/RPC, `022` — бэкфилл и новую `due_reminders`.

**CLI:**

```bash
supabase link --project-ref iqbbjkjzxtdqtuwhiadj
supabase db push            # при необходимости: --include-all
```

**MCP:** `apply_migration` по файлу, в порядке `018_recurrence_and_outbox` … `022_backfill_payments`, содержимое — как в репозитории. Применяйте по одной с паузой ≥ 1 с: версия берётся из текущего времени, и два вызова в одну секунду дают `duplicate key schema_migrations_pkey`. Повтор после паузы безопасен.

- [ ] Все 5 миграций применились без ошибок.
- [ ] `select version from supabase_migrations.schema_migrations order by version desc limit 5;` содержит 018–022.
- [ ] Не выполнялись `db reset`, `drop table`, правки старых таблиц.

Проверка схемы:

```sql
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('notification_outbox','idempotency_keys','payment_templates',
                      'payment_occurrences','reminders','reminder_occurrences',
                      'task_lists','task_series','tasks','module_preferences')
 order by table_name;   -- 10 строк

select relname, relrowsecurity from pg_class
 where relname in ('notification_outbox','payment_templates','payment_occurrences',
                   'reminders','reminder_occurrences','task_lists','task_series',
                   'tasks','module_preferences');   -- relrowsecurity = true

select has_function_privilege('authenticated',
  'public.confirm_payment_occurrence(uuid,uuid,uuid,numeric,date,uuid)', 'execute'); -- false
```

Бэкфилл:

```sql
select count(*) from public.recurring_payments;                       -- было
select count(*) from public.payment_templates where legacy_recurring_id is not null;
select count(*) from public.payment_occurrences o
  join public.payment_templates t on t.id = o.template_id
 where t.legacy_recurring_id is not null and o.status <> 'paid';
```

- [ ] Число шаблонов не меньше числа `recurring_payments` с найденным создателем.
- [ ] У каждого активного шаблона есть хотя бы одно неоплаченное начисление.
- [ ] Повторный запуск `022` не создаёт дублей (проверять не обязательно, но безопасно).

## 5. Деплой функций

**CLI (рекомендуется):**

```bash
supabase functions deploy api --no-verify-jwt
supabase functions deploy notify --no-verify-jwt
```

`api` — защита подписью Telegram initData; `notify` — заголовком `x-cron-secret`. `notify` не описан в `config.toml`, поэтому `--no-verify-jwt` обязателен, иначе cron получит 401.

**MCP:** относительные пути сохраняются, поэтому передавайте файлы как `api/index.ts` + `api/v1*.ts` + `_shared/*.ts`, entrypoint — `api/index.ts`; импорт `../_shared/...` резолвится. Для `notify` — `notify/index.ts` + `_shared/*.ts`. Проверено на деплое v17/v18.

Если клиент MCP всё же не сохраняет каталоги, используйте плоский staging:

```bash
tmp=$(mktemp -d); mkdir -p "$tmp/api" "$tmp/notify"
cp supabase/functions/api/*.ts "$tmp/api/"
cp supabase/functions/notify/index.ts "$tmp/notify/"
cp supabase/functions/_shared/{recurrence,modules}.ts "$tmp/api/"
cp supabase/functions/_shared/{recurrence,modules,notification_text}.ts "$tmp/notify/"
sed -i '' "s#'../_shared/#'./#g" "$tmp"/api/*.ts "$tmp"/notify/*.ts
grep -rn "\.\./_shared" "$tmp" || echo "flat imports ok"
```

Затем `deploy_edge_function` для `api` и `notify` (`verify_jwt: false`), файлы — плоским списком из staging.

- [ ] Обе функции в статусе ACTIVE.
- [ ] В логах деплоя нет ошибок бандлинга/импортов.
- [ ] `notify` отвечает 403 без `x-cron-secret` и 200 с ним.

## 6. Smoke-проверки

Health (без авторизации):

```bash
curl -sS "https://iqbbjkjzxtdqtuwhiadj.supabase.co/functions/v1/api/v1/health"
# {"ok":true,"version":"1.0.0","time":"..."}
```

Legacy через Mini App (старый UI должен работать без изменений):

- [ ] `summary` и `list_tx` открываются.
- [ ] Создать регулярный платёж → появляется в старом списке, в `payment_templates` создан шаблон с `legacy_recurring_id`.
- [ ] `pay_recurring` → в `transactions` ровно одна новая строка, начисление `paid`, `expense_id` заполнен.
- [ ] Удалить регулярный платёж → шаблон `deleted_at` заполнен, будущие неоплаченные начисления сняты.
- [ ] Старые напоминания не дублируются: у платежа с шаблоном v1 `due_reminders` строку не возвращает.

v1 через Mini App (initData) или отладочный клиент:

- [ ] `GET /v1/payments` и `GET /v1/reminders` отдают данные семьи.
- [ ] Создание платежа, подтверждение начисления (дважды с одним `Idempotency-Key` → один расход), пауза/возобновление.
- [ ] Напоминание: создание, выполнение, повторное выполнение → 409/идемпотентно.
- [ ] Задачи: список, создание, выполнение, восстановление, reorder.
- [ ] `PATCH /v1/module-preferences` меняет валюту; новое начисление получает снимок валюты.

Очередь:

```sql
select status, count(*) from public.notification_outbox group by 1 order by 1;
select dedupe_key, count(*) from public.notification_outbox
 group by 1 having count(*) > 1;                       -- пусто
select count(*) from public.payment_occurrences
 where expense_id is not null
 group by expense_id having count(*) > 1;              -- пусто
```

- [ ] `pending` появляется в пределах 7 дней, `failed` не растёт.
- [ ] Дублей `dedupe_key` и `expense_id` нет.

## 7. Возврат cron

Восстановить сохранённую команду:

```sql
select cron.schedule('notify-hourly', '*/5 * * * *', $$ <сохранённый command> $$);
select count(*) from cron.job where jobname = 'notify-hourly';  -- 1
```

- [ ] Через 5–10 минут в логах `notify` есть цикл без ошибок.
- [ ] `select status, count(*) from cron.job_run_details order by start_time desc limit 5;` → `succeeded`.
- [ ] `net._http_response` последнего вызова → 200.

## 8. Rollback

Триггеры: массовые 500 в `api`, дубли расходов, шторм уведомлений, ошибки схемы.

1. Остановить cron: `select cron.unschedule('notify-hourly');`
2. Вернуть предыдущие версии `api` и `notify` (Dashboard → Versions).
3. Схема: только при необходимости, в порядке `022 → 018` по `BACKEND.md` §8. `recurring_payments` не трогать; созданные расходы не удалять без согласования.
4. Проверить legacy: `summary`, `list_tx`, `save_recurring`, `pay_recurring`.
5. Включить cron после стабилизации.

## 9. Наблюдение 24–48 часов

- [ ] `notification_outbox`: `failed` и `attempts` не растут; нет отставания `pending` > 15 минут.
- [ ] `transactions`: нет парных дублей по сумме/категории в одну минуту.
- [ ] Логи `api`/`notify`: нет повторяющихся `materialize`, `outbox`, `finish_notification` ошибок.
- [ ] Advisors: только INFO `rls_enabled_no_policy` (ожидаемая модель).
- [ ] Legacy-экран регулярных платежей и v1-экраны дают одинаковые суммы.

## 10. Итог

| Пункт | Ответственный | Время | Результат |
|---|---|---|---|
| Бэкап | | | |
| Миграции 018–022 | | | |
| `api` / `notify` | | | |
| Smoke legacy + v1 | | | |
| Cron восстановлен | | | |
| Наблюдение 48 ч | | | |

## Rollout1.2 — выполнен 2026-11-03

- Пользователь разрешил завершение и публикацию.
- Сохранены локальные резервные копии api20/notify10.
- Адресно применена только20261103170840_personal_modules_readiness.sql; фактическая версия20261103182305. Bulk db push не выполнялся.
- Опубликованы api21 (REST1.2.0) и notify11, verify_jwt=false, import_map_path="deno.json". Исходники сверены с deployed files.
- Cron job3 восстановлен, schedule */5, active=true; прямые grants восьми personal/outbox таблиц отозваны при включённой RLS.
- Health200,401 без подписи, OPTIONS204 с нужными methods/headers.
- Проверки и оставшиеся границы доказательств — PERSONAL_MODULES_HANDOFF.md. Реальную доставку Telegram проверять с тестовым пользователем; подписанный fixture не используется в production.
