'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleError, notifySuccess } from '@/lib/notifications';
import Portal from '../../components/Portal';
import LoadingLogo from '../../components/LoadingLogo';

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
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <div className="bg-white border-4 border-slate-950 w-full max-w-md shadow-[12px_12px_0px_0px_#dc2626] animate-in zoom-in-95 duration-200">
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
                  <div className="bg-red-50 border-l-8 border-red-600 p-4 mb-6 animate-in slide-in-from-top-2">
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
                    className="flex-1 py-4 px-6 text-sm font-bold uppercase border-4 border-slate-950 bg-white text-slate-950 shadow-[4px_4px_0_0_#dc2626] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50"
                  >
                    ABORT
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-[1.5] py-4 px-6 text-sm font-bold uppercase border-4 border-slate-950 bg-red-600 text-white shadow-[4px_4px_0_0_#dc2626] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <LoadingLogo size="tiny" />
                        <span>DELETING...</span>
                      </>
                    ) : (
                      'CONFIRM_DELETE'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
