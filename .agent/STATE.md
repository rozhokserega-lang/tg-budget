# Текущее состояние

2026-11-02. Задача: разрешить перенос существующего расхода в другую категорию.
Ветка: fix/edit-expense-category от main 05bf22f (PR #13 влит).

Готово: `Api.updateTx` в реальном режиме отправляет `update_tx`; клиентское ограничение `update_unsupported` убрано; тесты real-mode обновлены; README и версии ассетов пересчитаны (build d8ad8a2ee103). Серверный `update_tx` и синхронизация `miniapp` — в `tg-budget-app`, ветка fix/edit-expense-category.

Проверки: `tests/edit-api.test.cjs` 5/5; полный прогон 168/170 — два старых теста общей сводки зависят от текущего месяца и падают на main после смены месяца, к изменению не относятся. `node --check` и `git diff --check` чисты; Deno check API выполнен в tg-budget-app.

Следующий шаг: review PR, затем с подтверждением задеплоить `api` и влить публичный клиент/Pages.
