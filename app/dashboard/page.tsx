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
        <div className="animate-hero-in hero-stagger-5 grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
          <Button href="/dashboard/repos" variant="outline" className="w-full justify-center">
            <GitBranch className="h-5 w-5 text-primary" strokeWidth={2.5} aria-hidden="true" />
            Repositories
          </Button>
          <Button
            href="/dashboard/transactions"
            variant="outline"
            className="w-full justify-center"
          >
            <ArrowLeftRight
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            Activity
          </Button>
          <Button
            href="/dashboard/contributors"
            variant="outline"
            className="w-full justify-center"
          >
            <Trophy
              className="h-5 w-5 text-amber-500 dark:text-amber-400"
              strokeWidth={2.5}
              aria-hidden="true"
            />
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
