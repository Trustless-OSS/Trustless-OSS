import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RepositoryEscrowCard from '../RepositoryEscrowCard';
import type { Repo } from '@/app/types';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const repo: Repo = {
  id: 'repo_123',
  full_name: 'trustless-oss/nftxlend',
  escrow_contract_id: 'contract_123',
  escrow_balance: 12500.5,
  xlm_balance: 36000,
  is_private: false,
};

afterEach(cleanup);

describe('RepositoryEscrowCard', () => {
  it('renders secured repository metadata and formatted balances', () => {
    render(<RepositoryEscrowCard repo={repo} xlmUsdPrice={0.1} />);

    expect(screen.getByText('nftxlend')).toBeInTheDocument();
    expect(screen.getByText('trustless-oss / git:main')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Escrow Secured')).toBeInTheDocument();
    expect(screen.getByText('12,500.5')).toBeInTheDocument();
    expect(screen.getByText('36,000')).toBeInTheDocument();
    expect(screen.getByText('$16,100.50')).toBeInTheDocument();
    expect(screen.queryByText('Contributors Whitelisted')).not.toBeInTheDocument();
    expect(screen.queryByText('No whitelist setup')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/dashboard/repo_123'
    );
    expect(
      screen.queryByRole('link', { name: 'Open trustless-oss/nftxlend on GitHub' })
    ).not.toBeInTheDocument();
  });

  it('renders the unconfigured private state', () => {
    render(
      <RepositoryEscrowCard
        repo={{
          ...repo,
          escrow_contract_id: null,
          escrow_balance: 0,
          stellar_balance: 0,
          xlm_balance: undefined,
          is_private: true,
        }}
      />
    );

    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Unconfigured')).toBeInTheDocument();
    expect(screen.queryByText('No whitelist setup')).not.toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'QUICK INITIALIZE' })).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: 'Open trustless-oss/nftxlend on GitHub' })
    ).not.toBeInTheDocument();
  });

  it('uses the callback when manage is selected without changing the detail route', () => {
    const onManage = vi.fn();
    render(<RepositoryEscrowCard repo={repo} onManage={onManage} />);

    fireEvent.click(screen.getByRole('link', { name: 'Manage' }));

    expect(onManage).toHaveBeenCalledWith(repo);
  });

  it('uses supported backend aliases and safe fallbacks for incomplete repository data', () => {
    render(
      <RepositoryEscrowCard
        repo={{
          ...repo,
          full_name: 'owner/',
          owner_username: 'maintainer',
          escrow_balance: Number.NaN,
          xlm_balance: undefined,
          stellar_balance: undefined,
        }}
      />
    );

    expect(screen.getByText('maintainer / git:main')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders a non-interactive loading skeleton', () => {
    render(<RepositoryEscrowCard repo={repo} isLoading />);

    expect(screen.getByLabelText('Loading repository escrow')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });
});
