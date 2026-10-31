"use client";

import { useState } from "react";
import { Button, Card, toast } from "@/src/components/ui";
import { formatDate } from "@/src/lib/time";
import { unregisterDeviceAction } from "@/src/server/actions/devices";
import type { PushDeviceView } from "@/src/server/notifications/push";

const PLATFORM: Record<PushDeviceView["platform"], string> = { web: "Navegador", android: "Android", ios: "iPhone" };

/** Dispositivos que reciben push, con "Quitar". */
export function DeviceList({ devices, tz }: { devices: PushDeviceView[]; tz: string }) {
  const [items, setItems] = useState(devices);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(id: string) {
    setRemoving(id);
    const r = await unregisterDeviceAction(id);
    setRemoving(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((d) => d.id !== id));
    toast.success(r.message ?? "Dispositivo quitado");
  }

  if (items.length === 0) return null;
  return (
    <Card className="space-y-2">
      <p className="font-semibold">Dispositivos con notificaciones</p>
      <ul className="divide-y divide-border">
        {items.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{d.label || PLATFORM[d.platform]}</span>
              <span className="block text-xs text-fg-muted">Desde el {formatDate(new Date(d.createdAt), tz, "short")}</span>
            </span>
            <Button variant="ghost" size="sm" pending={removing === d.id} onClick={() => remove(d.id)}>
              Quitar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
