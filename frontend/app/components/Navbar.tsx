import Link from 'next/link';
import { User } from '@supabase/supabase-js';

interface NavbarProps {
  user?: User | null;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function Navbar({ user, breadcrumbs }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-gray-950/70 border-b border-white/5 shadow-2xl shadow-black/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
            <span className="text-2xl drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]">🔐</span>
            <span className="font-bold text-lg tracking-tight gradient-text">Trustless OSS</span>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-sm ml-4">
              <span className="text-gray-600">|</span>
              {breadcrumbs.map((crumb, i) => (
                <div key={crumb.label} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link href={crumb.href} className="text-gray-400 hover:text-white transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-200 font-medium">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <span className="text-gray-700">/</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full py-1.5 pl-1.5 pr-4">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-7 h-7 rounded-full border border-indigo-500/30 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600/50 flex items-center justify-center text-xs border border-indigo-500/30">
                    {(user.user_metadata?.user_name || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-200 hidden sm:block">
                  {user.user_metadata?.user_name ?? user.email?.split('@')[0]}
                </span>
                <form action="/auth/signout" method="post" className="ml-2">
                  <button
                    type="submit"
                    className="text-xs font-semibold text-gray-500 hover:text-red-400 transition-colors"
                    title="Sign Out"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:scale-105 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center gap-2"
            >
              Sign In
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
