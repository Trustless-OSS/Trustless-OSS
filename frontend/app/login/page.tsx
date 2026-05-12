'use client';

import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'read:user user:email',
      },
    });
  }

  return (
    <div className="min-h-[calc(100vh-24px)] flex items-center justify-center p-6 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        <div className="bg-white brutal-border p-8 md:p-12 brutal-shadow relative">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-8 h-8 bg-blue-600 border-b-4 border-l-4 border-slate-950"></div>
          <div className="absolute top-4 right-12 w-4 h-4 rounded-full bg-slate-950 animate-pulse"></div>

          <div className="label-brutal mb-6 bg-slate-200 text-slate-950 inline-flex px-3 py-1 border-2 border-slate-950">
            SYS_LOGIN // AUTH_REQUIRED
          </div>

          <h1 className="title-brutal text-4xl mb-4 text-slate-950">
            AUTHENTICATE
          </h1>
          
          <p className="text-slate-600 font-mono text-sm mb-10 font-medium">
            &gt; Initialize session via GitHub OAuth.<br />
            &gt; Access repository configuration.<br />
            &gt; Awaiting user input...
          </p>

          <button
            onClick={handleLogin}
            className="brutal-button w-full py-4 text-lg flex items-center justify-center gap-4"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            CONNECT_GITHUB
          </button>

          <div className="mt-8 pt-6 border-t-4 border-slate-950 border-dashed">
            <p className="text-xs text-slate-500 font-mono font-bold uppercase tracking-widest text-center">
              By connecting, you accept the protocol Terms_of_Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
