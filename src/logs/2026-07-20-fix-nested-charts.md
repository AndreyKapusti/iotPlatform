# 2026-07-20 — Fix nested dashboard charts

**Автор:** PM (координация) → QA + FE  
**Фаза:** bugfix / feature loop

## Раздача задач
| Роль | Задание | Результат |
|------|---------|-----------|
| QA | Диагностика «графики вложенно» | Root cause: double `WidgetShell` (GridWidget + виджет) |
| FE | Убрать двойную оболочку, починить sizing Recharts | Content-only widgets + `.widget-chart` |
| PM | Review, theme strokes, rebuild web, лог | Accepted fix → стенд обновлён |

## Сделано
- Виджеты больше не рисуют свой `WidgetShell` внутри ячейки грида
- Chart body: `.widget-body--chart` + `.widget-chart` (height 100%, min-height 120)
- Цвета графика/gauge на CSS variables (light/dark)
- `web` пересобран и перезапущен

## План дальше
- PO проверка визуала графиков в view/edit
- При следующих багах — тот же цикл: QA → FE/BE → PM accept → restart

## Подводные камни
| Камень | Как жить дальше |
|--------|-----------------|
| Два владельца chrome виджета | Shell только в `GridWidget` / DashboardPage; content-компоненты без рамки |
| Recharts `%` height | Родитель обязан иметь явную высоту во flex-цепочке (`min-height: 0`, stretch) |

## Как проверить
1. Дашборд → виджет line chart  
2. Один заголовок, один бордер, график на всю область виджета  
3. View и Edit режимы  
