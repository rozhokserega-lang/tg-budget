# Текущее состояние

2026-11-03. Модули v1 задеплоены в прод `iqbbjkjzxtdqtuwhiadj`: миграции 018–022 применены, `api` v18 и `notify` v10 активны, cron восстановлен. Осталось: smoke старого UI пользователем, наблюдение 48 ч и фронтенд.

- Контракт: `docs/api/openapi.v1.yaml` (22 пути, 34 операции, 42 схемы), `FRONTEND_API_CONTRACT.md`, `BACKEND.md`, `DEPLOY_CHECKLIST.md`, `api-types.d.ts`.
- Бэкенд: `../teletreker`, ветка `feature/modules-v1`, коммиты `d64f282` + `cd540a0`, PR #5: https://github.com/rozhokserega-lang/tg-budget-app/pull/5.
- Миграции: версии `20261103160734` (018), `…160738` (019), `…160747` (020), `…160754` (021), `…160801` (022). Новых таблиц 10, шаблонов 9 из 9 `recurring_payments`, начислений 9, активных шаблонов без начисления 0.
- Функции: `api` v18 (`verify_jwt=false`), `notify` v10 (`verify_jwt=false`). Health 200 `{"ok":true,"version":"1.0.0"}`, v1 без initData — 401, legacy без initData — 401, `notify` без секрета — 403.
- Cron: job `notify-hourly` (`*/5 * * * *`, jobid 3) восстановлен; прогон 16:10 UTC — `succeeded`, HTTP 200, модули материализованы (11 семей), outbox без дублей и failed.
- SQL-smoke: `confirm_payment_occurrence` создаёт один расход и идемпотентно возвращает `replay`; тест выполнен в транзакции с откатом, `transactions` осталось 130, тестовых строк 0.
- RLS включён на всех новых таблицах, публичных грантов на RPC нет, service_role — 14. Advisors: только INFO `rls_enabled_no_policy`, `unindexed_foreign_keys`, `unused_index`.
- Среда: Supabase MCP подключён; `deno`/Supabase CLI по-прежнему нет. `task-tg` MCP без токена — не влияет.

Следующий шаг: пользователю проверить в Mini App старый экран регулярных платежей (создание/оплата/удаление) и убедиться, что удалённый платёж исчезает из уведомлений; затем наблюдение 48 ч и фронтенд.
