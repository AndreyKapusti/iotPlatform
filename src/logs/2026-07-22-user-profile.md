# 2026-07-22 — Профиль пользователя v1

**Автор:** PM → BE + FE + QA  
**Этап:** post-MVP (feature loop)

## Сделано
- Спека: `docs/features/user-profile.md`
- **BE:** колонки профиля в `users`, GET/PATCH `/api/v1/users/me`, уникальность email (409), `username` read-only в PATCH
- **FE:** страница `/profile` (ФИО, дата рождения, email, телефон, организация, должность, timezone), логин disabled, toast save/error
- **Deploy:** `docker compose --profile demo up -d --build control web`; smoke `GET /health` → 200
- **Backlog:** P1–P3 профиля отмечены ✅

## План дальше
- Подтверждение email, смена username, аватар — не v1; см. [`docs/roadmap-future.md`](../docs/roadmap-future.md)

## Типичные риски
| Решение | Почему важно | Как жить дальше |
|--------|--------------|-----------------|
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` при старте control | Старый Postgres volume без новых колонок | Не полагаться только на `init.sql`; при смене схемы — перезапуск control |
| Email без verify в v1 | Можно сменить email без подтверждения | Verify → roadmap-future |
| IANA timezone строкой | Нет валидации TZ на BE v1 | При необходимости — whitelist или API списка TZ |

## Решения / договорённости
- Одна таблица `users`, без отдельной `user_profiles` в v1
- JWT `sub` = username; UI не редактирует логин

## Подводные камни
- **Существующий Docker volume Postgres:** `init.sql` не перезапускается; миграция только через `database.py` на startup control — если control не поднялся после деплоя, колонок не будет
- **409 на email:** второй пользователь с тем же email — ожидаемое поведение, показать ошибку в UI

## Как проверить (PO)
1. http://localhost:3000 → логин `admin` / `admin123`
2. Профиль в сайдбаре или `/profile` → изменить поля → «Сохранить» → success toast
3. Перезагрузить страницу — данные сохранены
4. (Опционально) PATCH с чужим email вторым пользователем → 409