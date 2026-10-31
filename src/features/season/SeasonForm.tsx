"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Field, Input, NumberInput, Tabs, Textarea, cn, toast } from "@/src/components/ui";
import { createSeasonAction, updateSeasonAction } from "@/src/server/actions/seasons";
import { AwardsPicker } from "./AwardsPicker";
import { CategoryWeightsEditor } from "./CategoryWeightsEditor";
import {
  ADVANCED_RULE_KEYS,
  RULE_FIELDS,
  initialSeasonForm,
  mapFieldErrors,
  previewTable,
  summaryLine,
  validateSeasonForm,
  type CategoryOption,
  type FormErrors,
  type SeasonFormState,
} from "./season-form-state";
import { DEFAULT_RULES } from "./types";

type Section = "basic" | "activities" | "awards" | "rules";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "basic", label: "Básico" },
  { id: "activities", label: "Actividades" },
  { id: "awards", label: "Premios" },
  { id: "rules", label: "Reglas" },
];

/** A qué sección pertenece cada error (para saltar a la primera con problemas en mobile). */
function sectionOf(key: string): Section {
  if (key === "categories") return "activities";
  if (key === "awards" || key.startsWith("award.")) return "awards";
  if (key.startsWith("rules.")) return "rules";
  return "basic";
}

function RevealPicker({ value, onChange }: { value: "auto" | "manual"; onChange(v: "auto" | "manual"): void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">Resultados al terminar</p>
      <Tabs<"auto" | "manual">
        aria-label="Resultados al terminar"
        tabs={[
          { id: "auto", label: "Automático" },
          { id: "manual", label: "Lo decide el admin" },
        ]}
        value={value}
        onChange={onChange}
      />
      <p className="text-xs text-fg-subtle">
        {value === "auto"
          ? "Al día siguiente del final se cierran los puntos y todos ven el podio y los premios."
          : "Cuando termina, los miembros esperan y un admin publica los resultados cuando quiera."}
      </p>
    </div>
  );
}

/**
 * Wizard de temporada (crear/editar): en mobile, pasos con Tabs; desde md, todas las secciones juntas.
 * Resumen fijo al pie con los puntos de ejemplo (calculados con `dayPoints` del motor).
 */
export function SeasonForm({
  groupId,
  seasonId,
  categories,
  initial,
  today,
  otherSeasons,
  active = false,
}: {
  groupId: string;
  /** Si está, edita esa temporada. */
  seasonId?: string;
  categories: CategoryOption[];
  initial?: SeasonFormState;
  today: string;
  /** Otras temporadas del grupo (para avisar superposición sin ir al servidor). */
  otherSeasons: { name: string; startDate: string; endDate: string }[];
  /** La temporada está en curso: guardar recalcula los puntos de todos. */
  active?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<SeasonFormState>(() => initial ?? initialSeasonForm(categories, today));
  const [section, setSection] = useState<Section>("basic");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, start] = useTransition();

  // Después del primer intento, los errores se recalculan en vivo.
  const update = (next: SeasonFormState) => {
    setState(next);
    if (submitted) {
      const v = validateSeasonForm(next, groupId, otherSeasons);
      setErrors(v.ok ? {} : v.errors);
    }
  };
  const set = <K extends keyof SeasonFormState>(k: K, v: SeasonFormState[K]) => update({ ...state, [k]: v });
  const setRule = (k: (typeof ADVANCED_RULE_KEYS)[number], v: number | null) => update({ ...state, rules: { ...state.rules, [k]: v } });

  function showErrors(errs: FormErrors) {
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) setSection(sectionOf(first));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const v = validateSeasonForm(state, groupId, otherSeasons);
    if (!v.ok) {
      showErrors(v.errors);
      toast.error("Revisá los campos marcados.");
      return;
    }
    start(async () => {
      const r = seasonId ? await updateSeasonAction(seasonId, v.input) : await createSeasonAction(v.input);
      if (r.ok) {
        toast.success(r.message ?? "Listo");
        const id = seasonId ?? (r.data as { seasonId: string }).seasonId;
        router.push(`/group/${groupId}/season/${id}`);
        router.refresh();
        return;
      }
      const mapped = r.fieldErrors ? mapFieldErrors(r.fieldErrors, state) : {};
      // Errores de regla de negocio sin campo (p. ej. superposición): van a las fechas si hablan de fechas.
      if (!Object.keys(mapped).length && /fecha|superpon/i.test(r.error)) mapped.startDate = r.error;
      showErrors(mapped);
      toast.error(r.error);
    });
  }

  const visible = (id: Section) => (section === id ? "block" : "hidden md:block");
  const errorCount = (id: Section) => Object.keys(errors).filter((k) => sectionOf(k) === id).length;
  const rulesChanged = ADVANCED_RULE_KEYS.some((k) => state.rules[k] !== DEFAULT_RULES[k]);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {active && (
        <p className="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" role="note">
          La temporada está en curso. Al guardar se recalculan los puntos de todos.
        </p>
      )}

      <Tabs<Section>
        className="sticky top-14 z-10 md:hidden"
        aria-label="Secciones"
        tabs={SECTIONS.map((s) => ({
          id: s.id,
          label: (
            <span className="inline-flex items-center gap-1">
              {s.label}
              {errorCount(s.id) > 0 && <span className="h-2 w-2 rounded-full bg-danger" aria-label="con errores" />}
            </span>
          ),
        }))}
        value={section}
        onChange={setSection}
      />

      <Card as="section" className={cn("space-y-4", visible("basic"))}>
        <h2 className="hidden text-lg font-bold md:block">Básico</h2>
        <Field label="Nombre" htmlFor="season-name" error={errors.name}>
          <Input value={state.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Temporada de verano" autoComplete="off" />
        </Field>
        <Field label="Descripción" htmlFor="season-description" hint="Opcional: qué se juegan, reglas de la casa…" error={errors.description}>
          <Textarea value={state.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empieza" htmlFor="season-start" error={errors.startDate}>
            <Input type="date" value={state.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Termina" htmlFor="season-end" error={errors.endDate}>
            <Input type="date" value={state.endDate} min={state.startDate} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo semanal" htmlFor="season-goal" hint="Días por semana." error={errors.weeklyGoal}>
            <NumberInput value={state.weeklyGoal} onChange={(v) => set("weeklyGoal", v)} min={1} max={7} step={1} suffix="días" />
          </Field>
          <Field label="Mínimo por día" htmlFor="season-min" hint="Para que el día cuente." error={errors.minDailyMinutes}>
            <NumberInput value={state.minDailyMinutes} onChange={(v) => set("minDailyMinutes", v)} min={5} max={180} step={1} suffix="min" />
          </Field>
        </div>
        <RevealPicker value={state.resultsReveal} onChange={(v) => set("resultsReveal", v)} />
      </Card>

      <Card as="section" className={cn("space-y-3", visible("activities"))}>
        <h2 className="hidden text-lg font-bold md:block">Actividades</h2>
        <CategoryWeightsEditor state={state} categories={categories} onChange={update} error={errors.categories} />
      </Card>

      <Card as="section" className={cn("space-y-3", visible("awards"))}>
        <h2 className="hidden text-lg font-bold md:block">Premios</h2>
        <AwardsPicker state={state} onChange={update} errors={errors} />
      </Card>

      <Card as="section" className={cn("space-y-3", visible("rules"))}>
        <details open={rulesChanged || ADVANCED_RULE_KEYS.some((k) => errors[`rules.${k}`])} className="group space-y-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold">
            <span>Reglas avanzadas</span>
            <span className="text-sm font-normal text-fg-muted group-open:hidden">Mostrar</span>
          </summary>
          <p className="text-sm text-fg-muted">Si no sabés, dejalo así: son las reglas estándar de El Bravo.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADVANCED_RULE_KEYS.map((k) => {
              const f = RULE_FIELDS[k];
              return (
                <Field key={k} label={f.label} htmlFor={`rule-${k}`} hint={f.hint || undefined} error={errors[`rules.${k}`]}>
                  <NumberInput value={state.rules[k]} onChange={(v) => setRule(k, v)} min={f.min} max={f.max} step={1} suffix={f.suffix} />
                </Field>
              );
            })}
          </div>
          {rulesChanged && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ ...state, rules: Object.fromEntries(ADVANCED_RULE_KEYS.map((k) => [k, DEFAULT_RULES[k]])) as SeasonFormState["rules"] })}
            >
              Volver a las reglas estándar
            </Button>
          )}
        </details>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Tu día → puntos</p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                {previewTable(state).map((p) => (
                  <td key={p.label} className="rounded-lg bg-surface-2 px-2 py-1.5 text-center">
                    <span className="block text-xs text-fg-muted">{p.label}</span>
                    <span className="block font-bold tabular-nums">{p.points}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 sm:bottom-4">
        <Card className="space-y-2 border-primary/40 bg-surface-2 p-3">
          <p className="text-xs leading-snug text-fg-muted" aria-live="polite">
            {summaryLine(state)}
          </p>
          <Button type="submit" fullWidth pending={pending}>
            {seasonId ? "Guardar cambios" : "Crear temporada"}
          </Button>
        </Card>
      </div>
    </form>
  );
}
