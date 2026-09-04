# Device Contract v0 — SignalDeck

Контракт между **устройством** (на MVP — симулятор) и платформой.  
Реальная прошивка Arduino/ESP позже реализует тот же протокол.

## Идея

Устройство описывает датчики/актуаторы через **capabilities** (properties).  
Сервер сохраняет схему, определяет типы и предлагает виджеты/действия.  
Телеметрия приходит отдельно как **readings** по именам из схемы.

## Транспорт (MVP)

| Канал | Назначение |
|-------|------------|
| MQTT `devices/{device_id}/announce` | Публикация / обновление capabilities |
| MQTT `devices/{device_id}/telemetry` | Периодические readings |
| MQTT `devices/{device_id}/command` | Команды актуаторам (опционально в MVP) |
| HTTP `POST /api/v1/receive_data/` | Fallback ingest (отладка) |
| Auth | `X-API-Key` и/или MQTT username/password, выданные control API |

Точные имена топиков можно уточнить в фазе 2; смысл сохраняем.

## Announce (capabilities)

```json
{
  "device_id": 42,
  "schema_version": 1,
  "firmware": "simulator-0.1.0",
  "capabilities": [
    {
      "name": "temperature",
      "type": "number",
      "unit": "°C",
      "role": "sensor",
      "min": -40,
      "max": 85
    },
    {
      "name": "humidity",
      "type": "number",
      "unit": "%",
      "role": "sensor",
      "min": 0,
      "max": 100
    },
    {
      "name": "motion",
      "type": "boolean",
      "role": "sensor"
    },
    {
      "name": "relay_1",
      "type": "boolean",
      "role": "actuator"
    }
  ]
}
```

### Поля capability

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `name` | да | Стабильный id метрики (snake_case) |
| `type` | да | `number` \| `boolean` \| `string` |
| `role` | да | `sensor` \| `actuator` |
| `unit` | нет | Единица для UI |
| `min` / `max` | нет | Диапазон / шкала виджета |
| `enum` | нет | Для `string` с фиксированным набором |

## Telemetry (readings)

```json
{
  "device_id": 42,
  "timestamp": "2026-07-20T17:00:00Z",
  "readings": {
    "temperature": 23.4,
    "humidity": 61.0,
    "motion": false,
    "relay_1": false
  },
  "metadata": {
    "battery": 92,
    "rssi": -58
  }
}
```

- Ключи в `readings` должны соответствовать `capabilities[].name`.  
- Неизвестные ключи: логировать / класть в raw (политика фазы 2); UI их не предлагает, пока нет в схеме.  
- `timestamp` опционален; иначе время сервера.

## Маппинг на виджеты (MVP)

| type + role | Виджеты по умолчанию |
|-------------|----------------------|
| `number` + sensor | line chart, last value / gauge |
| `boolean` + sensor | indicator |
| `boolean` + actuator | toggle |
| `string` + sensor | text / last value |

## Поведение сервера

1. При announce — upsert схемы устройства (`schema_version`, список capabilities).  
2. При telemetry — запись в time-series; realtime push подписчикам WS.  
3. Control API отдаёт схему фронту для библиотеки виджетов DnD.  
4. Команды actuator (если включим в MVP) — publish в `command`; симулятор меняет state и отражает в следующем readings.

## Симулятор

- Профили (примеры): `temp_humidity`, `relay_sensor`.  
- Сначала announce, затем telemetry с интервалом.  
- Те же credentials, что выдаёт платформа при создании устройства.

## Вне v0

- Автообнаружение железа без announce  
- Бинарные кодеки, сжатие  
- Вложенные/сложные типы (массивы, матрицы)  
- OTA firmware  

## История

| Версия | Дата | Изменение |
|--------|------|-----------|
| v0 | 2026-07-20 | Первый черновик для SignalDeck MVP |
