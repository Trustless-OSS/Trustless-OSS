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
    <div className="min-h-screen bg-gray-950 flex flex-col relative overflow-hidden">
      {/* Dashboard ambient backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />

      <Navbar user={user} breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]} />
      
      <main className="flex-1 flex flex-col relative z-10 w-full max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
