'use client';

import AnimatedLogo from './AnimatedLogo';

export default function LoadingLogo({
  size = 'md',
  message = 'LOADING_SYSTEM...',
  variant = 'square',
}: {
  size?: 'tiny' | 'sm' | 'md' | 'lg';
  message?: string;
  variant?: 'square' | 'circle';
}) {
  const sizeClasses = {
    tiny: 'w-4 h-4 text-[10px] border-2',
    sm: 'w-8 h-8 text-xl',
    md: 'w-16 h-16 text-3xl',
    lg: 'w-24 h-24 text-5xl',
  };

  const isTiny = size === 'tiny';

  if (variant === 'circle') {
    return (
      <div
        className={`relative ${sizeClasses[size]} rounded-full border-slate-950 border-t-blue-600 animate-spin`}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      <AnimatedLogo size={size} showOrbiters={!isTiny} />

      {!isTiny && (
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-slate-950 animate-pulse">
            {message}
          </span>
          <div className="w-32 h-1 bg-slate-200 border border-slate-950 overflow-hidden">
            <div className="h-full bg-blue-600 animate-scan-loading" />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan-loading {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-scan-loading {
          width: 60%;
          animation: scan-loading 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
