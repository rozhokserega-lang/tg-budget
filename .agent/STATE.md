# Текущее состояние

2026-11-05. Цель — временно отключить подписки и пробный период на время теста, чтобы не пугать пользователей. Ветки `feat/disable-subscriptions-temporarily` в публичном клиенте и полном репозитории. Main и production не менялись.

Клиент: `src/state.js` — `SUBSCRIPTIONS_ENABLED = false`, `isExpired()` всегда false, `subscriptionsEnabled()`; `src/views.js` скрывает «Подписка и промокоды»; `src/app.js` — guard настроек, paywall, покупки и промокода; `src/api.js` — ошибка `subscriptions_disabled`. Регрессионный тест в `tests/views.test.cjs`. Проверки: syntax OK, 213/213, сборка `4de9ca8c2172`. Зеркало `miniapp/` синхронизировано.

Сервер: `api/index.ts` — env `SUBSCRIPTIONS_ENABLED` (по умолчанию false) отключает проверку `plan_until`, `plans` возвращает `[]`, `create_invoice`/`redeem_promo` — 403; `v1_http.ts` — `canWrite` всегда true; `bot/index.ts` — без trial-гейта, `/промо` отключён, `/start` без промо-команды; `successful_payment` оставлен для старых счетов. Проверки: miniapp 213/213, backend 58/58, Deno check api/bot/notify/admin OK.

Блокер: merge и деплой требуют явного подтверждения. Порядок: api → bot → публикация клиента. Включение: `SUBSCRIPTIONS_ENABLED=true` в секретах `api`/`bot` и флаг `SUBSCRIPTIONS_ENABLED = true` в `src/state.js`.

Следующий шаг: получить подтверждение, смержить PR, задеплоить `api` и `bot`, опубликовать клиент, проверить Telegram smoke.
