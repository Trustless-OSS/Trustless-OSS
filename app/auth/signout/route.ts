import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Supabase sign-out failed:', error);
    return NextResponse.json({ error: 'Unable to sign out. Please try again.' }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set('gh_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('auth_next', '', { path: '/', maxAge: 0 });
  return response;
}
