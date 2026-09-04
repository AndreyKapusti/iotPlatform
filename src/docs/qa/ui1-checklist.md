# QA checklist — UI-1 «Живой пульт»

## Окружение
- [ ] `docker compose --profile demo up -d` из `deploy/`
- [ ] UI http://localhost:3000 · login `admin` / `admin123` · device `demo-sensor`

## Toast при сохранении
- [ ] Редактирование дашборда → «Сохранить» → toast **success** «Дашборд сохранён»
- [ ] Toast справа снизу, ~4 с, исчезает без клика
- [ ] После reload layout и имя совпадают с сохранёнными
- [ ] Ошибка save → toast/alert error, layout не «потерян»

## Toggle + demo toast + local state
- [ ] Виджет toggle на boolean actuator добавляется из палитры
- [ ] Клик переключает switch сразу (optimistic / local state)
- [ ] Toast **demo** «Демо: команда не отправлена на устройство», ~6 с
- [ ] Chip «демо» на виджете (warning), switch не disabled
- [ ] Повторный клик меняет состояние локально; telemetry sensor не ломает toggle

## Online / last seen на дашборде
- [ ] Полоска под toolbar: badge Online/Offline по `last_seen_at`
- [ ] Относительное время («N сек назад», «только что») обновляется без refresh
- [ ] Симулятор online → Online; остановка >5 мин → Offline + muted/warning текст
- [ ] Не путать с badge Live/WebSocket в toolbar

## Empty states — дашборд
- [ ] Edit, 0 виджетов: «Дашборд пуст» + CTA «Добавить виджет» / фокус на палитру
- [ ] View, 0 виджетов: «Нет виджетов» (без лишнего CTA или «Настроить»)
- [ ] Во время loading — skeleton, не empty state
- [ ] Devices 0 шт.: empty state + CTA «Создать устройство» (регрессия MVP)

## Empty capabilities
- [ ] Edit, capabilities пусты: текст «Нет capabilities…» в sidebar палитры
- [ ] Палитра без кнопок виджетов; canvas не падает
- [ ] После announce палитра заполняется без reload страницы (или после refresh — ок)

## Тёмная тема
- [ ] Настройки → dark → дашборд, toolbar, status strip, toast, toggle, empty states читаемы
- [ ] Badge online/offline, chip «демо», accent виджетов — контраст ок
- [ ] Переключение light ↔ dark без артеfactов; тема сохраняется после reload

## Вердикт — Ready for PM
- [ ] Все пункты выше пройдены на demo-стенде
- [ ] Нет блокеров: crash, потеря layout, мёртвый toggle, нечитаемый UI в dark
- [ ] Stub команды документирован (demo toast + chip) — PM понимает ограничение
- [ ] **Ready for PM** — если 3 пункта выше да; иначе **Needs fix** + список дефектов
