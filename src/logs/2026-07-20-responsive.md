# 2026-07-20 — Adaptive / responsive scaling

**Автор:** PM → DESIGN + FE  
**Фаза:** feature loop

## Раздача
| Роль | Задание | Итог |
|------|---------|------|
| DESIGN | Breakpoints, sidebar, dashboard MVP | `docs/design/ui-guidelines.md` §Адаптивность |
| FE | Shell drawer, dashboard stack, view scale | Layout + CSS + DashboardPage ResizeObserver |
| PM | Accept, restart web | Deployed |

## Поведение
| Ширина | Что происходит |
|--------|----------------|
| ≤1100px | Edit: палитра сверху → canvas → свойства снизу |
| ≤900px | Sidebar = overlay drawer + ☰ бар |
| ≤768px | Плотнее отступы, формы в колонку |
| View + узкий canvas | Лёгкий CSS scale сетки (DnD в edit без scale) |

## Как проверить
1. Desktop широкий — как раньше  
2. Сузь окно ~1000px — дашборд edit стеком  
3. ~800px — меню ☰ слева выезжает  
4. View на узком экране — виджеты читаемы  

## Подводные камни
| Камень | Как жить дальше |
|--------|-----------------|
| Scale в edit ломает DnD координаты | Scale только view; edit без transform |
| DESIGN «без scale» vs FE scale в view | MVP pragmatic; при жалобах — только reflow |
