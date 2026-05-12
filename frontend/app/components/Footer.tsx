import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t-[4px] border-slate-950 bg-white py-8 px-6 font-mono text-sm font-bold uppercase relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center sm:text-left">
          <p className="tracking-widest">© {new Date().getFullYear()} TRUSTLESS <span className="text-blue-600">OSS</span> [V1.0.0]</p>
          <div className="hidden sm:block w-[2px] h-4 bg-slate-300" />
          <p className="text-slate-500">
            DEVELOPED_BY: <a href="https://github.com/ryzen-xp" target="_blank" rel="noopener noreferrer" className="text-slate-950 hover:text-blue-600 underline underline-offset-4 decoration-2">ryzen-xp</a>
          </p>
        </div>
        
        <div className="flex gap-8">
          <a href="https://github.com/Trustless-OSS" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline underline-offset-4 decoration-4 transition-colors">GITHUB_REPO</a>
          <a href="https://trustlesswork.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline underline-offset-4 decoration-4 transition-colors">TRUSTLESS_WORK</a>
        </div>
      </div>
    </footer>
  );
}
