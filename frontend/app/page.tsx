import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Navbar from './components/Navbar';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen bg-gray-950 flex flex-col overflow-hidden selection:bg-indigo-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-indigo-900/20 blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-900/20 blur-[150px] pointer-events-none" />

      <Navbar user={user} />

      <main className="flex-1 flex flex-col relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-32">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center mt-12 mb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-medium text-indigo-300 mb-8 backdrop-blur-md shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            Built on Trustless Work · Stellar Network
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tight mb-8 max-w-5xl text-white drop-shadow-2xl">
            Automated bounties <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
              for open source
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-2xl max-w-3xl mb-12 leading-relaxed font-light">
            Fund GitHub issues with USDC escrow. When a contributor merges a PR,{' '}
            <strong className="text-gray-100 font-semibold">funds release automatically</strong> — no trust required.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center w-full max-w-md mx-auto">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="group relative px-8 py-4 rounded-xl bg-white text-gray-950 font-bold text-lg overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {user ? "Go to Dashboard" : "Get started free"}
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-200 to-purple-200 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </Link>
            
            <a
              href="https://docs.trustlesswork.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-lg transition-all backdrop-blur-md flex items-center justify-center gap-2 group hover:text-white"
            >
              How it works
            </a>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mb-32">
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-16 text-white tracking-tight">
            A seamless experience for maintainers
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🏦',
                step: '01',
                title: 'Fund escrow',
                desc: 'Maintainer deposits USDC into a Trustless Work multi-release escrow for their repository.',
              },
              {
                icon: '🏷️',
                step: '02',
                title: 'Label issues',
                desc: 'Add `rewarded` + difficulty labels to issues. The bot reserves funds automatically.',
              },
              {
                icon: '⚡',
                step: '03',
                title: 'Merge → Release',
                desc: 'Contributor merges a PR. Webhook fires, funds released to their Stellar wallet instantly.',
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-3xl bg-gray-900/50 border border-white/10 p-8 hover:bg-gray-800/80 transition-all duration-500 overflow-hidden backdrop-blur-sm">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                <div className="text-4xl mb-6">{item.icon}</div>
                <div className="text-sm font-black text-indigo-500/50 mb-2 tracking-widest">
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles/Labels Table */}
        <section className="relative z-10 max-w-4xl mx-auto w-full">
          <div className="rounded-3xl bg-gray-900/50 border border-white/10 p-8 md:p-12 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white tracking-tight flex items-center gap-3">
              <span className="text-indigo-400">🏷️</span> Label → Reward Defaults
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500 uppercase tracking-wider text-xs font-bold">
                    <th className="pb-4 pr-4 font-semibold">GitHub Label</th>
                    <th className="pb-4 px-4 font-semibold">Base Amount</th>
                    <th className="pb-4 pl-4 font-semibold text-right">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { label: 'low', amount: '0.01 USDC', note: 'Small fixes, typos', cls: 'diff-low' },
                    { label: 'medium', amount: '75 USDC', note: 'Feature additions', cls: 'diff-medium' },
                    { label: 'high', amount: '150 USDC', note: 'Complex features', cls: 'diff-high' },
                    { label: 'bonus:N', amount: '+N USDC', note: 'Added on top of base', cls: 'status-active' },
                  ].map((row) => (
                    <tr key={row.label} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-5 pr-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-mono font-medium ${row.cls}`}>
                          {row.label}
                        </span>
                      </td>
                      <td className="py-5 px-4 font-mono text-white/90 text-sm">{row.amount}</td>
                      <td className="py-5 pl-4 text-gray-400 text-sm text-right font-light">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 text-center text-sm text-gray-600 bg-black/50 backdrop-blur-lg relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-6">
          <p>© {new Date().getFullYear()} Trustless OSS. All rights reserved.</p>
          <div className="flex gap-6 mt-4 sm:mt-0">
            <a href="https://github.com/Trustless-OSS" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://trustlesswork.com" className="hover:text-white transition-colors">Trustless Work</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
