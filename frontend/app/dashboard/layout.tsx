import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Navbar from '../components/Navbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-[calc(100vh-24px)] flex flex-col relative selection:bg-blue-600 selection:text-white">
      <Navbar user={user} breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]} />
      
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-6 py-12">
        {children}
      </main>
    </div>
  );
}
