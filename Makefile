# Imperial Game - Development Commands
# All targets run from the project root and delegate to public/client/

CLIENT_DIR = public/client

.PHONY: install start build test format format-check verify deploy clean help

## Setup & Run

install: ## Install dependencies
	cd $(CLIENT_DIR) && npm install

start: ## Start dev server at localhost:3000
	cd $(CLIENT_DIR) && npm start

## Quality

test: ## Run all Jest tests
	cd $(CLIENT_DIR) && npm test -- --watchAll=false --ci

format: ## Format all source files with Prettier
	cd $(CLIENT_DIR) && npm run format

format-check: ## Check formatting without writing changes
	cd $(CLIENT_DIR) && npm run format:check

## Build & Deploy

build: ## Create production build (zero warnings required)
	cd $(CLIENT_DIR) && npm run build

verify: ## Run full pre-push verification (format + test + build)
	cd $(CLIENT_DIR) && bash verify.sh

deploy: build ## Build and deploy to Firebase Hosting
	firebase deploy --only hosting

## Utilities

clean: ## Remove build artifacts and node_modules
	rm -rf $(CLIENT_DIR)/build $(CLIENT_DIR)/node_modules

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
