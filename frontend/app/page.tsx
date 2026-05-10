import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-indigo-950/30 to-gray-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          <span className="font-bold text-lg tracking-tight gradient-text">Trustless OSS</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Dashboard →
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Sign in with GitHub
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-indigo-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          Built on Trustless Work · Stellar Network
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold leading-tight mb-6 max-w-4xl">
          <span className="gradient-text">Automated bounties</span>
          <br />
          for open source
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Fund GitHub issues with USDC escrow. When a contributor merges a PR,{' '}
          <strong className="text-gray-200">funds release automatically</strong> — no trust required.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all hover:scale-105 shadow-lg shadow-indigo-900/40"
          >
            Get started free →
          </Link>
          <a
            href="https://docs.trustlesswork.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 rounded-xl glass hover:bg-white/5 text-gray-300 font-semibold text-base transition-all"
          >
            How it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12 text-gray-100">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🏦',
                step: '1',
                title: 'Fund escrow',
                desc: 'Maintainer deposits USDC into a Trustless Work multi-release escrow for their repo.',
              },
              {
                icon: '🏷️',
                step: '2',
                title: 'Label issues',
                desc: 'Add `rewarded` + difficulty labels to issues. Bot reserves funds automatically.',
              },
              {
                icon: '🚀',
                step: '3',
                title: 'Merge → Release',
                desc: "Contributor merges a PR. Webhook fires, funds released to their Stellar wallet instantly.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="glass rounded-2xl p-7 glow-hover"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <div className="text-xs font-bold text-indigo-400 mb-2 tracking-widest uppercase">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles table */}
      <section className="relative z-10 px-6 pb-24">
        <div className="max-w-3xl mx-auto glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6 text-gray-100">Label → Reward defaults</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="text-left pb-3">Label</th>
                  <th className="text-left pb-3">Base Amount</th>
                  <th className="text-left pb-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { label: 'low', amount: '0.01 USDC', note: 'Small fixes, typos', cls: 'diff-low' },
                  { label: 'medium', amount: '75 USDC', note: 'Feature additions', cls: 'diff-medium' },
                  { label: 'high', amount: '150 USDC', note: 'Complex features', cls: 'diff-high' },
                  { label: 'bonus:N', amount: '+N USDC', note: 'Added on top of base', cls: 'status-active' },
                ].map((row) => (
                  <tr key={row.label} className="text-gray-300">
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${row.cls}`}>{row.label}</span>
                    </td>
                    <td className="py-3 font-mono text-white">{row.amount}</td>
                    <td className="py-3 text-gray-400">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
