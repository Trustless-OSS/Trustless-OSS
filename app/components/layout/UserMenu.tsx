'use client';

import Link from 'next/link';
import {
  BookText,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
} from 'lucide-react';
import { DOCS_URL } from '@/lib/links';
import { FaGithub, FaXTwitter } from 'react-icons/fa6';
import type { User } from '@supabase/supabase-js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { STATUS_PAGE_URL } from '@/lib/health';

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
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 min-w-64 p-1.5">
        {/* Profile header */}
        <DropdownMenuItem asChild className="gap-3 rounded-lg p-2">
          <Link href="/profile" aria-label="Profile">
            <Avatar className="size-9">
              {avatar ? (
                <AvatarImage src={avatar} alt="" className="object-cover object-center" />
              ) : null}
              <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground">View profile</span>
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LayoutDashboard aria-hidden="true" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
              <BookText aria-hidden="true" />
              Documentation
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Resources
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href="https://github.com/Trustless-OSS" target="_blank" rel="noopener noreferrer">
              <FaGithub aria-hidden="true" />
              GitHub
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="https://x.com/Trustless_OSS" target="_blank" rel="noopener noreferrer">
              <FaXTwitter aria-hidden="true" />X (Twitter)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer">
              <LifeBuoy aria-hidden="true" />
              API status
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Account
        </DropdownMenuLabel>
        <form action="/auth/signout" method="post">
          <DropdownMenuItem variant="destructive" asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
