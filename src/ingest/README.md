# SignalDeck Ingest

Go-сервис data plane: приём announce/telemetry по MQTT и HTTP, запись в TimescaleDB, realtime через WebSocket.

## Переменные окружения

| Переменная | Обязательно | По умолчанию | Описание |
|------------|-------------|--------------|----------|
| `DATABASE_URL` | да | — | Postgres/Timescale connection string |
| `MQTT_BROKER` | нет | `tcp://localhost:1883` | MQTT broker URL |
| `HTTP_ADDR` | нет | `:8001` | HTTP listen address |
| `CORS_ORIGINS` | нет | — | Разрешённые origins через запятую |

## MQTT

Подписки:

- `devices/{device_id}/announce` — схема capabilities
- `devices/{device_id}/telemetry` — readings

В JSON payload обязателен `api_key` (MVP). `device_id` в топике должен совпадать с полем в теле.

## HTTP API

| Метод | Путь | Auth |
|-------|------|------|
| GET | `/health` | нет |
| POST | `/api/v1/ingest/announce` | `X-API-Key` |
| POST | `/api/v1/ingest/telemetry` | `X-API-Key` |
| GET | `/api/v1/telemetry/{deviceId}/history?metric=&limit=100` | нет (MVP) |
| GET | `/api/v1/telemetry/{deviceId}/latest` | нет (MVP) |
| GET | `/api/v1/ws?device_id=` | нет (MVP) |

### Announce

```json
{
  "device_id": 1,
  "schema_version": 1,
  "firmware": "sim-0.1",
  "capabilities": [
    {"name": "temperature", "type": "number", "role": "sensor", "unit": "°C", "min": -40, "max": 85},
    {"name": "motion", "type": "boolean", "role": "sensor"}
  ]
}
```

### Telemetry

```json
{
  "device_id": 1,
  "timestamp": "2026-07-20T17:00:00Z",
  "readings": {
    "temperature": 23.4,
    "motion": false
  }
}
```

### WebSocket push

При новой точке клиент получает:

```json
{
  "device_id": 1,
  "metric": "temperature",
  "value": 23.4,
  "type": "number",
  "received_at": "2026-07-20T17:00:01Z"
}
```

## Локальный запуск

```bash
cd signaldeck/ingest
export DATABASE_URL=postgres://signaldeck:signaldeck@localhost:5432/signaldeck?sslmode=disable
export MQTT_BROKER=tcp://localhost:1883
export CORS_ORIGINS=http://localhost:5173
go run ./cmd/server
```

Или через Compose из `deploy/`:

```bash
cd signaldeck/deploy
docker compose up --build ingest
```

## Сборка

```bash
go build -o bin/ingest ./cmd/server
```

Контракт устройства: `docs/device-contract-v0.md`.
