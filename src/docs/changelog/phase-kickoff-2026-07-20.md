# Phase 0–5 Kickoff — исполнение MVP

**Дата:** 2026-07-20  
**Статус:** in progress  
**PM:** запуск полной разработки до MVP

## Решения PO (зафиксировано)

- Цель: функционал ≥ MVP.
- Дизайн: полностью на команде; добавлен агент `DESIGN`.
- Железо: симулятор.
- Стек: FastAPI + Go + MQTT + Timescale + React (утверждён ранее).

## Assumptions (needs PO confirm только если возражает)

- UI: светлая industrial-тема (slate + teal), desktop-first.
- History API отдаёт Go ingest на `/api/v1/telemetry/...`, control остаётся на `/api/v1/...`.
- Один Compose-профиль `mvp` поднимает всё для демо.

## Порядок исполнения

1. Каркас репо + Compose + SQL  
2. Control API  
3. Ingest (Go) + Mosquitto + WS  
4. Simulator  
5. Web (DnD + live)  
6. Интеграция, README, smoke  

## Accept

См. exit criteria в `mvp-plan.md`. Финальная приёмка исполнения — PM; продуктовый accept — PO.
