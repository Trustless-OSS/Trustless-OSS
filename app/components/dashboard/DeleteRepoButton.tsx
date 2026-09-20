'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import Portal from '@/app/components/layout/Portal';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import Button from '@/app/components/ui/Button';
import { backendUrl } from '@/lib/backend';

export default function DeleteRepoButton({ repoId, token }: { repoId: string; token: string }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function closeModal() {
    if (loading) return;
    setShowModal(false);
    setError('');
  }

  async function handleDelete() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(backendUrl(`/api/v1/repos/${repoId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete repository');
      }

      notifySuccess('Repository removed', 'The GitHub connection and bounty records were deleted.');
      setShowModal(false);
      router.push('/dashboard');
    } catch (err: unknown) {
      handleError(err, 'Delete repository');
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        onClick={() => {
          setShowModal(true);
          setError('');
        }}
        disabled={loading}
        className="w-full gap-1.5 sm:w-auto"
      >
        {loading ? (
          <>
            <LoadingLogo size="tiny" variant="circle" />
            Deleting
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </>
        )}
      </Button>

      {showModal && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="surface-card w-full max-w-md overflow-hidden bg-card/95"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-repo-title"
              aria-describedby="delete-repo-description"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <Trash2 className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    aria-label="Close delete dialog"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-red-500">
                  Remove repository
                </p>
                <h3
                  id="delete-repo-title"
                  className="font-display mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
                >
                  Delete this repository?
                </h3>
                <p
                  id="delete-repo-description"
                  className="mt-3 text-sm leading-6 text-muted-foreground"
                >
                  This permanently removes the repository from Trustless OSS and cannot be undone.
                </p>

                {error && (
                  <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-600">
                      Delete failed
                    </p>
                    <p className="mt-1 text-sm font-medium text-red-800">{error}</p>
                  </div>
                )}

                <ul className="mt-5 space-y-2 rounded-2xl bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                  <li>Tracked issues and bounty records will be deleted.</li>
                  <li>The GitHub App connection for this repository will be revoked.</li>
                  <li>The repository will be removed from your dashboard.</li>
                </ul>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" onClick={closeModal} disabled={loading}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleDelete} disabled={loading}>
                    {loading ? (
                      <>
                        <LoadingLogo size="tiny" variant="circle" />
                        Deleting
                      </>
                    ) : (
                      'Delete repository'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
