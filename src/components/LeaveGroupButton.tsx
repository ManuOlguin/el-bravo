"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, toastResult, useConfirm } from "@/src/components/ui";
import { leaveGroupAction } from "@/src/server/actions/groups";

type Props = {
  groupId: string;
  isAdmin: boolean;
  activeMemberCount: number;
};

export default function LeaveGroupButton({ groupId, isAdmin, activeMemberCount }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  // Además del toast, el error se muestra acá: este botón vive dentro de un modal (top layer).
  const [error, setError] = useState<string | null>(null);

  async function onLeave() {
    const isLastMember = activeMemberCount === 1;
    const ok = await confirm(
      isLastMember
        ? {
            title: "¿Salir y borrar el grupo?",
            description: "Sos el único miembro: al salir se borra el grupo con sus temporadas. No se puede deshacer.",
            confirmLabel: "Salir y borrar",
            danger: true,
          }
        : {
            title: "¿Salir del grupo?",
            description: isAdmin
              ? "También vas a salir de las temporadas en curso. Si sos el único admin, primero nombrá a otro."
              : "También vas a salir de las temporadas en curso del grupo.",
            confirmLabel: "Salir",
            danger: true,
          }
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await leaveGroupAction(groupId);
      setError(r.ok ? null : r.error);
      if (toastResult(r)) {
        router.push("/home");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="danger" pending={pending} onClick={onLeave}>
        Salir del grupo
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
          {isAdmin && error.includes("admin") ? " Usá “Hacer admin” en la lista de miembros." : null}
        </p>
      )}
    </div>
  );
}
