type AnimatedLogoSize = 'tiny' | 'nav' | 'sm' | 'md' | 'lg';

interface AnimatedLogoProps {
  size?: AnimatedLogoSize;
  className?: string;
  animated?: boolean;
  showOrbiters?: boolean;
}

const sizeConfig: Record<
  AnimatedLogoSize,
  {
    box: string;
    shadowOffset: string;
    motionClass: string;
    orbiterSquare: string;
    orbiterDot: string;
  }
> = {
  tiny: {
    box: 'h-4 w-4 border-2 text-[10px]',
    shadowOffset: 'translate(3px, 3px)',
    motionClass: 'animate-logo-diagonal-tiny',
    orbiterSquare: '-right-1 -top-1 h-2 w-2 border',
    orbiterDot: '-bottom-1 -left-1 h-1.5 w-1.5 border',
  },
  nav: {
    box: 'h-8 w-8 border-4 text-xl',
    shadowOffset: 'translate(5px, 5px)',
    motionClass: 'animate-logo-diagonal-nav',
    orbiterSquare: '-right-1 -top-1 h-2.5 w-2.5 border-2',
    orbiterDot: '-bottom-1 -left-1 h-2 w-2 border-2',
  },
  sm: {
    box: 'h-9 w-9 border-4 text-lg',
    shadowOffset: 'translate(6px, 6px)',
    motionClass: 'animate-logo-diagonal-sm',
    orbiterSquare: '-right-1.5 -top-1.5 h-3 w-3 border-2',
    orbiterDot: '-bottom-1.5 -left-1.5 h-2.5 w-2.5 border-2',
  },
  md: {
    box: 'h-16 w-16 border-4 text-3xl',
    shadowOffset: 'translate(8px, 8px)',
    motionClass: 'animate-logo-diagonal-md',
    orbiterSquare: '-right-2 -top-2 h-4 w-4 border-2',
    orbiterDot: '-bottom-2 -left-2 h-3 w-3 border-2',
  },
  lg: {
    box: 'h-24 w-24 border-4 text-5xl',
    shadowOffset: 'translate(10px, 10px)',
    motionClass: 'animate-logo-diagonal-lg',
    orbiterSquare: '-right-2.5 -top-2.5 h-5 w-5 border-2',
    orbiterDot: '-bottom-2.5 -left-2.5 h-4 w-4 border-2',
  },
};

export default function AnimatedLogo({
  size = 'md',
  className = '',
  animated = true,
  showOrbiters = true,
}: AnimatedLogoProps) {
  const config = sizeConfig[size];
  const motionClass = animated ? config.motionClass : '';

  return (
    <div className={`relative inline-flex ${className}`.trim()}>
      <div
        className="absolute inset-0 border-4 border-slate-950 bg-blue-600 animate-pulse-brutal"
        style={{ transform: config.shadowOffset }}
      />
      <div
        className={`relative z-10 flex items-center justify-center border-slate-950 bg-slate-950 font-mono font-black text-white ${config.box} ${motionClass}`.trim()}
      >
        T
      </div>

      {showOrbiters && size !== 'tiny' && (
        <>
          <div
            className={`absolute ${config.orbiterSquare} animate-spin rounded-none border-slate-950 bg-white`}
          />
          <div
            className={`absolute ${config.orbiterDot} animate-ping rounded-full border-slate-950 bg-blue-600`}
          />
        </>
      )}
    </div>
  );
}
