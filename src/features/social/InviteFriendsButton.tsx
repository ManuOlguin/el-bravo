"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui";
import { InviteFriendsSheet } from "./InviteFriendsSheet";

/** Botón + sheet para invitar amigos a un grupo (lo cablea W2-2 en la página del grupo). */
export function InviteFriendsButton({ groupId, memberIds, label = "Invitar amigos" }: { groupId: string; memberIds: string[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <InviteFriendsSheet groupId={groupId} open={open} onClose={() => setOpen(false)} memberIds={memberIds} />
    </>
  );
}
