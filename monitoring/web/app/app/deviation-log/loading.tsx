// Skeleton for /app/deviation-log (Activity).
//
// Design spec says *timeline*; the built page is a four-column table
// (Severity, Rule, Expected, Actual). The skeleton has to mirror what actually
// renders, so this is the table. If Activity is meant to become a timeline the
// page and this file change together.

import { Skeleton } from "@/app/components/ui";

const COLUMNS = [
  { label: "Severity", w: "w-20" },
  { label: "Rule", w: "w-40" },
  { label: "Expected", w: "w-48" },
  { label: "Actual", w: "flex-1" },
];

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-9 w-40" />

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-4 py-2.5">
                  <Skeleton className={`h-3 ${col.w}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-t border-line">
                <td className="px-4 py-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-36" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-44" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}