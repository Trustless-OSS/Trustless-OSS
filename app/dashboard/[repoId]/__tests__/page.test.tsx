import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RepoDetailPage from '../page';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: { provider_id: '12345' } } },
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock child components that rely on state or wallet calls
vi.mock('@/app/components/escrow/DeployEscrowButton', () => ({
  default: () => <button>Deploy Escrow</button>,
}));
vi.mock('@/app/components/escrow/FundEscrowButton', () => ({
  default: () => <button>Fund Escrow</button>,
}));
vi.mock('@/app/components/escrow/RefundFundButton', () => ({
  default: () => <button>Refund Escrow</button>,
}));
vi.mock('@/app/components/escrow/RewardSettingsForm', () => ({
  default: () => <div>Reward Settings</div>,
}));
vi.mock('@/app/components/escrow/RetryProcessButton', () => ({
  default: () => <button>Retry</button>,
}));
vi.mock('@/app/components/dashboard/DeleteRepoButton', () => ({
  default: () => <button>Delete Repo</button>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RepoDetailPage - Actor Column Rendering', () => {
  const mockRepo = {
    id: 'repo-123',
    github_repo_id: 999,
    full_name: 'owner/test-repo',
    owner_github_id: 12345,
    owner_username: 'owner',
    installer_github_id: null,
    github_installation_id: null,
    escrow_contract_id: '0x1234567890abcdef',
    escrow_balance: 100,
    reward_low: 10,
    reward_medium: 25,
    reward_high: 50,
    is_fork: false,
    is_private: false,
    owner_type: 'User',
    created_at: '2026-01-01T00:00:00Z',
  };

  it('renders assigned bounty actor as a GitHub link', async () => {
    const mockIssues = [
      {
        id: 'issue-1',
        github_issue_number: 77,
        title: 'Bounty Actor display bug',
        difficulty_label: 'high',
        reward_amount: 50,
        status: 'active',
        assignments: {
          contributors: {
            github_username: 'ryzen-xp',
          },
        },
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/repos/repo-123/issues')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockIssues }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockRepo }),
        });
      })
    );

    const PageJSX = await RepoDetailPage({ params: Promise.resolve({ repoId: 'repo-123' }) });
    render(PageJSX);

    const actorLink = screen.getByRole('link', { name: '@ryzen-xp' });
    expect(actorLink).toBeInTheDocument();
    expect(actorLink).toHaveAttribute('href', 'https://github.com/ryzen-xp');
    expect(actorLink).toHaveAttribute('target', '_blank');
    expect(actorLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('renders unassigned bounty actor with dash fallback and no literal null', async () => {
    const mockIssues = [
      {
        id: 'issue-2',
        github_issue_number: 78,
        title: 'Unassigned bounty issue',
        difficulty_label: 'medium',
        reward_amount: 25,
        status: 'active',
        assignments: null,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/repos/repo-123/issues')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockIssues }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockRepo }),
        });
      })
    );

    const PageJSX = await RepoDetailPage({ params: Promise.resolve({ repoId: 'repo-123' }) });
    render(PageJSX);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});
