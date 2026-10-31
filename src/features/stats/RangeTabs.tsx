"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Spinner, Tabs } from "@/src/components/ui";
import type { StatsRange } from "@/src/server/stats";

const TABS: { id: StatsRange; label: string }[] = [
  { id: "4w", label: "4 semanas" },
  { id: "12w", label: "12 semanas" },
  { id: "all", label: "Todo" },
];

/** Selector de rango de /stats: actualiza `?range=` (lo lee la página en el server). */
export function RangeTabs({ value }: { value: StatsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);
  return (
    <div className="flex items-center gap-2">
      <Tabs
        aria-label="Rango"
        tabs={TABS}
        value={optimistic}
        className="flex-1"
        onChange={(id) =>
          startTransition(() => {
            setOptimistic(id);
            router.replace(id === "12w" ? pathname : `${pathname}?range=${id}`, { scroll: false });
          })
        }
      />
      {pending && <Spinner size={16} />}
    </div>
  );
}
