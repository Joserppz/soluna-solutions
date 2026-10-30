# Atajos del proyecto ASPAR. Requiere Docker Desktop (o Docker Engine) y GNU make.
# En Windows sin make, cada objetivo muestra el comando "docker compose" equivalente.
# Uso: make <objetivo>   (make help muestra la lista)

COMPOSE := docker compose
API := $(COMPOSE) exec api
WEB := $(COMPOSE) exec web

.PHONY: help up down reset-db logs ps migrate migrate-status test test-api test-web \
	lint lint-api lint-web format openapi psql shell-api

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

up: ## Levanta base, API y web (http://localhost:5173)
	$(COMPOSE) up --build -d

down: ## Detiene los servicios (los datos se conservan)
	$(COMPOSE) down

reset-db: ## Detiene todo y BORRA la base local
	$(COMPOSE) down -v

logs: ## Muestra los logs de todos los servicios
	$(COMPOSE) logs -f --tail=100

ps: ## Estado de los servicios
	$(COMPOSE) ps

migrate: ## Aplica las migraciones pendientes en la base local
	$(API) python -m scripts.migrate

migrate-status: ## Lista migraciones aplicadas y pendientes
	$(API) python -m scripts.migrate --status

test: test-api test-web ## Corre todas las pruebas

test-api: ## Pruebas del Backend contra la base aspar_test, con cobertura
	$(API) pytest -p no:cacheprovider --cov=app --cov-report=term-missing --cov-fail-under=70

test-web: ## Pruebas del Frontend con cobertura
	$(WEB) npm run test:coverage

lint: lint-api lint-web ## Revisa estilo y formato de todo

lint-api: ## Ruff (lint y formato) del Backend
	$(API) ruff check .
	$(API) ruff format --check .

lint-web: ## ESLint, Prettier y tipos del Frontend
	$(WEB) npm run lint
	$(WEB) npx prettier --check src
	$(WEB) npx vue-tsc -b

format: ## Corrige el formato del Backend y del Frontend
	$(COMPOSE) exec -u root api ruff format .
	$(COMPOSE) exec -u root api ruff check --fix .
	$(WEB) npx prettier --write src

openapi: ## Regenera docs/api/openapi.json desde la API
	$(API) python -m scripts.export_openapi

psql: ## Consola SQL de la base local
	$(COMPOSE) exec db psql -U aspar -d aspar

shell-api: ## Terminal dentro del contenedor de la API
	$(API) sh
