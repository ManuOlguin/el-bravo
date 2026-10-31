import { cn } from "@/src/components/ui";

const LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
/** Rampa secuencial de un solo tono (primary) de claro a intenso; 0 = superficie. */
const STEPS = ["bg-surface-2", "bg-primary/20", "bg-primary/40", "bg-primary/65", "bg-primary"];

function step(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
}

/** 7 celdas lunes..domingo con la intensidad según cuántas veces entrenó ese día (de por vida). */
export function WeekdayHeatmap({ byWeekday }: { byWeekday: number[] }) {
  const max = Math.max(...byWeekday, 0);
  const best = max > 0 ? byWeekday.indexOf(max) : -1;
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Entrenamientos por día de la semana">
        {byWeekday.map((v, i) => {
          const s = step(v, max);
          return (
            <li key={LABELS[i]} className="flex flex-col items-center gap-1" aria-label={`${NAMES[i]}: ${v} ${v === 1 ? "entrenamiento" : "entrenamientos"}`} title={`${v} los ${NAMES[i]}`}>
              <span
                aria-hidden="true"
                className={cn(
                  "grid aspect-square w-full max-w-12 place-items-center rounded-lg text-xs font-bold tabular-nums",
                  STEPS[s],
                  s >= 3 ? "text-on-primary" : s === 0 ? "text-fg-subtle" : "text-fg"
                )}
              >
                {v}
              </span>
              <span aria-hidden="true" className="text-[11px] text-fg-subtle">
                {LABELS[i]}
              </span>
            </li>
          );
        })}
      </ol>
      {best >= 0 && <p className="text-sm text-fg-muted">Tu día más fuerte: los {NAMES[best]}.</p>}
    </div>
  );
}
