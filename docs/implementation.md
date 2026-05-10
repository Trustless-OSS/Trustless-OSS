# OSS Bounty — Full Implementation Details
> Everything needed to build the app from scratch

---

## 1. Project Setup

```bash
npx create-next-app@latest oss-bounty --typescript --tailwind --app
cd oss-bounty
npm install @supabase/supabase-js @supabase/ssr
npm install @stellar/stellar-sdk
npm install axios
npm install shadcn-ui
npx shadcn-ui@latest init
```

### Folder Structure

```
oss-bounty/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── connect/
│   │   └── page.tsx              # contributor wallet connect
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── github/route.ts   # GitHub webhook handler
│   │   ├── escrow/
│   │   │   ├── create/route.ts
│   │   │   ├── fund/route.ts
│   │   │   └── release/route.ts
│   │   └── repos/
│   │       └── connect/route.ts
│   └── layout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── github/
│   │   ├── webhook.ts            # webhook verification + parsing
│   │   ├── labels.ts             # label parser
│   │   └── comments.ts           # issue comment bot
│   ├── trustless-work/
│   │   ├── client.ts             # API wrapper
│   │   ├── escrow.ts             # create/fund/approve/release
│   │   └── milestone.ts          # milestone management
│   └── stellar/
│       └── signer.ts             # platform wallet signing
├── types/
│   └── index.ts
└── .env.local
```

---

## 2. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GitHub App
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=          # PEM format, base64 encoded
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Trustless Work
TRUSTLESS_WORK_API_KEY=
TRUSTLESS_WORK_BASE_URL=https://dev.api.trustlesswork.com

# Stellar Platform Wallet
PLATFORM_STELLAR_SECRET_KEY=     # platform wallet secret (releaseSigner)
PLATFORM_STELLAR_PUBLIC_KEY=     # platform wallet public key
STELLAR_NETWORK=testnet          # testnet | mainnet
```

---

## 3. Supabase Schema

```sql
-- repos table
create table repos (
  id uuid primary key default gen_random_uuid(),
  github_repo_id bigint unique not null,
  full_name text not null,
  owner_github_id bigint not null,
  owner_username text not null,
  escrow_contract_id text,
  escrow_balance numeric default 0,
  reward_low numeric default 25,
  reward_medium numeric default 75,
  reward_high numeric default 150,
  created_at timestamptz default now()
);

-- contributors table
create table contributors (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint unique not null,
  github_username text not null,
  stellar_wallet text,
  created_at timestamptz default now()
);

-- issues table
create table issues (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid references repos(id) on delete cascade,
  github_issue_id bigint not null,
  github_issue_number int not null,
  title text not null,
  reward_amount numeric not null,
  difficulty_label text,           -- low | medium | high
  bonus_amount numeric default 0,
  milestone_index int,             -- index in TW escrow milestones array
  status text default 'pending',   -- pending | active | completed | cancelled
  created_at timestamptz default now(),
  unique(repo_id, github_issue_id)
);

-- assignments table
create table assignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references issues(id) on delete cascade,
  contributor_id uuid references contributors(id),
  assigned_at timestamptz default now(),
  pr_number int,
  pr_merged_at timestamptz,
  payout_status text default 'pending',  -- pending | released | failed
  unique(issue_id)
);
```

---

## 4. GitHub App Setup

### Required Permissions
```
Repository permissions:
- Issues: Read & Write        (read labels, write comments)
- Pull requests: Read         (detect merges)
- Metadata: Read

Subscribe to events:
- Issues
- Issue comment
- Pull request
```

### Webhook Events to Handle

| Event | Action | What to do |
|---|---|---|
| `issues` | `labeled` | Parse labels, create DB milestone |
| `issues` | `assigned` | Check wallet, push on-chain or send link |
| `issues` | `unassigned` | Cancel active milestone |
| `pull_request` | `closed` + `merged: true` | Approve + release funds |
| `pull_request` | `closed` + `merged: false` | Do nothing |

---

## 5. Core Code

### 5.1 Webhook Handler
`app/api/webhooks/github/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handleIssueLabeled, handleIssueAssigned, handlePRMerged } from '@/lib/github/webhook'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const event = req.headers.get('x-github-event') ?? ''

  // Verify webhook signature
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (sig !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  if (event === 'issues' && payload.action === 'labeled') {
    await handleIssueLabeled(payload)
  }

  if (event === 'issues' && payload.action === 'assigned') {
    await handleIssueAssigned(payload)
  }

  if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
    await handlePRMerged(payload)
  }

  return NextResponse.json({ ok: true })
}
```

---

### 5.2 Label Parser
`lib/github/labels.ts`

```typescript
export interface ParsedLabels {
  isRewarded: boolean
  difficulty: 'low' | 'medium' | 'high' | null
  bonusAmount: number
}

export function parseLabels(labels: { name: string }[]): ParsedLabels {
  const names = labels.map(l => l.name.toLowerCase())

  const isRewarded = names.includes('rewarded')
  
  const difficulty = names.includes('high') ? 'high'
    : names.includes('medium') ? 'medium'
    : names.includes('low') ? 'low'
    : null

  // Parse bonus:50 label
  const bonusLabel = names.find(n => n.startsWith('bonus:'))
  const bonusAmount = bonusLabel ? parseFloat(bonusLabel.split(':')[1]) || 0 : 0

  return { isRewarded, difficulty, bonusAmount }
}

export function getRewardAmount(
  difficulty: 'low' | 'medium' | 'high' | null,
  bonusAmount: number,
  repoDefaults: { reward_low: number; reward_medium: number; reward_high: number }
): number {
  const base = difficulty === 'high' ? repoDefaults.reward_high
    : difficulty === 'medium' ? repoDefaults.reward_medium
    : difficulty === 'low' ? repoDefaults.reward_low
    : 0

  return base + bonusAmount
}
```

---

### 5.3 Webhook Handlers
`lib/github/webhook.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { parseLabels, getRewardAmount } from './labels'
import { postComment } from './comments'
import { pushMilestoneOnChain, releaseEscrowMilestone } from '@/lib/trustless-work/milestone'

export async function handleIssueLabeled(payload: any) {
  const supabase = createClient()
  const { repository, issue } = payload

  // Find repo in DB
  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single()

  if (!repo || !repo.escrow_contract_id) return

  const parsed = parseLabels(issue.labels)
  if (!parsed.isRewarded || !parsed.difficulty) return

  // Check if milestone already exists for this issue
  const { data: existing } = await supabase
    .from('issues')
    .select('id')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single()

  if (existing) return // already processed

  const rewardAmount = getRewardAmount(parsed.difficulty, parsed.bonusAmount, repo)

  // Solvency check
  if (repo.escrow_balance < rewardAmount) {
    await postComment(repository.full_name, issue.number,
      `⚠️ Insufficient escrow balance (${repo.escrow_balance} USDC). Need ${rewardAmount} USDC. [Top up here](${process.env.NEXT_PUBLIC_APP_URL}/dashboard)`)
    return
  }

  // Create milestone in DB
  await supabase.from('issues').insert({
    repo_id: repo.id,
    github_issue_id: issue.id,
    github_issue_number: issue.number,
    title: issue.title,
    reward_amount: rewardAmount,
    difficulty_label: parsed.difficulty,
    bonus_amount: parsed.bonusAmount,
    status: 'pending'
  })

  // Reserve balance
  await supabase.from('repos')
    .update({ escrow_balance: repo.escrow_balance - rewardAmount })
    .eq('id', repo.id)
}

export async function handleIssueAssigned(payload: any) {
  const supabase = createClient()
  const { repository, issue, assignee } = payload

  const { data: repo } = await supabase
    .from('repos').select('*')
    .eq('github_repo_id', repository.id).single()

  if (!repo) return

  const { data: issueRecord } = await supabase
    .from('issues').select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id).single()

  if (!issueRecord || issueRecord.status !== 'pending') return

  // Find or create contributor
  let { data: contributor } = await supabase
    .from('contributors')
    .select('*')
    .eq('github_user_id', assignee.id)
    .single()

  if (!contributor) {
    const { data: newContributor } = await supabase
      .from('contributors')
      .insert({ github_user_id: assignee.id, github_username: assignee.login })
      .select().single()
    contributor = newContributor
  }

  // Create assignment
  await supabase.from('assignments').insert({
    issue_id: issueRecord.id,
    contributor_id: contributor.id
  })

  if (contributor?.stellar_wallet) {
    // Push milestone on-chain immediately
    await pushMilestoneOnChain(repo, issueRecord, contributor.stellar_wallet)
  } else {
    // Ask for wallet via issue comment
    const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/connect?issue=${issue.id}&repo=${repository.id}`
    await postComment(repository.full_name, issue.number,
      `👋 Hey @${assignee.login}! You've been assigned a bounty of **${issueRecord.reward_amount} USDC**.\n\nConnect your Stellar wallet to claim it: [Click here](${connectUrl})`)
  }
}

export async function handlePRMerged(payload: any) {
  const supabase = createClient()
  const { repository, pull_request } = payload

  // Find linked issue from PR body (e.g. "Closes #42" or "Fixes #42")
  const issueNumber = extractIssueNumber(pull_request.body)
  if (!issueNumber) return

  const { data: repo } = await supabase
    .from('repos').select('*')
    .eq('github_repo_id', repository.id).single()

  if (!repo) return

  const { data: issueRecord } = await supabase
    .from('issues').select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_number', issueNumber).single()

  if (!issueRecord || issueRecord.status !== 'active') return

  const { data: assignment } = await supabase
    .from('assignments').select('*, contributors(*)')
    .eq('issue_id', issueRecord.id).single()

  if (!assignment) return

  // Update PR info
  await supabase.from('assignments').update({
    pr_number: pull_request.number,
    pr_merged_at: new Date().toISOString()
  }).eq('id', assignment.id)

  // Approve + release via Trustless Work
  const released = await releaseEscrowMilestone(repo, issueRecord)

  if (released) {
    await supabase.from('assignments')
      .update({ payout_status: 'released' })
      .eq('id', assignment.id)

    await supabase.from('issues')
      .update({ status: 'completed' })
      .eq('id', issueRecord.id)

    await postComment(repository.full_name, issueNumber,
      `✅ Bounty of **${issueRecord.reward_amount} USDC** released to @${assignment.contributors.github_username}!`)
  }
}

function extractIssueNumber(body: string): number | null {
  if (!body) return null
  const match = body.match(/(?:closes|fixes|resolves)\s+#(\d+)/i)
  return match ? parseInt(match[1]) : null
}
```

---

### 5.4 Trustless Work Client
`lib/trustless-work/client.ts`

```typescript
import axios from 'axios'

export const twClient = axios.create({
  baseURL: process.env.TRUSTLESS_WORK_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.TRUSTLESS_WORK_API_KEY!
  }
})
```

---

### 5.5 Escrow Operations
`lib/trustless-work/escrow.ts`

```typescript
import { twClient } from './client'
import { signAndSendTransaction } from '@/lib/stellar/signer'

export async function createRepoEscrow(params: {
  maintainerWallet: string
  repoName: string
}) {
  const response = await twClient.post('/escrow/multi-release/deploy', {
    signer: params.maintainerWallet,
    engagementId: `repo-${Date.now()}`,
    title: `OSS Bounty: ${params.repoName}`,
    description: `Escrow for OSS bounty rewards in ${params.repoName}`,
    roles: {
      approver: params.maintainerWallet,
      serviceProvider: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
      platformAddress: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
      releaseSigner: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
      disputeResolver: params.maintainerWallet,
      receiver: process.env.PLATFORM_STELLAR_PUBLIC_KEY  // placeholder
    },
    platformFee: 0,
    milestones: [],
    trustline: {
      address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' // testnet USDC
    }
  })

  const { unsignedTransaction } = response.data
  return await signAndSendTransaction(unsignedTransaction)
}
```

---

### 5.6 Milestone Operations
`lib/trustless-work/milestone.ts`

```typescript
import { twClient } from './client'
import { signAndSendTransaction } from '@/lib/stellar/signer'
import { createClient } from '@/lib/supabase/server'

export async function pushMilestoneOnChain(
  repo: any,
  issue: any,
  contributorWallet: string
) {
  const supabase = createClient()

  // Get current escrow to find next milestone index
  const escrowData = await twClient.get(`/escrow/${repo.escrow_contract_id}`)
  const currentMilestones = escrowData.data.milestones ?? []
  const milestoneIndex = currentMilestones.length

  // Add milestone to escrow
  const response = await twClient.put('/escrow/multi-release/update-escrow', {
    signer: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
    contractId: repo.escrow_contract_id,
    escrow: {
      ...escrowData.data,
      milestones: [
        ...currentMilestones,
        {
          description: `Issue #${issue.github_issue_number}: ${issue.title}`,
          amount: issue.reward_amount,
          status: 'Pending',
          flags: { approved: false, released: false, disputed: false },
          receiver: contributorWallet
        }
      ]
    }
  })

  const { unsignedTransaction } = response.data
  await signAndSendTransaction(unsignedTransaction)

  // Update issue in DB
  await supabase.from('issues').update({
    milestone_index: milestoneIndex,
    status: 'active'
  }).eq('id', issue.id)
}

export async function releaseEscrowMilestone(repo: any, issue: any) {
  try {
    // Approve milestone
    const approveRes = await twClient.post('/escrow/multi-release/approve-milestone', {
      signer: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
      contractId: repo.escrow_contract_id,
      milestoneIndex: issue.milestone_index
    })
    await signAndSendTransaction(approveRes.data.unsignedTransaction)

    // Release milestone
    const releaseRes = await twClient.post('/escrow/multi-release/release-milestone', {
      signer: process.env.PLATFORM_STELLAR_PUBLIC_KEY,
      contractId: repo.escrow_contract_id,
      milestoneIndex: issue.milestone_index
    })
    await signAndSendTransaction(releaseRes.data.unsignedTransaction)

    return true
  } catch (err) {
    console.error('Release failed:', err)
    return false
  }
}
```

---

### 5.7 Stellar Signer
`lib/stellar/signer.ts`

```typescript
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk'
import { twClient } from '@/lib/trustless-work/client'

export async function signAndSendTransaction(unsignedXdr: string) {
  const keypair = Keypair.fromSecret(process.env.PLATFORM_STELLAR_SECRET_KEY!)
  const network = process.env.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET

  const tx = TransactionBuilder.fromXDR(unsignedXdr, network)
  tx.sign(keypair)
  const signedXdr = tx.toXDR()

  const result = await twClient.post('/helper/send-transaction', {
    signedXdr
  })

  return result.data
}
```

---

### 5.8 GitHub Comments Bot
`lib/github/comments.ts`

```typescript
import { App } from '@octokit/app'

const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY!, 'base64').toString('utf-8')
})

export async function postComment(fullName: string, issueNumber: number, body: string) {
  const [owner, repo] = fullName.split('/')
  const octokit = await app.getInstallationOctokit(await getInstallationId(fullName))
  await octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body })
}

async function getInstallationId(fullName: string): Promise<number> {
  const [owner, repo] = fullName.split('/')
  for await (const { installation } of app.eachInstallation.iterator()) {
    // Match by repo — simplified; in prod query installations API
    return installation.id
  }
  throw new Error('Installation not found')
}
```

---

## 6. API Routes

### Create Escrow
`app/api/escrow/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRepoEscrow } from '@/lib/trustless-work/escrow'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { repoId, maintainerWallet } = await req.json()

  const { data: repo } = await supabase
    .from('repos').select('*').eq('id', repoId).single()

  if (!repo) return NextResponse.json({ error: 'Repo not found' }, { status: 404 })

  const result = await createRepoEscrow({
    maintainerWallet,
    repoName: repo.full_name
  })

  // Store contract ID
  await supabase.from('repos').update({
    escrow_contract_id: result.contractId
  }).eq('id', repoId)

  return NextResponse.json({ contractId: result.contractId })
}
```

### Contributor Wallet Connect
`app/connect/page.tsx`

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ConnectPage({
  searchParams
}: {
  searchParams: { issue: string; repo: string }
}) {
  const [wallet, setWallet] = useState('')
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save wallet
    await supabase.from('contributors').upsert({
      github_user_id: user.user_metadata.provider_id,
      github_username: user.user_metadata.user_name,
      stellar_wallet: wallet
    }, { onConflict: 'github_user_id' })

    // Trigger on-chain milestone push
    await fetch('/api/milestones/push', {
      method: 'POST',
      body: JSON.stringify({
        githubIssueId: searchParams.issue,
        githubRepoId: searchParams.repo,
        wallet
      })
    })

    setDone(true)
  }

  if (done) return <p>✅ Wallet connected! Your bounty is locked in escrow.</p>

  return (
    <div>
      <h1>Claim Your Bounty</h1>
      <p>Connect your Stellar wallet to receive your USDC reward when your PR is merged.</p>
      <input
        placeholder="G... Stellar wallet address"
        value={wallet}
        onChange={e => setWallet(e.target.value)}
      />
      <button onClick={handleSubmit}>Connect Wallet</button>
    </div>
  )
}
```

---

## 7. Frontend Pages

### Pages Needed (minimal)

| Route | Purpose |
|---|---|
| `/` | Landing + login button |
| `/dashboard` | Repos list, escrow balance, issues table |
| `/dashboard/[repoId]` | Repo detail: milestones, statuses, Viewer link |
| `/connect` | Contributor wallet connect |

### Dashboard Data to Show

```
Repo: ethereum/solidity
Escrow: C...ABC | Balance: 650 USDC
Viewer: https://viewer.trustlesswork.com/C...ABC

Issues:
#123 | Fix memory leak | high | 150 USDC | active   | @contributor1
#124 | Add tests       | low  |  25 USDC | pending  | unassigned
#125 | Update docs     | med  |  75 USDC | completed| @contributor2 ✓
```

---

## 8. Testnet Setup

### Get Testnet USDC
1. Create Stellar testnet wallet: https://stellar.expert/explorer/testnet
2. Fund with XLM: https://laboratory.stellar.org/#account-creator
3. Add USDC trustline (testnet issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`)
4. Get testnet USDC from Trustless Work team or use their faucet

### Local Webhook Testing
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Update GitHub App webhook URL to:
# https://xxxx.ngrok.io/api/webhooks/github
```

---

## 9. Deployment (for demo)

```bash
# Deploy to Vercel (fastest for Next.js)
npm install -g vercel
vercel

# Set env vars in Vercel dashboard
# Update GitHub App webhook URL to Vercel URL
```

---

## 10. Key Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "@stellar/stellar-sdk": "^12.x",
    "@octokit/app": "^14.x",
    "axios": "^1.x"
  }
}
```

---

## 11. Trustless Work API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Create escrow | POST | `/escrow/multi-release/deploy` |
| Update escrow (add milestone) | PUT | `/escrow/multi-release/update-escrow` |
| Approve milestone | POST | `/escrow/multi-release/approve-milestone` |
| Release milestone | POST | `/escrow/multi-release/release-milestone` |
| Send signed transaction | POST | `/helper/send-transaction` |
| Get escrow state | GET | `/escrow/:contractId` |

---

## 12. Pre-submission Checklist

- [ ] Webhook verified with HMAC signature
- [ ] Happy path works end-to-end on testnet
- [ ] Escrow visible in Viewer: `https://viewer.trustlesswork.com/<contractId>`
- [ ] Bot comments working on issues
- [ ] Contributor wallet connect flow works
- [ ] Dashboard shows live escrow state
- [ ] Demo video recorded (≤3 min)
- [ ] README explains: trust problem, parties, unlock condition, dispute resolver
- [ ] Known limitations documented
