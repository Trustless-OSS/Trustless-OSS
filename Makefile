.DEFAULT_GOAL := help

.PHONY: help check format-check lint typecheck test build audit

help: ## Show the available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <command>\n\nCommands:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: format-check lint typecheck test build audit ## Run every check before committing
	@printf '\nAll checks passed.\n'

format-check: ## Verify formatting without changing files
	pnpm format:check

lint: ## Run ESLint
	pnpm lint

typecheck: ## Run the TypeScript compiler checks
	pnpm typecheck

test: ## Run the test suite once
	pnpm test

build: ## Create an optimized production build
	pnpm build

audit: ## Check for high or critical dependency vulnerabilities
	pnpm audit
