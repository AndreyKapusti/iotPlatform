# SignalDeck Simulator

Виртуальное устройство для MVP: регистрация в control plane, announce capabilities и периодическая телеметрия по [Device Contract v0](../docs/device-contract-v0.md).

## Назначение

- Первый клиент платформы без Arduino/ESP.
- Эталон поведения для будущей прошивки.
- Демо-поток данных в Compose-стенде.

## Быстрый старт (Compose)

```bash
cd ../deploy
docker compose --profile demo up --build
```

Симулятор сам создаёт demo-пользователя и устройство `demo-sensor`, затем шлёт данные каждые 2 с.

## Локальный запуск

```bash
pip install -r requirements.txt
# для MQTT: pip install paho-mqtt

export CONTROL_URL=http://localhost:8000
export INGEST_HTTP_URL=http://localhost:8001
python main.py
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `CONTROL_URL` | `http://localhost:8000` | Control API (auth, devices) |
| `INGEST_HTTP_URL` | `http://localhost:8001` | Data plane HTTP ingest |
| `MQTT_BROKER` | `localhost:1883` | Брокер (`host:port`) при `USE_MQTT=true` |
| `DEVICE_NAME` | `demo-sensor` | Имя устройства |
| `EMAIL` / `SIGNALDECK_EMAIL` | `admin@example.com` | Email demo-пользователя (не `.local` — EmailStr отклоняет) |
| `USERNAME` / `SIGNALDECK_USERNAME` | `admin` | Логин (**не** OS `USERNAME` на Windows) |
| `PASSWORD` / `SIGNALDECK_PASSWORD` | `admin123` | Пароль |
| `INTERVAL_SEC` | `2` | Интервал телеметрии |
| `USE_MQTT` | `false` | `true` — MQTT вместо HTTP |

## Поведение при старте

1. **Register** — `POST /api/v1/auth/register`. Если пользователь уже есть — игнор, переход к login.
2. **Login** — `POST /api/v1/auth/login`, JWT для control API.
3. **Device** — `GET /api/v1/devices/`; если имя найдено — reuse, иначе `POST /api/v1/devices/`.
4. Печать `device_id` и `api_key`.
5. **Announce** capabilities (HTTP или MQTT).
6. **Loop** — телеметрия с random `temperature`, `humidity`, `motion`, `relay_1`.

## Capabilities

| name | type | role | unit |
|------|------|------|------|
| `temperature` | number | sensor | °C |
| `humidity` | number | sensor | % |
| `motion` | boolean | sensor | — |
| `relay_1` | boolean | actuator | — |

## Транспорт

### HTTP (по умолчанию)

Надёжнее в Docker; не требует paho-mqtt локально.

| Действие | Метод и путь | Auth |
|----------|--------------|------|
| Announce | `POST {INGEST}/api/v1/ingest/announce` | `X-API-Key` |
| Telemetry | `POST {INGEST}/api/v1/ingest/telemetry` | `X-API-Key` |

### MQTT (`USE_MQTT=true`)

| Топик | Назначение |
|-------|------------|
| `devices/{device_id}/announce` | capabilities |
| `devices/{device_id}/telemetry` | readings |
| `devices/{device_id}/command` | команды actuator (subscribe) |

Auth: MQTT username = `device_id`, password = `api_key`.

## Demo credentials

При первом запуске создаётся:

- Email: `admin@example.com`
- Username: `admin`
- Password: `admin123`

## Остановка

`Ctrl+C` — корректное завершение цикла (и отключение MQTT при необходимости).
