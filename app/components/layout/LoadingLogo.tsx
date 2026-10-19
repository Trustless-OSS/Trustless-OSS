'use client';

import Logo from './Logo';

export default function LoadingLogo({
  size = 'md',
  message = 'Loading...',
  variant = 'square',
}: {
  size?: 'tiny' | 'sm' | 'md' | 'lg';
  message?: string;
  variant?: 'square' | 'circle';
}) {
  const sizeClasses = {
    tiny: 'h-4 w-4 border-2',
    sm: 'h-8 w-8 border-2',
    md: 'h-16 w-16 border-2',
    lg: 'h-24 w-24 border-2',
  };

  if (variant === 'circle') {
    return (
      <span
        className={`${sizeClasses[size]} inline-block rounded-full border-border border-t-primary animate-spin`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="loading-orbit relative">
        <span className="loading-orbit-ring" aria-hidden="true" />
        <Logo size={size} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">{message}</p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
