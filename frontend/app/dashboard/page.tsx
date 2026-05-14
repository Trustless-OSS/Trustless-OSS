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

  const isNew = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return now - created < 5 * 60 * 1000;
  };

  return (
    <div className="w-full">
      <InstallationSuccessHandler />

      {isSyncing && (
        <div className="mb-8 p-4 bg-white brutal-border brutal-shadow-blue flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-slate-950 animate-pulse" />
            <p className="font-mono font-bold text-sm text-slate-950">
              SYS_SYNC // AWAITING GITHUB_WEBHOOK_EVENT
            </p>
          </div>
          <Link href="/dashboard" className="text-xs font-bold uppercase underline">Dismiss</Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b-[4px] border-slate-950 pb-4">
        <div>
          <h1 className="title-brutal text-4xl text-slate-950">
            DASHBOARD_
          </h1>
          <p className="text-slate-500 font-mono font-bold uppercase tracking-widest text-sm mt-2">
            Repository Escrow Management
          </p>
        </div>
        <Link
          href="/dashboard/connect-repo"
          className="brutal-button px-6 py-3 mt-4 md:mt-0 text-sm"
        >
          + ADD_REPO
        </Link>
      </div>

      {reposError && (
        <div className="mb-8 p-6 bg-red-100 brutal-border flex flex-col gap-2 brutal-shadow">
          <div className="label-brutal bg-red-500 text-white w-fit px-2 py-1 border-2 border-slate-950">ERR_FETCH</div>
          <p className="font-bold text-slate-950 uppercase tracking-widest text-sm">Failed to load repositories</p>
          <p className="text-xs text-slate-600 font-mono bg-white p-2 border-2 border-slate-950">{reposError}</p>
        </div>
      )}

      {repos.length === 0 ? (
        <div className="bg-white brutal-border p-16 text-center brutal-shadow flex flex-col items-center">
          <div className="text-6xl mb-6 grayscale">📦</div>
          <h2 className="title-brutal text-2xl text-slate-950 mb-2">NO_MODULES_FOUND</h2>
          <p className="text-slate-500 font-mono font-bold uppercase text-sm mb-8">
            Connect a GitHub repo to initialize.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/dashboard/connect-repo"
              className="brutal-button px-8 py-4"
            >
              INITIALIZE_CONNECTION
            </Link>
            {isSyncing && (
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 animate-pulse mt-4">
                &gt; Polling for updates...
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {repos.map((repo: {
            id: string;
            full_name: string;
            escrow_contract_id: string | null;
            escrow_balance: number;
            created_at: string;
          }) => (
            <div
              key={repo.id}
              className={`bg-white brutal-border p-6 flex flex-col h-full relative ${isNew(repo.created_at) ? 'brutal-shadow-blue border-blue-600' : 'brutal-shadow'}`}
            >
              {isNew(repo.created_at) && (
                <div className="absolute -top-4 -right-4 bg-blue-600 text-white px-3 py-1 font-bold font-mono text-xs uppercase border-2 border-slate-950">
                  NEW
                </div>
              )}
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 bg-slate-950 text-white flex items-center justify-center border-4 border-slate-950 font-black text-2xl">
                  {repo.full_name[0].toUpperCase()}
                </div>
                {repo.escrow_contract_id ? (
                  <span className="status-badge status-completed">
                    ESCROW_ACTIVE
                  </span>
                ) : (
                  <span className="status-badge status-pending">
                    UNCONFIGURED
                  </span>
                )}
              </div>

              <h3 className="title-brutal text-xl text-slate-950 mb-1 truncate">{repo.full_name.split('/')[1] || repo.full_name}</h3>
              <p className="text-xs text-slate-500 font-mono font-bold uppercase truncate mb-8">{repo.full_name.split('/')[0]}</p>

              <div className="flex flex-col mt-auto pt-4 border-t-4 border-slate-950 border-dashed">
                <div className="flex justify-between items-end mb-4">
                  <div className="label-brutal text-slate-500">BALANCE</div>
                  <div className="text-xl font-black font-mono text-slate-950">
                    {repo.escrow_balance} <span className="text-sm">USDC</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Link
                    href={`/dashboard/${repo.id}`}
                    className="brutal-button flex-1 py-2 text-sm"
                  >
                    MANAGE
                  </Link>
                  <a
                    href={`https://github.com/${repo.full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-button-outline px-4 py-2 text-sm flex items-center justify-center"
                    title="View on GitHub"
                  >
                    ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
