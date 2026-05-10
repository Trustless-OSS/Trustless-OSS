# Trustless OSS

> Trustless, milestone-based rewards for OSS contributors via GitHub + Trustless Work

## What it does

1. Maintainer connects a GitHub repo + funds a USDC escrow on Stellar
2. Labelling a GitHub issue with `rewarded` + difficulty (`low`/`medium`/`high`) creates a bounty
3. When a contributor is assigned, they paste their Stellar wallet address
4. When their PR is merged, funds release **automatically** to their wallet — no trust required

## Project Structure

```
Trustless-OSS/
├── backend/          # Pure Node.js + TypeScript HTTP server (no frameworks)
│   └── src/
│       ├── server.ts            # Entry point — HTTP server
│       ├── router.ts            # Minimal router (no Express)
│       ├── routes/
│       │   ├── webhooks.ts      # GitHub webhook endpoint
│       │   └── api.ts           # REST API endpoints
│       ├── lib/
│       │   ├── supabase.ts      # Supabase admin client
│       │   ├── github/
│       │   │   ├── labels.ts    # Label parser
│       │   │   ├── comments.ts  # Bot comments via Octokit
│       │   │   └── webhook.ts   # Business logic handlers
│       │   ├── stellar/
│       │   │   └── signer.ts    # Platform wallet signing
│       │   └── trustless-work/
│       │       ├── client.ts    # TW API fetch wrapper
│       │       ├── escrow.ts    # Escrow creation
│       │       └── milestone.ts # Milestone push/release
│       └── types/index.ts
│
├── frontend/         # Next.js 14 App Router + TypeScript + Tailwind
│   └── app/
│       ├── page.tsx             # Landing page
│       ├── login/page.tsx       # GitHub OAuth login
│       ├── dashboard/
│       │   ├── page.tsx         # Repos list
│       │   ├── [repoId]/page.tsx # Repo detail + issues
│       │   └── connect-repo/    # Connect new repo
│       ├── connect/page.tsx     # Contributor wallet connect
│       └── auth/
│           ├── callback/route.ts
│           └── signout/route.ts
│
└── docs/
    ├── plan.md
    ├── implementation.md
    └── schema.sql               # Supabase SQL schema
```

## Quick Start

### 1. Supabase Setup

1. Create a [Supabase](https://supabase.com) project
2. Run `docs/schema.sql` in the SQL editor
3. Enable GitHub OAuth in **Authentication → Providers → GitHub**

### 2. GitHub App Setup

1. Create a [GitHub App](https://github.com/settings/apps)
2. Set permissions: Issues (R/W), Pull requests (R), Metadata (R)
3. Subscribe to events: `issues`, `pull_request`
4. Set webhook URL: `https://your-backend.com/api/webhooks/github`

### 3. Backend

```bash
cd backend
cp .env.example .env   # fill in all values
npm install
npm run dev            # starts on http://localhost:4000
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local   # fill in Supabase public keys
npm install
npm run dev                  # starts on http://localhost:3000
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | PEM private key (or base64) |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC secret |
| `TRUSTLESS_WORK_API_KEY` | Trustless Work API key |
| `TRUSTLESS_WORK_BASE_URL` | `https://dev.api.trustlesswork.com` |
| `PLATFORM_STELLAR_SECRET_KEY` | Platform wallet secret key |
| `PLATFORM_STELLAR_PUBLIC_KEY` | Platform wallet public key |
| `STELLAR_NETWORK` | `testnet` or `mainnet` |
| `APP_URL` | Frontend URL (for bot comment links) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL (default: `http://localhost:4000`) |

## API Endpoints (Backend)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/webhooks/github` | GitHub webhook receiver |
| `GET` | `/api/repos` | List authed user's repos |
| `POST` | `/api/repos/connect` | Register a repo |
| `GET` | `/api/repos/:id/issues` | List bounty issues for a repo |
| `POST` | `/api/escrow/create` | Create TW escrow for a repo |
| `POST` | `/api/milestones/push` | Push milestone on-chain |
| `POST` | `/api/wallet/connect` | Save contributor wallet |
| `GET` | `/api/contributor/me` | Get contributor profile |

## Webhook Label Format

Add these labels to any GitHub issue:

- `rewarded` — marks the issue as having a bounty
- `low` / `medium` / `high` — sets the difficulty tier
- `bonus:50` — adds 50 USDC on top of the base amount

## Known Limitations (v1)

1. **Solvency check is app-level** — not enforced on-chain
2. **Platform wallet is releaseSigner** — centralization risk
3. **Maintainer is dispute resolver** — conflict of interest in disputes
4. **No milestone timeout** — funds can be locked if contributor disappears
