'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NotificationBell from '@/app/components/layout/NotificationBell';
import UserMenu from '@/app/components/layout/UserMenu';

const iconBtn =
  'size-9 shrink-0 rounded-md border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:shadow-md';

export default function AccountBar({ user }: { user: User }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center gap-2 sm:gap-2.5" data-testid="account-bar">
        <UserMenu user={user} />
        <NotificationBell />
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
      </div>
    </TooltipProvider>
  );
}
