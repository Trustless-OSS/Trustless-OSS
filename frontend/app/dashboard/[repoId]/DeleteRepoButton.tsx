'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleError, notifySuccess } from '@/lib/notifications';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export default function DeleteRepoButton({ repoId, token }: { repoId: string; token: string }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND}/api/repos/${repoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete repository');
      }

      notifySuccess('Repository Removed', 'All connections have been permanently deleted.');
      setShowModal(false);
      router.push('/dashboard');
    } catch (err: any) {
      handleError(err, 'Delete Repository');
      setError(err.message ?? 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setShowModal(true); setError(''); }}
        disabled={loading}
        className="brutal-button-outline px-5 py-3 text-sm flex items-center gap-2 w-full sm:w-auto border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? 'DELETING...' : 'DELETE_REPO'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white border-[6px] border-slate-950 w-full max-w-md shadow-[16px_16px_0px_0px_#dc2626]">
            <div className="h-4 bg-red-600 border-b-4 border-slate-950 w-full" />

            <div className="p-8">
              <div className="mb-8">
                <div className="label-brutal bg-red-600 text-white px-3 py-1 w-fit mb-4 border-2 border-slate-950">
                  ACTION // PERMANENT_DELETE
                </div>
                <h3 className="title-brutal text-3xl text-slate-950 mb-2">DELETE_REPO</h3>
                <p className="font-mono text-xs text-slate-500 font-bold uppercase leading-relaxed">
                  This will permanently remove all repository data, bounty history, and revoke the GitHub App connection.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border-l-8 border-red-600 p-4 mb-6">
                  <p className="text-red-600 font-black text-xs uppercase mb-1">ERR_DELETE_FAILED</p>
                  <p className="text-red-950 font-mono text-[10px] font-bold leading-tight uppercase">{error}</p>
                </div>
              )}

              <div className="p-4 bg-slate-950 font-mono mb-8">
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">This action will:</p>
                <ul className="text-slate-300 text-[10px] font-bold uppercase space-y-1">
                  <li>→ Delete all tracked issues & bounty records</li>
                  <li>→ Remove GitHub App from this repository</li>
                  <li>→ Permanently remove from database</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-6 border-t-4 border-slate-950 border-dashed">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="brutal-button-outline py-4 px-6 flex-1 text-sm"
                >
                  ABORT
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-red-600 text-white px-6 py-4 flex-[1.5] text-sm font-bold border-4 border-slate-950 shadow-[4px_4px_0_0_#020617] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase disabled:opacity-50"
                >
                  {loading ? 'DELETING...' : 'CONFIRM_DELETE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
