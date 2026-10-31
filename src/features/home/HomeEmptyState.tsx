import Link from "next/link";
import { Card, cn } from "@/src/components/ui";
import { LOG_WORKOUT_HREF } from "./QuickStart";

type Step = { title: string; description: string; href: string; done: boolean };

/** Primeros pasos para un usuario nuevo (sin entrenamientos). */
export function HomeEmptyState({ hasGroup, hasRoutine }: { hasGroup: boolean; hasRoutine: boolean }) {
  const steps: Step[] = [
    { title: "Unite o creá un grupo", description: "Competí por temporadas con tus amigos.", href: "/groups", done: hasGroup },
    { title: "Registrá tu primer entrenamiento", description: "Cualquier actividad suma.", href: LOG_WORKOUT_HREF, done: false },
    { title: "Creá una rutina", description: "Para arrancar más rápido la próxima vez.", href: "/routines/new", done: hasRoutine },
  ];
  return (
    <Card as="section" className="space-y-3">
      <h2 className="text-lg font-bold">Arrancá en 3 pasos</h2>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 transition-[transform,background-color] duration-100 hover:bg-surface-3 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                  s.done ? "bg-primary text-on-primary" : "border-2 border-border text-fg-muted"
                )}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-semibold", s.done && "text-fg-muted line-through")}>{s.title}</span>
                <span className="block text-sm text-fg-muted">{s.description}</span>
              </span>
              {s.done && <span className="sr-only">(hecho)</span>}
              <span aria-hidden="true" className="text-fg-subtle">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
