"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toastResult, useConfirm } from "@/src/components/ui";
import { deleteGroupAction, leaveGroupAction } from "@/src/server/actions/groups";

/** "Salir del grupo" y, para admins, "Borrar grupo". Ambas con confirmación. */
export function GroupActionsMenu({
  groupId,
  groupName,
  isAdmin,
  memberCount,
  showDelete = isAdmin,
}: {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  memberCount: number;
  showDelete?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [leaving, startLeave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const alone = memberCount <= 1;

  async function leave() {
    const okToGo = await confirm({
      title: `¿Salir de ${groupName}?`,
      description: alone
        ? "Sos el único miembro: si salís, el grupo se borra con todas sus temporadas."
        : "Salís también de las temporadas en curso. Para volver vas a necesitar un código o una invitación.",
      confirmLabel: "Salir",
      danger: true,
    });
    if (!okToGo) return;
    startLeave(async () => {
      const r = await leaveGroupAction(groupId);
      if (toastResult(r)) {
        router.push("/groups");
        router.refresh();
      }
    });
  }

  async function remove() {
    const okToGo = await confirm({
      title: `¿Borrar ${groupName}?`,
      description: "Se borran el grupo, sus temporadas y los rankings para todos. No se puede deshacer. Los entrenamientos de cada uno no se borran.",
      confirmLabel: "Borrar grupo",
      danger: true,
    });
    if (!okToGo) return;
    startDelete(async () => {
      const r = await deleteGroupAction(groupId);
      if (toastResult(r)) {
        router.push("/groups");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="ghost" pending={leaving} onClick={leave} className="sm:flex-1">
        Salir del grupo
      </Button>
      {showDelete && (
        <Button variant="danger" pending={deleting} onClick={remove} className="sm:flex-1">
          Borrar grupo
        </Button>
      )}
    </div>
  );
}
