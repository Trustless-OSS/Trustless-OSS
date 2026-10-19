import { redirect } from 'next/navigation';

export default async function GitHubSetupRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  // The GitHub App's setup URL points here, but the real handler is at /dashboard/settings/github.
  // Redirect with the query params preserved.
  const params = await searchParams;
  redirect(`/dashboard/settings/github?${new URLSearchParams(params).toString()}`);
}
