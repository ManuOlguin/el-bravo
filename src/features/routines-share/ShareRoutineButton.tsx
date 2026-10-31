"use client";
import { useTransition } from "react";
import { Button, toast } from "@/src/components/ui";
import { getRoutineForEditorAction } from "@/src/server/actions/routines";
import { routineToText } from "./format";

/** Comparte la rutina como texto El Bravo: hoja nativa del celular (WhatsApp, etc.) o, si no hay, copia al portapapeles. */
export function ShareRoutineButton({ routineId, url, size = "sm" }: { routineId: string; url?: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      variant="secondary"
      pending={pending}
      onClick={() =>
        start(async () => {
          const r = await getRoutineForEditorAction(routineId);
          if (!r.ok) return void toast.error(r.error);
          const text = routineToText(r.data, { url });
          try {
            if (navigator.share) await navigator.share({ title: r.data.name, text });
            else {
              await navigator.clipboard.writeText(text);
              toast.success("Rutina copiada: pegala en WhatsApp");
            }
          } catch (e) {
            if ((e as { name?: string }).name !== "AbortError") toast.error("No pudimos compartir la rutina.");
          }
        })
      }
    >
      Compartir
    </Button>
  );
}
