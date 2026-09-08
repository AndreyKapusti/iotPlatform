# SignalDeck

IoT-платформа: телеметрия → capabilities → real-time DnD-дашборды.

Актуальный код и документация: [`src/`](src/).

## Быстрый старт

Одна команда (backend + симулятор + Vite с hot-reload):

```bash
make dev
```

Только Docker (UI на :3000, без hot-reload):

```bash
make start
```

Остановка: `make stop`

| URL | Что |
|-----|-----|
| http://localhost:5173 | UI (dev, `make dev`) |
| http://localhost:3000 | UI (Docker, `make start`) |
| http://localhost:8000/docs | Control API |
| http://localhost:8001/health | Ingest |

Демо-логин: `admin` / `admin123`

Подробности: [`src/README.md`](src/README.md).
