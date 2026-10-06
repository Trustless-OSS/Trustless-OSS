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
            
            className="animate-hero-in hero-stagger-5 mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <GitBranch className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Repositories
          </Button>
          <Button
            href="/dashboard/transactions"
            variant="outline"
        
            className="animate-hero-in hero-stagger-5 mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Activity
          </Button>
          <Button
            href="/dashboard/contributors"
            variant="outline"

            className="animate-hero-in hero-stagger-5 mt-10 flex flex-col gap-3 sm:flex-row"
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
