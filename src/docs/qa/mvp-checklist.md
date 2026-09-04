# QA checklist — MVP happy path

## Окружение
- [ ] `docker compose up --build -d` из `deploy/`
- [ ] `docker compose --profile demo up -d` (симулятор)
- [ ] UI http://localhost:3000 , control http://localhost:8000/docs

## Сценарий
1. Register + login  
2. Создать устройство / или demo-sensor от симулятора  
3. Capabilities видны после announce  
4. Dashboard: добавить line, gauge, indicator  
5. Save layout  
6. Live: точки обновляются без refresh  
7. History подгружается при открытии  

## Негатив
- [ ] Неверный пароль → 401  
- [ ] Неверный X-API-Key → 401 на ingest  
- [ ] Битый JSON → 400  

## Вердикт
- Окружение для полного прогона: требуется Docker (+ Node для `web` dev).
- Статический review кода: Ready for PM с оговоркой e2e на машине PO.
