import Link from 'next/link';
import { User } from '@supabase/supabase-js';

interface NavbarProps {
  user?: User | null;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function Navbar({ user, breadcrumbs }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-50 brutal-border-b">
      <div className="px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-950 flex items-center justify-center text-white font-black text-xl brutal-shadow-blue">
              T
            </div>
            <span className="title-brutal text-2xl tracking-tighter">
              TRUSTLESS <span className="text-blue-600">OSS</span>
            </span>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="hidden sm:flex items-center gap-4 text-sm ml-4 font-mono font-bold">
              <span className="text-slate-950/30">{'//'}</span>
              {breadcrumbs.map((crumb, i) => (
                <div key={crumb.label} className="flex items-center gap-4">
                  {crumb.href ? (
                    <Link href={crumb.href} className="text-slate-600 hover:text-blue-600 hover:underline underline-offset-4 decoration-2 transition-colors uppercase">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-950 uppercase bg-slate-200 px-2 py-0.5 border border-slate-950">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <span className="text-slate-950/30">/</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm font-bold uppercase tracking-widest text-slate-950 hover:bg-slate-950 hover:text-white px-3 py-1 border-2 border-transparent hover:border-slate-950 transition-all"
              >
                [ Dashboard ]
              </Link>
              <div className="w-1 h-8 bg-slate-950 hidden sm:block" />
              <div className="flex items-center gap-3 bg-white brutal-border px-2 py-1 brutal-shadow">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-8 h-8 border-2 border-slate-950 object-cover grayscale hover:grayscale-0 transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 bg-slate-950 text-white font-bold flex items-center justify-center text-xs">
                    {(user.user_metadata?.user_name || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="font-mono font-bold text-slate-950 text-sm hidden sm:block">
                  {user.user_metadata?.user_name ?? user.email?.split('@')[0]}
                </span>
                <form action="/auth/signout" method="post" className="ml-2 border-l-2 border-slate-950 pl-2">
                  <button
                    type="submit"
                    className="text-xs font-bold text-slate-950 hover:text-red-600 uppercase tracking-widest"
                    title="Sign Out"
                  >
                    EXIT
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="brutal-button px-6 py-2 text-sm"
            >
              Init_Session
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
