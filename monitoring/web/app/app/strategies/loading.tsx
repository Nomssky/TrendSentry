// Skeleton for /app/strategies.
//
// Design spec: *card list*. The page renders strategies as rows inside a
// bordered container, so this is rows, not the metric-card grid the shared
// skeleton used to show.

import { Skeleton } from "@/app/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading strategies">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b border-line p-5 last:border-b-0"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}