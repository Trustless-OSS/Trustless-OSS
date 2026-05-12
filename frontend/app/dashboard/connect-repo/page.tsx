'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ConnectRepoPage() {
  const router = useRouter();

  useEffect(() => {
    // Listen for the "success" message from the installation tab
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'github-installation-success') {
        router.push('/dashboard?syncing=true');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  const handleInstall = () => {
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'Trustless-OSS';
    // Open GitHub App installation page in a new window
    window.open(`https://github.com/apps/${slug}/installations/new`, 'github_install', 'width=600,height=800');
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full glass rounded-3xl p-10 relative overflow-hidden text-center">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="w-20 h-20 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🚀</span>
            </div>
            
            <h1 className="text-3xl font-extrabold text-white mb-3">Install GitHub App</h1>
            <p className="text-gray-400 text-sm mb-10 leading-relaxed">
              To start rewarding contributors, you need to install our bot on your repository. 
            </p>

            <button
              onClick={handleInstall}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3"
            >
              🔐 Connect to GitHub →
            </button>
            
            <div className="mt-8 pt-8 border-t border-white/5">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest text-center animate-pulse">
                Waiting for installation...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
