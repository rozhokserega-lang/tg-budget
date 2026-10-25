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
