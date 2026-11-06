import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Navbar from '../components/layout/Navbar';
import InstallationSuccessHandler from '@/app/components/dashboard/InstallationSuccessHandler';
import WalletPreloader from '@/app/components/layout/WalletPreloader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="dashboard-page-shell relative flex min-h-screen flex-col">
      <WalletPreloader />
      <InstallationSuccessHandler />
      <Navbar user={user} />
      <main className="relative z-10 mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
