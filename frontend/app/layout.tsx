import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Footer from './components/Footer';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Trustless OSS — Automated Bounties for Open Source',
  description:
    'Trustless, milestone-based rewards for OSS contributors. GitHub PR merged → funds automatically released via Trustless Work escrow.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jbMono.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-950 font-sans antialiased selection:bg-blue-600 selection:text-white">
        <div className="min-h-screen border-[12px] border-slate-950 flex flex-col relative">
          {/* Subtle geometric dot grid overlay */}
          <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-dot-drift" style={{ backgroundImage: 'radial-gradient(#2563eb 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="relative z-10 flex-1 flex flex-col">
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
