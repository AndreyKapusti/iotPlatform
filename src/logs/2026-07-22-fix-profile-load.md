# 2026-07-22 — Фикс: профиль не загружается («Не удалось загрузить профиль»)

**Автор:** PO-репорт → расследование и фикс
**Этап:** post-MVP (feature loop), баг после `2026-07-22-user-profile.md`

## Симптом
`/profile` показывает алерт «Не удалось загрузить профиль» — для **admin и для остальных пользователей** (не зависит от юзера/данных).

## Расследование
- `POST /api/v1/auth/login` (admin/admin123) → `200`, токен валидный
- Прямой запрос к control (`GET http://localhost:8000/api/v1/users/me`, порт 8000, минуя web) → **`200 OK`**, корректный JSON профиля. BE, роутер, `deps.py`, миграция колонок, pydantic-сериализация — всё исправно, `docker logs signaldeck_control` не содержит ошибок 5xx.
- Тот же запрос через web (`GET http://localhost:3000/api/v1/users/me`, порт 3000) → `200 OK`, но `Content-Type: text/html` и тело — `index.html` SPA. Nginx не проксировал запрос на `control`, а отдавал fallback `try_files ... /index.html`.
- Причина: `web/nginx.conf` содержит явные `location` для `/api/v1/auth`, `/api/v1/devices`, `/api/v1/dashboards`, `/api/v1/ingest`, `/api/v1/telemetry`, `/api/v1/ws` — но **не было блока для `/api/v1/users`** (забыли добавить при внедрении фичи профиля, см. `2026-07-22-user-profile.md`).
- На FE (`web/src/api/client.ts`, функция `request()`) проверяется только `res.ok` (у SPA-фоллбэка `200`, так что проверка проходит), а затем вызывается `res.json()` на HTML-теле → `SyntaxError` при парсинге → ловится в `ProfilePage.tsx` как обычная ошибка (не `ApiError`) → текст «Не удалось загрузить профиль». Это объясняет одинаковое поведение для всех пользователей — баг не зависит от данных юзера, чисто роутинг на уровне nginx.

## Root cause
Отсутствовал `location /api/v1/users { proxy_pass http://control:8000; ... }` в `web/nginx.conf`. Backend был полностью исправен.

## Что изменено
- `web/nginx.conf`: добавлен блок `location /api/v1/users` (аналогично `/api/v1/devices`, с тем же набором `proxy_set_header`)
- Пересборка: `docker compose --profile demo up -d --build web` (в `deploy/`)

## Проверка
| Запрос | До фикса | После фикса |
|--------|----------|-------------|
| `GET :8000/api/v1/users/me` (прямой, admin) | `200 OK`, JSON | `200 OK`, JSON (не менялось) |
| `GET :3000/api/v1/users/me` (через web, admin) | `200 OK`, `text/html` (index.html) | `200 OK`, `application/json`, профиль |
| `GET :3000/api/v1/users/me` (через web, второй юзер `testuser2026`) | не проверялось до фикса | `200 OK`, `application/json`, профиль |
| `PATCH :3000/api/v1/users/me` (через web) | — | `200 OK`, обновлённые поля в JSON |

`control` не менялся — фикс только `web/nginx.conf`, FE-код (`client.ts`, `ProfilePage.tsx`) пересобран без изменений исходников (только новый образ web из-за `--build`).

## Подводные камни / на будущее
| Камень | Почему важно | Как жить дальше |
|--------|--------------|-----------------|
| Nginx location-блоки прописаны вручную по префиксу роутера | При добавлении нового роутера в `control`/`ingest` легко забыть добавить `location` в `web/nginx.conf` — ошибка «тихая» (200 + HTML вместо проксирования) | Чек-лист в QA/PR: новый router на BE → обязательно новый `location` в nginx; либо один общий `location /api/` с единым proxy_pass, если не нужна разница control/ingest |
| FE `client.ts.request()` не проверяет `Content-Type` перед `res.json()` | При похожих регрессиях (SPA-фоллбэк вместо API) ошибка теряет детали — юзер видит общий текст, а не реальную причину | Опционально: в `parseError`/`request` проверять `res.headers.get('content-type')` и кидать более информативную `ApiError`, если это не JSON |
