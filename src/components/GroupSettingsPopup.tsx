"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import LeaveGroupButton from "@/src/components/LeaveGroupButton";
import DeleteGroupButton from "@/src/components/DeleteGroupButton";
import { Avatar, Button, Modal, Pill, toastResult, useConfirm } from "@/src/components/ui";
import { formatDate } from "@/src/lib/time";
import { kickMemberAction, setMemberRoleAction } from "@/src/server/actions/groups";

export type GroupSettingsMember = { userId: string; name: string | null; photoUrl?: string | null; role: string };

type GroupSettingsPopupProps = {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  activeMemberCount: number;
  createdAt: Date;
  members?: GroupSettingsMember[];
  currentUserId?: string;
};

function MemberRow({ groupId, member, canManage }: { groupId: string; member: GroupSettingsMember; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [rolePending, startRole] = useTransition();
  const [kickPending, startKick] = useTransition();
  const isAdmin = member.role === "admin";
  const name = member.name ?? "Este miembro";

  function toggleRole() {
    startRole(async () => {
      const r = await setMemberRoleAction(groupId, member.userId, isAdmin ? "member" : "admin");
      if (toastResult(r)) router.refresh();
    });
  }

  async function kick() {
    const ok = await confirm({
      title: `¿Expulsar a ${name}?`,
      description: "Sale del grupo y de las temporadas en curso. Para volver va a necesitar una invitación tuya.",
      confirmLabel: "Expulsar",
      danger: true,
    });
    if (!ok) return;
    startKick(async () => {
      const r = await kickMemberAction(groupId, member.userId);
      if (toastResult(r)) router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <Avatar name={member.name} src={member.photoUrl ?? null} size="sm" href={`/u/${member.userId}`} />
      <Link href={`/u/${member.userId}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
        {member.name ?? "Usuario"}
      </Link>
      {isAdmin && <Pill tone="primary">Admin</Pill>}
      {canManage && (
        <div className="flex w-full justify-end gap-2 sm:w-auto">
          <Button size="sm" variant="secondary" pending={rolePending} onClick={toggleRole}>
            {isAdmin ? "Quitar admin" : "Hacer admin"}
          </Button>
          <Button size="sm" variant="danger" pending={kickPending} onClick={kick}>
            Expulsar
          </Button>
        </div>
      )}
    </li>
  );
}

export default function GroupSettingsPopup({
  open,
  onClose,
  groupId,
  groupName,
  isAdmin,
  activeMemberCount,
  createdAt,
  members = [],
  currentUserId,
}: GroupSettingsPopupProps) {
  const others = members.filter((m) => m.userId !== currentUserId);
  return (
    <Modal open={open} onClose={onClose} title="Configuración del grupo">
      <div className="space-y-4">
        {isAdmin && (
          <section className="rounded-card border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">Miembros</p>
              <Link href={`/group/${groupId}/edit`} className="text-sm font-semibold text-primary">
                Editar grupo
              </Link>
            </div>
            {others.length === 0 ? (
              <p className="text-sm text-fg-muted">Todavía no hay otros miembros.</p>
            ) : (
              <ul className="divide-y divide-border">
                {others.map((m) => (
                  <MemberRow key={m.userId} groupId={groupId} member={m} canManage />
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-card border border-border bg-surface-2 p-4">
          <p className="mb-3 font-semibold">Tu participación</p>
          <LeaveGroupButton groupId={groupId} isAdmin={isAdmin} activeMemberCount={activeMemberCount} />
        </section>

        {isAdmin && (
          <section className="rounded-card border border-danger/40 bg-danger/10 p-4">
            <p className="font-semibold text-danger">Administración del grupo</p>
            <p className="mb-3 mt-1 text-sm text-fg-muted">Esta acción elimina el grupo y expulsa a sus miembros.</p>
            <DeleteGroupButton groupId={groupId} groupName={groupName} />
          </section>
        )}

        <p className="border-t border-border pt-3 text-sm text-fg-subtle">
          Creado: {formatDate(new Date(createdAt), Intl.DateTimeFormat().resolvedOptions().timeZone, "long")}
        </p>
      </div>
    </Modal>
  );
}
