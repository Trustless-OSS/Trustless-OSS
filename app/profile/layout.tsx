import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Navbar from '../components/layout/Navbar';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/profile');
  }

  return (
    <div className="dashboard-page-shell relative flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
