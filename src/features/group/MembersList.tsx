"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, CardHeader, IconButton, Pill, Sheet, toastResult, useConfirm } from "@/src/components/ui";
import { kickMemberAction, setMemberRoleAction } from "@/src/server/actions/groups";

export type GroupMemberView = { userId: string; name: string | null; photoUrl: string | null; role: "admin" | "member" };

function MemberActionsSheet({ groupId, member, onClose }: { groupId: string; member: GroupMemberView; onClose(): void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [rolePending, startRole] = useTransition();
  const [kickPending, startKick] = useTransition();
  const isAdmin = member.role === "admin";
  const name = member.name ?? "este miembro";

  function toggleRole() {
    startRole(async () => {
      const r = await setMemberRoleAction(groupId, member.userId, isAdmin ? "member" : "admin");
      if (toastResult(r)) {
        onClose();
        router.refresh();
      }
    });
  }

  async function kick() {
    const okToGo = await confirm({
      title: `¿Expulsar a ${name}?`,
      description: "Sale del grupo y de las temporadas en curso. Para volver va a necesitar una invitación tuya.",
      confirmLabel: "Expulsar",
      danger: true,
    });
    if (!okToGo) return;
    startKick(async () => {
      const r = await kickMemberAction(groupId, member.userId);
      if (toastResult(r)) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={member.name} src={member.photoUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate font-bold">{member.name ?? "Usuario"}</p>
          <p className="text-xs text-fg-muted">{isAdmin ? "Admin" : "Miembro"}</p>
        </div>
      </div>
      <Button variant="secondary" fullWidth pending={rolePending} onClick={toggleRole}>
        {isAdmin ? "Quitar admin" : "Hacer admin"}
      </Button>
      <Button variant="danger" fullWidth pending={kickPending} onClick={kick}>
        Expulsar del grupo
      </Button>
    </div>
  );
}

/** Miembros con su rol. El admin tiene un menú ⋯ por miembro: hacer/quitar admin y expulsar. */
export function MembersList({
  groupId,
  members,
  viewerId,
  isAdmin,
}: {
  groupId: string;
  members: GroupMemberView[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<GroupMemberView | null>(null);
  return (
    <Card className="px-0 pb-2">
      <div className="px-4">
        <CardHeader title="Miembros" subtitle={`${members.length} en el grupo`} />
      </div>
      <ul>
        {members.map((m) => {
          const me = m.userId === viewerId;
          return (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-2">
              <Avatar name={m.name} src={m.photoUrl} size="sm" href={`/u/${m.userId}`} />
              <Link href={`/u/${m.userId}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {m.name ?? "Usuario"}
                {me && <span className="font-normal text-fg-muted"> (vos)</span>}
              </Link>
              {m.role === "admin" && <Pill tone="primary">Admin</Pill>}
              {isAdmin && !me && (
                <IconButton label={`Opciones para ${m.name ?? "este miembro"}`} onClick={() => setSelected(m)}>
                  <span aria-hidden="true" className="text-lg leading-none">
                    ⋯
                  </span>
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {isAdmin && (
        <Sheet open={!!selected} onClose={() => setSelected(null)} title="Opciones del miembro">
          {selected && <MemberActionsSheet groupId={groupId} member={selected} onClose={() => setSelected(null)} />}
        </Sheet>
      )}
    </Card>
  );
}
