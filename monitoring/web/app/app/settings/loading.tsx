// Skeleton for /app/settings.
//
// Design spec: *forms only - no metrics*. This was the clearest failure of the
// shared skeleton, which rendered four metric cards and a chart before snapping
// into a password form.

import { Skeleton } from "@/app/components/ui";

function FieldGroup({ label, fields }: { label: string; fields: number }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <Skeleton className="h-6 w-48" aria-label={label} />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-11 w-32 rounded-full" />
    </section>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-9 w-40" />
      <FieldGroup label="Exchange connection" fields={3} />
      <FieldGroup label="Account password" fields={3} />
    </div>
  );
}