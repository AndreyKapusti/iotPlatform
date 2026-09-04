# Backlog SignalDeck — UI-first (затычки)

**Стратегия PO (2026-07-20):** не уходить в Arduino сейчас; отдельный день на железо позже.  
Сейчас — **накидать интерфейс**, даже на stub’ах; контракты закладывать так, чтобы потом подключить симулятор/ESP.

## Принцип затычек

| Слой | Сейчас | Потом |
|------|--------|--------|
| UI | Полные экраны, состояния, демо-данные | Те же экраны |
| API | Реальный или mock в control | Без смены UX |
| Устройство | Симулятор / fake store | ESP по Device Contract |

Stub помечаем в UI мелкой подписью «демо» / «скоро», не выдаём за готовое железо.

---

## Не сейчас

- Прошивка Arduino/ESP (отдельный день)
- Реальный MQTT command end-to-end (можно UI + fake ack)
- Kubernetes, OAuth, multi-org
- Долгий список: [`roadmap-future.md`](roadmap-future.md) (email verify, 2FA, алерты, …)

---

## Профиль пользователя — v1 (2026-07-22)

Спека: [`features/user-profile.md`](features/user-profile.md)

| # | Фича | Статус |
|---|------|--------|
| P1 | Расширение `users` + GET/PATCH `/users/me` | ✅ |
| P2 | UI `/profile`: ФИО, birth, email, phone, org, job, timezone | ✅ |
| P3 | Уникальность email при смене | ✅ |

Дальше (не v1): подтверждение почты — в [`roadmap-future.md`](roadmap-future.md).

---

## Пакет UI-1 — «Живой пульт» ✅ (2026-07-20)

Цель: дашборд ощущается как пульт, не только графики.

| # | Фича | Stub | Статус |
|---|------|------|--------|
| 1 | Toggle / кнопка актуатора | Optimistic + toast demo | ✅ |
| 2 | Online / last seen на дашборде | Badge + relative time | ✅ |
| 3 | Empty states | Canvas + palette | ✅ |
| 4 | Toast / snackbar | success / info / demo | ✅ |

Чеклист: `docs/qa/ui1-checklist.md`

## Пакет UI-2 — «Мониторинг как продукт»

| # | Фича | Stub |
|---|------|------|
| 5 | Пороги на number-виджетах | Цвет gauge/line при > max / < min из capabilities или ручной порог в props |
| 6 | Лента событий | Fake + реальные announce/telemetry события в правой колонке |
| 7 | Период графика 15м / 1ч / 24ч | UI переключатель; history API limit/range (допилить BE при необходимости) |
| 8 | Дублировать дашборд | Copy layout JSON |

## Пакет UI-3 — «Онбординг и полировка»

| # | Фича | Stub |
|---|------|------|
| 9 | Home / обзор после логина | Карточки: N устройств, online, последний дашборд |
| 10 | Wizard «первое устройство» | Шаги с текстом «вставьте key в симулятор» |
| 11 | Шаблоны дашборда | «Климат», «Дискреты» — раскладка виджетов из caps |
| 12 | Настройки: язык RU/EN (stub), плотность UI | Только UI |

## Редактор (вне пакетов UI-2…4) — сделано 2026-07-20

| Фича | Статус |
|------|--------|
| Ресайз виджетов мышью (E/S/SE) | ✅ |
| Цвет виджета: semantic accents (default…slate), light/dark | ✅ |

Чеклисты: `docs/qa/widget-resize-checklist.md`, `docs/qa/widget-accent-checklist.md`

## Пакет UI-4 — «Вау для защиты»

| # | Фича | Stub | Статус |
|---|------|------|--------|
| 13 | Полноэкранный view-режим (kiosk) | F11-like, скрыть chrome | |
| 14 | Sparkline в списке устройств | Mini chart из latest | |
| 15 | Тёмная тема на дашборде — пресеты акцента | Theme + per-widget accents | ✅ частично (accents) |
| 16 | Экспорт скрина/PDF дашборда | html2canvas stub | |

---

## Порядок накидывания (PM)

1. **UI-1** — сразу заметно в демо  
2. **UI-2** — «умный» мониторинг без железа  
3. **UI-3** — первый заход новичка  
4. День железа (симулятор command + ESP)  
5. **UI-4** по остатку времени до защиты  

---

## Связь с железом позже

Любой stub команды/статуса должен иметь стабильный контракт:

- UI → `POST .../command` или MQTT `devices/{id}/command`
- payload: `{ "relay_1": true }` / capabilities name  
- симулятор/ESP отвечают telemetry  

Пока BE/SIM не готовы — UI держит optimistic state + пометка «демо».
