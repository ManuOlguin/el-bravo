"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, toast, type ButtonSize, type ButtonVariant } from "@/src/components/ui";
import { refreshCatalogIfLoaded } from "@/src/features/exercises/useExerciseCatalog";
import { copyRoutineAction } from "@/src/server/actions/routines";

/** "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia): crea una rutina privada y lleva a /routines. */
export function CopyRoutineButton({
  routineId,
  label,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  onDone,
}: {
  routineId: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Tras copiar con éxito el botón sigue deshabilitado hasta que la navegación lo desmonte (evita un segundo toque = otra copia).
  const [done, setDone] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      pending={pending}
      disabled={done}
      onClick={() =>
        start(async () => {
          try {
            const r = await copyRoutineAction(routineId);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            setDone(true);
            toast.success(r.message ?? "Rutina copiada");
            onDone?.();
            router.push("/routines");
            router.refresh();
            // La copia puede haber creado ejercicios propios: después del push (una server action antes cuelga la cola del router).
            refreshCatalogIfLoaded();
          } catch {
            toast.error("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
          }
        })
      }
    >
      {label}
    </Button>
  );
}
