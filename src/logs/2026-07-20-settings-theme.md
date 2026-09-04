# 2026-07-20 — Settings + light/dark theme

**Автор:** PM / FE  
**Фаза:** post-MVP polish (feature loop)

## Сделано
- Процесс фич зафиксирован: `docs/process-feature-loop.md`
- Экран **Настройки** (`/settings`): выбор светлой / тёмной темы
- Тема через `data-theme` + CSS variables; сохранение в `localStorage`
- Анти-flash скрипт в `index.html`
- Ссылка «Настройки» в шапке (AppLayout + WideLayout)
- Dark tokens в `styles.css`; хардкод цветов убран на переменные
- UI guidelines обновлены секцией тем
- Контейнер `web` пересобран и перезапущен

## План дальше
- Правки PO по теме/настройкам
- Следующая фича по описанию PO

## Подводные камни
| Камень | Как жить дальше |
|--------|-----------------|
| Hardcoded HEX в CSS ломает dark | Только CSS variables |
| Flash светлой темы при reload | Inline script до React обязателен |
| Recharts может не подхватывать CSS vars для stroke | При жалобах на графики в dark — явные цвета из computed style |

## Как проверить
1. http://localhost:3000 → войти  
2. «Настройки» → выбрать Тёмная / Светлая  
3. Обновить страницу — тема должна сохраниться  
4. Проверить devices / dashboard в обеих темах  
