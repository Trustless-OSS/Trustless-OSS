import React from 'react';
import { ShieldCheck, Link2, Mail, Bug } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t-[4px] border-slate-950 bg-white py-12 px-6 font-mono text-xs font-bold uppercase relative z-10 text-slate-950">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
        
        {/* Column 1: Branding */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.ico" alt="Trustless Logo" className="w-10 h-10 object-contain" />
            <div className="flex flex-col leading-none">
              <span className="text-base tracking-widest">TRUSTLESS <span className="text-blue-600">OSS</span></span>
              <span className="text-[0.65rem] text-slate-500 tracking-wider">ON-CHAIN ESCROW PROTOCOL</span>
            </div>
          </div>
          <p className="text-slate-500 text-[0.65rem] leading-relaxed mt-2 max-w-[250px]">
            © {new Date().getFullYear()} TRUSTLESS OSS PROTOCOL INC. ALL ESCROWS AUTOMATED VIA SMART-CONTRACT DEPLOYMENT.
          </p>
        </div>

        {/* Column 2: Resources */}
        <div className="flex flex-col gap-4">
          <h3 className="text-slate-500 tracking-widest mb-2">// RESOURCES</h3>
          <a
            href="https://docs.trustlessoss.io/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-blue-600 transition-colors group w-fit"
          >
            <ShieldCheck className="w-4 h-4 text-green-500 group-hover:text-blue-600 transition-colors" />
            Security Audit Report
          </a>
          <a
            href="https://stellar.expert/explorer/public"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-blue-600 transition-colors group w-fit"
          >
            <Link2 className="w-4 h-4 text-orange-500 group-hover:text-blue-600 transition-colors" />
            Contract Explorers
          </a>
        </div>

        {/* Column 3: System Status */}
        <div className="flex flex-col gap-4">
          <h3 className="text-slate-500 tracking-widest mb-2">// SYSTEM STATUS</h3>
          <div className="flex items-start gap-3">
            <div className="relative flex h-3 w-3 mt-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-green-600 font-black tracking-widest">SYS_OK</span>
              <span className="text-slate-500 tracking-wider text-[0.65rem]">v1.0.0 [OPERATIONAL]</span>
            </div>
          </div>
        </div>

        {/* Column 4: Support & Contact */}
        <div className="flex flex-col gap-4">
          <h3 className="text-slate-500 tracking-widest mb-2">// SUPPORT & CONTACT</h3>
          <a
            href="mailto:support@trustlessoss.io"
            className="flex items-center gap-2 hover:text-blue-600 transition-colors group w-fit"
          >
            <Mail className="w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors" />
            support@trustlessoss.io
          </a>
          <a
            href="https://github.com/Trustless-OSS/Trustless-OSS/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-blue-600 transition-colors group w-fit"
          >
            <Bug className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            GitBounty Bug Tracker
          </a>
          <div className="mt-4 pt-4 border-t border-slate-200 border-dashed w-full text-slate-500 text-[0.65rem] tracking-widest">
            DEVELOPED_BY:{' '}
            <a
              href="https://github.com/ryzen-xp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-950 hover:text-blue-600 underline underline-offset-4 decoration-2"
            >
              RYZEN-XP
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
