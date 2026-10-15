# Frontend → Backend API requirements

**Audience:** Toss Backend (Rust / Axum) maintainers  
**Source of truth:** this frontend repo as of 2026-09-11  
**Backend repo:** [Trustless-OSS/Toss-Backend](https://github.com/Trustless-OSS/Toss-Backend)  
**Status:** the screens below ship with **demo / sample data**. They cannot go live until the APIs in this document exist.

This is not a catalog of every backend route. It is only what the **web app already renders** and **cannot load from the current API map**.

---

## 1. Why this exists

The dashboard overview, activity ledger, contributor leaderboard, notification bell, homepage event feed, and funds charts are built against typed models. None of those models are served by Toss Backend today.

| UI surface | File | Current data | Backend today |
| --- | --- | --- | --- |
| Overview metrics | `app/components/dashboard/DashboardMetrics.tsx` | `DEMO_ACTIVITY` + “Live metrics unavailable” banner | No dashboard/summary route |
| Funds movement chart | `app/components/dashboard/FundsMovementChart.tsx` | Hardcoded `SAMPLE` months | No time-series route |
| Repo funds / rewarded charts | `app/components/dashboard/MaintainerActivity.tsx` | `DEMO_ACTIVITY` rollup | No per-repo funds aggregate |
| Activity page | `app/components/dashboard/TransactionHistory.tsx` | `DEMO_ACTIVITY`, client pagination | No activity/ledger route |
| Leaderboard | `app/components/dashboard/ContributorLeaderboard.tsx` | `DEMO_ACTIVITY` ranking | No leaderboard route |
| Notification bell | `app/components/layout/NotificationBell.tsx` | `DEMO_NOTIFICATIONS`, local mark-read | No notifications route |
| Homepage live feed | `lib/event-stream.ts` + `EscrowEventLog.tsx` | Mock ticker (or unprovisioned Supabase table) | No event history / stream |

Existing bounty, escrow, repo, and wallet routes are **already enough** for connect-repo, deploy, fund, refund, rewards, and issue tables. Do not rebuild those.

---

## 2. Conventions (match existing API)

All new application routes must follow the contract the frontend already uses.

| Rule | Requirement |
| --- | --- |
| Base URL | `{NEXT_PUBLIC_BACKEND_URL}` (local default `http://localhost:5000`) |
| Browser path | Frontend proxies as `/api/backend/{backend-path}` — backend path stays `/api/...` |
| Protocol | HTTPS JSON REST. One SSE (or equivalent) stream for the public event log. |
| Auth | `Authorization: Bearer <supabase_access_token>` on every maintainer route |
| Scope | Return **only** repos the caller owns or installed (`owner_github_id` / `installer_github_id`) |
| Content type | `application/json; charset=utf-8` |
| Amounts | USDC as JSON **numbers** (not strings). Use `0` not `null` for zero. |
| Timestamps | ISO-8601 UTC, e.g. `2026-09-04T12:10:00.000Z` |
| Usernames | GitHub login **without** `@` |
| Repo names | `owner/name` (`full_name`) |
| Tx hashes | Stellar transaction hash hex, or `null` for GitHub-only events |
| Errors | `{ "error": "human readable message" }` — same as `ErrorResponse` in Toss Backend |
| Success lists | `{ "data": [ ... ] }` |
| Empty | `200` + `"data": []`. Do not 404 an empty dashboard. |
| Auth failures | `401` `{ "error": "Unauthorized" }` |
| Forbidden repo | `403` `{ "error": "Forbidden" }` |

### Pagination (required on list endpoints)

Query:

```
page=1          # 1-based, default 1
limit=20        # default 20, max 100
```

Response envelope:

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "total_pages": 1
}
```

`total_pages` must be `max(1, ceil(total / limit))` even when `total` is 0.

---

## 3. Already available (do not duplicate)

These are implemented on Toss Backend and already called by this app.

| Method | Path | Used by |
| --- | --- | --- |
| `GET` | `/api/health` | Footer / install overlay |
| `GET` | `/api/repos` | `/dashboard/repos` |
| `GET` | `/api/repos/{repoId}` | `/dashboard/{repoId}` |
| `DELETE` | `/api/repos/{repoId}` | Delete repo |
| `GET` | `/api/repos/{repoId}/issues` | Repo bounty table |
| `PUT` | `/api/repos/{repoId}/rewards` | Reward tier form |
| `POST` | `/api/repos/sync-installation` | GitHub App install + Sync |
| `POST` | `/api/issues/{issueId}/retry` | Retry payout |
| `GET` | `/api/contributor/me` | `/connect` assignment check |
| `POST` | `/api/milestones/push` | Contributor wallet / CCTP link |
| `POST` | `/api/escrow/create-unsigned` | Deploy escrow |
| `POST` | `/api/escrow/submit-deploy` | Deploy escrow |
| `POST` | `/api/escrow/fund-unsigned` | Fund escrow |
| `POST` | `/api/escrow/submit-fund` | Fund escrow |
| `POST` | `/api/escrow/refund` | Refund funds |

Not a frontend gap (backend has them; UI does not call them yet): `POST /api/repos/connect`, `POST /api/wallet/connect`, `POST /api/escrow/close-unsigned`, `POST /api/escrow/submit-close`.

---

## 4. Missing APIs (required)

Implement these seven REST resources plus one live stream. Suggested paths keep a single `/api/dashboard` prefix for maintainer analytics.

Priority: **P0** blocks replacing demo data. **P1** is the notification bell and homepage feed. **P2** is optional polish.

### 4.1 `GET /api/dashboard/summary` — P0

**UI:** `/dashboard` metric cards  
**Auth:** bearer, maintainer  
**Type:** REST JSON

Totals across every repo the caller maintains.

**Response `200`**

```json
{
  "locked_usdc": 3275,
  "released_usdc": 575,
  "issues_rewarded": 4,
  "contributors": [
    {
      "github_username": "gaearon",
      "avatar_url": "https://github.com/gaearon.png?size=96"
    }
  ]
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `locked_usdc` | `number` | Sum of USDC currently reserved in escrow (pool deposits + unreleased milestones). Matches the “Funds locked” card. |
| `released_usdc` | `number` | Cumulative USDC paid to contributors. Matches “Funds released”. |
| `issues_rewarded` | `integer` | Count of distinct issues that have ever been labeled rewarded (do not count the same issue twice). |
| `contributors` | `array` | Unique GitHub users who were assigned or paid. Order: highest earned first, then username. Cap at **12** avatars; the card only shows faces. |

`avatar_url` may be omitted; the UI can fall back to `https://github.com/{github_username}.png?size=96`.

**Must not**

- Include other maintainers’ repositories.
- Return sample/demo numbers when the user has no activity (`0` / `[]` is correct).

---

### 4.2 `GET /api/dashboard/funds-movement` — P0

**UI:** Funds movement area chart  
**Auth:** bearer, maintainer  
**Type:** REST JSON

Monthly series for escrow TVL vs payouts.

**Query**

```
months=12          # default 12, min 3, max 24
```

**Response `200`**

```json
{
  "data": [
    { "month": "2025-07", "label": "Jul", "tvl": 1000, "payouts": 800 },
    { "month": "2025-08", "label": "Aug", "tvl": 1500, "payouts": 900 }
  ]
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `month` | `string` | `YYYY-MM`, chronological ascending |
| `label` | `string` | Short month for the X axis (`Jul`, `Aug`, …) |
| `tvl` | `number` | Escrow TVL locked at end of that month (USD/USDC) |
| `payouts` | `number` | Cumulative payouts released **through** that month |

Always return one point per month in the window, including months with `0`. Chart library needs a continuous series.

---

### 4.3 `GET /api/dashboard/repos` — P0

**UI:** “Repository funds” stacked bars + “Explore Bounties” bars  
**Auth:** bearer, maintainer  
**Type:** REST JSON

One row per connected repo.

**Response `200`**

```json
{
  "data": [
    {
      "repo_id": "uuid",
      "full_name": "trustless-oss/web",
      "name": "web",
      "locked": 1050,
      "released": 280,
      "remaining": 770,
      "rewarded": 3
    }
  ]
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `name` | `string` | Short name (`full_name` after `/`) for axis ticks |
| `locked` | `number` | Lifetime USDC locked into this repo’s escrow |
| `released` | `number` | Lifetime USDC released from this repo |
| `remaining` | `number` | `max(0, locked - released)` — “still locked” stack |
| `rewarded` | `integer` | Distinct Explore Bounties in this repo |

Sort by most recent activity descending. Include repos with zero funds so empty charts are honest.

---

### 4.4 `GET /api/activity` — P0

**UI:** `/dashboard/transactions` table  
**Auth:** bearer, maintainer  
**Type:** REST JSON, paginated

This is the canonical ledger. Metrics, charts, and leaderboard can be derived from the same event store, but the UI needs this list as its own endpoint (do not force the browser to page through thousands of rows to draw four cards).

**Query**

```
kind=all                 # all | rewarded | locked | released | assigned | unassigned | rejected
repo=owner/name          # optional
page=1
limit=20
```

**Response `200`**

```json
{
  "data": [
    {
      "id": "act_16",
      "at": "2026-09-04T12:10:00.000Z",
      "repo": "trustless-oss/contracts",
      "issue_number": 9,
      "issue_title": "Add replay-safe release path",
      "kind": "released",
      "amount_usdc": 220,
      "contributor": "gaearon",
      "tx_hash": "8c2d14a0e6b73951f4c0a9d2b8e30647a1d5f0c8b3e7a269d4c1e8b0f5a67314"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 142,
  "total_pages": 8
}
```

#### `kind` enum (exact strings)

| `kind` | When to emit | `amount_usdc` | `contributor` | `tx_hash` | `issue_*` |
| --- | --- | --- | --- | --- | --- |
| `rewarded` | Issue labeled rewarded / custom amount set | bounty amount | `null` | `null` | required |
| `locked` | USDC reserved: pool deposit **or** milestone lock | amount locked | assignee if milestone, else `null` | Stellar hash | `null` for pool deposit |
| `released` | Milestone payout released | amount paid | payee username | Stellar hash | required |
| `assigned` | Contributor assigned / claimed | `null` | required | `null` | required |
| `unassigned` | Assignee dropped | `null` | previous assignee | `null` | required |
| `rejected` | Maintainer `/reject` (or aliases) | `null` | rejected contributor | `null` | required |

Pool deposits (fund escrow with no issue) **must** use `kind: "locked"`, `issue_number: null`, `issue_title: null`. The UI labels that row “Pool deposit”.

Newest first (`at` descending). `id` must be stable across pages.

**Must not**

- Invent kinds outside the enum (frontend filter tabs are hardcoded).
- Put `@` on `contributor`.
- Return a stub hash; use `null` when there is no chain tx.

---

### 4.5 `GET /api/contributors/leaderboard` — P0

**UI:** `/dashboard/contributors`  
**Auth:** bearer, maintainer  
**Type:** REST JSON

Rank contributors **across the caller’s repos**.

**Query**

```
limit=50        # default 50, max 100
```

**Response `200`**

```json
{
  "data": [
    {
      "rank": 1,
      "github_username": "gaearon",
      "avatar_url": "https://github.com/gaearon.png?size=96",
      "earned_usdc": 220,
      "merged_prs": 1,
      "assigned": 1,
      "repos": ["trustless-oss/contracts"]
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `rank` | `1`-based after sort |
| `earned_usdc` | Sum of `released` amounts to this user |
| `merged_prs` | Count of `released` events (one per paid merged PR) |
| `assigned` | Count of `assigned` events (not unique issues unless you document it; count events to match current UI) |
| `repos` | Sorted `owner/name` list this person appeared on |

Sort: `earned_usdc` desc, then `merged_prs` desc, then `github_username` asc.

Include users who were assigned but never paid (`earned_usdc: 0`). Exclude users with no assigned/released activity.

---

### 4.6 Notifications — P1

**UI:** navbar bell  
**Auth:** bearer, maintainer  
**Type:** REST JSON

Kinds the bell understands: `rewarded` | `locked` | `released` | `assigned` only (not `unassigned` / `rejected`).

#### `GET /api/notifications`

```
unread_only=false
page=1
limit=20
```

```json
{
  "data": [
    {
      "id": "ntf_05",
      "title": "Payout released",
      "body": "220 USDC sent to @gaearon for #9.",
      "at": "2026-09-04T12:10:00.000Z",
      "href": "/dashboard/transactions",
      "kind": "released",
      "read": false,
      "repo": "trustless-oss/contracts",
      "issue_number": 9
    }
  ],
  "unread_count": 3,
  "page": 1,
  "limit": 20,
  "total": 5,
  "total_pages": 1
}
```

`href` should be an in-app path (`/dashboard/transactions` or `/dashboard/{repoId}`). Newest first.

`unread_count` is the **global** unread total, not the current page.

#### `PATCH /api/notifications/{id}/read`

No body. Mark one notification read for the caller.

```json
{ "id": "ntf_05", "read": true }
```

#### `POST /api/notifications/read-all`

No body. Mark every notification for the caller read.

```json
{ "updated": 3 }
```

**Must not**

- Mark another user’s notifications.
- Persist “read” only in the browser (current demo behavior).

Suggested copy (backend may generate):

| kind | title | body pattern |
| --- | --- | --- |
| `released` | Payout released | `{amount} USDC sent to @{user} for #{n}.` |
| `assigned` | Contributor assigned | `@{user} claimed #{n} in {repo}.` |
| `locked` | Funds locked | `{amount} USDC escrowed for #{n}.` or pool: `{amount} USDC locked into the {repo} escrow.` |
| `rewarded` | Issue rewarded | `#{n} was labeled and is ready for contributors.` |

---

### 4.7 Public escrow event feed — P1

**UI:** homepage `EscrowEventLog`  
**Auth:** none for the public feed (homepage is logged-out). Maintainer-scoped feed may use bearer.  
**Type:** REST history + live stream

The frontend already has two adapters:

1. Mock ticker (default).
2. Supabase Realtime on `public.escrow_events` when `NEXT_PUBLIC_EVENT_STREAM=supabase`.

Pick **one** of the following. Do not leave both unimplemented.

#### Option A (preferred): backend SSE

**`GET /api/events`** — snapshot

```
limit=120
```

```json
{
  "data": [
    {
      "id": "evt_01",
      "event_type": "FUNDS_RELEASED",
      "actor": "gaearon",
      "avatar_url": null,
      "project": "TRUSTLESS-OSS",
      "description": "Released 250 USDC payout for merged PR on TRUSTLESS-OSS",
      "created_at": "2026-09-04T12:10:00.000Z"
    }
  ]
}
```

Newest first. Public events must not leak private repo names, wallet addresses, or emails. Use a display `project` slug (repo name or public alias).

**`GET /api/events/stream`** — Server-Sent Events

```
Content-Type: text/event-stream
Cache-Control: no-cache
```

Each message:

```
event: escrow
data: {"id":"evt_99","event_type":"FUNDS_DEPOSITED","actor":"octocat","avatar_url":null,"project":"web","description":"Deposited 1,500 USDC into the escrow pool for web","created_at":"2026-09-04T12:11:00.000Z"}

```

Heartbeat comment every 15s so proxies do not idle-timeout.

#### Option B: provision Supabase `escrow_events`

If you keep the existing adapter, the backend must **insert** rows the frontend already maps:

| Column | Type | Maps to |
| --- | --- | --- |
| `id` | uuid / text | `id` |
| `event_type` | text | `type` |
| `actor` | text | GitHub username |
| `avatar_url` | text, nullable | optional |
| `project` | text | display name |
| `description` | text | sentence shown in the feed |
| `created_at` | timestamptz | `timestamp` |

Enable Realtime on `public.escrow_events` (`INSERT` only). RLS: public `SELECT` of sanitized rows, or a view.

#### `event_type` enum (exact)

```
ESCROW_INITIALIZED
FUNDS_DEPOSITED
FUNDS_WITHDRAWN
MILESTONE_CREATED
CONTRIBUTOR_ASSIGNED
CONTRIBUTOR_REASSIGNED
FUNDS_RELEASED
PARTIAL_RELEASE
MILESTONE_CANCELLED
```

Do not add types without a frontend badge update. `FUNDS_WITHDRAWN` covers full refunds.

---

## 5. Optional (P2)

Not blocking demo-data removal, but the UI already has hooks.

### 5.1 `GET /api/market/prices`

`RepositoryEscrowCard` accepts `xlmUsdPrice` but the repos page always passes `undefined`.

```json
{
  "xlm_usd": 0.42,
  "usdc_usd": 1,
  "quoted_at": "2026-09-11T10:00:00.000Z"
}
```

Public, cacheable (`Cache-Control: public, max-age=60`).

### 5.2 Server-side repo list filters

Today `GET /api/repos` returns the full list; the app filters in memory.

Optional query on the existing route:

```
q=web
sort=balance | name | recent
page=1
limit=12
```

Only needed if maintainers connect dozens of repos.

### 5.3 Issue list paging

`GET /api/repos/{repoId}/issues` has no `page`. Add the standard envelope when a repo tracks more than ~100 bounties.

### 5.4 Maintainer profile on the backend

`/profile` writes `display_name`, `bio`, `location`, `website`, `skills`, `stellar_address` to **Supabase user metadata**, not Toss Backend. `POST /api/wallet/connect` already exists for contributor payout wallets. No new profile CRUD is required unless you want the backend to own maintainer bios.

---

## 6. Suggested event store (backend design)

Do not make the frontend aggregate GitHub + escrow tables on every page load.

Recommended source of truth:

```
activity_events
  id, occurred_at, kind, repo_id,
  issue_id null, amount_usdc null,
  contributor_github_username null,
  tx_hash null,
  payload jsonb
```

Write a row when:

- labels change → `rewarded`
- escrow funded / milestone locked → `locked`
- payout released → `released`
- assignment webhook → `assigned` / `unassigned`
- `/reject` → `rejected`

Then:

- `/api/activity` reads this table
- `/api/dashboard/*` and `/api/contributors/leaderboard` are SQL aggregates
- `/api/notifications` is a per-user projection (`read_at`) of a subset of kinds
- `/api/events` is a sanitized public projection with `event_type` mapped from `kind`

Idempotency: unique `(kind, repo_id, issue_id, tx_hash)` (or equivalent) so webhook retries do not double-count TVL.

---

## 7. TypeScript shapes the UI already uses

Map snake_case JSON → these types on the frontend. Do not change the enum strings.

```ts
type ActivityKind =
  | 'rewarded'
  | 'locked'
  | 'released'
  | 'assigned'
  | 'unassigned'
  | 'rejected';

type ActivityRow = {
  id: string;
  at: string;
  repo: string;
  issueNumber: number | null;
  issueTitle: string | null;
  kind: ActivityKind;
  amountUsdc: number | null;
  contributor: string | null;
  txHash: string | null;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string;
  earnedUsdc: number;
  mergedPrs: number;
  assigned: number;
  repos: string[];
};

type MaintainerNotice = {
  id: string;
  title: string;
  body: string;
  at: string;
  href: string;
  kind: 'rewarded' | 'locked' | 'released' | 'assigned';
  read: boolean;
};

type EscrowEventType =
  | 'ESCROW_INITIALIZED'
  | 'FUNDS_DEPOSITED'
  | 'FUNDS_WITHDRAWN'
  | 'MILESTONE_CREATED'
  | 'CONTRIBUTOR_ASSIGNED'
  | 'CONTRIBUTOR_REASSIGNED'
  | 'FUNDS_RELEASED'
  | 'PARTIAL_RELEASE'
  | 'MILESTONE_CANCELLED';

type EscrowEvent = {
  id: string;
  type: EscrowEventType;
  actor: string;
  avatarUrl?: string;
  project: string;
  description: string;
  timestamp: string;
};
```

---

## 8. Auth, CORS, OpenAPI

| Topic | Requirement |
| --- | --- |
| Identity | Verify the same Supabase JWT used by existing `/api/repos` routes. GitHub user id from token metadata. |
| CORS | Browser calls go through the Next proxy, but install/sync can hit the API origin. Keep `APP_URL` / `http://localhost:3000` on `CORS_ALLOWED_ORIGINS`. |
| SSE CORS | If using Option A, allow `GET /api/events/stream` from the frontend origin. |
| OpenAPI | Add every new route to `/api-doc/openapi.json` / `/swagger` with bearer security, request query, and response schemas. |
| Rate limit | `GET /api/dashboard/*` and `/api/activity` should be cheap (indexed aggregates). 60 req/min per user is enough. |

---

## 9. Error matrix

| Status | When | Body |
| --- | --- | --- |
| `200` | Success, including empty lists | envelope above |
| `400` | Invalid `kind`, `page`, `limit`, `months` | `{ "error": "..." }` |
| `401` | Missing / expired bearer | `{ "error": "Unauthorized" }` |
| `403` | Authenticated but not a maintainer of requested repo | `{ "error": "Forbidden" }` |
| `404` | Unknown notification id | `{ "error": "Not found" }` |
| `500` | DB / Redis failure | `{ "error": "..." }` (existing `AppError` mapping) |

Do not wrap errors as `{ "message": "..." }` only. The UI reads `error` first.

---

## 10. Acceptance checklist

Backend is done for the frontend when all of the following are true against a real maintainer token (no fixtures):

- [ ] `GET /api/dashboard/summary` returns live locked/released/rewarded/contributor avatars; zeros when the account is new.
- [ ] `GET /api/dashboard/funds-movement` returns 12 continuous months; chart can plot `tvl` and `payouts`.
- [ ] `GET /api/dashboard/repos` returns per-repo `locked`, `released`, `remaining`, `rewarded`.
- [ ] `GET /api/activity?kind=released&page=1&limit=20` filters and paginates; pool deposits have null issue fields.
- [ ] `GET /api/contributors/leaderboard` ranks by `earned_usdc` with merged PR and assigned counts.
- [ ] Notifications list, unread badge, `PATCH .../read`, and `POST .../read-all` persist per user.
- [ ] Homepage can load historical escrow events and receive a new event without refresh (SSE **or** `escrow_events` INSERT).
- [ ] Swagger documents every new route.
- [ ] Other maintainers cannot read this user’s ledger.

Until then the frontend will keep the sample-data banner and `DEMO_*` constants.

---

## 11. Frontend follow-up (out of scope for backend)

After these routes ship, the web app still needs to:

1. Fetch the new endpoints instead of `DEMO_ACTIVITY` / `DEMO_NOTIFICATIONS` / `SAMPLE`.
2. Remove the “Live metrics unavailable — showing sample data.” alert when `summary` succeeds.
3. Wire `NotificationBell` mark-read to `PATCH` / `read-all`.
4. Point `EscrowEventLog` at SSE (or confirm `NEXT_PUBLIC_EVENT_STREAM=supabase`).
5. Map snake_case → the TypeScript types above.

That work belongs in this frontend repo, not Toss Backend.
