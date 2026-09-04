# SignalDeck Web — фронтенд MVP

Веб-интерфейс SignalDeck: регистрация, управление устройствами, просмотр schema (capabilities) и drag-and-drop дашборд с live-данными по WebSocket.

## Стек

- Vite + React 18 + TypeScript
- react-router-dom
- @dnd-kit/core — перетаскивание виджетов на CSS grid (12 колонок)
- recharts — line chart
- Стили: custom CSS по [UI Guidelines](../docs/design/ui-guidelines.md)

## Быстрый старт (локально)

```bash
cd signaldeck/web
npm install
npm run dev
```

Приложение: http://localhost:5173

Для работы API поднимите backend из `signaldeck/deploy`:

```bash
cd signaldeck/deploy
docker compose up -d postgres mosquitto control ingest
# опционально демо-данные:
docker compose --profile demo up -d simulator
```

Vite проксирует запросы:

| Путь | Сервис |
|------|--------|
| `/api/v1/auth`, `/api/v1/devices`, `/api/v1/dashboards` | control :8000 |
| `/api/v1/ingest`, `/api/v1/telemetry`, `/api/v1/ws` | ingest :8001 |

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `VITE_CONTROL_URL` | пусто | URL control API (для dev proxy) |
| `VITE_INGEST_URL` | пусто | URL ingest API (для dev proxy) |
| `VITE_WS_URL` | пусто | WebSocket URL (если пусто — `ws(s)://<host>/api/v1/ws`) |

В production (Docker/nginx) фронтенд использует **относительные** URL: `fetch('/api/v1/...')`.

JWT хранится в `localStorage` под ключом `signaldeck_token`.

## Сборка

```bash
npm run build
npm run preview
```

Docker-образ: multi-stage build (Node → nginx:alpine). Nginx отдаёт SPA и проксирует API согласно `nginx.conf`.

```bash
docker build -t signaldeck-web .
```

## Экраны

1. **Login / Register** — `/login`  
   OAuth2 login: `POST /api/v1/auth/login` (form-urlencoded).  
   Register: `POST /api/v1/auth/register` (JSON).

2. **Список устройств** — `/devices`  
   Создание, статус online/offline (по `last_seen_at`), ссылки на detail и dashboard.

3. **Устройство** — `/devices/:id`  
   API key (copy), таблица capabilities из `GET /api/v1/devices/{id}/capabilities`.

4. **Дашборд** — `/devices/:id/dashboard`  
   - Загрузка layout: `GET /api/v1/dashboards/device/{id}`  
   - Сохранение: `PUT /api/v1/dashboards/device/{id}`  
   - Палитра виджетов из capabilities  
   - Live: WebSocket `/api/v1/ws?device_id=`  
   - History: `GET /api/v1/telemetry/{id}/history?metric=&limit=50`

## Виджеты

| type | Capability | Компонент |
|------|------------|-----------|
| `line` | number + sensor | LineChartWidget |
| `gauge` | number + sensor | KpiGaugeWidget |
| `indicator` | boolean + sensor | BooleanIndicatorWidget |
| `toggle` | boolean + actuator | ToggleWidget (UI; команды — фаза 2) |

Формат layout JSON:

```json
{
  "id": "w_...",
  "type": "line",
  "metric": "temperature",
  "x": 0,
  "y": 0,
  "w": 6,
  "h": 4,
  "title": "temperature"
}
```

## Структура

```
web/
├── src/
│   ├── api/client.ts       # HTTP + auth + helpers
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── widgets/        # виджеты дашборда
│   ├── hooks/useTelemetry.tsx
│   ├── pages/              # Login, Devices, Device, Dashboard
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── nginx.conf
├── Dockerfile
└── vite.config.ts
```

## Happy path

1. Зарегистрироваться / войти  
2. Создать устройство → скопировать API key  
3. Запустить симулятор с этим ключом  
4. Открыть дашборд → добавить виджеты из палитры → Сохранить  
5. Убедиться, что графики и KPI обновляются в live mode

## Адаптивность

Breakpoints (см. `src/styles.css` и `docs/design/ui-guidelines.md`):

- **1100px** — dashboard edit: palette / canvas / props в одну колонку
- **900px** — sidebar overlay drawer + mobile top bar
- **768px** — компактные отступы и типографика

View mode масштабирует grid через CSS transform (без влияния на DnD в edit).
