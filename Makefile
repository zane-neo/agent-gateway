.PHONY: runtime init up down logs ps config

RUNTIME ?= auto
COMPOSE := RUNTIME=$(RUNTIME) ./scripts/compose.sh compose

runtime:
	@RUNTIME=$(RUNTIME) ./scripts/compose.sh runtime

init:
	RUNTIME=$(RUNTIME) ./scripts/compose.sh init

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

config:
	$(COMPOSE) config --quiet
