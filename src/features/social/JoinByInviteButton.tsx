"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toastResult } from "@/src/components/ui";
import { joinGroupByInviteTokenAction } from "@/src/server/actions/groups";

export function JoinByInviteButton({ token, groupName }: { token: string; groupName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      fullWidth
      pending={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await joinGroupByInviteTokenAction(token);
          if (toastResult(r)) router.push(`/group/${r.data.groupId}`);
        })
      }
    >
      Unirme a {groupName}
    </Button>
  );
}
