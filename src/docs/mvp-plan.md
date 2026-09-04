# План разработки до MVP — SignalDeck

Фокус: **софт-платформа** (Python control + Go ingest/realtime).  
Железо = **симулятор**. Контракт устройств закладываем сразу ([device-contract-v0.md](device-contract-v0.md)).

---

## Цель MVP

1. Регистрация / вход  
2. Создание устройства + credentials (API key / MQTT)  
3. Симулятор шлёт **capabilities + readings**  
4. Сервер распознаёт типы метрик  
5. Drag-and-drop дашборд из нескольких виджетов **для одного устройства**  
6. Данные в **real-time** (не HTTP polling UI)

**Вне MVP:** автоматизация, уведомления, multi-device dashboard, облако, настоящая прошивка, OAuth, магазин шаблонов, enterprise-админка.

---

## Принципы

- Control plane ≠ data plane  
- Симулятор — первый клиент устройства; прошивка позже по тому же контракту  
- Самохостинг через Docker Compose  
- Каждая фаза заканчивается **демо** для защиты / портфолио  
- **Документация обязательна:** подробно по смыслу, лаконично по форме; сдаётся вместе с кодом ([documentation-standard.md](documentation-standard.md))  

---

## Фаза 0 — Каркас продукта (≈1 неделя)

| Deliverable | Результат |
|-------------|-----------|
| Product brief | аудитория, цели, non-goals |
| Stack decision | FastAPI + Go + MQTT + Timescale + React |
| Device contract v0 | JSON: capabilities + readings |
| Структура репо | `control/`, `ingest/`, `web/`, `simulator/`, `deploy/` |
| Compose skeleton | postgres/timescale, mqtt, api, ingest, web + healthchecks |

**Exit:** `docker compose up` поднимает пустые сервисы с healthchecks.

---

## Фаза 1 — Control plane (≈2–3 недели)

База: наработки из `iot-platform`, с очисткой.

| Эпик | Состав |
|------|--------|
| Auth | register, login JWT, защита эндпоинтов |
| Devices | CRUD, лимиты, выдача ключей / MQTT credentials |
| Device schema | capabilities, версия схемы, upsert при announce |
| Dashboard config | layout JSON (виджеты, позиции, привязка к metric) |
| API docs | OpenAPI как контракт для фронта и Go |

Техдолг из прототипа закрыть сразу: delete/regenerate device, баги login, индексы SQL.

**Exit:** через API: юзер → устройство → схема и пустой dashboard config.

---

## Фаза 2 — Data plane + real-time (≈3–4 недели)

| Эпик | Состав |
|------|--------|
| MQTT broker | Mosquitto в Compose (`devices/{id}/announce`, `devices/{id}/telemetry`) |
| Go ingest | MQTT → валидация → Timescale → pub в realtime-канал |
| HTTP ingest | fallback для отладки и совместимости |
| Timescale | hypertables под метрики |
| History API | последние N / time range |
| Realtime gateway | WebSocket: подписка на `device_id`, push точек |
| Load smoke | N симуляторов, msg/s, p99 до WS |

**Exit:** симулятор → строка в БД → точка в WS &lt; ~200 ms на локалке.

---

## Фаза 3 — Симулятор (≈1 неделя, параллельно с фазой 2)

| Эпик | Состав |
|------|--------|
| CLI/service | announce → периодический telemetry |
| Профили | например `temp_humidity`, `relay_sensor` |
| Auth | те же credentials, что у реального устройства |
| Документация | «как писать прошивку» для будущей firmware-команды |

**Exit:** один конфиг = одно виртуальное устройство стабильно online.

---

## Фаза 4 — Frontend MVP (≈3–4 недели)

| Эпик | Состав |
|------|--------|
| Auth UI | login / register |
| Devices UI | список, создание, credentials, online/offline |
| Schema view | известные metrics (read-only) |
| Dashboard builder | DnD canvas + библиотека виджетов |
| Виджеты (минимум) | line chart, last value / gauge, boolean indicator; toggle при actuator |
| Live mode | WS → обновление виджетов |
| History | подгрузка при открытии дашборда |

Ограничение: **один device на дашборд**.

**Exit:** руками в UI от регистрации до живого графика.

---

## Фаза 5 — Упаковка MVP (≈1–2 недели)

| Эпик | Состав |
|------|--------|
| Compose prod-like | README: clone → up → UI |
| Demo seed | юзер + device + симулятор + готовый дашборд |
| Мониторинг | health, простой счётчик ingest |
| Артефакты диплома | схема архитектуры, замеры msg/s, сравнение с polling |
| Bugfix | auth, обрыв MQTT, reconnect WS, невалидный payload |

### Exit criteria (accept PO)

- [ ] Compose на чистой машине  
- [ ] Симулятор кормит одно устройство  
- [ ] Capabilities влияют на виджеты  
- [ ] DnD ≥ 3 типов визуализаций  
- [ ] Real-time без ручного refresh  
- [ ] Есть цифры нагрузки  
- [ ] Документация продукта актуальна (модули, контракты, запуск) по стандарту docs  

---

## Календарь (ориентир)

| Недели | Фокус |
|--------|--------|
| 1 | Фаза 0 |
| 2–4 | Фаза 1 (+ старт симулятора) |
| 4–7 | Фазы 2 + 3 |
| 7–10 | Фаза 4 |
| 11–12 | Фаза 5 |

~**2.5–3 месяца** в устойчивом ритме; при работе вечерами — ×1.5–2.

---

## Если режем scope

1. Ingest + schema + realtime + один живой график  
2. DnD и 3 виджета  
3. UX / online status / history range  
4. Toggle актуатора (MQTT command + реакция симулятора)  
5. Остальное → post-MVP  

---

## Post-MVP (не сейчас)

- Несколько устройств на одном дашборде  
- Блочная автоматизация  
- Прошивка ESP по контракту  
- EMQX / горизонтальный scale  
- Уведомления, роли, org  
- Облачный деплой  

---

## Sub-agents (после стабилизации docs)

| Агент | Фазы |
|-------|------|
| PM | приоритеты, контракты, accept |
| Backend Control (Python) | 1, 5 |
| Backend Data (Go) | 2, 5 |
| Frontend | 4, 5 |
| Simulator | 3 |
| DevOps / Compose | 0, 5 |
| QA | с конца фазы 2 |

Firmware-агенты — только после стабильного контракта и симулятора.
