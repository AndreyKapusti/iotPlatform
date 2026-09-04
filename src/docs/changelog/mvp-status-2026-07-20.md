# PM status — MVP build

**Дата:** 2026-07-20 (закрытие дня)  
**Вердикт исполнения MVP:** **Accepted** (e2e Compose)  
**Продуктовый accept:** PO смотрел UI в течение дня; стенд на ночь **остановлен**

## Runtime (конец дня)

Контейнеры остановлены:

```bash
cd signaldeck/deploy
docker compose --profile demo down
```

Поднять снова:

```bash
docker compose --profile demo up --build -d
```

Подробный итог: `logs/2026-07-20-day-wrap.md`

## Demo (когда стенд up)

- UI: http://localhost:3000  
- Login: `admin` / `admin123`  
- Device: `demo-sensor`

## Сделано поверх MVP (UI)

- Theme light/dark, sidebar, multi-dashboard view/edit, responsive  
- UI-1 (toast, toggle demo, online, empty)  
- Widget resize + per-widget accent colors  

## Remaining polish (не блокирует MVP demo)

- [ ] Toggle → MQTT command  
- [ ] Load smoke цифры для диплома  
- [ ] Секреты в `.env`  
- [ ] UI-2 пакет (пороги, лента, период графика, duplicate)
