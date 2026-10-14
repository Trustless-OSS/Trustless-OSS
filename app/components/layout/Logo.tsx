import Image from 'next/image';

type LogoSize = 'tiny' | 'nav' | 'sm' | 'md' | 'lg';

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

const sizeConfig: Record<LogoSize, string> = {
  tiny: 'h-4 w-4',
  nav: 'h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14',
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 ${sizeConfig[size]} ${className}`.trim()}
    >
      <Image
        src="/toss-logo.png"
        alt=""
        width={1254}
        height={1254}
        unoptimized
        className="h-full w-full scale-[1.2] object-contain"
      />
    </span>
  );
}
