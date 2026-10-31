"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button, toast, useConfirm, type ButtonSize } from "@/src/components/ui";
import { followAction, unfollowAction } from "@/src/server/actions/social";

type FollowState = { isFollowing: boolean; isFriend: boolean };

/** "Seguir" / "Siguiendo ✓" / "Amigos ✓". Optimista; si falla, revierte y muestra el error. */
export function FollowButton({
  userId,
  userName,
  isFollowing,
  followsMe,
  size = "md",
  fullWidth,
}: {
  userId: string;
  userName?: string | null;
  isFollowing: boolean;
  followsMe: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, setState] = useState<FollowState>({ isFollowing, isFriend: isFollowing && followsMe });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, startTransition] = useTransition();

  async function onClick() {
    const follow = !optimistic.isFollowing;
    if (!follow) {
      const ok = await confirm({
        title: `¿Dejar de seguir${userName ? ` a ${userName}` : ""}?`,
        confirmLabel: "Dejar de seguir",
      });
      if (!ok) return;
    }
    startTransition(async () => {
      setOptimistic({ isFollowing: follow, isFriend: follow && followsMe });
      const r = follow ? await followAction(userId) : await unfollowAction(userId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setState(r.data.isFollowing ? { isFollowing: true, isFriend: r.data.isFriend } : { isFollowing: false, isFriend: false });
      router.refresh(); // contadores del perfil
    });
  }

  const label = optimistic.isFriend ? "Amigos ✓" : optimistic.isFollowing ? "Siguiendo ✓" : "Seguir";
  return (
    <Button
      variant={optimistic.isFollowing ? "secondary" : "primary"}
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={onClick}
      aria-pressed={optimistic.isFollowing}
    >
      {label}
    </Button>
  );
}
