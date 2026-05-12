export interface Repo {
  id: string;
  github_repo_id: number;
  full_name: string;
  owner_github_id: number;
  owner_username: string;
  installer_github_id: number | null;
  github_installation_id: number | null;
  escrow_contract_id: string | null;
  escrow_balance: number;
  reward_low: number;
  reward_medium: number;
  reward_high: number;
  created_at: string;
}

export interface Contributor {
  id: string;
  github_user_id: number;
  github_username: string;
  stellar_wallet: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  repo_id: string;
  github_issue_id: number;
  github_issue_number: number;
  title: string;
  reward_amount: number;
  difficulty_label: 'low' | 'medium' | 'high' | 'custom' | null;
  milestone_index: number | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Assignment {
  id: string;
  issue_id: string;
  contributor_id: string;
  assigned_at: string;
  pr_number: number | null;
  pr_merged_at: string | null;
  payout_status: 'pending' | 'released' | 'failed';
  contributors?: Contributor;
}

export interface ParsedLabels {
  isRewarded: boolean;
  difficulty: 'low' | 'medium' | 'high' | 'custom' | null;
}

export interface RouteContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
}
