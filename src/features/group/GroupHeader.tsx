"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, buttonClasses } from "@/src/components/ui";
import { plural } from "@/src/features/season/format";
import { InviteSheet } from "./InviteSheet";

export function GroupHeader({
  group,
  isAdmin,
}: {
  group: { id: string; name: string; description: string | null; photoUrl: string | null; members: { userId: string }[] };
  isAdmin: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const memberIds = group.members.map((m) => m.userId);
  return (
    <header className="flex items-center gap-3">
      <Avatar name={group.name} src={group.photoUrl} size="lg" className="rounded-2xl" />
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-2 break-words text-2xl font-extrabold leading-tight">{group.name}</h1>
        <p className="text-sm text-fg-muted">{plural(group.members.length, "miembro", "miembros")}</p>
      </div>
      {isAdmin && (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Invitar
          </Button>
          <Link
            href={`/group/${group.id}/settings`}
            aria-label="Configuración del grupo"
            title="Configuración del grupo"
            className={buttonClasses({ variant: "ghost", size: "icon" })}
          >
            <span aria-hidden="true" className="text-lg">
              ⚙️
            </span>
          </Link>
          <InviteSheet groupId={group.id} groupName={group.name} memberIds={memberIds} open={inviteOpen} onClose={() => setInviteOpen(false)} />
        </div>
      )}
    </header>
  );
}
