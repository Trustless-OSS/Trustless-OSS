import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // provider_token (GitHub OAuth token) is only available immediately after
      // the code exchange — persist it in a short-lived cookie so client pages
      // can use it for GitHub API calls without re-authenticating.
      if (data.session?.provider_token) {
        response.cookies.set('gh_token', data.session.provider_token, {
          httpOnly: false,   // must be readable by JS on the client
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 8, // 8 hours
          path: '/',
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
