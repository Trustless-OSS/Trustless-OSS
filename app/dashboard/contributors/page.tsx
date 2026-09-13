import { ArrowLeft } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import ContributorLeaderboard from '@/app/components/dashboard/ContributorLeaderboard';

export default function ContributorsPage() {
  return (
    <div className="w-full">
      <div className="relative mb-10 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Community
          </p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Contributors
          </h1>
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <Button
            href="/dashboard"
            variant="outline"
            size="lg"
            className="w-full border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 sm:w-auto"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Back to dashboard
          </Button>
        </div>
      </div>

      <ContributorLeaderboard />
    </div>
  );
}
