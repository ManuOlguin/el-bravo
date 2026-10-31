"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [pending, setPending] = useState(false);

  // Sin useTransition/useOptimistic a propósito: React entrelaza las transiciones async con la del
  // router que aplica el árbol revalidado por la acción, y en perfiles con grupos en común ese
  // render quedaba suspendido, así que el botón no salía nunca de "Cargando…" (lo encontró el E2E social).
  async function onClick() {
    const follow = !state.isFollowing;
    if (!follow) {
      const ok = await confirm({
        title: `¿Dejar de seguir${userName ? ` a ${userName}` : ""}?`,
        confirmLabel: "Dejar de seguir",
      });
      if (!ok) return;
    }
    const before = state;
    setState({ isFollowing: follow, isFriend: follow && followsMe }); // optimista
    setPending(true);
    try {
      const r = follow ? await followAction(userId) : await unfollowAction(userId);
      if (!r.ok) {
        setState(before);
        toast.error(r.error);
        return;
      }
      setState(r.data.isFollowing ? { isFollowing: true, isFriend: r.data.isFriend } : { isFollowing: false, isFriend: false });
      router.refresh(); // contadores del perfil (fuera de cualquier transición propia)
    } catch {
      setState(before);
      toast.error("No pudimos conectarnos. Probá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const label = state.isFriend ? "Amigos ✓" : state.isFollowing ? "Siguiendo ✓" : "Seguir";
  return (
    <Button
      variant={state.isFollowing ? "secondary" : "primary"}
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={onClick}
      aria-pressed={state.isFollowing}
    >
      {label}
    </Button>
  );
}
