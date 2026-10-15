// Skeleton for /app/deployments/[id].
//
// Design spec: *header + two columns*. The page shows the deployment name, a
// status block, config, and a recent-signals list.

import { Skeleton } from "@/app/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-label="Loading deployment">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>

        <div className="space-y-3 rounded-2xl border border-line p-5">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="space-y-2 border-b border-line pb-3 last:border-b-0">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}