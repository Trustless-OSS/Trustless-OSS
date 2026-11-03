import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { refresh, push, notifySuccess } = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
}));
vi.mock('@/lib/backend', () => ({
  backendUrl: (path: string) => path,
  authHeaders: () => ({ Authorization: 'Bearer test-token' }),
}));
vi.mock('@/lib/notifications', () => ({
  handleError: vi.fn(),
  notifySuccess,
  toast: { error: vi.fn() },
}));

import RetryProcessButton from '../RetryProcessButton';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
  push.mockReset();
  notifySuccess.mockReset();
});

describe('RetryProcessButton', () => {
  it('offers Retry, Hold, and Reject when an active bounty has an on-chain milestone', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <RetryProcessButton issueId="issue-1" token="test-token" status="active" milestoneIndex={0} />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Bounty actions' }));

    expect(await screen.findByRole('option', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hold' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Release' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Approve' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Retry' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/issues/issue-1/retry', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('hides Hold before the milestone is on chain', async () => {
    render(
      <RetryProcessButton
        issueId="issue-2"
        token="test-token"
        status="active"
        milestoneIndex={null}
      />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Bounty actions' }));
    expect(await screen.findByRole('option', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Hold' })).not.toBeInTheDocument();
  });

  it('confirms Hold before sending the action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RetryProcessButton issueId="issue-4" token="test-token" status="active" milestoneIndex={0} />
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Bounty actions' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Hold' }));
    expect(
      await screen.findByRole('dialog', { name: 'Place this bounty on hold?' })
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Place on hold' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/issues/issue-4/hold', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('confirms Reject before sending the action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ refundedAmount: '25' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <RetryProcessButton
        issueId="issue-5"
        token="test-token"
        status="active"
        milestoneIndex={null}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Bounty actions' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Reject' }));
    expect(await screen.findByRole('dialog', { name: 'Reject this bounty?' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reject bounty' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/issues/issue-5/reject', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('hides actions for finished bounties', () => {
    render(
      <RetryProcessButton
        issueId="issue-3"
        token="test-token"
        status="released"
        milestoneIndex={0}
      />
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
