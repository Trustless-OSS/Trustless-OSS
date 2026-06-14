# Frontend — Trustless OSS

Next.js 16 + React 19 frontend for dashboard and contributor onboarding.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_GITHUB_APP_SLUG`
- `NEXT_PUBLIC_APP_URL`

## Scripts

- `pnpm dev` — Start Next.js dev server
- `pnpm build` — Build for production
- `pnpm start` — Run production build
- `pnpm lint` — Run ESLint
- `pnpm typecheck` — Check TypeScript types

## Pages

| Route                     | Purpose            |
| ------------------------- | ------------------ |
| `/`                       | Landing            |
| `/login`                  | GitHub OAuth       |
| `/dashboard`              | Repos & escrow     |
| `/dashboard/[repoId]`     | Repo detail        |
| `/dashboard/connect-repo` | GitHub App install |
| `/connect`                | Wallet onboarding  |

## User Flows

**Maintainer:**

1. Login with GitHub
2. Connect repo & authorize app
3. Deploy escrow & fund with USDC
4. Issues auto-populate
5. Milestones released on PR merge

**Contributor:**

1. Get assigned to issue
2. Click wallet link
3. Connect Stellar wallet
4. Submit PR
5. Get paid on merge

## Deployment

Vercel integration via `vercel.json`. See `VERCEL_DEPLOYMENT.md` for config.

## Related

- [Backend](../backend/README.md)
- [Root Documentation](../../README.md)
