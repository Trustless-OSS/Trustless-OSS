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
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchInstalledRepos() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch repos where the app is already installed (from our DB)
        const res = await fetch(`${BACKEND}/api/repos`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch installed repositories');
        
        const data = await res.json();
        setRepos(data.repos || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchInstalledRepos();
  }, []);

  const handleInstallApp = () => {
    // Redirect to GitHub App installation page
    window.location.href = `https://github.com/apps/trustless-oss-bot/installations/new`;
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

      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold text-white mb-2">Connect a repository</h1>
        <p className="text-gray-400 text-sm mb-10 max-w-md mx-auto">
          Grant access to specific repositories you want to manage. We only request permission for the repos you select.
        </p>

        <button
          onClick={handleInstallApp}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20 mb-12"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Select Repositories on GitHub
        </button>

        <div className="text-left max-w-lg mx-auto">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Recently Authorized
          </h2>
          
          <div className="space-y-3">
            {loadingRepos ? (
              <div className="py-10 text-center text-gray-600 animate-pulse">Checking for new repositories...</div>
            ) : repos.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center text-gray-500 border-dashed border-2 border-white/5">
                No repositories authorized yet. Use the button above to get started.
              </div>
            ) : (
              repos.map(repo => (
                <Link
                  key={repo.id}
                  href={`/dashboard/${repo.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">📁</span>
                    <span className="text-sm font-medium text-gray-300">{repo.full_name}</span>
                  </div>
                  <span className="text-xs text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">Manage →</span>
                </Link>
              ))
            )}
          </div>
          
          <p className="mt-8 text-xs text-gray-600 text-center">
            Repos will appear here automatically after you grant access on GitHub.
          </p>
        </div>
      </div>
    </div>
  );
}
