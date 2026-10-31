"use client";

import { useState } from "react";
import { Card, Switch, toast } from "@/src/components/ui";
import { updatePreferenceAction } from "@/src/server/actions/notifications";
import type { Channel, PreferenceRow } from "@/src/server/notifications/preferences";

const CHANNEL_LABELS: Record<Channel, string> = { inApp: "App", email: "Email", push: "Push" };

/**
 * Preferencias por tipo (Switch por canal) + resumen semanal. Guarda cada cambio al instante
 * (optimista; si falla, vuelve atrás y avisa con un toast).
 */
export function PreferencesForm({
  initialRows,
  initialWeeklyDigest,
  channels = ["inApp", "email"],
}: {
  initialRows: PreferenceRow[];
  initialWeeklyDigest: boolean;
  channels?: Channel[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [digest, setDigest] = useState(initialWeeklyDigest);
  const [saving, setSaving] = useState<string | null>(null);

  async function change(type: PreferenceRow["type"], channel: Channel, value: boolean) {
    const key = `${type}:${channel}`;
    setSaving(key);
    setRows((prev) => prev.map((r) => (r.type === type ? { ...r, [channel]: value } : r)));
    const res = await updatePreferenceAction({ type, channel, value });
    setSaving(null);
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.type === type ? { ...r, [channel]: !value } : r)));
      toast.error(res.error);
    }
  }

  async function changeDigest(value: boolean) {
    setSaving("digest");
    setDigest(value);
    const res = await updatePreferenceAction({ type: "weekly_digest", channel: "email", value });
    setSaving(null);
    if (!res.ok) {
      setDigest(!value);
      toast.error(res.error);
    } else toast.success(value ? "Te vamos a mandar el resumen los lunes" : "Listo, no te mandamos más el resumen");
  }

  return (
    <div className="space-y-4">
      <Card>
        <Switch
          checked={digest}
          disabled={saving === "digest"}
          onChange={changeDigest}
          label="Resumen semanal por email"
          description="Los lunes: tus posiciones, tus entrenamientos y las novedades de la semana."
        />
      </Card>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.type}>
            <Card className="space-y-3">
              <div>
                <p className="font-semibold">{r.label}</p>
                <p className="text-sm text-fg-muted">{r.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-x-3">
                {channels.map((ch) => (
                  <Switch
                    key={ch}
                    className="justify-start gap-2"
                    checked={r[ch]}
                    disabled={saving === `${r.type}:${ch}`}
                    onChange={(v) => change(r.type, ch, v)}
                    label={CHANNEL_LABELS[ch]}
                  />
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
