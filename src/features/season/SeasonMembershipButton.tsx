"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toastResult, useConfirm, type ButtonProps } from "@/src/components/ui";
import { joinSeasonAction, leaveSeasonAction } from "@/src/server/actions/seasons";

/** "Unirme a la temporada" o, si ya estás, "Salir de la temporada" (con confirmación). */
export function SeasonMembershipButton({
  seasonId,
  joined,
  size = "md",
  fullWidth,
}: {
  seasonId: string;
  joined: boolean;
  size?: ButtonProps["size"];
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  async function run() {
    if (joined) {
      const okToGo = await confirm({
        title: "¿Salir de la temporada?",
        description: "Dejás de aparecer en el ranking. Si volvés a unirte antes del final, tus entrenamientos vuelven a contar.",
        confirmLabel: "Salir",
        danger: true,
      });
      if (!okToGo) return;
    }
    start(async () => {
      const r = joined ? await leaveSeasonAction(seasonId) : await joinSeasonAction(seasonId);
      if (toastResult(r)) router.refresh();
    });
  }

  return (
    <Button size={size} fullWidth={fullWidth} variant={joined ? "ghost" : "primary"} pending={pending} onClick={run}>
      {joined ? "Salir de la temporada" : "Unirme a la temporada"}
    </Button>
  );
}
