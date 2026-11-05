# Текущее состояние

2026-11-05. Подписки и пробный период временно отключены в production.

- Сервер: `api` v22 и `bot` v13 — ACTIVE. Секрет `SUBSCRIPTIONS_ENABLED` не задан, поэтому флаг выключен по умолчанию. Проверка `plan_until` в legacy API и v1 не блокирует записи; `plans` возвращает `[]`; `create_invoice`/`redeem_promo` — 403; бот не блокирует записи и не активирует `/промо`. `successful_payment` оставлен для старых счетов.
- Клиент: GitHub Pages build `4de9ca8c2172` — https://rozhokserega-lang.github.io/tg-budget/. Раздел «Подписка и промокоды», paywall и баннеры пробного периода скрыты; `State.isExpired()` всегда false.
- Данные `plan_until`, тарифы, промокоды и платежи сохранены. Рекуррентные платежи и напоминания не затронуты.
- Проверки: клиент 213/213, backend 58/58, Deno check api/bot/notify/admin OK. Production: функции ACTIVE, Pages отдаёт новый build.

2026-11-05, плашка предстоящих платежей: `renderSummary` снова вызывает `dueBanner(plans)` — вызов был потерян в 28985c4 (`src/views.js`). Регрессионный тест добавлен. Проверки: клиент 214/214, `node --check src/app.js` OK; версии ассетов пересчитаны (build `80f1232195eb`).

Не закрыто: Telegram smoke на семье с истёкшим `plan_until` (запись должна проходить), проверка скрытого раздела подписки и ответа `/промо`; Telegram smoke плашки (напоминание за N дней/в день платежа, крестик, кнопка оплаты).

Включение обратно: задать `SUBSCRIPTIONS_ENABLED=true` в секретах проекта, задеплоить `api` и `bot`, поставить `SUBSCRIPTIONS_ENABLED = true` в `src/state.js` и опубликовать клиент.
