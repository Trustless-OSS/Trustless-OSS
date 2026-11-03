import { ArrowLeft } from 'lucide-react';
import TransactionHistory from '@/app/components/dashboard/TransactionHistory';
import Button from '@/app/components/ui/Button';

export default function ActivityPage() {
  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="max-w-5xl">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Activity
          </h1>
        </div>
        <Button
          href="/dashboard"
          variant="outline"
          size="sm"
          className="border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Dashboard
        </Button>
      </div>

      <TransactionHistory />
    </div>
  );
}
