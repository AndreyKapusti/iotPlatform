# 2026-07-20 — Fix widget select after drag

**Автор:** PM → QA + FE  
**Фаза:** bugfix

## Раздача
| Роль | Задание | Итог |
|------|---------|------|
| QA | Почему после drag нет выбора виджета | Bubble: select → canvas clears; + dnd-kit click suppress after drag |
| FE | stopPropagation + select on drag start + deselect only on empty grid | Build OK |
| PM | Review, restart web | Deployed |

## Как проверить
1. Дашборд → Редактирование  
2. Перетащи виджет за ⋮⋮  
3. Кликни другой виджет — должен выделиться, справа свойства  
4. Кликни пустое место сетки — снятие выделения  
