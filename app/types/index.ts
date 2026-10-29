export type RepoContributor = {
  id?: string | number;
  github_username?: string;
  username?: string;
  login?: string;
  avatar_url?: string | null;
};

export type Repo = {
  id: string;
  full_name: string;
  escrow_contract_id: string | null;
  escrow_balance: number;
  bounty_count?: number;
  owner_username?: string;
  is_private?: boolean;
  created_at?: string;
  contributors?: RepoContributor[];
  contributor_whitelist?: RepoContributor[];
  whitelisted_contributors?: RepoContributor[];
};
