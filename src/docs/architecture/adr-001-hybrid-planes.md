# ADR-001: Hybrid control/data planes

- **Status:** accepted
- **Date:** 2026-07-20

## Context
Нужны auth/CRUD дашбордов и высоконагруженный ingest + realtime.

## Decision
- Control plane: FastAPI (Python) — users, devices, capabilities API, dashboards.
- Data plane: Go — MQTT/HTTP ingest, Timescale write, WebSocket fan-out, history.
- Broker: Mosquitto. DB: TimescaleDB (PostgreSQL). UI: React+Vite.

## Consequences
Два сервиса и общий Postgres; контракты через REST/MQTT JSON. Проще масштабировать ingest отдельно.
