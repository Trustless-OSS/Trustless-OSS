import { ArrowUpRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { githubAvatarUrl, githubProfileUrl } from '@/app/components/dashboard/activity';
import { cn } from '@/lib/utils';

export default function GithubUserLink({
  name,
  size = 'default',
  compact = false,
  className,
}: {
  name: string;
  size?: 'sm' | 'default' | 'lg';
  compact?: boolean;
  className?: string;
}) {
  return (
    <a
      href={githubProfileUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`@${name} on GitHub`}
      className={cn(
        'inline-flex min-w-0 items-center font-semibold text-foreground hover:text-primary',
        compact ? 'gap-1.5 text-sm' : 'gap-2.5',
        className
      )}
    >
      <Avatar size={compact ? 'sm' : size} aria-hidden="true">
        <AvatarImage src={githubAvatarUrl(name)} alt="" />
        <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
          {name[0]?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <span aria-hidden="true" className="truncate">
        @{name}
      </span>
      {compact ? null : (
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </a>
  );
}
