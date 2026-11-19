import type { Metadata } from 'next';
import Navbar from '@/app/components/layout/Navbar';
import RecentBounties from '@/app/components/home/RecentBounties';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Explore Rewarded Issues | Trustless OSS',
  description:
    'Browse open, unassigned GitHub issues with rewards and find your next contribution.',
  alternates: { canonical: 'https://www.trustless-oss.xyz/explore' },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const value = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-[96rem] flex-1 px-3 py-8 sm:px-6 lg:px-8 lg:py-12">
        <RecentBounties key={page} page={page} />
      </main>
    </>
  );
}
