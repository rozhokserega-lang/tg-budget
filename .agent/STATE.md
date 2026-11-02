# Текущее состояние

2026-11-02. Задача: разрешить перенос существующего расхода в другую категорию.
Ветка влита: main b02c815; backend PR #2 влит в `tg-budget-app` (9c3056f).

Готово: `Api.updateTx` в реальном режиме отправляет `update_tx`; Edge Function `api` v16 ACTIVE; GitHub Pages run 41398606587 успешен; production отдаёт build d8ad8a2ee103 и `src/api.js?v=0edd5d0a1e02`. Проверено, что deployed `api.js` содержит `update_tx`, а endpoint без initData возвращает 401.

Проверки: edit-api 5/5; полный прогон 168/170 — два старых теста общей сводки зависят от текущего месяца, к изменению не относятся; Deno check, syntax/diff check успешны. Production Edge Function сверена с main после деплоя.

Следующий шаг: ручной smoke в Telegram — открыть существующий расход, сменить категорию и сохранить.
