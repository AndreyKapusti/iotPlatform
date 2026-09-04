# Профиль пользователя — v1

**Статус:** принят PO (2026-07-22)  
**Владелец исполнения:** PM → BE + FE + QA

## Цель

Пользователь видит и редактирует свои данные: ФИО, дату рождения, почту и доп. поля. Данные хранятся в Postgres.

## Модель данных (`users`)

Расширяем таблицу `users` (не отдельная `user_profiles` в v1 — проще для MVP):

| Колонка | Тип | Обязательность | Примечание |
|---------|-----|----------------|------------|
| `email` | VARCHAR UNIQUE | да | уже есть; PATCH с проверкой уникальности |
| `username` | VARCHAR UNIQUE | да | **read-only** в UI v1 (JWT `sub`) |
| `hashed_password` | VARCHAR | да | не в профиле |
| `last_name` | VARCHAR(100) | нет | фамилия |
| `first_name` | VARCHAR(100) | нет | имя |
| `middle_name` | VARCHAR(100) | нет | отчество |
| `birth_date` | DATE | нет | не в будущем |
| `phone` | VARCHAR(32) | нет | |
| `organization` | VARCHAR(200) | нет | компания / кафедра |
| `job_title` | VARCHAR(120) | нет | должность / роль |
| `timezone` | VARCHAR(64) | нет | IANA, напр. `Europe/Moscow` |

Существующие инсталлы: миграция `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` при старте control (init.sql только для чистого volume).

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/users/me` | Текущий профиль |
| PATCH | `/api/v1/users/me` | Частичное обновление |

- Auth: Bearer JWT  
- Смена email: 409 если занят другим пользователем  
- `username` в PATCH игнорировать или 400  

## UI

- Раздел **Профиль** в сайдбаре (рядом с Настройками), маршрут `/profile`
- Форма: ФИО (3 поля), дата рождения, email, телефон, организация, должность, часовой пояс
- Логин — только показ (disabled)
- Сохранить → toast success / error
- Аватар в v1: инициалы из имени/фамилии (без upload)

## Вне scope v1

См. [`roadmap-future.md`](roadmap-future.md): подтверждение email, смена username, аватар-файл, 2FA.
