# Stack Decision — SignalDeck

**Статус:** принято  
**Вариант:** A — hybrid (Python control + Go data plane)

## Решение

| Слой | Технология | Роль |
|------|------------|------|
| Control API | Python, FastAPI | Auth, users, devices, schemas, dashboard config |
| Ingest + realtime | Go | MQTT consumer, запись метрик, WebSocket fan-out |
| Broker | Mosquitto (MVP) → EMQX при необходимости | Транспорт устройств |
| Буфер / pub-sub | Redis Streams или NATS JetStream (уточнить в фазе 2) | Пики, fan-out |
| Метаданные | PostgreSQL | Users, devices, schemas, layouts |
| Телеметрия | TimescaleDB (PostgreSQL) | Time-series метрик |
| Frontend | React + TypeScript + DnD | Auth, devices, dashboard builder |
| Устройство (MVP) | Simulator (Python/Go CLI) | Искусственные capabilities + readings |
| Infra | Docker Compose | Самохостинг first |

HTTP ingest сохраняем как fallback и для отладки (наследие `iot-platform`).

## Почему не «всё на Go»

- Ускоряем MVP: переносим control-наработки из `iot-platform`.
- Go там, где нагрузка и длинные соединения (ingest, WS).
- Для диплома/портфолио важнее разделение plane’ов, чем один язык.

## Почему не «всё на FastAPI»

- Плотный MQTT/WS fan-in и горизонтальный scale ingest удобнее в Go.
- Не смешиваем настройки и телеметрию в одном процессе.

## Целевые цифры нагрузки (ориентир)

| Метрика | Пилот | Стресс в отчёте |
|---------|-------|-----------------|
| Устройства online | 100–1k | ~10k MQTT |
| Сообщения | 100–1k msg/s | 10k+ msg/s |
| UI latency | &lt; 200 ms publish → точка | — |
| Хранение | 30–90 дней raw + rollup | — |

## Non-goals стека на MVP

- Kubernetes, Kafka-кластер  
- Облачные managed-сервисы как обязательная зависимость  
- Микросервисы «по одной функции» без необходимости  

## Открытые решения (фаза 2)

1. Redis Streams vs NATS JetStream  
2. History API: FastAPI или Go  
3. Формат MQTT payload: JSON only (v0) vs бинарный позже  

## Связанные документы

- [Product brief](product-brief.md)  
- [MVP plan](mvp-plan.md)  
- [Device contract v0](device-contract-v0.md)  
