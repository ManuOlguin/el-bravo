"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Sheet, Spinner, toast, toastResult, useConfirm } from "@/src/components/ui";
import { formatDateTime } from "@/src/lib/time";
import { getInviteCodeAction, regenerateInviteCodeAction } from "@/src/server/actions/groups";
import { InviteFriendsSheet } from "@/src/features/social/InviteFriendsSheet";

function browserTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Link que se comparte: abre /groups/join con el código cargado. */
export function inviteLink(code: string) {
  return `${window.location.origin}/groups/join?code=${encodeURIComponent(code)}`;
}

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error("No pudimos copiar. Copialo a mano.");
  }
}

/**
 * Invitar al grupo (solo admins): código grande, copiar, compartir (`navigator.share` con fallback a
 * copiar el link), regenerar e invitar amigos sin código.
 */
export function InviteSheet({
  groupId,
  groupName,
  memberIds,
  open,
  onClose,
}: {
  groupId: string;
  groupName: string;
  memberIds: string[];
  open: boolean;
  onClose(): void;
}) {
  const confirm = useConfirm();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [loading, startLoading] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

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

  async function share() {
    if (!code) return;
    const url = inviteLink(code);
    const text = `Sumate a "${groupName}" en El Bravo. Código: ${code}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "El Bravo", text, url });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return; // el usuario cerró el menú
      }
    }
    await copyText(`${text}\n${url}`, "Copiamos la invitación. Pegala donde quieras.");
  }

  async function regenerate() {
    const okToGo = await confirm({
      title: "¿Generar un código nuevo?",
      description: "El código actual deja de funcionar. Los que ya están en el grupo no se ven afectados.",
      confirmLabel: "Generar nuevo",
      danger: true,
    });
    if (!okToGo) return;
    startRegenerate(async () => {
      const r = await regenerateInviteCodeAction(groupId);
      if (toastResult(r)) {
        setCode(r.data.code);
        setExpiresAt(new Date(r.data.expiresAt));
      }
    });
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Invitar al grupo">
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">Pasales este código o compartí el link. No distingue mayúsculas.</p>
          <div
            className="flex h-20 items-center justify-center rounded-card bg-surface-2 font-mono text-3xl font-bold tracking-[0.25em] select-all"
            aria-live="polite"
          >
            {loading && !code ? <Spinner /> : (code ?? "—")}
          </div>
          {expiresAt && <p className="text-center text-xs text-fg-subtle">Vence el {formatDateTime(expiresAt, browserTz())}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={!code} onClick={() => code && copyText(code, "Código copiado")}>
              Copiar código
            </Button>
            <Button disabled={!code} onClick={share}>
              Compartir
            </Button>
          </div>
          <Button variant="secondary" fullWidth onClick={() => setFriendsOpen(true)}>
            Invitar amigos de la app
          </Button>
          <Button variant="ghost" fullWidth pending={regenerating} onClick={regenerate}>
            Generar código nuevo
          </Button>
        </div>
      </Sheet>
      <InviteFriendsSheet groupId={groupId} open={friendsOpen} onClose={() => setFriendsOpen(false)} memberIds={memberIds} />
    </>
  );
}
