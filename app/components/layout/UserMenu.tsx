'use client';

import Link from 'next/link';
import { Check, ChevronDown, LayoutDashboard, LogOut, Menu, UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function UserMenu({ user }: { user: User }) {
  const name = user.user_metadata?.user_name ?? user.email?.split('@')[0] ?? 'Account';
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initial = name[0]?.toUpperCase() ?? 'U';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              aria-label={`Open settings for ${name}`}
              className="h-9 gap-1.5 rounded-md border-border bg-card px-1.5 text-foreground shadow-sm hover:border-primary/40 hover:shadow-md sm:pr-2.5"
            >
              <span className="relative hidden sm:inline-flex">
                <Avatar className="size-6 sm:size-7">
                  {avatar ? (
                    <AvatarImage src={avatar} alt="" className="object-cover object-center" />
                  ) : null}
                  <AvatarFallback className="bg-foreground text-[10px] font-semibold text-background">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute -right-0.5 -bottom-0.5 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"
                  aria-hidden="true"
                >
                  <Check className="size-2" strokeWidth={3} />
                </span>
              </span>
              <span className="hidden max-w-[7.5rem] truncate text-sm font-medium sm:inline">
                {name}
              </span>
              <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:inline" />
              <Menu className="size-5 sm:hidden" strokeWidth={2.25} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open settings</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 min-w-56">
        <DropdownMenuLabel className="font-medium text-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard aria-hidden="true" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem variant="destructive" asChild>
            <button type="submit">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
