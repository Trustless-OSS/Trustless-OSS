'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export default function ConnectRepoPage() {
  const [repoFullName, setRepoFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleConnect() {
    setError('');
    if (!repoFullName.includes('/')) {
      setError('Enter a full repo name like owner/repo');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = (await supabase.auth.getUser()).data.user;

      if (!session || !user) { router.push('/login'); return; }

      // Use GitHub API to get repo details
      const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: { Authorization: `Bearer ${session.provider_token}` },
      });

      if (!ghRes.ok) { setError("Repo not found or you don't have access."); return; }

      const ghRepo = await ghRes.json();

      const res = await fetch(`${BACKEND}/api/repos/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          githubRepoId: ghRepo.id,
          fullName: ghRepo.full_name,
          ownerGithubId: ghRepo.owner.id,
          ownerUsername: ghRepo.owner.login,
        }),
      });

      if (!res.ok) { setError('Failed to connect repo'); return; }

      router.push('/dashboard');
    } catch (e) {
      setError('Unexpected error. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
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

      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="glass rounded-2xl p-10">
          <h1 className="text-2xl font-extrabold text-white mb-2">Connect a repository</h1>
          <p className="text-gray-400 text-sm mb-8">
            Enter your GitHub repo to start managing bounty escrow.
          </p>

          <label className="block text-sm text-gray-400 mb-2">Repository</label>
          <input
            id="repo-name-input"
            type="text"
            placeholder="owner/repo-name"
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          />

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            id="connect-repo-btn"
            onClick={handleConnect}
            disabled={loading || !repoFullName}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all"
          >
            {loading ? 'Connecting…' : 'Connect repository →'}
          </button>
        </div>
      </div>
    </div>
  );
}
