'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import LoadingLogo from '../../components/LoadingLogo';

export default function ConnectRepoPage() {
  const router = useRouter();
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'github-installation-success') {
        router.push('/dashboard');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  const handleInstall = () => {
    setInstalling(true);
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'Trustless-OSS';
    window.open(`https://github.com/apps/${slug}/installations/new`, 'github_install', 'width=600,height=800');
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white brutal-border p-8 md:p-12 brutal-shadow relative text-center">
          {/* Interactive Close Element */}
          {!installing && (
            <button 
              onClick={() => router.back()}
              className="absolute top-0 right-0 w-8 h-8 bg-blue-600 border-b-4 border-l-4 border-slate-950 flex items-center justify-center text-white hover:bg-slate-950 transition-colors cursor-pointer group z-20"
              aria-label="Go back"
            >
              <X size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          )}
          
          <div className="label-brutal mb-6 bg-slate-200 text-slate-950 inline-flex px-3 py-1 border-2 border-slate-950">
            MODULE_INSTALL // REPO_SYNC
          </div>
          
          <div className="w-20 h-20 bg-slate-950 flex items-center justify-center text-white text-4xl font-black brutal-border brutal-shadow-blue mx-auto mb-8 relative border-4 border-slate-950">
            {installing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-600">
                <LoadingLogo size="sm" variant="circle" />
              </div>
            ) : '+'}
          </div>
            
          <h1 className="title-brutal text-3xl text-slate-950 mb-4">
            {installing ? 'INSTALLATION_IN_PROGRESS' : 'INSTALL_GITHUB_APP'}
          </h1>
          
          <div className="terminal-block text-left mb-8 brutal-shadow">
            {installing ? (
              <>
                <span className="text-blue-400">status:</span> <span className="text-white">AWAITING_GITHUB_CALLBACK...</span><br />
                <span className="text-slate-500">// Please complete the installation in the popup window</span>
              </>
            ) : (
              <>
                <span className="text-blue-400">sudo</span> <span className="text-yellow-200">apt-get install</span> <span className="text-white">trustless-bot</span><br />
                <span className="text-slate-500">// Requires repository access permissions</span>
              </>
            )}
          </div>

          <button
            onClick={handleInstall}
            disabled={installing}
            className="brutal-button w-full py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {installing ? (
              <>
                <LoadingLogo size="tiny" variant="circle" />
                <span>WAITING_FOR_APP...</span>
              </>
            ) : (
              'EXECUTE_INSTALLATION'
            )}
          </button>
          
          <div className="mt-8 pt-6 border-t-4 border-slate-950 border-dashed text-center">
            {installing ? (
              <div className="flex flex-col items-center gap-2">
                <LoadingLogo size="sm" message="VERIFYING_PAYLOAD..." />
                <p className="text-[10px] text-blue-600 font-mono font-bold uppercase tracking-widest animate-pulse mt-4">
                  Do not close this window
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest animate-pulse">
                Awaiting user authorization...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
