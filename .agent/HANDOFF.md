# Передача

## Текущая задача

Временное отключение подписок/пробного периода. Изменения лежат в ветке `feat/disable-subscriptions-temporarily` публичного клиента и полного репозитория; main и production не менялись.

## Изменённые пути

- Клиент: `src/state.js`, `src/views.js`, `src/app.js`, `src/api.js`, `tests/views.test.cjs`, `index.html`, `README.md`.
- Сервер: `supabase/functions/api/index.ts`, `supabase/functions/api/v1_http.ts`, `supabase/functions/bot/index.ts`.
- Документация: `docs/PROJECT.md`; зеркало клиента в `miniapp/`.

## Проверки

- `node --check` всех `src/*.js` — OK.
- `node --test tests/*.test.cjs` — 213/213.
- `node --test miniapp/tests/*.test.cjs` — 213/213.
- `node --test tests/*.test.mjs` — 58/58.
- `npx -y deno check supabase/functions/{api,bot,notify,admin}/index.ts` — OK.
- `node scripts/version-assets.mjs` — build `4de9ca8c2172`.

## Решение

Флаг `SUBSCRIPTIONS_ENABLED` выключен по умолчанию. Данные `plan_until`, тарифы, промокоды и платежи не удаляются. Рекуррентные платежи и напоминания не затронуты.

## Не закрыто

- Merge и деплой не выполнены: нужно явное подтверждение.
- После деплоя нужен Telegram smoke: запись при истёкшем `plan_until`, скрытый раздел подписки, `/промо` и обычная запись в боте.
