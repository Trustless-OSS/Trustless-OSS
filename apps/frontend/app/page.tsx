import { createClient } from '@/lib/supabase/server';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-[calc(100vh-24px)] flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar user={user} />

      <main className="flex-1 flex flex-col w-full px-6 md:px-12 pt-4 pb-32">
        <HeroSection user={user} />

        <div className="w-full border-t-[4px] border-slate-950 mb-32 border-dashed"></div>

        {/* Feature Grid */}
        <section className="mb-32">
          <div className="flex justify-between items-end mb-16 border-b-[4px] border-slate-950 pb-4">
            <h2 className="title-brutal text-4xl md:text-6xl text-slate-950">WORKFLOW_</h2>
            <div className="label-brutal text-slate-500">ARCHITECTURE</div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'FUND_ESCROW',
                desc: 'Maintainer deposits USDC into a Trustless Work multi-release escrow for their repository.',
                metric: 'USDC',
              },
              {
                step: '02',
                title: 'LABEL_ISSUES',
                desc: 'Add `rewarded` + difficulty labels to issues. The bot reserves funds automatically.',
                metric: 'LABEL',
              },
              {
                step: '03',
                title: 'AUTO_RELEASE',
                desc: 'Contributor merges a PR. Webhook fires, funds released to their Stellar wallet instantly.',
                metric: 'MERGE',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white brutal-border p-8 brutal-shadow relative">
                <div className="absolute top-0 right-0 bg-blue-600 text-white font-mono font-bold px-3 py-1 border-b-4 border-l-4 border-slate-950">
                  {item.step}
                </div>
                <div className="text-5xl font-black text-slate-200 mb-6 font-mono tracking-tighter">
                  {item.metric}
                </div>
                <h3 className="title-brutal text-2xl text-slate-950 mb-4">{item.title}</h3>
                <p className="text-slate-700 font-medium font-mono text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles/Labels Table */}
        <section className="mb-32">
          <div className="bg-slate-200 brutal-border p-8 md:p-12 brutal-shadow">
            <div className="flex justify-between items-center mb-8 border-b-[4px] border-slate-950 pb-4">
              <h2 className="title-brutal text-3xl md:text-4xl text-slate-950">REWARD_MATRIX</h2>
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-950 text-white">
                    <th className="p-4 border-r-4 border-slate-950 font-bold tracking-widest uppercase">
                      Label_ID
                    </th>
                    <th className="p-4 border-r-4 border-slate-950 font-bold tracking-widest uppercase">
                      Base_Allocation
                    </th>
                    <th className="p-4 font-bold tracking-widest uppercase">Parameters</th>
                  </tr>
                </thead>
                <tbody className="bg-white border-4 border-t-0 border-slate-950">
                  {[
                    {
                      label: 'low',
                      amount: '1.00 USDC',
                      note: 'Small fixes, typos',
                      cls: 'diff-low',
                    },
                    {
                      label: 'medium',
                      amount: '2.00 USDC',
                      note: 'Feature additions',
                      cls: 'diff-medium',
                    },
                    {
                      label: 'high',
                      amount: '3.00 USDC',
                      note: 'Complex features',
                      cls: 'diff-high',
                    },
                    {
                      label: 'custom',
                      amount: 'custom amount set by maintainer',
                      note: 'Variable addition',
                      cls: 'status-active',
                    },
                  ].map((row, i) => (
                    <tr
                      key={row.label}
                      className={i !== 3 ? 'border-b-[4px] border-slate-950' : ''}
                    >
                      <td className="p-4 border-r-[4px] border-slate-950">
                        <span
                          className={`inline-block px-3 py-1 border-2 border-slate-950 font-black uppercase text-sm ${row.cls}`}
                        >
                          {row.label}
                        </span>
                      </td>
                      <td className="p-4 border-r-[4px] border-slate-950 font-black text-lg">
                        {row.amount}
                      </td>
                      <td className="p-4 text-slate-600 font-medium text-sm">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
