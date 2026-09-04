# SignalDeck

IoT-платформа: телеметрия → capabilities → real-time DnD-дашборды.

Актуальный код и документация: [`src/`](src/).

## Быстрый старт

```bash
cd src/deploy
docker compose up --build -d
docker compose --profile demo up -d   # симулятор demo-sensor
```

| URL | Что |
|-----|-----|
| http://localhost:3000 | UI |
| http://localhost:8000/docs | Control API |
| http://localhost:8001/health | Ingest |

Демо-логин: `admin` / `admin123`

Подробности: [`src/README.md`](src/README.md).
