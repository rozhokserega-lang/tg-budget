# Текущее состояние

2026-11-03. «Напоминания», feature/reminders-module от main 4b83c94 (Платежи уже в main).

Реализовано: личный модуль из хаба, компактный календарь, ближайшие/выбранный день,
CRUD, pause/resume, ручное выполнение occurrence, важность, несколько уведомлений,
правила day/week/month/year + N + weekdays, IANA timezone. Отдельные API/views/controller.
Посторонние модули не переписаны, в app только точки интеграции.

Блокер: серверного контракта нет; docs/reminders-adapter.md — предложение v1,
требуется согласование backend. APP_REMINDERS_ADAPTER включает production;
mock только demo, memory-only, без отправки Telegram. Backend отвечает за авторизацию
и доставку/отмену уведомлений, не клиентский scope.

Проверки: один полный прогон 187/187. После уточнений DST/редактирования/паузы —
адресно reminders 9/9. SWR benchmark, syntax и diff-check успешны.
Chromium отсутствует: browser/Telegram smoke не выполнен.

Следующий шаг: PR review, согласование и подключение backend, Telegram smoke.
Main не менять без отдельной просьбы merge.
