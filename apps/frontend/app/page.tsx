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
      </main>
    </div>
  );
}
