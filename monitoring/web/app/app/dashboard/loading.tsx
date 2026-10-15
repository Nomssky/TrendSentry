// Skeleton for /app/dashboard.
//
// Design spec ("Loading States" board): *metrics then chart*. This mirrors the
// real screen — bot health, setup checklist, four performance metrics, the score
// trend chart, then recent activity. A skeleton that shows a different shape
// than the page it replaces is what causes layout shift on arrival.

import { Skeleton } from "@/app/components/ui";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-9 w-56" />

      <section className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-64 w-full" />
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-32 w-full" />
      </section>
    </div>
  );
}