import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function ScreenReaderStatus({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>;
}

export function NavbarSkeleton() {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="relative flex flex-col" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading" />
      <NavbarSkeleton />
      <main className="relative flex w-full flex-1 flex-col px-3 pt-7 pb-16 sm:px-5 md:px-6 lg:px-7 lg:pt-14">
        <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)]">
          <div className="max-w-5xl space-y-6">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-16 w-full max-w-xl sm:h-20" />
            <Skeleton className="h-16 w-4/5 max-w-lg sm:h-20" />
            <Skeleton className="h-20 w-full max-w-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-12 w-40 rounded-md" />
              <Skeleton className="h-12 w-36 rounded-md" />
            </div>
          </div>
          <Card className="hidden rounded-3xl py-0 lg:block">
            <CardHeader className="gap-4 border-b border-border/70 py-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="min-h-56 rounded-3xl">
              <CardHeader className="flex-row justify-between">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <Skeleton className="h-10 w-12" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading dashboard" />
      <div className="mb-10 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-56 sm:h-14" />
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <Skeleton className="h-12 w-full rounded-md sm:w-44" />
          <Skeleton className="h-12 w-full rounded-md sm:w-40" />
          <Skeleton className="h-12 w-full rounded-md sm:w-36" />
        </div>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader className="space-y-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
          </CardHeader>
        </Card>
        <div className="grid gap-4">
          <Card className="rounded-3xl">
            <CardHeader className="flex-row justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-md" />
            </CardHeader>
          </Card>
          <Card className="rounded-3xl">
            <CardHeader className="flex-row justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-md" />
            </CardHeader>
          </Card>
        </div>
      </div>
      <Card className="rounded-3xl">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full rounded-xl" />
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TransactionsPageSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading activity" />
      <div className="mb-10 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-64 sm:h-14" />
        </div>
        <Skeleton className="h-12 w-full rounded-md sm:w-44" />
      </div>
      <Card className="rounded-3xl">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ContributorsPageSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading contributors" />
      <div className="mb-10 flex flex-col justify-between gap-7 md:mb-14 md:flex-row md:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-64 sm:h-14" />
        </div>
        <Skeleton className="h-12 w-full rounded-md sm:w-44" />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="rounded-3xl">
            <CardHeader className="space-y-4">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-5 w-28" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-6 w-40 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-3xl">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ReposCardSkeletonGrid({ count = 15 }: { count?: number }) {
  return (
    <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="rounded-3xl">
          <CardHeader className="flex-row items-start justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-36" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReposPageSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading repositories" />
      <div className="mb-8 flex flex-col justify-between gap-4 md:mb-14 md:flex-row md:items-end md:gap-7">
        <Skeleton className="h-12 w-64 sm:h-14" />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
          <Skeleton className="h-11 min-w-0 flex-1 rounded-md sm:w-44 sm:flex-none" />
        </div>
      </div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-56" />
      </div>
      <ReposCardSkeletonGrid count={15} />
    </div>
  );
}

export function RepoDetailSkeleton() {
  return (
    <div className="w-full space-y-10" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading repository" />
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-12 w-64 sm:h-14" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Card className="overflow-hidden rounded-2xl py-0">
        <CardHeader className="border-b border-border py-4">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="w-full space-y-6" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Loading profile" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-full max-w-sm" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-3xl py-0">
            <Skeleton className="h-40 w-full rounded-none" />
            <CardContent className="space-y-5 pb-6">
              <div className="flex items-end gap-4">
                <Skeleton className="-mt-12 h-24 w-24 rounded-full" />
                <div className="space-y-2 pb-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-2xl" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-28 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-3xl">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AuthCardSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <ScreenReaderStatus label={label} />
      <Card className="w-full max-w-md rounded-3xl">
        <CardHeader className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="mx-auto h-3 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

export function FormFieldsSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-live="polite">
      <ScreenReaderStatus label="Verifying assignment" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );
}
