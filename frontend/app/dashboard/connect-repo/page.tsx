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
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchRepos() {
      try {
        // provider_token is null after page refresh — read from cookie set by /auth/callback
        const ghToken = getCookie('gh_token');
        if (!ghToken) {
          setError('GitHub session expired. Please sign out and sign in again.');
          return;
        }

        // Fetch user's public, non-fork repos sorted by recently pushed
        const res = await fetch(
          'https://api.github.com/user/repos?type=owner&sort=pushed&per_page=100',
          { headers: { Authorization: `Bearer ${ghToken}` } }
        );
        if (!res.ok) {
          setError('Failed to fetch repositories from GitHub.');
          return;
        }

        const data = await res.json() as any[];
        // Filter out forks and private repos
        const publicNonForks = data.filter(r => !r.fork && !r.private);
        setRepos(publicNonForks);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchRepos();
  }, []);

  const filtered = searchQuery
    ? repos.filter(r => r.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : repos.slice(0, 8);

  async function handleConnect() {
    if (!selected) return;
    setError('');
    setConnecting(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const res = await fetch(`${BACKEND}/api/repos/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          githubRepoId: selected.id,
          fullName: selected.full_name,
          ownerGithubId: selected.owner.id,
          ownerUsername: selected.owner.login,
          ghToken: getCookie('gh_token') ?? '',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to connect: ${text}`);
        return;
      }

      router.push('/dashboard');
    } catch (e) {
      setError('Unexpected error. Please try again.');
      console.error(e);
    } finally {
      setConnecting(false);
    }
  }

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
        <div className="glass rounded-2xl p-10">
          <h1 className="text-2xl font-extrabold text-white mb-1">Connect a repository</h1>
          <p className="text-gray-400 text-sm mb-8">
            Select a public repository to start managing bounty escrow. Webhooks will be set up automatically.
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search your repositories…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          {/* Repo list */}
          <div className="space-y-2 max-h-80 overflow-y-auto mb-6">
            {loadingRepos ? (
              <div className="py-8 text-center text-gray-500 text-sm animate-pulse">Loading your repositories…</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">No public repositories found.</div>
            ) : (
              filtered.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => setSelected(selected?.id === repo.id ? null : repo)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selected?.id === repo.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span className="font-mono text-sm font-medium truncate">{repo.full_name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                      {repo.language && <span>{repo.language}</span>}
                      <span>⭐ {repo.stargazers_count}</span>
                    </div>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{repo.description}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {!searchQuery && repos.length > 8 && (
            <p className="text-xs text-gray-600 mb-4 text-center">
              Showing 8 most recently updated. Search to find others ({repos.length} total).
            </p>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting || !selected}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all"
          >
            {connecting
              ? 'Connecting…'
              : selected
              ? `Connect ${selected.name} →`
              : 'Select a repository above'}
          </button>
        </div>
      </div>
    </div>
  );
}
