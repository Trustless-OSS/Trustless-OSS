import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

async function getRepos(token: string) {
  try {
    const res = await fetch(`${BACKEND}/api/repos`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return data.repos ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  const repos = await getRepos(session?.access_token ?? '');

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
          <span className="text-sm text-gray-400">
            {user.user_metadata?.user_name ?? user.email}
          </span>
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

      <div className="max-w-6xl mx-auto px-6 py-10">
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

        {/* Repos grid */}
        {repos.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-white mb-2">No repos connected yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect a GitHub repo to start creating trustless bounties.
            </p>
            <Link
              href="/dashboard/connect-repo"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
            >
              Connect your first repo →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {repos.map((repo: {
              id: string;
              full_name: string;
              escrow_contract_id: string | null;
              escrow_balance: number;
            }) => (
              <Link
                key={repo.id}
                href={`/dashboard/${repo.id}`}
                className="glass rounded-2xl p-6 glow-hover block"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-xl">📁</span>
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

                <h3 className="font-bold text-white text-base mb-1 truncate">{repo.full_name}</h3>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <div>
                    <div className="text-xs text-gray-500">Balance</div>
                    <div className="text-sm font-mono font-semibold text-green-400">
                      {repo.escrow_balance} USDC
                    </div>
                  </div>
                  {repo.escrow_contract_id && (
                    <a
                      href={`https://viewer.trustlesswork.com/${repo.escrow_contract_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Escrow Viewer ↗
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
