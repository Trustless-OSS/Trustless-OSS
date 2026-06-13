# Backend — Trustless OSS

Node.js + TypeScript backend for GitHub webhook processing and Trustless Work integration.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Documentation

- **[Migrations](./migrations/README.md)** — Database schema and migration files
- **[Implementation Guide](./docs/IMPLEMENTATION.md)** — Full code walkthrough
- **[Environment Variables](../.env.example)** — Configuration reference

## Scripts

- `pnpm dev` — Start dev server with hot reload
- `pnpm build` — Compile TypeScript
- `pnpm start` — Run compiled server
- `pnpm migrate` — Run database migration (loads schema.sql)
- `pnpm lint` — Run ESLint
- `pnpm typecheck` — Check TypeScript types

## Key Files

| Path                      | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `src/server.ts`           | Express server setup                    |
| `src/app.ts`              | Route handlers                          |
| `src/routes/`             | API endpoints (repos, webhooks, escrow) |
| `src/lib/github/`         | GitHub App integration                  |
| `src/lib/trustless-work/` | Trustless Work API wrapper              |
| `src/lib/stellar/`        | Stellar signing & transactions          |
| `src/lib/supabase.ts`     | Supabase client                         |
| `src/migrate.ts`          | Database schema setup                   |
| `migrations/`             | Versioned SQL migrations                |

## Architecture

```
GitHub Webhook
    ↓
src/routes/webhooks.ts (verify signature)
    ↓
src/lib/github/webhook.ts (handle events)
    ↓
Supabase (store issue/assignment state)
Trustless Work API (push/release milestones)
Stellar (sign & send transactions)
```

## Environment Variables

Required (backend):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_BOT_TOKEN`
- `PLATFORM_STELLAR_SECRET_KEY`
- `PLATFORM_STELLAR_PUBLIC_KEY`
- `STELLAR_NETWORK`
- `TRUSTLESS_WORK_API_KEY`
- `TRUSTLESS_WORK_BASE_URL`
- `PORT` (default: 4000)
- `APP_URL`
- `FRONTEND_URL`
- `DATABASE_URL` (for migrations)

See `../.env.example` for full reference.

## Testing

Local webhook testing with ngrok:

```bash
# Terminal 1: start backend
pnpm dev

# Terminal 2: expose with ngrok
npx ngrok http 4000

# Update GitHub App webhook URL to:
# https://xxxx.ngrok.io/api/webhooks/github
```

## Deployment

Backend can be deployed to any Node.js host (Heroku, Railway, Render, etc).

Ensure environment variables are set and database is migrated before starting.

## Related

- [Migrations](./migrations/README.md)
- [Frontend](../frontend/README.md)
- [Root Documentation](../../README.md)
