"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton, toast, useConfirm } from "@/src/components/ui";
import { deleteActivityAction } from "@/src/server/actions/activities";

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

/** Borra un entrenamiento (con confirmación). Los puntos y las insignias se recalculan en el servidor. */
export function DeleteWorkoutButton({
  activityId,
  variant = "button",
  redirectTo,
}: {
  activityId: string;
  variant?: "button" | "icon";
  /** Adónde ir después de borrar (por defecto, refresca la página actual). */
  redirectTo?: string;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();

  const onClick = async () => {
    const yes = await confirm({
      title: "¿Borrar este entrenamiento?",
      description: "Se recalculan tus puntos e insignias. No se puede deshacer.",
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!yes) return;
    start(async () => {
      const r = await deleteActivityAction(activityId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const lost = r.data.effects.scoring.reduce((n, s) => n + Math.max(0, s.totalBefore - s.totalAfter), 0);
      const downgraded = r.data.effects.badges.filter((b) => b.levelAfter < b.levelBefore).map((b) => b.name);
      toast.success(lost > 0 ? `Entrenamiento borrado (−${lost} pts)` : "Entrenamiento borrado", {
        description: downgraded.length ? `Bajaste de nivel en: ${downgraded.join(", ")}` : undefined,
      });
      if (redirectTo) router.replace(redirectTo);
      else router.refresh();
    });
  };

  if (variant === "icon") {
    return (
      <IconButton label="Borrar entrenamiento" onClick={onClick} pending={pending} className="hover:bg-danger/15 hover:text-danger">
        <TrashIcon />
      </IconButton>
    );
  }
  return (
    <Button variant="danger" onClick={onClick} pending={pending}>
      <TrashIcon />
      Borrar
    </Button>
  );
}
