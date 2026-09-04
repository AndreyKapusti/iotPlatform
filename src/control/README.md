# Control API

## Назначение
Control plane SignalDeck: регистрация пользователей, JWT-auth, CRUD устройств, capabilities и конфигурация дашбордов (layout JSON).

## Границы
| Входит | Не входит |
|--------|-----------|
| Auth, devices, capabilities, dashboards | Телеметрия, MQTT, WebSocket (ingest) |
| OpenAPI `/docs` | OAuth, RBAC, multi-tenant |

Схема БД: [`deploy/postgres/init/01-init.sql`](../deploy/postgres/init/01-init.sql).

## Запуск

### Compose (рекомендуется)
```bash
cd ../deploy
docker compose up --build -d control
```
Swagger: http://localhost:8000/docs

### Локально
```bash
pip install -r requirements.txt
set JWT_SECRET=signaldeck-dev-secret-change-me
uvicorn app.main:app --reload --port 8000
```
Требуется PostgreSQL из Compose (`5432`).

## Конфигурация

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | `postgresql://signaldeck:signaldeck@localhost:5432/signaldeck` | PostgreSQL |
| `JWT_SECRET` | — (обязательна) | Секрет подписи JWT |
| `JWT_EXPIRE_MINUTES` | `1440` | TTL токена |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost` | Origins через запятую |

## Контракты

Базовый префикс: `/api/v1`.

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/register` | Регистрация |
| POST | `/auth/login` | Login (OAuth2 form: username + password) |
| POST | `/devices/` | Создать устройство (макс. 10 на пользователя) |
| GET | `/devices/` | Список устройств |
| GET | `/devices/{id}` | Одно устройство |
| DELETE | `/devices/{id}` | Удалить (по `devices.id`) |
| POST | `/devices/{id}/regenerate-key` | Новый `api_key` |
| GET/PUT | `/devices/{id}/capabilities` | Чтение / замена schema |
| GET/PUT | `/dashboards/device/{id}` | Получить или создать / обновить layout |
| GET | `/health` | Healthcheck |

Пример регистрации и создания устройства:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","username":"demo","password":"secret12"}'

curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=demo&password=secret12"

curl -X POST http://localhost:8000/api/v1/devices/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"sensor-1"}'
```

Полная спецификация: OpenAPI на `/docs`.

## Разработка
```bash
pip install -r requirements.txt
JWT_SECRET=dev uvicorn app.main:app --reload
```

## Известные ограничения
- Один dashboard на пару user+device.
- Не более 10 устройств на пользователя.
- Capabilities заменяются целиком (PUT), без частичного patch.
