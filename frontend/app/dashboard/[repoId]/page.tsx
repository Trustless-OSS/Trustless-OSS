import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DeployEscrowButton from './DeployEscrowButton';
import FundEscrowButton from './FundEscrowButton';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

async function getIssues(repoId: string, token: string) {
  try {
    const res = await fetch(`${BACKEND}/api/repos/${repoId}/issues`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return data.issues ?? [];
  } catch {
    return [];
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'status-pending',
    active: 'status-active',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
  };
  return `${map[status] ?? 'status-pending'} px-2 py-0.5 rounded-full text-xs font-medium`;
}

function diffBadge(diff: string | null) {
  if (!diff) return '';
  const map: Record<string, string> = { low: 'diff-low', medium: 'diff-medium', high: 'diff-high' };
  return `${map[diff] ?? ''} px-2 py-0.5 rounded-full text-xs font-medium`;
}

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();

  // Get repo from supabase directly
  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .single();

  const issues = await getIssues(repoId, session?.access_token ?? '');

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-white/5 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="font-bold gradient-text text-lg">🔐 Trustless OSS</Link>
        <span className="text-gray-600">|</span>
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">Dashboard</Link>
        <span className="text-gray-700">/</span>
        <span className="text-gray-300 text-sm">{repo?.full_name ?? repoId}</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Repo header */}
        {repo && (
          <div className="glass rounded-2xl p-8 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white mb-1">{repo.full_name}</h1>
                {repo.escrow_contract_id ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 font-mono">
                      {repo.escrow_contract_id.slice(0, 8)}…{repo.escrow_contract_id.slice(-6)}
                    </span>
                    <a
                      href={`https://viewer.trustlesswork.com/${repo.escrow_contract_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Escrow Viewer ↗
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 items-start mt-2">
                    <span className="text-sm text-yellow-400">⚠️ No escrow created yet</span>
                    <DeployEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Escrow Balance</div>
                <div className="text-3xl font-bold text-green-400 font-mono">
                  {repo.escrow_balance} <span className="text-sm">USDC</span>
                </div>
                {repo.escrow_contract_id && (
                  <FundEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-6 pt-6 border-t border-white/5 flex-wrap">
              <div className="glass rounded-xl px-4 py-3">
                <div className="text-xs text-gray-500 mb-1">Low reward</div>
                <div className="text-sm font-mono font-semibold text-white">{repo.reward_low} USDC</div>
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <div className="text-xs text-gray-500 mb-1">Medium reward</div>
                <div className="text-sm font-mono font-semibold text-white">{repo.reward_medium} USDC</div>
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <div className="text-xs text-gray-500 mb-1">High reward</div>
                <div className="text-sm font-mono font-semibold text-white">{repo.reward_high} USDC</div>
              </div>
            </div>
          </div>
        )}

        {/* Issues table */}
        <h2 className="text-xl font-bold text-white mb-4">Bounty Issues</h2>

        {issues.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-4xl mb-4">🏷️</div>
            <p className="text-gray-400">
              No bounty issues yet. Add <code className="text-indigo-300 bg-indigo-900/20 px-1.5 py-0.5 rounded">rewarded</code> + difficulty labels to a GitHub issue to get started.
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-left">
                  <th className="px-6 py-4 font-medium">Issue</th>
                  <th className="px-6 py-4 font-medium">Difficulty</th>
                  <th className="px-6 py-4 font-medium">Reward</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {issues.map((issue: {
                  id: string;
                  github_issue_number: number;
                  title: string;
                  difficulty_label: string | null;
                  reward_amount: number;
                  status: string;
                  assignments?: { contributors?: { github_username: string }; payout_status: string }[];
                }) => {
                  const assignment = issue.assignments?.[0];
                  const contributor = assignment?.contributors;
                  return (
                    <tr key={issue.id} className="text-gray-300 hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-gray-500 mr-2">#{issue.github_issue_number}</span>
                        <span className="text-white font-medium">{issue.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        {issue.difficulty_label && (
                          <span className={diffBadge(issue.difficulty_label)}>{issue.difficulty_label}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-green-400">{issue.reward_amount} USDC</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadge(issue.status)}>{issue.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        {contributor ? (
                          <span className="text-indigo-300">@{contributor.github_username}</span>
                        ) : (
                          <span className="text-gray-600">unassigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
