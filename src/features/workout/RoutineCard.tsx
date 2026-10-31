"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, IconButton, LinkButton, Pill, Sheet, toast, useConfirm } from "@/src/components/ui";
import { GROUP_LABEL } from "@/src/features/exercises";
import { CopyRoutineButton } from "@/src/features/routines-share/CopyRoutineButton";
import { ShareRoutineButton } from "@/src/features/routines-share/ShareRoutineButton";
import type { RoutineVisibility } from "@/src/schemas/routine";
import { deleteRoutineAction } from "@/src/server/actions/routines";
import { MoreIcon, PlayIcon, TrashIcon } from "./icons";
import { CopiedFromNote, RoutineCounts, VisibilityPill } from "./RoutineMeta";

/** Tarjeta de `/routines`: "Empezar" (en vivo) es la acción principal; Editar, Compartir y ⋯ → Borrar. */
export function RoutineCard({
  routine,
  lastUsedLabel,
  shareUrl,
}: {
  routine: {
    id: string;
    name: string;
    exerciseCount: number;
    setCount: number;
    groupKeys: string[];
    visibility: RoutineVisibility;
    copiedFromUserName: string | null;
  };
  lastUsedLabel: string | null;
  /** Link absoluto para el pie del texto de Compartir; solo si la rutina es pública. */
  shareUrl?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();

  const onDelete = async () => {
    setMenu(false);
    const yes = await confirm({
      title: `¿Borrar «${routine.name}»?`,
      description: "Los entrenamientos que hiciste con esta rutina no se borran.",
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!yes) return;
    start(async () => {
      const r = await deleteRoutineAction(routine.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Rutina borrada");
      router.refresh();
    });
  };

  return (
    <Card as="li" className={pending ? "opacity-50" : undefined}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">
            <Link href={`/routines/${routine.id}`} className="hover:underline">
              {routine.name}
            </Link>
          </h2>
          <RoutineCounts exerciseCount={routine.exerciseCount} setCount={routine.setCount} />
          <CopiedFromNote userName={routine.copiedFromUserName} />
          <p className="text-xs text-fg-subtle">{lastUsedLabel ? `Última vez: ${lastUsedLabel}` : "Todavía no la usaste"}</p>
        </div>
        <IconButton label={`Opciones de ${routine.name}`} onClick={() => setMenu(true)}>
          <MoreIcon />
        </IconButton>
      </div>
      {(routine.visibility === "public" || routine.groupKeys.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VisibilityPill visibility={routine.visibility} />
          {routine.groupKeys.map((k) => (
            <Pill key={k}>{GROUP_LABEL[k] ?? k}</Pill>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <LinkButton href={`/routines/${routine.id}/live`} className="flex-1">
          <PlayIcon size={16} />
          Empezar
        </LinkButton>
        <LinkButton href={`/routines/${routine.id}/edit`} variant="secondary">
          Editar
        </LinkButton>
        <ShareRoutineButton routineId={routine.id} url={shareUrl} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
        <div className="space-y-1">
          <LinkButton href={`/workout/new?routine=${routine.id}`} variant="ghost" fullWidth className="justify-start">
            Registrar un entrenamiento ya hecho con esta rutina
          </LinkButton>
          <CopyRoutineButton
            routineId={routine.id}
            label="Duplicar rutina"
            variant="ghost"
            fullWidth
            className="justify-start"
            onDone={() => setMenu(false)}
          />
          <button
            type="button"
            onClick={onDelete}
            className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-danger transition-[transform,background-color] duration-100 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
          >
            <TrashIcon size={16} />
            Borrar rutina
          </button>
        </div>
      </Sheet>
    </Card>
  );
}
