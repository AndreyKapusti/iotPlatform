COMPOSE_DIR := src/deploy
COMPOSE := docker compose -f $(COMPOSE_DIR)/docker-compose.yml --project-directory $(COMPOSE_DIR)
WEB_DIR := src/web

.PHONY: help start dev stop restart logs ps install build-web

help: ## Показать команды
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Установить npm-зависимости фронтенда
	cd $(WEB_DIR) && npm install

start: ## Запустить backend + demo-симулятор (Docker)
	$(COMPOSE) up --build -d
	$(COMPOSE) --profile demo up -d
	@echo ""
	@echo "SignalDeck запущен:"
	@echo "  UI (Docker):  http://localhost:3000"
	@echo "  API:          http://localhost:8000/docs"
	@echo "  Ingest:       http://localhost:8001/health"
	@echo "  Логин:        admin / admin123"
	@echo ""
	@echo "Для hot-reload фронтенда: make dev"

dev: start ## Backend в Docker + Vite dev-сервер (http://localhost:5173)
	@command -v npm >/dev/null || (echo "npm не найден — установите Node.js" && exit 1)
	cd $(WEB_DIR) && (test -d node_modules || npm install) && npm run dev

stop: ## Остановить все контейнеры
	$(COMPOSE) --profile demo down

restart: stop start ## Перезапустить backend + симулятор

logs: ## Логи всех сервисов
	$(COMPOSE) --profile demo logs -f

ps: ## Статус контейнеров
	$(COMPOSE) --profile demo ps

build-web: ## Пересобрать Docker-образ UI
	$(COMPOSE) build web
	$(COMPOSE) up -d web
