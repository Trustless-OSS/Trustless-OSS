import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Navbar from './components/Navbar';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-[calc(100vh-24px)] flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar user={user} />

      <main className="flex-1 flex flex-col w-full px-6 md:px-12 pt-20 pb-32">
        {/* Hero Section */}
        <section className="flex flex-col max-w-6xl mt-12 mb-32 border-l-8 border-slate-950 pl-8 md:pl-16 relative">
          <div className="absolute -left-[5px] top-0 w-2 h-20 bg-blue-600"></div>

          <div className="label-brutal mb-8 bg-slate-950 text-white inline-flex px-3 py-1 w-fit brutal-shadow">
            SYS.STATUS // OPERATIONAL
          </div>

          <h1 className="text-5xl md:text-8xl lg:text-[7rem] font-black leading-[0.85] tracking-tighter mb-8 text-slate-950 uppercase italic">
            Automated<br />
            <span className="text-blue-600">Bounties</span><br />
            For OSS.
          </h1>

          <div className="terminal-block max-w-3xl mb-12 brutal-shadow">
            <span className="text-blue-400">const</span> <span className="text-white">protocol</span> = <span className="text-green-400">"Trustless Escrow"</span>;<br />
            <span className="text-slate-500">// Fund GitHub issues with USDC</span><br />
            <span className="text-slate-500">// PR Merge triggers automatic on-chain release</span><br />
            <span className="text-blue-400">await</span> <span className="text-yellow-200">executeRelease</span>();
          </div>

          <div className="flex flex-col sm:flex-row gap-6 max-w-xl">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="brutal-button px-8 py-5 text-lg w-full sm:w-auto"
            >
              {user ? "ACCESS_DASHBOARD" : "INIT_PROTOCOL"}
            </Link>
            
            <a
              href="https://docs.trustlesswork.com"
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-button-outline px-8 py-5 text-lg w-full sm:w-auto"
            >
              READ_DOCS
            </a>
          </div>
        </section>

        <div className="w-full border-t-[4px] border-slate-950 mb-32 border-dashed"></div>

        {/* Feature Grid */}
        <section className="mb-32">
          <div className="flex justify-between items-end mb-16 border-b-[4px] border-slate-950 pb-4">
            <h2 className="title-brutal text-4xl md:text-6xl text-slate-950">
              WORKFLOW_
            </h2>
            <div className="label-brutal text-slate-500">ARCHITECTURE</div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'FUND_ESCROW',
                desc: 'Maintainer deposits USDC into a Trustless Work multi-release escrow for their repository.',
                metric: 'USDC'
              },
              {
                step: '02',
                title: 'LABEL_ISSUES',
                desc: 'Add `rewarded` + difficulty labels to issues. The bot reserves funds automatically.',
                metric: 'LABEL'
              },
              {
                step: '03',
                title: 'AUTO_RELEASE',
                desc: 'Contributor merges a PR. Webhook fires, funds released to their Stellar wallet instantly.',
                metric: 'MERGE'
              },
            ].map((item) => (
              <div key={item.step} className="bg-white brutal-border p-8 brutal-shadow relative">
                <div className="absolute top-0 right-0 bg-blue-600 text-white font-mono font-bold px-3 py-1 border-b-4 border-l-4 border-slate-950">
                  {item.step}
                </div>
                <div className="text-6xl font-black text-slate-200 mb-6 font-mono tracking-tighter">
                  {item.metric}
                </div>
                <h3 className="title-brutal text-2xl text-slate-950 mb-4">{item.title}</h3>
                <p className="text-slate-700 font-medium font-mono text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles/Labels Table */}
        <section className="mb-32">
          <div className="bg-slate-200 brutal-border p-8 md:p-12 brutal-shadow">
            <div className="flex justify-between items-center mb-8 border-b-[4px] border-slate-950 pb-4">
              <h2 className="title-brutal text-3xl md:text-4xl text-slate-950">
                REWARD_MATRIX
              </h2>
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-950 text-white">
                    <th className="p-4 border-r-4 border-slate-950 font-bold tracking-widest uppercase">Label_ID</th>
                    <th className="p-4 border-r-4 border-slate-950 font-bold tracking-widest uppercase">Base_Allocation</th>
                    <th className="p-4 font-bold tracking-widest uppercase">Parameters</th>
                  </tr>
                </thead>
                <tbody className="bg-white border-4 border-t-0 border-slate-950">
                  {[
                    { label: 'low', amount: '0.01 USDC', note: 'Small fixes, typos', cls: 'diff-low' },
                    { label: 'medium', amount: '75.0 USDC', note: 'Feature additions', cls: 'diff-medium' },
                    { label: 'high', amount: '150.0 USDC', note: 'Complex features', cls: 'diff-high' },
                    { label: 'bonus:N', amount: '+N USDC', note: 'Variable addition', cls: 'status-active' },
                  ].map((row, i) => (
                    <tr key={row.label} className={i !== 3 ? "border-b-[4px] border-slate-950" : ""}>
                      <td className="p-4 border-r-[4px] border-slate-950">
                        <span className={`inline-block px-3 py-1 border-2 border-slate-950 font-black uppercase text-sm ${row.cls}`}>
                          {row.label}
                        </span>
                      </td>
                      <td className="p-4 border-r-[4px] border-slate-950 font-black text-lg">{row.amount}</td>
                      <td className="p-4 text-slate-600 font-medium text-sm">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-[4px] border-slate-950 bg-white py-8 px-6 font-mono text-sm font-bold uppercase">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="tracking-widest">© {new Date().getFullYear()} TRUSTLESS <span className="text-blue-600">OSS</span> [V1.0.0]</p>
          <div className="flex gap-8 mt-4 sm:mt-0">
            <a href="https://github.com/Trustless-OSS" className="hover:text-blue-600 hover:underline underline-offset-4 decoration-4 transition-colors">GITHUB_REPO</a>
            <a href="https://trustlesswork.com" className="hover:text-blue-600 hover:underline underline-offset-4 decoration-4 transition-colors">TRUSTLESS_WORK</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
