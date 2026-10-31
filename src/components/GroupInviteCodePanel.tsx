"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Modal, toast, toastResult } from "@/src/components/ui";
import { formatDateTime } from "@/src/lib/time";
import { getInviteCodeAction, regenerateInviteCodeAction } from "@/src/server/actions/groups";

type GroupInviteCodePanelProps = {
  groupId: string;
  open: boolean;
  onClose: () => void;
};

function browserTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default function GroupInviteCodePanel({ groupId, open, onClose }: GroupInviteCodePanelProps) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, startLoading] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

  // Traer el código vigente (o crear uno) cuando se abre.
  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const r = await getInviteCodeAction(groupId);
      if (r.ok) {
        setCode(r.data.code);
        setExpiresAt(new Date(r.data.expiresAt));
      } else toast.error(r.error);
    });
  }, [open, groupId]);

  function regenerate() {
    startRegenerate(async () => {
      const r = await regenerateInviteCodeAction(groupId);
      if (toastResult(r)) {
        setCode(r.data.code);
        setExpiresAt(new Date(r.data.expiresAt));
      }
    });
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado.");
    } catch {
      toast.error("No pudimos copiar el código.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Código de invitación">
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">Compartilo para que se unan al grupo. No distingue mayúsculas.</p>
        <div className="flex items-center gap-2">
          <div className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-surface-2 font-mono text-xl tracking-[0.3em]">
            {loading && !code ? "…" : (code ?? "— — — —")}
          </div>
          <Button onClick={copy} disabled={!code}>
            Copiar
          </Button>
        </div>
        {expiresAt && <p className="text-xs text-fg-subtle">Vence el {formatDateTime(expiresAt, browserTz())}.</p>}
        <Button variant="secondary" fullWidth pending={regenerating} onClick={regenerate}>
          Generar código nuevo
        </Button>
      </div>
    </Modal>
  );
}
