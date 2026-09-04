# 2026-07-20 — MVP bootstrap и ожидание Docker

**Автор:** PM  
**Фаза:** 0–5 (код MVP), e2e — pending Docker

---

## Сделано

### Продукт / процесс
- Финальный репозиторий `signaldeck/` с governance, PM-мандатом, командой sub-agents, стандартом docs.
- Добавлен агент Product Designer; UI guidelines (светлая industrial-тема).
- Папка `logs/` для журнала работ (этот файл).

### Код MVP
| Модуль | Содержание |
|--------|------------|
| `control/` | FastAPI: register/login JWT, devices CRUD, capabilities, dashboards layout |
| `ingest/` | Go: HTTP+MQTT announce/telemetry, Timescale write, WS fan-out, history/latest |
| `web/` | React+Vite: login, devices, schema, DnD dashboard (line/gauge/indicator/toggle), live WS |
| `simulator/` | demo-sensor: register→login→device→announce→telemetry loop |
| `deploy/` | Compose: TimescaleDB, Mosquitto, control, ingest, web; profile `demo` для симулятора |

### Проверки на машине разработки
- `go build ./cmd/server` (ingest) — OK  
- `npm run build` (web) — OK после фикса  
- Docker Compose e2e — **не запущен** (Docker Desktop ещё не установлен)

### Коррективы PM по ходу
1. `useTelemetry.ts` → `useTelemetry.tsx` (иначе `tsc` падает на JSX).  
2. Симулятор: не использовать env `USERNAME` (на Windows это имя ОС-аккаунта) → `SIGNALDECK_USERNAME`.  
3. History без capabilities: fallback по таблицам метрик, пустой массив вместо жёсткой 404.  
4. Убран хрупкий healthcheck Mosquitto из Compose.  
5. В demo-профиль явно прописаны credentials симулятора.

---

## План дальше

1. **После установки Docker Desktop (PO):**  
   - `cd signaldeck/deploy`  
   - `docker compose up --build -d`  
   - `docker compose --profile demo up -d`  
   - Прогнать `docs/qa/mvp-checklist.md`  
   - Зафиксировать результат в новом логе `2026-07-XX-docker-e2e.md`
2. Починить всё, что всплывёт на живом стенде (миграции, сеть, proxy nginx, WS).  
3. Добить polish: команда актуатора (toggle → MQTT command), короткие замеры msg/s для диплома.  
4. Продуктовый accept MVP от PO.

---

## Подводные камни

| Камень | Почему важно | Как жить дальше |
|--------|--------------|-----------------|
| **Нет Docker = нет полного демо** | Compose — основной путь самохостинга; без него UI/API/БД вместе не поднять на этой машине | Сначала Docker Desktop + WSL2/Hyper-V по инструкции Docker; потом только e2e |
| **Env `USERNAME` в симуляторе** | Windows подставляет локального пользователя → «логин» ломается молча | Только `SIGNALDECK_USERNAME` / `SIGNALDECK_PASSWORD` / `SIGNALDECK_EMAIL` |
| **JSX в файле `.ts`** | Vite/tsc не компилирует JSX вне `.tsx` | Хуки/компоненты с JSX — всегда `.tsx` |
| **Timescale hypertables + init SQL** | `create_hypertable` в `docker-entrypoint-initdb.d` выполняется один раз при пустом volume; смена SQL на уже созданном volume **не применится** | При смене схемы: `docker compose down -v` (данные сотрутся) или отдельные миграции |
| **Capabilities до history** | Раньше history требовал строку в `device_capabilities` → 404 до announce | Сделан fallback; всё равно сначала announce, потом UI |
| **nginx proxy путей** | Control и ingest на разных сервисах; WS нужен `Upgrade` | Не объединять все `/api/v1` в один upstream; держать отдельные location как в `web/nginx.conf` |
| **Токен JWT в localStorage** | XSS-риск; для MVP ок, для продакшена слабо | Post-MVP: httpOnly cookie / refresh; не светить секреты в git |
| **MQTT anonymous** | Mosquitto MVP: `allow_anonymous true` | Только локальный стенд; перед внешним доступом — ACL + credentials устройств |
| **Два источника правды API** | Control `:8000`, ingest `:8001`; через UI — один origin `:3000` | Локальная разработка без nginx: Vite proxy в `web/vite.config.ts`; не мешать порты |
| **Профиль Compose `demo`** | Симулятор не стартует без `--profile demo` | Для полного happy path всегда добавлять profile |
| **Go path на Windows** | `go` может быть не в PATH сессии Cursor | Вызывать `"C:\Program Files\Go\bin\go.exe"` или обновить PATH |
| **Секреты в Compose** | Dev-пароли БД/JWT захардкожены | Только dev; перед шарингом стенда сменить и вынести в `.env` (не коммитить) |
| **Toggle без команды на устройство** | UI-переключатель пока не шлёт MQTT command | Не демонстрировать как «управление реле» до доработки; честно сказать «UI stub» |
| **Volume Postgres после failed init** | Если init SQL упал наполовину, контейнер может «жить» со сломанной схемой | `down -v`, смотреть логи `signaldeck_postgres`, править SQL, поднимать снова |
| **Node установлен mid-session** | PATH старых терминалов без `node` | Новый shell или refresh PATH Machine+User |

---

## Решения / допущения

- Дизайн полностью на команде (PO делегировал).  
- HTTP ingest — основной путь симулятора в demo; MQTT поддержан, но не обязателен для MVP-демо.  
- Один device на dashboard в MVP.  
- Продуктовый accept MVP — только после успешного e2e у PO (или явного waive).

---

## Блокеры

- [ ] Docker Desktop у PO (в процессе установки)  
- [ ] E2E checklist на живом Compose  

---

## Следующая запись лога

После первого `docker compose up`: `logs/2026-07-XX-docker-e2e.md` (факт старта, ошибки, фиксы, вердикт).
