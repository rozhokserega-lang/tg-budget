# «Развлечения и отдых»: реализация и запуск

## Статус на 9 ноября 2026

Код подготовлен в feature/leisure-mvp. Production не изменён: SQL, Edge Function и cron не развёрнуты. До запуска нельзя считать модуль работающим для настоящих пользователей. В production нет локальной подмены каталога: ошибки API показываются явно. Демо выделено отдельно.

Аудит PR #26 выявил статический список трёх мест, localStorage вместо backend, отсутствие настроек города, истории, импорта и серверной авторизации. Дата определялась по устройству, seed не учитывал пользователя; CSS использовал отсутствующие токены и фиксированный тёмный fallback. Всё это переработано.

## Архитектура

- Публичный клиент: `rozhokserega-lang/tg-budget` (Vanilla JS, Pages).
- Настоящий backend: приватный `rozhokserega-lang/tg-budget-app`, `supabase/functions/{api,bot,notify,admin}`; `miniapp/` — зеркало публичного клиента. Проверены исходники, `members.id uuid`, `telegram_id bigint unique`, существующие личные модули v1, проверка Telegram и миграция readiness от 3 ноября.
- Действующий `api/v1/health` реально ответил 200 / version 1.2.0. Это не проверка готовности новой функции.
- `backend/leisure/` — проверяемый пакет новых backend-файлов; его function и migration зеркалируются в настоящий backend. Старые финансовые функции не меняются.
- Выделенная функция `leisure` на том же Supabase использует существующие BOT_TOKEN, service_role и members. JWT выключен, вместо него проверяется HMAC Telegram, срок initData, неоднозначные поля. Клиент не задаёт owner_id.
- RLS без клиентских политик. RPC и таблицы закрыты для anon/authenticated; service_role вызывается только сервером.
- Публичный каталог ODbL экспортируется через GET `/leisure/catalog?city_id=…&cursor=…`; никаких персональных полей в нём нет.
- Один offline worker на существующем Linux-хосте: OSM PBF → общий каталог PostgreSQL → персональная подборка. Redis, очередь и новые сервисы не нужны.

## Источники и реальные проверки

1. Geofabrik: https://download.geofabrik.de/russia.html — региональные OSM PBF, ODbL. Реально скачан `kaliningrad-261108.osm.pbf`, около 28 МБ, SHA256 `34bfa49e9a30282f83bbc022eba87450eef4a83dc4f2a615f8a9090955fac8aa`.
2. Импорт вокруг GeoNames 554234 (Калининград) дал **961 уникальное место**, все девять категорий. Это реальный dry-run чтения файла и нормализации, не запись в production.
3. Справочник GeoNames https://download.geonames.org/export/dump/RU.zip — реально загружен; 188975 населённых пунктов PPL/PPLA/PPLC с country_code RU и IANA timezone. Включает сельские поселения; русский вариант имени берётся из отдельного GeoNames alternatenames/RU.zip с кодом языка ru, без угадывания языка по кириллице. Для некоторых малых поселений названия латинские. Регион извлекается из ADM1 того же файла.
4. GeoNames: CC BY 4.0 https://download.geonames.org/export/dump/readme.txt. OSM: https://www.openstreetmap.org/copyright. В UI стоят обе атрибуции, экспорт содержит лицензию.
5. Overpass: ограниченный GET around 300m, timeout 10s вернул HTTP 406 / nginx за ~4.9s. Источник отказа не установлен. Проверено исследование в `Ncomest/kuda-poyti-bot`, feature/hybrid-place-search: там то же ограничение, production Overpass отключён. Не повторяли запросы через зеркала.
6. Nominatim в модуле не используется: массовая выгрузка POI запрещена его политикой. Публичный Overpass не выбран backend-зависимостью: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html.

Нулевые платежи внешним API; используются существующие ресурсы. PBF-парсинг требует RAM/диска/CPU существующего хоста. Бесплатные квоты Supabase конечны; не добавлены платные тарифы и ключи. Полный PBF России ~3.9 ГБ не скачивается worker-ом: выбираются региональные файлы до 2 GiB.

## Каталог и рекомендации

- nodes, ways и multipolygon relations, реальные name/name:ru, адрес и description из OSM. Для геометрий — точка представления; не обещается точный вход.
- Идентификатор `osm:{node|way|relation}:{id}`. Повторный импорт — upsert. Одинаковое нормализованное имя/категория ближе 40 м объединяются эвристически; разные элементы OSM могут описывать одно место.
- Каталог: 30 км от центра населённого пункта; это **город и окрестности**, не административная граница. Объекты с явно другим addr:city отбрасываются. Пограничные/малые населённые пункты требуют проверки качества; расширение до административных полигонов — следующий этап.
- Импорт только городов с preferences. Источник региона задаётся оператором в JSON (пример Калининградской области есть в пакете). Другие регионы подключаются конфигурацией без изменения алгоритма. Без источника регион остаётся в состоянии ожидания, выдуманных мест не появляется.
- Worker группирует города по PBF, кеширует файл 7 дней, исключает одновременный запуск flock. DB lease на 2 часа, атомарная замена города, неудачный/пустой импорт сохраняет предыдущие данные. Ошибки пишутся в leisure_imports и stderr. Backoff 1/2/4/8/16 часов, после 5 ошибок автоматические попытки останавливаются. Download backoff хранится в cache state.json; после исправления оператор сбрасывает счетчик.
- Обновление города не чаще 7 дней; пользовательские открытия не вызывают импорт.
- День рассчитывает PostgreSQL `now() at time zone city.timezone`. Снимок хранится по owner/city/day/revision и не зависит от доступности источника. Транзакционная advisory lock сериализует одновременные запросы.
- Сначала не показанные за последние 14 дней, затем более давние; категории чередуются, если есть альтернативы. При исчерпании каталога допустимы повторы. До трёх мест, без фиктивного заполнения.
- Изменение настроек явно создаёт новую revision и подборку. Отметка «посетил» влияет на следующую подборку; текущий дневной снимок сохраняется.
- Радиус от добровольно сохранённой точки 1–30 км. Без координат — каталог города и окрестностей. Расстояние по прямой, не маршрут.

## API

Базовый адрес автоматически заменяет `/api` на `/leisure`; для другого размещения задайте `window.APP_LEISURE_API_URL` до leisure.js.

Все персональные запросы — POST JSON с `initData` и `action`. Участник определяется по подписанному telegram_id и members. `owner_id`/telegram_id из payload не используются.

| action | Payload | Ответ |
|---|---|---|
| load | — | Snapshot |
| cities | query: строка, от 2 символов | cities: до 30 {id,name,region,timezone} |
| preferences | preferences: {city_id,categories,exclude_visited,radius_km?,origin_lat?,origin_lon?} | Snapshot |
| saved | id: OSM id; favorite?, visited?, planned_on?: YYYY-MM-DD или null | Snapshot |

Snapshot: `{preferences: null | {city_id,city,categories,radius_km,origin_lat,origin_lon,exclude_visited,revision,…}, daily:{date,timezone,importedAt,places:[]}, saved:[{place_id,favorite,visited,planned_on,place}], categories:[{id,title,symbol}]}`.

Персональные поля saved обновляются независимо, атомарно; снятие даты не удаляет избранное. GET `/catalog` возвращает `{license,licenseUrl,attribution,city_id,data,nextCursor}`, страницы до 200 мест. Передавайте nextCursor до null для полного каталога города. Персональных таблиц и точек пользователей в экспорте нет.

Ошибки: 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 413 TOO_LARGE, 503 UNAVAILABLE. Изменения подтверждаются сервером; при ошибке нет ложного успешного состояния. Прямой Supabase клиент и service_role в браузере отсутствуют.

## Запуск после отдельного разрешения

В backend PR добавлены настоящие `supabase/functions/leisure`, миграция `20261109120000_leisure.sql` и конфигурация функции. Для ревью доступен идентичный пакет в публичном PR. Не применять SQL повторно под другим именем миграции: выбрать один путь.

1. После ревью применить миграцию к существующему Supabase. Она аддитивна, сохраняет финансы и при повторном применении проходит проверки. BOT_TOKEN/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY уже используются функциями, новые платные секреты не нужны.
2. Развернуть `leisure` с verify_jwt=false из полного backend-репозитория. Проверка initData остаётся обязательной внутри функции.
3. На существующем хосте создать venv, установить `backend/leisure/requirements.txt`. DATABASE_URL задать через секреты окружения хоста, **не в чат, Git и crontab-команду**.
4. Один раз скачать RU.zip и https://download.geonames.org/export/dump/alternatenames/RU.zip (под другим локальным именем ru-names.zip) и запустить `python import_catalog.py --cities-zip /path/RU.zip --ru-names /path/ru-names.zip --cities-only`. GeoNames справочник — не массовый сбор POI.
5. Пользователь выбирает город; preferences сохраняются. Первые рекомендации появятся после первого импорта.
6. Скопировать sources.example.json в конфигурацию хоста и дополнить нужные регионы. Ключи — GeoNames RU-admin1, например RU-23. Планировщик существующего сервера запускает раз в час `python refresh_catalog.py --sources /config/leisure-sources.json --cache /data/leisure-cache` с DATABASE_URL из закрытого окружения. Импорт произойдёт только при истечении cooldown.
7. Убедиться, что endpoint `/leisure/catalog` отдаёт ODbL-экспорт; пользователь выбирает город, получает реальные места, проверяет избранное с двух устройств. Только затем публиковать frontend после отдельного разрешения на main.

Необходимы существующий хост с Python/диском и разрешённый доступ к Geofabrik, GeoNames и Postgres. Никакой инфраструктурный деплой здесь не выполнялся.

## Проверки и ограничения

- Node: 4 новых frontend-теста PASS: день города, URL, настройки/избранное demo, изоляция аккаунтов, initData transport, stale response, escaping. Demo-планы реализованы; отдельный тест даты плана проверяется на SQL-уровне.
- Backend: HMAC/expiry/tampering PASS; PostgreSQL engine PGlite PASS: миграция дважды, день города, стабильность, категории, история, visited, radius, ownership, independent saved updates, запрет anon. Это локальный PostgreSQL engine, не интеграция с production Supabase/PostgREST.
- Deno check новой функции PASS. Python compile PASS. Deno check существующих api/bot/notify/admin и новой leisure в полном backend PASS.
- Общий клиентский набор: 227/228 с четырьмя новыми тестами; один сбой task module opens in app… воспроизведён на исходном app.js ветки, относится к старому ожиданию manual sort после редизайна. Не исправлялся попутно.
- Browser smoke NOT RUN: Chromium пытались запустить, получен fatal `socket() failed: Operation not permitted`. Telegram, safe areas, 320/360/390/430px, светлая/тёмная тема визуально не подтверждены. Использованы существующие --c-* токены, общие отступы и reduced-motion, dock CSS не менялся.
- Фотографии и средний чек пока отсутствуют; CSS-иллюстрации категории показываются всегда, цены/рейтинги не выдумываются. Карты — внешний поиск Яндекса, совпадение не гарантируется.
- GeoNames может содержать неполные/устаревшие имена; OSM неполон, данные заведений могут устареть. Каталог не обещает полного покрытия страны или точных муниципальных границ.
- Из-за отсутствия production-деплоя и визуальной проверки end-to-end критерии ещё не выполнены. Main, секреты и production-данные не изменялись.
