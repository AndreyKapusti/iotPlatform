# UI Guidelines — SignalDeck

Светлая industrial-тема для MVP. Desktop-first, без «AI-purple» и dark-only.

## Принципы

- Простота выше Blynk: минимум шагов от входа до живого графика.
- Ясная иерархия: фон → поверхность → контент → акцент.
- 8px spacing grid — все отступы кратны 8.
- Состояния явные: hover, focus, disabled, error, loading.

## Цвета

| Token | HEX | Назначение |
|-------|-----|------------|
| `--bg` | `#F4F7F5` | Фон приложения |
| `--surface` | `#FFFFFF` | Карточки, панели, модалки |
| `--text` | `#1A2332` | Основной текст |
| `--text-muted` | `#5C6B7A` | Вторичный текст, подписи |
| `--border` | `#D8E0DC` | Рамки, разделители |
| `--accent` | `#0F766E` | CTA, links, active, focus ring |
| `--accent-hover` | `#0D9488` | Hover акцента |
| `--success` | `#15803D` | Online, OK |
| `--warning` | `#B45309` | Предупреждения |
| `--error` | `#B91C1C` | Ошибки, offline critical |

**Запрещено:** фиолетовые градиенты, neon-dark hero, card-soup на пустых экранах.

## Темы (light / dark)

Приложение поддерживает две темы через `data-theme` на `<html>` и CSS-переменные.

| Тема | Фон / поверхность / акцент |
|------|----------------------------|
| light (default) | `#F4F7F5` / `#FFFFFF` / `#0F766E` |
| dark | `#0F1419` / `#1A222C` / `#2DD4BF` |

- Переключение: экран **Настройки** (`/settings`).
- Хранение: `localStorage.signaldeck_theme` (`light` \| `dark`).
- Анти-flash: inline-скрипт в `index.html` до React.
- Не хардкодить цвета в компонентах — только CSS variables.

## Типографика

Google Fonts:

- **DM Sans** — заголовки, кнопки, навигация (`500`, `600`, `700`).
- **IBM Plex Sans** — body, таблицы, формы, метки (`400`, `500`).

| Уровень | Размер / line-height | Шрифт |
|---------|----------------------|-------|
| H1 | 28px / 36px | DM Sans 600 |
| H2 | 22px / 28px | DM Sans 600 |
| H3 | 18px / 24px | DM Sans 500 |
| Body | 14px / 20px | IBM Plex Sans 400 |
| Caption | 12px / 16px | IBM Plex Sans 400 |
| Mono (IDs, keys) | 13px | IBM Plex Mono (опционально) |

## Spacing & layout

- Базовая сетка: **8px** (`4, 8, 16, 24, 32, 48`).
- Контентная ширина: max **1200px** (dashboard builder — до **1440px**).
- Радиус: `8px` карточки, `6px` inputs, `4px` chips.
- Тень карточки: `0 1px 3px rgba(26, 35, 50, 0.08)`.

## Компоненты (базовые)

- **Button primary** — fill `--accent`, text white.
- **Button secondary** — border `--border`, text `--text`.
- **Input** — surface, border 1px, focus ring 2px `--accent`.
- **Card** — surface, padding 16–24px, border или лёгкая тень.
- **Badge** — online (green dot), offline (muted), error (red).

## Экраны MVP

### 1. Login / Register

- Центрированная форма на `--bg`, card `--surface`.
- Поля: email (register), username, password.
- Primary CTA «Войти» / «Зарегистрироваться»; ссылка переключения режима.
- Ошибки под полем, не toast-only.

### 2. Devices list

- Header: заголовок + «Добавить устройство».
- Таблица или список карточек: имя, id, статус online/offline, дата создания.
- Row click → device detail.
- Empty state: краткая инструкция + CTA создать устройство.

### 3. Device detail + schema

- Вкладки или секции: **Overview** | **Schema** | **Dashboard**.
- Overview: credentials (api_key с copy), MQTT hint, last seen.
- Schema: read-only таблица capabilities (`name`, `type`, `role`, `unit`).
- CTA «Открыть дашборд» / «Собрать дашборд».

### 4. Dashboard builder (DnD grid)

- Layout: sidebar виджетов | canvas grid | panel свойств выбранного виджета.
- Grid: 12 колонок, row height 8px-based (например 40px), snap при drag.
- Библиотека виджетов фильтруется по schema device (type + role).
- Toolbar: save, preview/live toggle, reset layout.
- Widget selected — border `--accent`, handles resize (минимум 2×2 cells).

## Виджеты

| Виджет | Capability | Поведение |
|--------|------------|-----------|
| **Line chart** | `number` + sensor | WS/history, ось Y из min/max или auto |
| **Gauge / KPI** | `number` + sensor | Последнее значение + unit, optional arc |
| **Boolean indicator** | `boolean` + sensor | ON/OFF цвет + label |
| **Toggle** | `boolean` + actuator | Switch → command на device |

Общее для виджетов:

- Заголовок = metric name (editable alias в layout JSON).
- Loading skeleton при первой подгрузке history.
- Offline badge если нет данных > N сек.

## Real-time

- Live mode: WebSocket push обновляет виджеты без refresh.
- При reconnect — догрузка последних точек через history API.
- Не блокировать UI на disconnect; banner «Нет связи» сверху canvas.

## Responsive (MVP)

Desktop-first; три breakpoint в `web/src/styles.css`:

| Breakpoint | Поведение |
|------------|-----------|
| **≤1100px** | Dashboard edit: одна колонка — палитра сверху (horizontal scroll), canvas, свойства снизу. View: canvas на всю ширину. |
| **≤900px** | App sidebar — overlay drawer (☰ в mobile bar), backdrop, main content на всю ширину. |
| **≤768px** | Уменьшенные отступы, компактные заголовки; device meta и формы в одну колонку. |

View mode: grid масштабируется через CSS `transform` (min design width 720px), DnD только в edit без scale.

## Accessibility (минимум)

- Focus visible на интерактивных элементах.
- Конtrast text/surface ≥ WCAG AA для body.
- Кликабельные зоны ≥ 40px height.

## CSS variables (стартовый набор)

```css
:root {
  --bg: #F4F7F5;
  --surface: #FFFFFF;
  --text: #1A2332;
  --text-muted: #5C6B7A;
  --border: #D8E0DC;
  --accent: #0F766E;
  --accent-hover: #0D9488;
  --font-display: "DM Sans", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;
}
```

## Адаптивность (breakpoints)

Desktop-first; mobile — просмотр и базовая навигация, не полноценный builder.

| Диапазон | Класс | Ширина контента (ориентир) |
|----------|-------|----------------------------|
| **Desktop** | `≥1280px` | sidebar 240 + main до 1200 (wide 1440) |
| **Tablet** | `768–1279px` | sidebar 72 (rail) или drawer; main 100% − rail |
| **Mobile** | `<768px` | sidebar drawer/overlay; main full-bleed, padding 16px |

Точки перелома для FE: **1280**, **768**, **640** (мелкие формы, theme-options).

### Sidebar (app nav)

| Состояние | Ширина | Поведение |
|-----------|--------|-----------|
| Развёрнут | **240px** | Лого + подписи пунктов; toggle «свернуть» |
| Свернут | **72px** | Только иконки + `title` tooltip; выбор в `localStorage` |
| Tablet | **72px** по умолчанию | Rail sticky; разворот по toggle |
| Mobile | **0 / overlay** | Скрыт; hamburger открывает drawer поверх контента (backdrop, Esc закрывает) |

Не дублировать sidebar в header на desktop. На `<768px` — drawer, не постоянный rail.

### Dashboard grid (MVP)

**Рекомендация: reflow панелей + пропорциональное сжатие сетки, без CSS-transform scale.**

| Режим | Desktop | Tablet | Mobile |
|-------|---------|--------|--------|
| **View** | 12-col grid, row 40px | 12-col, ячейки уже; виджет ≥4 col → **full width** (span 12) | Одна колонка: порядок по `y`, затем `x` |
| **Edit** | palette \| canvas \| props (240+1fr+240) | Панели **стеком** над/под canvas | Только view; edit — «нужен экран ≥768px» или read-only banner |

- Layout JSON **не менять** при reflow — только CSS `grid-column` override в view.
- Мин. высота виджета: **2 rows (80px)**; chart/gauge — **≥120px** контента.
- DnD/resize — только `≥768px`.
- Горизонтальный scroll canvas — **запрещён** (кроме временного debug).

### Минимальная пригодность

**~1280px (laptop):**

- Login, devices, settings — без горизонтального scroll.
- Dashboard **view**: ≥2 виджета в ряд (напр. 2× gauge 3-col).
- Dashboard **edit**: canvas ≥640px; palette и props доступны (стек или узкие колонки).
- Toolbar: mode toggle + save не обрезаются (`flex-wrap`).

**~768px (tablet):**

- Навигация: rail 72px или drawer — все пункты reachable.
- Dashboard **view**: все виджеты читаемы (KPI цифра, toggle ≥40px, chart ось видна).
- Dashboard **edit**: palette + canvas + props вертикально; drag snap работает.
- Таблица devices: card-list или scroll-x таблицы — допустимо; row tap → detail.

**<768px:** auth + devices list + dashboard view; edit/builder — опционально с предупреждением.

## UI-1 — feedback и пустые состояния

### Toast / snackbar

- **Позиция:** правый нижний угол, отступ 24px от краёв; на mobile — 16px, над mobile bar если есть.
- **Длительность:** success/info — **4 с**; demo — **6 с** (чуть дольше, чтобы успели прочитать).
- **Варианты:**

| Вариант | Цвет / иконка | Когда |
|---------|---------------|-------|
| **success** | `--success`, ✓ | Сохранено, команда принята, копирование в буфер |
| **info** | `--text`, ℹ | Нейтральное уведомление (reconnect, подсказка) |
| **demo** | `--warning`, ⚡ | Действие выполнено в demo/stub-режиме |

- Не более **2** toast одновременно — новый вытесняет старый.
- Ошибки форм — под полем; toast только для глобальных сбоев (save failed, network).

### Empty states

- **Без иллюстраций** — заголовок, 1–2 строки текста, primary CTA.
- Центр контентной области, max-width ~400px.

| Экран | Условие | Текст + CTA |
|-------|---------|-------------|
| Devices | 0 устройств | «Нет устройств» → «Добавить устройство» |
| Device schema | capabilities пуст | «Схema не загружена» → «Обновить» / ссылка на docs |
| Dashboard | 0 виджетов (edit) | «Дашборд пуст» → «Добавить виджет» (фокус на palette) |
| Dashboard | 0 виджетов (view) | «Нет виджетов» — без CTA или «Настроить» если есть права |
| History / chart | нет точек | «Нет данных за период» — без CTA |

- Не показывать empty state во время **loading** — skeleton вместо него.

### Dashboard status strip

- Полоска **над canvas** (под toolbar), высота ~32px, фон `--surface`, border-bottom.
- Слева: badge **online** (green dot + «Online») / **offline** (muted + «Offline»).
- Справа от badge: **last seen** — относительное время («2 мин назад», «вчера»); обновлять каждые 30 с без перезагрузки страницы.
- Если online и last seen < 60 с — last seen можно скрыть или показать «только что».
- Offline > 5 мин — текст `--warning`; > 1 ч — `--text-muted`.

### Toggle demo

- Если команда actuator **stubbed** (demo mode, нет реального MQTT publish) — после переключения показать toast **demo**: «Демо: команда не отправлена на устройство».
- На самом toggle — постоянный chip **«демо»** (caption, `--warning`, 12px) рядом с label или под switch, если устройство или tenant в demo-режиме.
- Chip скрывать только когда устройство online и publish реальный.
- Switch остаётся интерактивным — меняет локальное состояние и UI; не блокировать disabled без пояснения.

## История

| Дата | Изменение |
|------|-----------|
| 2026-07-20 | Первая версия для MVP frontend |
| 2026-07-20 | Адаптивность: breakpoints, sidebar, dashboard grid |
| 2026-07-20 | UI-1: toast, empty states, status strip, toggle demo |
