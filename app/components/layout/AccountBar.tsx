'use client';

import { useEffect, useState } from 'react';
import { Check, Globe, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NotificationBell from '@/app/components/layout/NotificationBell';
import UserMenu from '@/app/components/layout/UserMenu';
import { createClient } from '@/lib/supabase/client';
import { NETWORKS, useNetwork } from '@/lib/network-config';

const iconBtn =
  'size-9 shrink-0 rounded-md border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:shadow-md';

export default function AccountBar({ user }: { user: User }) {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';
  const [network, setNetwork] = useNetwork();

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? '');
    });
  }, []);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center gap-2 sm:gap-2.5" data-testid="account-bar">
        <UserMenu user={user} />
        <NotificationBell token={token} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={iconBtn}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
        {/* Standalone network button — hidden on mobile; moved into UserMenu there */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={`${iconBtn} hidden sm:inline-flex`}
                  aria-label="Network config"
                >
                  <Globe className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Network config</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" sideOffset={8} className="w-44 p-1.5">
            <DropdownMenuLabel className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Network
            </DropdownMenuLabel>
            {NETWORKS.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => setNetwork(value)}
                className="justify-between"
              >
                {label}
                {network === value ? (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
