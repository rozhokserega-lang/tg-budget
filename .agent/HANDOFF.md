# Передача сессии

Контрольная точка E локально: 2026-10-21. Цель/следующий шаг — STATE; очередь — TASKS.

Созданы: `AGENTS.md`, `.agent/{STATE,DECISIONS,TASKS,ARCHITECTURE,HANDOFF}.md`; в родительской папке Finance — короткий `AGENTS.md` для входа из текущего workspace.

На старте реализации: main 6891810; fetch обнаружил b8688cd, выполнен fast-forward и создана feature/expenses-ux-performance. Исходные untracked: AGENTS.md, .agent/, пользовательский tg-budget-codex-final-plan.md. План не изменять/не удалять автоматически.

Восстановление: прочитать инструкции и STATE, затем этот файл; выполнить `git status --short --branch` из репозитория (либо `git -C tg-budget ...` из Finance). Сверить HEAD и изменения, открыть только нужные по следующей задаче участки кода.

Сохранение вручную: попросить «Сохрани контрольную точку» до `/compact`, закрытия чата или перехода в новый. В новом чате: «Восстанови контекст из .agent и продолжи». При аварийном закрытии сохраняется только последняя записанная точка; несохранённую работу проверить через Git.

Изменения B: src/app.js, api.js, demo.js, views.js, styles/finance.css, README; tests/edit-api.test.cjs и views.test.cjs. Тесты: 17/17, syntax/diff check чисты. Browser demo: карандаш → исходные значения → сумма 1500/пустая заметка → success/новые итоги. Серверный update отсутствует в доступном коде: real unsupported, предлагаемый контракт в README.

Локальный сервер тестирования: 127.0.0.1:8766 (exec session 50004 вне sandbox), IAB tab 2; sandbox session 97235 порт 8765 недоступен IAB. Не проверялись реальные Telegram Android/iOS. Viewport override после проверки сброшен.

C: src/cache.js, app/index интеграция; tests/cache.test.cjs и app.test.cjs. Все 39 тестов прошли. SWR memory-only, parallel summary/list_tx, no neighbour prefetch, epochs и scope, return visibility/pageshow. Review выявил deletion invalidation, context overlays и microtask commit race — исправлены; финальный review ещё предстоит.
Synthetic до/после: два одновременных summary, loader 20мс, performance.now(): старые функции 2 запроса/29,86мс, новый модуль 1/32,44мс; доказана экономия запросов, ускорение не доказано. Реальная сеть не измерялась.

D: styles/finance.css (плавная SVG mask 96×40, background до нижнего края без сдвига +), views/i18n (Финансы en/es). Дополнительно format fallback использует локальный день; tests/format.test.cjs проверяет UTC boundaries. 48/48 проходят. Browser: перенос кофе 350 из октября в 30 сентября подтвердил новые итоги обоих месяцев и сохранность фильтра. Keyboard ArrowLeft открывает edit+delete. При 320×640 DOM: backgroundBottom=640, icon=54×54 центр160, overflow=false; 375×812 визуально проверен. Safe-area на настоящем устройстве ещё не проверена.

E: все 60 тестов проходят (node --test tests/*.test.cjs), syntax всех src/*.js и version script, diff --check пройдены. Build 25ed82430ba2, 16 versioned assets. Нет package.json/сборщика/линтера. Review исправил инвалидацию остальных мутаций, гонку раскрытия месяца, old edit finally, keyboard Escape на кнопках и сброс данных при auth failure. Browser дополнительно: add 123 → confirmed totals → delete → запись отсутствует; sorting/show empty; plans navigation; console errors []. Полный auth проверен mocked fetch, live API/реальные устройства не тестировались.

Коммиты реализации: 4d9d0b2 (API/demo), 7146102 (UI/SWR/tests). Пользовательский план остаётся untracked и не включён. git push отклонён auto-review: sensitive egress private repository на remote без достаточно явного разрешения публикации. PR не создан; не пытаться обходить запрет. После разрешения: push origin feature/expenses-ux-performance, PR в main, attach_artifact, обновить эту точку.

## Сканер чеков (2026-10-22)

Ветка `receipt-scanner` от `01d5ea6`, коммит `633c2c5` (клиент/тесты, без merge/push). Добавлены `src/receipt.js` (разбор QR ФНС), `src/receipt-store.js` (локальные ключи в разрезе member:household), `src/receipt-photo.js` (BarcodeDetector → jsQR, ограниченные попытки), `src/vendor/jsqr.js` + Apache-2.0 license, RU/EN/ES строки, кнопки сканера/чип чека, CSS, demo duplicate/bad_receipt,queue terminal-коды и тесты.

Проверено: 71/71 тестов, syntax всех изменённых JS, `git diff --check`; browser demo на 127.0.0.1:8123 — сумма/дата из QR, дубль, удаление очищает store, повторное добавление, фото-QR через jsQR. Build `c5fd38addff1`; 19 assets. Реальный Telegram/камера и задеплоенный API не проверялись.

Серверные изменения (ignored каталог `supabase/`): `functions/api/receipt.ts`, `functions/api/index.ts` (`add_tx`: server-side `fn:i:fp`, `bad_receipt`, `duplicate_receipt`, вставка `receipt_key` только при наличии ключа), `migrations/20261022073910_receipt_key.sql` (колонка + partial unique index). Rollout: миграция применена, `api` v13 ACTIVE с `verify_jwt=false`, уникальность проверена транзакционным тестом, `SEND_RECEIPT_KEY = true`, Build `bf5a153a7543`. Реальный Telegram/камера ещё не проверены. Ветка `receipt-scanner` отправлена в origin, PR #2 влит в `main` (`a7af83f`), GitHub Pages собрал Build `bf5a153a7543`. Не включать ignored `supabase/` в git без решения пользователя.

## UI/UX v2, 2026-10-26

Пользователь разрешил push и merge main. Реализация baa43ca; origin/main515ac88 добавил собственные editor/swipe/dock, scanner/CSV/theme. При интеграции переиспользованы main editor с входом из profile/interface и возвратом, pointer swipe и постоянный плюс. Наши dropdown и pull-refresh сохранены. Порядок member-scoped с legacy fallback. Конфликтующие тесты актуализированы; browser editor/save/return и console[] проверены. 132/132 теста и syntax всех src прошли; Build02005d2d983b. Следующие шаги — STATE. AGENTS.md и untracked план исходные пользовательские, не добавлять.

## Деплой модулей v1 (2026-11-03)

Через Supabase MCP: миграции 018–022 применены (`apply_migration`), функции `api` v18 и `notify` v10 задеплоены с `verify_jwt=false`. MCP сохраняет относительные пути: передавались `api/*.ts` + `_shared/*.ts` (entrypoint `api/index.ts`) и `notify/index.ts` + `_shared/*.ts`; плоское дублирование не понадобилось. `apply_migration` берёт версию из текущего времени — при двух вызовах в одну секунду возможен `duplicate key schema_migrations_pkey`, поэтому применять по одной с паузой.

Cron `notify-hourly` снимался на время миграций и восстановлен (jobid 3). Проверки: health 200, 401 без initData, `notify` 403 без секрета, прогон cron 200 и `succeeded`, 9 шаблонов/9 начислений из 9 legacy-платежей, дублей `dedupe_key`/`expense_id` нет, advisors только INFO.

Найден и исправлен баг dual-write: удаление `recurring_payments` обнуляло `legacy_recurring_id` по FK, и шаблон не скрывался. Теперь id шаблона запоминается до удаления, скрытие — по id (`hideTemplate`), тест 49/49, коммит `cd540a0`.

## Модули v1, реализация (2026-11-03)

Ветка `feature/modules-v1` в `../teletreker` (от `e424723`), изменения не закоммичены. Новые файлы: `supabase/migrations/018_recurrence_and_outbox.sql` … `022_backfill_payments.sql`, `supabase/functions/_shared/{recurrence,modules,notification_text}.ts`, `supabase/functions/api/{v1,v1_http,v1_validate,v1_serialize,v1_errors,v1_path,legacy_sync}.ts`, `tests/` (8 файлов). Изменены только `supabase/functions/api/index.ts` и `supabase/functions/notify/index.ts`; pre-existing untracked `miniapp/.agent/`, `miniapp/AGENTS.md` не тронуты.

Проверки: `node --test tests/*.test.mjs` — 48/48; все изменённые TS проходят `npx -y esbuild … --outfile=/dev/null`; в `tg-budget-public` обновлены `docs/api/BACKEND.md` (валюта в начислениях, состав миграции 019) и `.agent/*`.

Не сделано: миграции нигде не применены, `api`/`notify` не задеплоены, SQL/конкурентные интеграционные тесты не запускались (нет БД). Коммит `d64f282` отправлен в origin, PR #5 открыт. Перед деплоем — бэкап БД по `BACKEND.md` §8, после — `GET /v1/health` и smoke legacy-действий.

## Аудит нового ТЗ, 2026-11-03

## Этап 2 контракта, 2026-11-03

Созданы `docs/api/openapi.v1.yaml`, `FRONTEND_API_CONTRACT.md`, `BACKEND.md`, `generate-types.mjs`, `api-types.d.ts`. Проверки: YAML парсится, 22 пути / 34 операции / 42 схемы, все `$ref` разрешаются; `node docs/api/generate-types.mjs` отработал (openapi-typescript 7.13.0). Код бэкенда не менялся. Открытые вопросы — в конце `BACKEND.md`; согласование контракта ещё не получено.

Бэкенд найден в `../teletreker` (origin `tg-budget-app`), ветка `main` e424723, чистая (кроме untracked `miniapp/.agent`, `miniapp/AGENTS.md`). Ключевые файлы: `supabase/functions/api/index.ts` (action-протокол, `verifyInitData`), `supabase/functions/api/telegram.ts`, `supabase/functions/notify/index.ts` (pg_cron, `x-cron-secret`), `supabase/migrations/001_schema.sql`, `005_payments.sql` (подписка Stars, не модуль платежей), `010_notifications.sql`, `013_recurring_reminder_days.sql`, `017_month_split_mode.sql`, `docs/PROJECT.md` (деплой, pg_cron `notify-hourly`).

Ограничения: `deno`/Supabase CLI/MCP отсутствуют; применить миграции и задеплоить функции из этой сессии нельзя. `supabase/` в `tg-budget-public` ignored — серверные правки делать в `../teletreker`, контракт/доки фронта — здесь. Тестов бэкенда нет; фронтовые тесты — `miniapp/tests/*.test.cjs` / `tests/*.test.cjs` на node.

Публикация завершена: feature/ui-ux-v2 и main на origin b7bdae6, рабочая ветка main. Build b934973230a9 (после нормализации конечной пустой строки CSS). Пользовательские AGENTS временно stash и восстановлены без конфликтов; исходный untracked план сохранён. Память о публикации обновлена локально без отдельного коммита.

## Исправление home-only dock, 2026-10-26

Пользователь уточнил: плюс скрывать вне summary и показывать с drop при каждом возврате. Ветка fix/home-only-add-dock от b7bdae6. Изменены app.js (route visibility, inert/aria/tabIndex, transfer focus, cancel intro timer, stale add guard), finance.css (5→4 grid tracks, morph40→0, hide transform/opacity/visibility, reduced-motion), app tests, README/index asset versions. 134/134, syntax/diff чисты, Build1c9e4aab9d80. Browser375: четыре области84.25px; 320:70.5px; notch0 вне home/40 на home, no overflow, repeated add-drop, rapid tabs и quick actions, console[]. Светлая/тёмная проверены; theme system и viewport восстановлены. Скриншоты dock-home.png/dock-profile.png в visualizations/2026/10/25/01a174f7-5451-7950-8f12-0c2503bf0331. Изменения без коммита/push; прошлый push/merge уже выполнен, не считать его blanket-разрешением на новые публикации. Настоящие устройства/FPS и reduced-motion environment не проверены.
