import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DeployEscrowButton from './DeployEscrowButton';
import FundEscrowButton from './FundEscrowButton';
import RewardSettingsForm from './RewardSettingsForm';
import RetryProcessButton from './ReleaseBountyButton';
import RefundFundButton from './RefundFundButton';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

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
  return `${map[status] ?? 'status-pending'} status-badge`;
}

function diffBadge(diff: string | null) {
  if (!diff) return '';
  const map: Record<string, string> = { low: 'diff-low', medium: 'diff-medium', high: 'diff-high', custom: 'diff-custom' };
  return `${map[diff] ?? ''} border-2 border-slate-950 px-2 py-0.5 font-bold uppercase text-xs tracking-widest`;
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

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .single();

  const issues = await getIssues(repoId, session?.access_token ?? '');

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  const isRepoMaintainer = repo && (
    Number(repo.owner_github_id) === githubId ||
    Number(repo.installer_github_id) === githubId
  );

  return (
    <div className="w-full">
      <Link href="/dashboard" className="label-brutal text-slate-500 hover:text-slate-950 flex items-center gap-2 mb-8 transition-colors w-fit underline underline-offset-4 decoration-2">
        &lt; RETURN_TO_DASHBOARD
      </Link>

      {/* Repo header */}
      {repo && (
        <div className="bg-white brutal-border p-8 md:p-12 mb-16 brutal-shadow relative">
          <div className="absolute top-0 right-0 bg-slate-950 text-white font-mono font-bold px-3 py-1 border-b-4 border-l-4 border-slate-950">
            CONFIG
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
            <div>
              <div className="label-brutal text-slate-500 mb-2">TARGET_MODULE</div>
              <h1 className="title-brutal text-3xl md:text-5xl text-slate-950 mb-4">{repo.full_name}</h1>
              {repo.escrow_contract_id ? (
                <div className="flex items-center gap-4 bg-slate-100 p-2 border-2 border-slate-950 w-fit">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse border border-slate-950"></div>
                  <span className="text-sm font-mono font-bold text-slate-950">
                    {repo.escrow_contract_id.slice(0, 8)}…{repo.escrow_contract_id.slice(-6)}
                  </span>
                  <a
                    href={`https://viewer.trustlesswork.com/${repo.escrow_contract_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label-brutal bg-slate-950 text-white px-2 py-1 hover:bg-blue-600 transition-colors"
                  >
                    INSPECT
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-4 mt-4">
                  <span className="label-brutal text-red-600 bg-red-100 border-2 border-red-600 px-2 py-1 w-fit">ERR_NO_ESCROW</span>
                  <DeployEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-6 lg:text-right border-l-4 border-slate-950 pl-8 border-dashed">
              {repo.escrow_contract_id && (
                <>
                  <div className="flex flex-col items-end">
                    <div className="label-brutal text-slate-500 mb-1">CONTRACT_LIQUIDITY</div>
                    <div className="text-4xl font-black text-slate-950">{repo.escrow_balance.toFixed(2)} <span className="text-lg text-slate-500">USDC</span></div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-6 relative w-full sm:w-auto">
                      {isRepoMaintainer && (
                        <>
                          <div className="w-full sm:w-auto">
                            <FundEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
                          </div>
                          <div className="w-full sm:w-auto">
                            <RefundFundButton repoId={repoId} token={session?.access_token ?? ''} currentBalance={repo.escrow_balance} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {isRepoMaintainer && (
            <div className="border-t-4 border-slate-950 pt-8 border-dashed">
              <div className="label-brutal text-slate-500 mb-6">REWARD_PARAMETERS</div>
              <RewardSettingsForm
                repoId={repoId}
                token={session?.access_token ?? ''}
                initialLow={repo.reward_low}
                initialMedium={repo.reward_medium}
                initialHigh={repo.reward_high}
              />
            </div>
          )}
        </div>
      )}

      {!isRepoMaintainer && repo && (
        <div className="mb-12 p-6 bg-blue-50 border-[4px] border-slate-950 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🧑‍💻</div>
            <div>
              <h2 className="title-brutal text-xl text-slate-950 uppercase">Contributor_View</h2>
              <p className="text-sm font-mono text-slate-600 font-bold uppercase">You are viewing this repository as a contributor.</p>
            </div>
          </div>
        </div>
      )}

      {/* Issues table */}
      <div className="flex items-end justify-between mb-8 border-b-[4px] border-slate-950 pb-4">
        <h2 className="title-brutal text-3xl text-slate-950">ACTIVE_BOUNTIES</h2>
        <div className="label-brutal text-slate-500">ISSUES_TRACKED: {issues.length}</div>
      </div>

      {issues.length === 0 ? (
        <div className="bg-white brutal-border p-16 text-center brutal-shadow">
          <div className="text-4xl mb-4 grayscale">🏷️</div>
          <p className="font-mono font-bold text-slate-500 mb-4 uppercase text-sm">
            No tracked issues in current repository.
          </p>
          <p className="font-mono text-sm text-slate-950">
            Append <span className="bg-slate-200 border-2 border-slate-950 px-1 font-black">rewarded</span> label with difficulty (<span className="bg-slate-200 border-2 border-slate-950 px-1 font-black">low</span>, <span className="bg-slate-200 border-2 border-slate-950 px-1 font-black">medium</span>, <span className="bg-slate-200 border-2 border-slate-950 px-1 font-black">high</span>), or comment <span className="bg-slate-200 border-2 border-slate-950 px-1 font-black">@Trustless-OSS 50</span> on target issue.
          </p>
        </div>
      ) : (
        <div className="bg-white brutal-border brutal-shadow overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-slate-950 text-white border-b-4 border-slate-950 uppercase tracking-widest text-xs font-bold">
                <th className="px-6 py-4 border-r-4 border-slate-950 text-left">Target</th>
                <th className="px-6 py-4 border-r-4 border-slate-950 text-left">Class</th>
                <th className="px-6 py-4 border-r-4 border-slate-950 text-left">Bounty</th>
                <th className="px-6 py-4 border-r-4 border-slate-950 text-left">State</th>
                <th className="px-6 py-4 border-r-4 border-slate-950 text-left">Actor</th>
                <th className="px-6 py-4 text-left">Exec</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue: {
                id: string;
                github_issue_number: number;
                title: string;
                difficulty_label: string | null;
                reward_amount: number;
                status: string;
                assignments?: { contributors?: { github_username: string }; payout_status: string };
              }, idx: number) => {
                const assignment = issue.assignments;
                const contributor = assignment?.contributors;
                return (
                  <tr key={issue.id} className={`text-slate-950 ${idx !== issues.length - 1 ? 'border-b-4 border-slate-950' : ''} hover:bg-slate-50 transition-colors`}>
                    <td className="px-6 py-4 border-r-4 border-slate-950">
                      <span className="text-blue-600 font-bold mr-2">#{issue.github_issue_number}</span>
                      <span className="font-semibold text-slate-800">{issue.title}</span>
                    </td>
                    <td className="px-6 py-4 border-r-4 border-slate-950">
                      {issue.difficulty_label && (
                        <span className={diffBadge(issue.difficulty_label)}>{issue.difficulty_label}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-r-4 border-slate-950">
                      <span className="font-black text-slate-950 text-lg">{issue.reward_amount}</span> <span className="text-xs text-slate-500 font-bold">USDC</span>
                    </td>
                    <td className="px-6 py-4 border-r-4 border-slate-950">
                      <span className={statusBadge(issue.status)}>{issue.status}</span>
                    </td>
                    <td className="px-6 py-4 border-r-4 border-slate-950">
                      {contributor ? (
                        <span className="font-bold underline decoration-2 underline-offset-4">@{contributor.github_username}</span>
                      ) : (
                        <span className="text-slate-400 italic">null</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isRepoMaintainer ? (
                        <RetryProcessButton 
                          issueId={issue.id}
                          token={session?.access_token ?? ''}
                          status={issue.status}
                          payoutStatus={assignment?.payout_status ?? 'pending'}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">N/A</span>
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
  );
}
