# Передача

## Статус

Подписки/пробный период временно отключены и выкачены. Ветки PR #21 (клиент) и #9 (сервер) смержены в main; production обновлён.

## Production

- `api` v22 ACTIVE.
- `bot` v13 ACTIVE.
- Клиент: GitHub Pages build `4de9ca8c2172`, https://rozhokserega-lang.github.io/tg-budget/.
- `SUBSCRIPTIONS_ENABLED` в секретах отсутствует → серверный флаг false.

## Изменённые пути

- Текущая задача (плашка предстоящих платежей): `src/views.js` — вернули `dueBanner(plans)` в `renderSummary`; `tests/views.test.cjs` — регрессионный тест и подключение `recurring.js` в setup.
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
