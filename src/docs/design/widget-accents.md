# Акцентные цвета виджетов — SignalDeck

Per-widget accent для дашборда: один **именованный** цвет читается в light и dark темах. В светлой теме — насыщеннее и темнее; в тёмной — ярче и светлее (как `--accent` teal: `#0F766E` / `#2DD4BF`).

## Палитра (6 имён + default)

| Имя | Назначение | Заметка |
|-----|------------|---------|
| `default` | Брендовый teal, как глобальный `--accent` | Без выбора или явный default |
| `blue` | Основные метрики, «холодные» процессы | Steel-blue, не neon |
| `amber` | Пороги, внимание, энергия | Отличим от `--warning`, но в той же семье |
| `rose` | Критичные KPI, alarm-adjacent | Приглушённый rose, не hot-pink |
| `green` | Рост, «норма», eco/efficiency | Emerald; **не** путать с `--success` (статус ON) |
| `slate` | Вторичные серии, нейтральные KPI | Вместо violet — спокойный industrial, без «AI-purple» |

Violet намеренно **не** включён: фиолетовый на белом — клише; `slate` лучше для вторичных линий на SCADA-подобных панелях.

## Токены CSS

### Палитра (в `styles.css`, по теме)

Промежуточные переменные — источник истины для hex:

| Token | Light | Dark |
|-------|-------|------|
| `--widget-palette-default` | `#0F766E` | `#2DD4BF` |
| `--widget-palette-default-soft` | `#EEF7F6` | `#14352F` |
| `--widget-palette-blue` | `#1E40AF` | `#60A5FA` |
| `--widget-palette-blue-soft` | `#EFF6FF` | `#172554` |
| `--widget-palette-amber` | `#B45309` | `#FBBF24` |
| `--widget-palette-amber-soft` | `#FFFBEB` | `#3F2E14` |
| `--widget-palette-rose` | `#BE123C` | `#FB7185` |
| `--widget-palette-rose-soft` | `#FFF1F2` | `#3F1D28` |
| `--widget-palette-green` | `#047857` | `#34D399` |
| `--widget-palette-green-soft` | `#ECFDF5` | `#064E3B` |
| `--widget-palette-slate` | `#475569` | `#94A3B8` |
| `--widget-palette-slate-soft` | `#F1F5F9` | `#1E293B` |

### На виджете (runtime)

На `.widget-shell` (или корне виджета в view mode):

| Token | Назначение |
|-------|------------|
| `--widget-accent` | Основной акцент: stroke, fill, текст KPI, checked toggle |
| `--widget-accent-soft` | Мягкий фон: highlight, chip, optional selection fill |

Выбор цвета: `data-widget-accent="{name}"` на `.widget-shell`. Без атрибута или `default` → teal.

```html
<div class="widget-shell" data-widget-accent="blue">…</div>
```

## Правила использования

### Где применять `--widget-accent`

| Элемент | Правило |
|---------|---------|
| **Line chart** — stroke линии | `stroke: var(--widget-accent)` |
| **Gauge** — кольцо (conic-gradient) | активная дуга `var(--widget-accent)`, остаток `var(--border)` |
| **Gauge** — значение | `color: var(--widget-accent)` |
| **Toggle** — checked track | `background: var(--widget-accent)` |
| **Selected border** (optional) | `border-color: var(--widget-accent)` + ring `color-mix(in srgb, var(--widget-accent) 25%, transparent)` — только если продукт хочет рамку в цвет виджета; иначе оставить глобальный `--accent` в builder |

### Где применять `--widget-accent-soft`

- Фон выделенной ячейки / chip внутри виджета.
- Лёгкая подложка под мини-легенду (если появится).
- **Не** использовать как основной фон всего виджета — только локальные акцентные зоны.

### Что **не** перекрашивать акcentом виджета

| Элемент | Токен |
|---------|-------|
| **Boolean indicator ON/OFF** | `--success` / `--text-muted` + `--indicator-on-bg` / `--indicator-off-bg` — семантика состояния |
| **Ошибки, offline** | `--error` |
| **Предупреждения системные** | `--warning` |
| **Ссылки, CTA приложения** | глобальный `--accent` |
| **Focus ring форм** | глобальный `--accent` |

Исключение: если PO явно захочет indicator ON в цвет виджета (например rose для alarm-метрики) — допустимо, но по умолчанию ON = success.

## Контраст и читаемость

- Light: акценты уровня 700–800 (slate 600) на `--surface` `#FFFFFF`.
- Dark: акценты уровня 400 на `--surface` `#1A222C`.
- Soft-фоны: light ≈ 50 tint семьи; dark ≈ 900–950 tint — не конкурируют с `--surface-muted`.
- Текст KPI в `--widget-accent` на белом/тёмном surface — проверен визуально; для мелкого caption (<12px) предпочитать `--text` + accent только на stroke/icon.

## FE: подключение (без picker)

1. Сохранять в конфиге виджета поле `accent: 'default' | 'blue' | 'amber' | 'rose' | 'green' | 'slate'`.
2. Пробрасывать `data-widget-accent={accent}` на `WidgetShell`.
3. В виджетах заменить `var(--accent)` на `var(--widget-accent)` для chart/gauge/toggle (см. таблицу выше).
4. Палитра уже в `web/src/styles.css` под `[data-theme="light"]` / `[data-theme="dark"]`.

## Сводная таблица `--widget-accent` / `--widget-accent-soft`

| Name | Light accent | Light soft | Dark accent | Dark soft |
|------|--------------|------------|-------------|-----------|
| **default** | `#0F766E` | `#EEF7F6` | `#2DD4BF` | `#14352F` |
| **blue** | `#1E40AF` | `#EFF6FF` | `#60A5FA` | `#172554` |
| **amber** | `#B45309` | `#FFFBEB` | `#FBBF24` | `#3F2E14` |
| **rose** | `#BE123C` | `#FFF1F2` | `#FB7185` | `#3F1D28` |
| **green** | `#047857` | `#ECFDF5` | `#34D399` | `#064E3B` |
| **slate** | `#475569` | `#F1F5F9` | `#94A3B8` | `#1E293B` |
