"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toastResult, useConfirm } from "@/src/components/ui";
import { deleteGroupAction } from "@/src/server/actions/groups";

type Props = {
  groupId: string;
  groupName: string;
};

export default function DeleteGroupButton({ groupId, groupName }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    const ok = await confirm({
      title: `¿Borrar "${groupName}"?`,
      description: "Se borran los miembros, las temporadas y sus puntos. No se puede deshacer.",
      confirmLabel: "Borrar grupo",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteGroupAction(groupId);
      if (toastResult(r)) {
        router.push("/home");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="danger" pending={pending} onClick={onDelete} title="Solo admins">
      Borrar grupo
    </Button>
  );
}
