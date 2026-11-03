import { ArrowLeftRight } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
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
      <header className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end md:mb-14">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Dashboard
          </h1>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <Button href="/dashboard/repos" variant="outline" className="w-full justify-center">
            <SiGithub className="h-5 w-5 text-primary" aria-hidden="true" />
            Repositories
          </Button>
          <Button
            href="/dashboard/activity"
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
        </div>
      </header>

      <DashboardMetrics />

      <FundsMovementChart />

      <MaintainerActivity />
    </div>
  );
}
