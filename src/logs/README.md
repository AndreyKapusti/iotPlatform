# SignalDeck — рабочие логи

Журнал разработки для PO, PM и команды.

## Зачем
Фиксируем: **что сделано**, **что планируется**, **подводные камни** (чтобы не наступать дважды).

## Правила
1. Один файл на значимый день/сессию или на инцидент (`YYYY-MM-DD-topic.md`).
2. Стиль: коротко, по делу, без воды (как documentation-standard).
3. Подводные камни — обязательно с «как жить дальше».
4. PM отвечает за актуальность индексного README; агенты дополняют по факту работ.

## Индекс

| Файл | Содержание |
|------|------------|
| [2026-07-20-mvp-bootstrap.md](2026-07-20-mvp-bootstrap.md) | Старт MVP: сборка стека, фиксы, ожидание Docker |
| [2026-07-20-docker-e2e.md](2026-07-20-docker-e2e.md) | Первый живой Compose: e2e OK, фиксы email/race |
| [2026-07-20-settings-theme.md](2026-07-20-settings-theme.md) | Настройки + светлая/тёмная тема |
| [2026-07-20-sidebar.md](2026-07-20-sidebar.md) | Сворачиваемая левая панель меню |
| [2026-07-20-multi-dashboards.md](2026-07-20-multi-dashboards.md) | Несколько дашбордов + view/edit |
| [2026-07-20-fix-nested-charts.md](2026-07-20-fix-nested-charts.md) | Фикс вложенных графиков (QA→FE) |
| [2026-07-20-fix-widget-select.md](2026-07-20-fix-widget-select.md) | Фикс выбора виджета после drag |
| [2026-07-20-responsive.md](2026-07-20-responsive.md) | Адаптив под разные экраны |
| [2026-07-20-ui1.md](2026-07-20-ui1.md) | UI-1: toast, toggle демо, online, empty |
| [2026-07-20-widget-resize.md](2026-07-20-widget-resize.md) | Ресайз виджетов мышью в edit |
| [2026-07-20-widget-accent.md](2026-07-20-widget-accent.md) | Цвет виджета (accents light/dark) |
| [2026-07-20-day-wrap.md](2026-07-20-day-wrap.md) | **Итог дня**, стенд остановлен |
| [2026-07-22-user-profile.md](2026-07-22-user-profile.md) | Профиль v1: BE `/users/me`, UI `/profile`, deploy + backlog |
| [2026-07-22-fix-profile-load.md](2026-07-22-fix-profile-load.md) | Фикс: профиль не загружался (nginx не проксировал `/api/v1/users`) |
| [TEMPLATE.md](TEMPLATE.md) | Шаблон новой записи |

## Связанные docs
- Статус приёмки: `../docs/changelog/mvp-status-2026-07-20.md`
- QA: `../docs/qa/mvp-checklist.md`
