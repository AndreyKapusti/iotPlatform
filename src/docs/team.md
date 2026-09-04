# Команда sub-agents — SignalDeck

**Статус:** рабочий состав v1  
**Утверждает состав:** Product Manager (в рамках воли PO)  
**Финальная приёмка работ:** Product Manager — см. [`product-manager.md`](product-manager.md) (**обязан делегировать** исполнение sub-agents)  
**Верховный accept продукта/MVP:** Product Owner (см. [governance.md](governance.md))

Мандаты агентов: [`../agents/`](../agents/).

---

## 1. Принцип команды

Небольшая кросс-функциональная команда под MVP: без «армии», но с полным контуром  
**анализ → архитектура → разработка → документация → тест → приёмка PM**.

Документация обязательна на каждом шаге: [`documentation-standard.md`](documentation-standard.md).

```text
Product Owner
     │  vision / veto / финальный смысл продукта
     ▼
Product Manager          ← финальная приёмка исполнения, ответственность за результат команды
     │
     ▼
Tech Lead                ← рулит всеми sub-agents день-за-днём
     │
     ├── Architect & Systems Analyst
     ├── Backend Control Developer      (Python / FastAPI)
     ├── Backend Data Developer         (Go / ingest / realtime)
     ├── Frontend Developer             (React / DnD / WS)
     ├── Simulator Developer            (device stub / contract client)
     ├── Platform Engineer              (Compose / obs / demo seed)
     └── QA Engineer
```

**Почему так:** Tech Lead снимает с PM микроменеджмент задач; Architect держит целостность; три dev-линии отражают control / data / UI; Simulator обязателен без железа; Platform нужен для самохостинга; QA закрывает регрессии до приёмки PM.

---

## 2. Состав (оптимальный)

| ID | Роль | Кол-во | Главная зона |
|----|------|--------|--------------|
| `TL` | Tech Lead | 1 | План спринта/фазы, раздача задач, тех. ревью, интеграция, эскалация к PM |
| `ARCH` | Architect & Systems Analyst | 1 | Системный анализ, архитектура, контракты, ADR, границы сервисов |
| `BE-CTRL` | Backend Control Developer | 1 | FastAPI: auth, devices, schemas, dashboard config |
| `BE-DATA` | Backend Data Developer | 1 | Go: MQTT ingest, Timescale, WebSocket realtime |
| `FE` | Frontend Developer | 1 | React: auth, devices, DnD dashboards, live |
| `SIM` | Simulator Developer | 1 | Симулятор устройств по Device Contract |
| `PLAT` | Platform Engineer | 1 | Docker Compose, health, seed, локальный demo path |
| `DESIGN` | Product Designer | 1 | UI guidelines, UX простоты «лучше Blynk» |
| `QA` | QA Engineer | 1 | Тест-план, API/E2E/контрактные/load smoke, отчёты TL/PM |

**Итого: 9 sub-agents + PM + PO.**

Не вводим сейчас: firmware/ESP, mobile, data science, отдельный UX-research — вне MVP или позже по решению PO/PM.

---

## 3. Цепочка ответственности

| Уровень | Кто | За что отвечает |
|---------|-----|-----------------|
| Смысл продукта | PO | Vision, MVP boundaries, final product accept |
| Результат разработки | **PM** | Финальная приёмка работ команды; вся ответственность за то, что предъявляется PO |
| Техническое исполнение | **Tech Lead** | Что делают агенты, качество интеграции, готовность к сдаче PM |
| Проектные решения | Architect | «Как устроено» в рамках утверждённого стека |
| Код/тесты/инфра | Dev / QA / Platform | Свои зоны по мандату |

### Правило приёмки

1. Агент сдаёт работу **Tech Lead**.  
2. Tech Lead проводит тех. приёмку (сборка, контракты, ревью).  
3. Tech Lead подаёт пакет **Product Manager**.  
4. **PM принимает или возвращает** — это финальная приёмка исполнения.  
5. Демо фаз / MVP показывает PM → **PO** утверждает продуктовый смысл.

Tech Lead **не** имеет права объявить MVP принятым.  
PM **не** снимает с себя ответственность ссылкой на ошибку агента: команда — зона PM.

---

## 4. Кому кто подчиняется

| Агент | Прямой руководитель | С кем согласует обязательно |
|-------|---------------------|-----------------------------|
| Tech Lead | PM | PM (scope), Architect (ломка архитектуры) |
| Architect | Tech Lead | PM (продуктовые контракты), PO через PM при смене стека |
| BE-CTRL / BE-DATA / FE / SIM / PLAT / QA | Tech Lead | Architect по контрактам и границам |

Иерархия инструкций: **PO > PM > Tech Lead > мандат агента > локальная инициатива**.

---

## 5. Когда кого звать (по фазам MVP)

| Фаза | Активное ядро |
|------|----------------|
| 0 Каркас | TL, ARCH, PLAT |
| 1 Control | TL, ARCH, BE-CTRL, QA |
| 2 Data + realtime | TL, ARCH, BE-DATA, PLAT, QA |
| 3 Simulator | TL, SIM, BE-DATA, QA |
| 4 Frontend | TL, FE, ARCH (UX-поток), BE-CTRL, QA |
| 5 Упаковка | все; лидируют TL + PLAT + QA → приёмка PM |

---

## 6. Каналы эскалации

| Ситуация | Куда |
|----------|------|
| Спор двух разработчиков | Tech Lead |
| Ломается архитектура / контракт | Architect → Tech Lead → при необходимости PM |
| Scope creep / «давайте ещё фичу» | Tech Lead → **PM** (не решать молча) |
| Смена стека, MVP, non-goals | **PM → PO** |
| Блокер > 1 рабочего дня | Tech Lead обязан эскалировать PM |

---

## 7. Anti-bloat

Не плодим агентов «на всякий случай». Новая роль — только если:

- есть устойчивый объём работ ≥ фазы, и  
- текущие агенты систематически перегружены или конфликтуют зонами, и  
- PM утвердил расширение (PO может veto).

Кандидаты «позже»: Firmware Engineer, UX Writer, Security Reviewer.

---

## 8. История

| Версия | Дата | Изменение |
|--------|------|-----------|
| 1.0 | 2026-07-20 | Стартовый состав из 8 sub-agents |
