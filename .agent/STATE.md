# Текущее состояние

2026-11-05. Подписки и пробный период временно отключены в production.

- Сервер: `api` v22 и `bot` v13 — ACTIVE. Секрет `SUBSCRIPTIONS_ENABLED` не задан, поэтому флаг выключен по умолчанию. Проверка `plan_until` в legacy API и v1 не блокирует записи; `plans` возвращает `[]`; `create_invoice`/`redeem_promo` — 403; бот не блокирует записи и не активирует `/промо`. `successful_payment` оставлен для старых счетов.
- Клиент: GitHub Pages build `4de9ca8c2172` — https://rozhokserega-lang.github.io/tg-budget/. Раздел «Подписка и промокоды», paywall и баннеры пробного периода скрыты; `State.isExpired()` всегда false.
- Данные `plan_until`, тарифы, промокоды и платежи сохранены. Рекуррентные платежи и напоминания не затронуты.
- Проверки: клиент 213/213, backend 58/58, Deno check api/bot/notify/admin OK. Production: функции ACTIVE, Pages отдаёт новый build.

2026-11-05, плашка предстоящих платежей: `renderSummary` снова вызывает `dueBanner(plans)` — вызов был потерян в 28985c4 (`src/views.js`). Регрессионный тест добавлен. Проверки: клиент 214/214, `node --check src/app.js` OK; версии ассетов пересчитаны (build `80f1232195eb`).

Не закрыто: Telegram smoke на семье с истёкшим `plan_until` (запись должна проходить), проверка скрытого раздела подписки и ответа `/промо`; Telegram smoke плашки (напоминание за N дней/в день платежа, крестик, кнопка оплаты).

Включение обратно: задать `SUBSCRIPTIONS_ENABLED=true` в секретах проекта, задеплоить `api` и `bot`, поставить `SUBSCRIPTIONS_ENABLED = true` в `src/state.js` и опубликовать клиент.

2026-11-05. «Задачи на сегодня»: реализована карточка после финансовых блоков в `feat/home-today-tasks`. Общие Tasks controller/cache/API, до 4 строк, сегодняшний прогресс без просрочки, завершение повторов существующим complete. Проверки: 217/217 Node tests; syntax и diff OK. Browser smoke заблокирован запуском Chromium (`socket() Operation not permitted`); Telegram/mobile visual smoke остаётся. Следующий шаг: PR в main, без слияния.

2026-11-05. Страница «Модули»: добавлены сетка/список, SVG-переключатель и четыре SVG-иконки. Выбор хранится локально в `tg-budget-modules-view`, применяется до отрисовки; переключение на существующих DOM-узлах с transform/opacity 180 мс и reduced-motion. Изменены app.js, payments-views.js, payments.css и версии ассетов index.html. Тесты и браузерные проверки не запускались по указанию пользователя. Следующий шаг: пользовательская проверка в Telegram.

2026-11-05. Редизайн «Напоминания»: Calendar & Timeline, палитра приложения, неделя/месяц, фильтры/дата, отдельный таймлайн, стабильный FAB, частичное обновление регионов DOM. CRUD/повторы/API сохранены, backend-контракты не менялись. Реализация готова к записи в main; следующий шаг — визуальный Telegram smoke 320/360/390/430 px. Проверки и ограничение среды: см. HANDOFF.

2026-11-09. Leisure: PR #26 переработан в серверный модуль; см. docs/leisure.md. Backend найден в rozhokserega-lang/tg-budget-app; настоящая схема сверена. Пакет backend/leisure содержит миграцию, Edge Function, offline OSM importer/worker и тесты. Реальный Kaliningrad PBF: 961 POI / 9 категорий. Node 227/228 (старый task-sort сбой воспроизведён на baseline), backend 2/2, новая функция Deno OK. Production не развёрнут; Chromium socket EPERM блокирует visual smoke. Следующий шаг: ревью парных PR, затем отдельное разрешение на миграцию/deploy/публикацию.

2026-11-09, продолжение: пользователь «Приступай» разрешил migration/deploy, main merge НЕ разрешён. Voronezh real PBF dry-run: 1203 unique POI / 9 категорий; FileProcessor/KeyFilter + file-backed index проверены на реальном источнике и Python fixture (PASS). Production NOT_FOUND для leisure. Блокер доступа: нет credentials/SSH; codex mcp add не может записать read-only ~/.codex/config.toml; list пуст, login server not found. Supabase предложен для подключения; повторно разрешение не запрашивать. Следующий шаг — после подключения Supabase проверить схему и применить разрешённую миграцию/deploy, затем импорт и worker.

2026-11-09 production leisure: Supabase доступ получен. Migration leisure=20261109121747 применена, leisure v1 ACTIVE, Voronezh bootstrap 1203 POI и 1 city. No initData →401, catalog GET→200. Реальные DB rollback tests PASS; персональные prefs/saved/days после тестов0, anon grants denied,8tablesRLS. Старая блокировка Supabase снята. Осталось: полный GeoNames registry, регулярный worker на существующем хосте (SSH нет), Telegram/UI/auth end-to-end. Main merge не разрешён. Следующий шаг: проверить из Telegram после согласованной публикации frontend, получить доступ к хосту для worker.

2026-11-09 publication: пользователь «Запускай все в продакшн» разрешил main/publish. Backend PR22 merged e925349, frontend PR26 merged f07456d. GitHub Pages run42617519559 completed success; live index подключает leisure JS/CSS. DB migration и leisure v1, Voronezh1203 остаются ACTIVE. Клиент main синхронизирован. Осталось Telegram authenticated end-to-end, полный GeoNames registry и регулярный worker (нет server/SSH). Ежедневные подборки из существующего каталога работают без worker; worker нужен для обновления самих POI. Не повторять старую блокировку разрешения main.

2026-11-09 leisure design mix: пользователь дал референс A–D и попросил переработать UI. Ветка feature/leisure-design-mix: hero deck+быстрые действия, категории/список/подборки, календарь планов, схема реальных координат+внешняя карта. Локальные SVG-иллюстрации вместо fake photo. API/БД/dock неизменны. Leisure6/6 PASS; Cloud Browser localhost→Missing or invalid bearer token, visual smoke остаётся. Следующий шаг: сохранить PR и публикацию по имеющемуся разрешению на production модуля, затем пользовательская проверка Telegram.

2026-11-09 entertainment UX: feature/entertainment-ux-improvements, main не сливать по текущему ТЗ. Две вкладки, поиск по GET catalog (пагинация/кеш/debounce), персональное saved, подборки до5, экран предпочтений и активный leisure accent. Backend не менялся; детальные категории/расширенные prefs требуют контракта docs/entertainment-backend-requirements.md. Leisure9/9, общий229/230 (task-sort воспроизводится на baseline); visual smoke Chromium socket EPERM. Следующий шаг: PR без слияния и Telegram smoke.

2026-11-09 app background: feature/app-background-customization. Реализованы глобальный CSS fixed-слой, 7 пресетов, редактор в существующем appearance, сжатие/IndexedDB, восстановление до hideLoader (таймаут1800мс), SDK safe areas. Main не сливать: явный запрет текущего ТЗ. 237/238 Node PASS; единственный task-sort FAIL воспроизведён на origin/main55e30ff. Appearance5/5; focused46/46. Chromium socket EPERM. Детали docs/app-appearance.md. Следующий шаг: PR без merge, затем Telegram visual smoke.
