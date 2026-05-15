'use client';

export default function LoadingLogo({ size = 'md', message = 'LOADING_SYSTEM...' }: { size?: 'sm' | 'md' | 'lg', message?: string }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xl',
    md: 'w-16 h-16 text-3xl',
    lg: 'w-24 h-24 text-5xl',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      <div className="relative">
        {/* Animated Shadow Layer */}
        <div 
          className={`absolute inset-0 bg-blue-600 border-4 border-slate-950 animate-pulse-brutal`}
          style={{ transform: 'translate(8px, 8px)' }}
        />
        
        {/* Main Logo Box */}
        <div className={`${sizeClasses[size]} bg-slate-950 text-white font-black flex items-center justify-center border-4 border-slate-950 relative z-10 animate-bounce-slow`}>
          T
        </div>

        {/* Orbiting Elements */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-slate-950 animate-spin duration-1000" />
        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-600 border-2 border-slate-950 animate-ping" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-slate-950 animate-pulse">
          {message}
        </span>
        <div className="w-32 h-1 bg-slate-200 border border-slate-950 overflow-hidden">
          <div className="h-full bg-blue-600 animate-scan-loading" />
        </div>
      </div>

      <style jsx>{`
        @keyframes scan-loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-scan-loading {
          width: 60%;
          animation: scan-loading 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
