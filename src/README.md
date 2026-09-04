# SignalDeck

IoT-платформа: телеметрия → capabilities → real-time DnD-дашборды.  
Ориентир UX — проще Blynk. Самохостинг first.

## Быстрый старт

Нужен **Docker Desktop** (Compose v2).

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

Демо-логин (создаёт симулятор): `admin` / `admin123` (email `admin@example.com`)

Happy path: Devices → `demo-sensor` → Dashboard → добавить виджеты из палитры → Save → Live.

## Структура

```text
src/
  control/     # FastAPI — auth, devices, schemas, dashboards
  ingest/      # Go — MQTT/HTTP ingest, Timescale, WebSocket
  web/         # React — DnD dashboard + live
  simulator/   # искусственное устройство
  deploy/      # Docker Compose
  docs/        # продукт, архитектура, QA
  agents/      # мандаты команды (в .gitignore, локально)
```

## Документация

| Документ | Содержание |
|----------|------------|
| [Documentation standard](docs/documentation-standard.md) | Обязательные docs |
| [Governance](docs/governance.md) | Роли, PO, команда |
| [Product Manager](docs/product-manager.md) | Мандат PM |
| [Team](docs/team.md) | Sub-agents |
| [MVP plan](docs/mvp-plan.md) | Фазы |
| [Backlog UI-first](docs/backlog.md) | Что накидывать в интерфейс на stub’ах |
| [Roadmap future](docs/roadmap-future.md) | Планы на будущее (email verify, 2FA, …) |
| [User profile](docs/features/user-profile.md) | Профиль пользователя v1 |
| [Stack](docs/stack-decision.md) | Стек |
| [Device contract](docs/device-contract-v0.md) | Протокол устройств |
| [UI guidelines](docs/design/ui-guidelines.md) | Дизайн |
| [QA checklist](docs/qa/mvp-checklist.md) | Приёмка |
| [PM status](docs/changelog/mvp-status-2026-07-20.md) | Статус исполнения MVP |
| [**Logs**](logs/README.md) | Журнал: сделано / план / подводные камни |

## Статус разработки

Код MVP собран (control + ingest + web + simulator + compose). E2e Compose пройден.  
UI-first поверх MVP: тема, multi-dashboard, UI-1, ресайз и цвет виджетов.  
Итог дня 2026-07-20: [`logs/2026-07-20-day-wrap.md`](logs/2026-07-20-day-wrap.md).  
Стенд поднимать из `deploy/` (`--profile demo` для симулятора).

## Роли

PO — ты.  
PM — обязан **делегировать** задачи sub-agents, принимать исполнение, отвечать за результат.  
Tech Lead + агенты — реализация. Дизайн: `DESIGN` + FE.

Подробно: [`docs/product-manager.md`](docs/product-manager.md) §3.3, [`docs/governance.md`](docs/governance.md) §3.1.
