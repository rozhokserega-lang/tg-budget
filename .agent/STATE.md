# Текущее состояние

2026-11-05. Подписки и пробный период временно отключены в production.

- Сервер: `api` v22 и `bot` v13 — ACTIVE. Секрет `SUBSCRIPTIONS_ENABLED` не задан, поэтому флаг выключен по умолчанию. Проверка `plan_until` в legacy API и v1 не блокирует записи; `plans` возвращает `[]`; `create_invoice`/`redeem_promo` — 403; бот не блокирует записи и не активирует `/промо`. `successful_payment` оставлен для старых счетов.
- Клиент: GitHub Pages build `4de9ca8c2172` — https://rozhokserega-lang.github.io/tg-budget/. Раздел «Подписка и промокоды», paywall и баннеры пробного периода скрыты; `State.isExpired()` всегда false.
- Данные `plan_until`, тарифы, промокоды и платежи сохранены. Рекуррентные платежи и напоминания не затронуты.
- Проверки: клиент 213/213, backend 58/58, Deno check api/bot/notify/admin OK. Production: функции ACTIVE, Pages отдаёт новый build.

Не закрыто: Telegram smoke на семье с истёкшим `plan_until` (запись должна проходить), проверка скрытого раздела подписки и ответа `/промо`.

Включение обратно: задать `SUBSCRIPTIONS_ENABLED=true` в секретах проекта, задеплоить `api` и `bot`, поставить `SUBSCRIPTIONS_ENABLED = true` в `src/state.js` и опубликовать клиент.
