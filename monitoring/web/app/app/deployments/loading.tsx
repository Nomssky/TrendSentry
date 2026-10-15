// Skeleton for /app/deployments.
//
// Design spec: *status rows*. The page is a max-w-3xl column: a row list of
// existing bots, then a "create" form. Both are reflected here.

import { Skeleton } from "@/app/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading deployments">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 border-b border-line p-5 last:border-b-0"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}