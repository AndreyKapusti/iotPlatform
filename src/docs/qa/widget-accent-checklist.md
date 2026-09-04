# QA checklist — акцент виджета (edit mode)

## Окружение
- [ ] `docker compose --profile demo up -d` из `deploy/`
- [ ] UI http://localhost:3000 · login `admin` / `admin123` · demo-дашборд
- [ ] Режим «Редактирование» · на canvas есть line, gauge, toggle (indicator — для регрессии)

## Color picker в PropertiesPanel
- [ ] Выбрать виджет → в «Свойства» виден блок «Акцент» / color picker
- [ ] 6 swatch + default (teal); активный swatch подсвечен
- [ ] Смена акцента сразу меняет виджет на canvas (без save)
- [ ] Снять выделение / выбрать другой виджет — picker показывает его accent

## Акценты (default, blue, amber, rose, green, slate)
- [ ] **default** — teal, как глобальный `--accent`
- [ ] **blue** — steel-blue, не neon
- [ ] **amber** — тёплый, отличим от chip «демо» / `--warning`
- [ ] **rose** — приглушённый rose, не hot-pink
- [ ] **green** — emerald KPI; **не** совпадает с `--success` (indicator ON)
- [ ] **slate** — нейтральный серый, читаем на white/dark surface

## Применение: line / gauge / toggle
- [ ] **Line** — stroke линии = `--widget-accent`
- [ ] **Gauge** — активная дуга кольца и значение = accent
- [ ] **Toggle** — checked track = accent; OFF — нейтральный track
- [ ] Indicator **не** перекрашивается accent'ом (см. ниже)

## Indicator — ON остаётся success-green
- [ ] Boolean indicator ON — `--success` / зелёный pill, не цвет виджета
- [ ] OFF — muted / `--indicator-off-bg`, без accent
- [ ] Сменить accent у соседнего line/gauge — indicator не меняется

## Light / dark: контраст палитры
- [ ] **Light** — акценты темнее/насыщеннее (≈700–800), читаемы на `--surface`
- [ ] **Dark** — акценты светлее/ярче (≈400), без «грязи» на `#1A222C`
- [ ] Переключить тему в Настройках — accent виджета обновляется, layout не сбрасывается

## Сохранение
- [ ] Сменить accent → «Сохранить» → toast «Дашборд сохранён»
- [ ] Reload страницы — accent каждого виджета совпадает с сохранённым
- [ ] «Сбросить» до save откатывает accent к последнему сохранённому layout

## Режим «Просмотр»
- [ ] Переключить «Просмотр» — accent виден на line/gauge/toggle
- [ ] PropertiesPanel / picker скрыты; toggle кликабелен как раньше
- [ ] Indicator ON/OFF в view mode без регрессии

## Регрессия resize / drag
- [ ] После смены accent — SE resize и drag за «⋮⋮» работают (см. `widget-resize-checklist.md`)
- [ ] Resize/drag не сбрасывает accent; save/reload сохраняет w/h + accent
- [ ] В view mode handles не видны; accent не «отваливается» после edit → view → edit
