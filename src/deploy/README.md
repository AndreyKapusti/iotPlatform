# Deploy / Compose

## Назначение
Локальный самохостинг SignalDeck MVP.

## Запуск
```bash
cd deploy
docker compose up --build -d
```

UI: http://localhost:3000  
Control API: http://localhost:8000/docs  
Ingest/WS: http://localhost:8001  

С симулятором:
```bash
docker compose --profile demo up --build -d
```

## Порты
| Сервис | Порт |
|--------|------|
| web | 3000 |
| control | 8000 |
| ingest | 8001 |
| postgres | 5432 |
| mosquitto | 1883 |

## Брокер

Mosquitto использует отдельные учётные данные для каждого устройства и ограничивает доступ его собственными топиками. До запуска создайте src/deploy/.env с секретами: см. [настройку MQTT](../docs/features/mqtt-device-transport.md).

Чтение history и WebSocket на ingest требует тот же `JWT_SECRET`, что и control.

## Остановка
```bash
docker compose --profile demo down
```
