import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button as UiButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Variant = 'solid' | 'outline' | 'ghost' | 'danger' | 'warning';
type Size = 'sm' | 'md' | 'lg';

const variantMap = {
  solid: 'default',
  outline: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
  warning: 'outline',
} as const;

const variantClass: Record<Variant, string> = {
  solid: '',
  outline: 'border-border bg-card shadow-sm',
  ghost: 'border-border bg-card',
  danger: 'border-destructive bg-destructive text-white hover:bg-destructive/90',
  warning:
    'border-amber-500/30 bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:text-white dark:border-amber-400/20 dark:bg-amber-500 dark:hover:bg-amber-600',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 rounded-md px-3.5 text-sm',
  md: 'h-10 rounded-md px-5 text-sm',
  lg: 'h-12 rounded-md px-6 text-base',
};

type ButtonBase = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = ButtonBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined;
    external?: never;
  };

type ButtonAsLink = ButtonBase & {
  href: string;
  external?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLAnchorElement>['onClick'];
  'aria-label'?: string;
  title?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function isLinkProps(props: ButtonProps): props is ButtonAsLink {
  return 'href' in props && typeof props.href === 'string';
}

export default function Button(props: ButtonProps) {
  const variant = variantMap[props.variant ?? 'solid'];
  const size = props.size ?? 'md';
  const className = cn(
    'font-semibold',
    sizeClass[size],
    variantClass[props.variant ?? 'solid'],
    props.className
  );

  if (isLinkProps(props)) {
    const { href, external, onClick, title, children } = props;
    const ariaLabel = props['aria-label'];

    if (external) {
      return (
        <UiButton variant={variant} className={className} asChild>
          <a
            href={href}
            onClick={onClick}
            title={title}
            aria-label={ariaLabel}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        </UiButton>
      );
    }

    return (
      <UiButton variant={variant} className={className} asChild>
        <Link href={href} onClick={onClick} title={title} aria-label={ariaLabel}>
          {children}
        </Link>
      </UiButton>
    );
  }

  const {
    children,
    variant: _variant,
    size: _size,
    className: _className,
    ...rest
  } = props as ButtonAsButton;

  return (
    <UiButton type="button" variant={variant} className={className} {...rest}>
      {children}
    </UiButton>
  );
}
