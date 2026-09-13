import { ArrowLeftRight, GitBranch, Trophy } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardMetrics from '@/app/components/dashboard/DashboardMetrics';
import FundsMovementChart from '@/app/components/dashboard/FundsMovementChart';
import MaintainerActivity from '@/app/components/dashboard/MaintainerActivity';
import Button from '@/app/components/ui/Button';

interface DashboardProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage(props: DashboardProps) {
  const _searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="w-full">
      <div className="relative mb-10 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
        <div className="max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Overview</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Dashboard
          </h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            href="/dashboard/repos"
            variant="outline"
            size="lg"
            className="w-full border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 dark:hover:text-blue-200 sm:w-auto"
          >
            <GitBranch className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            View repositories
          </Button>
          <Button
            href="/dashboard/transactions"
            variant="outline"
            size="lg"
            className="w-full border-violet-200 bg-violet-50 text-violet-700 shadow-sm hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 dark:hover:text-violet-200 sm:w-auto"
          >
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Activity
          </Button>
          <Button
            href="/dashboard/contributors"
            variant="outline"
            size="lg"
            className="w-full border-amber-200 bg-amber-50 text-amber-800 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-200 sm:w-auto"
          >
            <Trophy className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Leaderboard
          </Button>
        </div>
      </div>

      <DashboardMetrics />

      <FundsMovementChart />

      <MaintainerActivity />
    </div>
  );
}
