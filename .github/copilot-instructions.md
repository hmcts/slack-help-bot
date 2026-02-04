# Copilot Instructions for slack-help-bot

## Overview

This project is a Node.js Slack bot designed to help Platform users self-serve and request support, integrating with Azure AI Search, Jira, and Application Insights. It provides Slack commands, automated help workflows, and analytics/reporting.

## Tech Stack

- **Language:** JavaScript (Node.js)
- **Main Frameworks/Libraries:**
  - [@slack/bolt](https://slack.dev/bolt-js/) for Slack integration
  - Azure SDKs for Cosmos DB, Identity, and Search
  - Jira Client for ticketing
  - Application Insights for telemetry
  - Prettier for formatting, Jest for testing
- **Containerization:** Docker, with Azure Container Registry for deployment

## Key Files & Directories

- `app.js` — Main entry point, initializes config, secrets, Slack app, and health checks
- `src/` — Core logic:
  - `slackHandlers/` — Slack event and command handlers
  - `service/` — Data persistence, search, and Jira integration
  - `ai/` — AI prompt and response handling
  - `modules/appInsights.js` — Telemetry setup
  - `routes/server.js` — HTTP server for health checks
- `config/` — Configuration files
- `ci/` — CI scripts (e.g., Terraform linting)
- `pipeline/azure-pipelines.yml` — Azure DevOps pipeline definition
- `.github/workflows/` — GitHub Actions workflows for build/deploy
- `Dockerfile`, `docker-compose.yaml` — Containerization

## Build & Test

- **Install dependencies:**  
  `npm install`
- **Run locally:**  
  `npm start`
- **Lint (format check):**  
  `npx prettier -c .`
- **Test:**  
  `npm test` (Jest; currently placeholder, add tests in `src/**/*.test.js`)
- **CI/CD:**
  - GitHub Actions: `.github/workflows/main.yml` (build, lint, deploy)
  - Azure Pipelines: `pipeline/azure-pipelines.yml`

## Project Conventions

- Use Prettier for code formatting (`.prettierrc.json`)
- Environment/configuration via `config/` and `@hmcts/properties-volume`
- Secrets loaded before config access in production
- All Slack commands and event handlers live in `src/slackHandlers/`
- AI and search integrations in `src/ai/` and `src/service/`
- Health check endpoint provided by `src/routes/server.js`
- Analytics via Application Insights (`src/modules/appInsights.js`)

## Additional Notes

- See `README.md` for feature details and architecture diagram.
- Use `.nvmrc` for Node version management.
- For infrastructure, see `ci/terraform-lint.tests.ps1` and related scripts.

---

**Edit this file to update Copilot's context and guidance for this repository.**
