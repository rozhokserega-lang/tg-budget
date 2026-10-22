# Текущее состояние

Обновлено: 2026-10-22 (Europe/Moscow).
Задача: добавить в профиль Telegram Mini App действие «Добавить на главный экран» через `Telegram.WebApp.addToHomeScreen()`, не ломая существующее поведение бюджета и тесты.
Прогресс: клиентские изменения готовы. Добавлены обёртки `Tg.canAddToHomeScreen`, `Tg.checkHomeScreenStatus`, `Tg.addToHomeScreen`, `Tg.onHomeScreenAdded`; в профиле над меню появилась статусная строка: активна для `missed`/`unknown`, показывает «уже добавлено» для `added`, скрыта для `unsupported`. Статус перепроверяется при открытии профиля, событие `homeScreenAdded` обновляет UI и показывает тост. Добавлены EN/ES-переводы, стили и тесты. `node --test tests/*.test.cjs`: 81/81. Build `0b69ff34a421`.
Проверка: локальный browser demo с подменённым `Telegram.WebApp` — строка видна для `missed`, исчезает для `unsupported`, показывает `added`, клик вызывает `addToHomeScreen()`. Реальное мобильное устройство Telegram ещё не проверено.
Прод-раскатка: миграция `receipt_key` применена (версия `20261022073910`), Edge Function `api` — версия 13, `ACTIVE`, `verify_jwt=false`; `SEND_RECEIPT_KEY = true` включён после деплоя.
Ограничения: серверные файлы `supabase/` исключены `.gitignore` и в коммит не входят; `homeScreenAdded` может не прийти на устройствах без определения статуса установки, поэтому статус перепроверяется при открытии профиля.
Публикация: изменения закоммичены (`d277ef2`, «Add Telegram home screen shortcut to profile») и отправлены в origin; GitHub Pages собирает Build `0b69ff34a421`, production до завершения деплоя может отдавать `faf38ba7ce44`.
Следующий шаг: проверить на GitHub Pages Build `0b69ff34a421`, затем протестировать на реальном Telegram iOS/Android (включая сценарий без события `homeScreenAdded`). Серверные файлы в Git добавлять только отдельным решением.
