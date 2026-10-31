"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toast, toastResult, useConfirm, type ButtonProps } from "@/src/components/ui";
import {
  deleteSeasonAction,
  finalizeSeasonAction,
  publishSeasonResultsAction,
  reopenSeasonAction,
} from "@/src/server/actions/seasons";

type Common = { seasonId: string; size?: ButtonProps["size"]; fullWidth?: boolean };

/** Reabrir una temporada finalizada (borra premios y vuelve a calcular). */
export function ReopenSeasonButton({ seasonId, size, fullWidth }: Common) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={async () => {
        const okToGo = await confirm({
          title: "¿Reabrir la temporada?",
          description: "Se borran los premios entregados y los resultados dejan de estar publicados. Los puntos se vuelven a calcular.",
          confirmLabel: "Reabrir",
          danger: true,
        });
        if (!okToGo) return;
        start(async () => {
          if (toastResult(await reopenSeasonAction(seasonId))) router.refresh();
        });
      }}
    >
      Reabrir temporada
    </Button>
  );
}

/** Borrar la temporada (con sus puntos). Vuelve a la página del grupo. */
export function DeleteSeasonButton({ seasonId, groupId, size, fullWidth }: Common & { groupId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={async () => {
        const okToGo = await confirm({
          title: "¿Borrar la temporada?",
          description: "Se borran el ranking y los premios de esta temporada para todos. Los entrenamientos no se borran.",
          confirmLabel: "Borrar",
          danger: true,
        });
        if (!okToGo) return;
        start(async () => {
          if (toastResult(await deleteSeasonAction(seasonId))) {
            router.push(`/group/${groupId}`);
            router.refresh();
          }
        });
      }}
    >
      Borrar temporada
    </Button>
  );
}

/** Terminar la temporada ahora (antes de la fecha de fin). En modo auto publica sola. */
export function FinalizeSeasonButton({ seasonId, size, fullWidth, auto }: Common & { auto: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={async () => {
        const okToGo = await confirm({
          title: "¿Cerrar la temporada ahora?",
          description: auto
            ? "Se congelan los puntos, se entregan los premios y todos ven los resultados. Los entrenamientos que se carguen después no cuentan."
            : "Se congelan los puntos y se calculan los premios. Después los publicás cuando quieras.",
          confirmLabel: "Cerrar temporada",
          danger: true,
        });
        if (!okToGo) return;
        start(async () => {
          if (toastResult(await finalizeSeasonAction(seasonId))) router.refresh();
        });
      }}
    >
      Cerrar temporada ahora
    </Button>
  );
}

/**
 * "Publicar resultados" (modo manual). Si la temporada terminó pero todavía no se cerró, primero la
 * finaliza (premios incluidos) y después publica.
 */
export function PublishResultsButton({ seasonId, finalized, size = "lg", fullWidth = true }: Common & { finalized: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      pending={pending}
      onClick={async () => {
        const okToGo = await confirm({
          title: "¿Publicar los resultados?",
          description: "Todos los miembros van a ver el podio, los premios y la tabla final. Los puntos quedan congelados.",
          confirmLabel: "Publicar",
        });
        if (!okToGo) return;
        start(async () => {
          if (!finalized) {
            const f = await finalizeSeasonAction(seasonId);
            if (!f.ok) {
              toast.error(f.error);
              return;
            }
          }
          if (toastResult(await publishSeasonResultsAction(seasonId))) router.refresh();
        });
      }}
    >
      Publicar resultados 🎉
    </Button>
  );
}
