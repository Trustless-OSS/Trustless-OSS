'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  owner: { id: number; login: string };
}

/** Read a cookie value by name (client-side only). */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : null;
}

export default function ConnectRepoPage() {
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<GHRepo | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchPublicRepos() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const username = user.user_metadata.user_name || user.user_metadata.preferred_username;
        if (!username) throw new Error('Could not determine GitHub username');

        // Fetch user's public repos using public API (no special scopes needed)
        const res = await fetch(`https://api.github.com/users/${username}/repos?sort=pushed&per_page=100`);
        if (!res.ok) throw new Error('Failed to fetch repositories from GitHub');

        const data = await res.json();
        // Filter out forks
        setRepos(data.filter((r: any) => !r.fork));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchPublicRepos();
  }, []);

  const filtered = searchQuery
    ? repos.filter(r => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : repos.slice(0, 10);

  const handleConnect = () => {
    if (!selected) return;
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'trustless-oss-bot';
    // Standard GitHub App installation URL with suggested repo
    const installUrl = `https://github.com/apps/${slug}/installations/new?suggested_target_id=${selected.owner.id}&repository_ids=${selected.id}`;
    window.open(installUrl, '_blank');
    
    // Redirect dashboard to wait for the sync
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-white/5 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="font-bold gradient-text text-lg">🔐 Trustless OSS</Link>
        <span className="text-gray-600">|</span>
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</Link>
        <span className="text-gray-700">/</span>
        <span className="text-gray-300 text-sm">Connect repo</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="glass rounded-3xl p-10 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-2xl font-extrabold text-white mb-1">Connect a repository</h1>
            <p className="text-gray-400 text-sm mb-8">
              Select a repository to grant access. We only request permission for the specific repo you choose.
            </p>

            {/* Search */}
            <div className="relative mb-6">
              <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search your public repositories…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Repo list */}
            <div className="space-y-2 max-h-80 overflow-y-auto mb-8 pr-2 custom-scrollbar">
              {loadingRepos ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 text-sm animate-pulse">Fetching your public repos…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-2xl">
                  No public repositories found matching your search.
                </div>
              ) : (
                filtered.map(repo => (
                  <button
                    key={repo.id}
                    onClick={() => setSelected(selected?.id === repo.id ? null : repo)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 ${
                      selected?.id === repo.id
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xl transition-transform ${selected?.id === repo.id ? 'scale-125' : ''}`}>
                          {selected?.id === repo.id ? '✅' : '📁'}
                        </span>
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${selected?.id === repo.id ? 'text-white' : ''}`}>
                            {repo.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{repo.full_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500 bg-black/20 px-2 py-1 rounded-lg">
                        <span>⭐ {repo.stargazers_count}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleConnect}
                disabled={!selected}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
              >
                {selected
                  ? `Connect ${selected.name} →`
                  : 'Select a repository above'}
              </button>
              
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">or</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <button
                onClick={() => {
                  const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'trustless-oss-bot';
                  window.open(`https://github.com/apps/${slug}/installations/new`, '_blank');
                }}
                className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                🔐 Grant Access to Organization / Repos
              </button>
            </div>
            
            <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest text-center">
              Privacy First: We only ask for access to the repo you select.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
