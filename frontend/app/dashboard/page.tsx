import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import InstallationSuccessHandler from './InstallationSuccessHandler';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

async function getRepos(token: string): Promise<{ repos: any[]; error: string | null }> {
  const url = `${BACKEND}/api/repos`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { repos: [], error: `Backend URL "${url}" → HTTP ${res.status} non-JSON: ${text.substring(0, 120)}` };
    }
    if (!res.ok) {
      return { repos: [], error: data.error ?? `API error ${res.status}` };
    }
    return { repos: data.repos ?? [], error: null };
  } catch (e: any) {
    return { repos: [], error: `Fetch to "${url}" failed: ${e.message}` };
  }
}

interface DashboardProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage(props: DashboardProps) {
  const searchParams = await props.searchParams;
  const isSyncing = searchParams.syncing === 'true';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  const { repos, error: reposError } = await getRepos(session?.access_token ?? '');

  // Calculate if a repo is "new" (added in the last 5 minutes)
  const isNew = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return now - created < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold gradient-text text-lg">🔐 Trustless OSS</Link>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400 text-sm">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-white/10"
              />
            )}
            <span className="text-sm text-gray-400">
              {user.user_metadata?.user_name ?? user.email}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      
      <InstallationSuccessHandler />

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Syncing Banner */}
        {isSyncing && (
          <div className="mb-8 p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <p className="text-sm text-indigo-300">
                Background sync active. We are waiting for GitHub to notify us about your new repository...
              </p>
            </div>
            <Link href="/dashboard" className="text-xs text-indigo-400 hover:underline">Dismiss</Link>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-1">Your Repos</h1>
            <p className="text-gray-400 text-sm">Manage escrow bounties across your repositories.</p>
          </div>
          <Link
            href="/dashboard/connect-repo"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all hover:scale-105"
          >
            + Connect repo
          </Link>
        </div>

        {/* API Error Banner */}
        {reposError && (
          <div className="mb-8 p-4 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div>
              <p className="text-sm text-red-300 font-medium">Failed to load repositories</p>
              <p className="text-xs text-red-400/70 font-mono mt-0.5">{reposError}</p>
            </div>
          </div>
        )}

        {/* Repos grid */}
        {repos.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-white mb-2">No repos connected yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect a GitHub repo to start creating trustless bounties.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/dashboard/connect-repo"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
              >
                Connect your first repo →
              </Link>
              {isSyncing && (
                <p className="text-[10px] text-gray-600 uppercase tracking-widest animate-pulse">
                  Checking for updates... Try refreshing in a few seconds.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {repos.map((repo: {
              id: string;
              full_name: string;
              escrow_contract_id: string | null;
              escrow_balance: number;
              created_at: string;
            }) => (
              <div
                key={repo.id}
                className={`glass rounded-2xl p-6 flex flex-col transition-all duration-500 ${isNew(repo.created_at) ? 'ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/10 scale-[1.02]' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📁</span>
                    {isNew(repo.created_at) && (
                      <span className="bg-indigo-500 text-[10px] text-white font-bold px-2 py-0.5 rounded-full animate-bounce">
                        NEW
                      </span>
                    )}
                  </div>
                  {repo.escrow_contract_id ? (
                    <span className="status-completed px-2 py-0.5 rounded-full text-xs font-medium">
                      Escrow ✓
                    </span>
                  ) : (
                    <span className="status-pending px-2 py-0.5 rounded-full text-xs font-medium">
                      No escrow
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-white text-base mb-1 truncate">{repo.full_name.split('/')[1] || repo.full_name}</h3>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <div>
                    <div className="text-xs text-gray-500">Balance</div>
                    <div className="text-sm font-mono font-semibold text-green-400">
                      {repo.escrow_balance} USDC
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {repo.escrow_contract_id && (
                      <a
                        href={`https://viewer.trustlesswork.com/${repo.escrow_contract_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Escrow ↗
                      </a>
                    )}
                    <Link
                      href={`/dashboard/${repo.id}`}
                      className="text-xs font-medium text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
