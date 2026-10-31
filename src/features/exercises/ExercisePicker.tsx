"use client";
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, EmptyState, Sheet, Skeleton } from "@/src/components/ui";
import { CreateExerciseSheet } from "./CreateExerciseSheet";
import { ExerciseRow } from "./ExerciseRow";
import { recent } from "./recent";
import { normalize, searchExercises } from "./search";
import { useExerciseCatalog } from "./useExerciseCatalog";
import { GROUP_KEYS, GROUP_LABEL, type CatalogEntry, type Equipment, type ExerciseSummary } from "./types";

const EQUIPMENT_FILTERS: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Barra" },
  { id: "dumbbell", label: "Mancuernas" },
  { id: "machine", label: "Máquina" },
  { id: "cable", label: "Polea" },
  { id: "bodyweight", label: "Peso corporal" },
  { id: "cardio", label: "Cardio" },
];

export type ExercisePickerProps = {
  open: boolean;
  onClose(): void;
  /** Se llama al confirmar (tocar una fila sin `multiple`, o "Agregar (N)"); después el picker llama a `onClose()`. */
  onConfirm(exercises: ExerciseSummary[]): void;
  multiple?: boolean;
  title?: string;
};

const toSummary = (e: CatalogEntry): ExerciseSummary => ({
  id: e.id,
  name: e.name,
  nameEn: e.nameEn,
  measureType: e.measureType,
  equipment: e.equipment,
  tracksWeight: e.tracksWeight,
  primaryGroupKey: e.primaryGroupKey,
  mediaUrl: e.mediaUrl,
});

/** Selector de ejercicios tipo Strong: búsqueda tolerante, filtros por grupo y equipamiento, recientes y crear. */
export function ExercisePicker({ open, onClose, onConfirm, multiple = false, title }: ExercisePickerProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title ?? (multiple ? "Agregar ejercicios" : "Elegí un ejercicio")} className="sm:max-w-xl">
      {open && <PickerBody onClose={onClose} onConfirm={onConfirm} multiple={multiple} />}
    </Sheet>
  );
}

function FilterRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-fg-subtle">{children}</h3>;
}

function PickerBody({ onClose, onConfirm, multiple }: Required<Pick<ExercisePickerProps, "onClose" | "onConfirm" | "multiple">>) {
  const { catalog, loading, error, refresh } = useExerciseCatalog();
  const [query, setQuery] = useState("");
  const [groupKey, setGroupKey] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<Equipment | undefined>();
  const [selected, setSelected] = useState<CatalogEntry[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [recentIds] = useState(() => recent.get());
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  // El <dialog> enfoca su primer control al abrirse (después de este efecto): enfocar la búsqueda un frame después.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const filters = { groupKey, equipment };
  const results = useMemo(() => searchExercises(catalog, deferredQuery, { groupKey, equipment }), [catalog, deferredQuery, groupKey, equipment]);
  const browsing = normalize(deferredQuery) === "";
  const showRecent = browsing && !groupKey && !equipment;
  const recentEntries = useMemo(() => {
    if (!showRecent) return [];
    const byId = new Map(catalog.map((e) => [e.id, e]));
    return recentIds.map((id) => byId.get(id)).filter((e): e is CatalogEntry => !!e);
  }, [catalog, recentIds, showRecent]);

  const confirm = (list: CatalogEntry[]) => {
    if (list.length === 0) return;
    recent.push(list.map((e) => e.id));
    onConfirm(list.map(toSummary));
    onClose();
  };

  const select = (e: CatalogEntry) => {
    if (!multiple) return confirm([e]);
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  };

  const isSelected = (id: string) => selected.some((s) => s.id === id);
  const trimmed = query.trim();

  const renderRows = (list: CatalogEntry[], withLetters: boolean) =>
    list.map((e, i) => {
      const letterOf = (x: CatalogEntry) => normalize(x.name).charAt(0).toUpperCase() || "#";
      const l = letterOf(e);
      const showHeader = withLetters && (i === 0 || letterOf(list[i - 1]) !== l);
      return (
        <Fragment key={e.id}>
          {showHeader && (
            <li role="presentation">
              <SectionTitle>{l}</SectionTitle>
            </li>
          )}
          <ExerciseRow exercise={e} selected={isSelected(e.id)} onSelect={select} />
        </Fragment>
      );
    });

  return (
    <div className="flex min-h-[calc(90dvh-7rem)] flex-col">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 space-y-2 border-b border-border bg-surface-1 px-4 pb-3 pt-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Buscar ejercicio"
            placeholder="Buscar (también en inglés)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-10 text-base text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-fg-muted hover:text-fg active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <FilterRow label="Grupo muscular">
          <Chip size="sm" selected={!groupKey} onClick={() => setGroupKey(undefined)}>
            Todos
          </Chip>
          {GROUP_KEYS.map((g) => (
            <Chip key={g} size="sm" selected={groupKey === g} onClick={() => setGroupKey(groupKey === g ? undefined : g)}>
              {GROUP_LABEL[g]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Equipamiento">
          <Chip size="sm" selected={!equipment} onClick={() => setEquipment(undefined)}>
            Todos
          </Chip>
          {EQUIPMENT_FILTERS.map((f) => (
            <Chip key={f.id} size="sm" selected={equipment === f.id} onClick={() => setEquipment(equipment === f.id ? undefined : f.id)}>
              {f.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="flex-1 py-2">
        {loading ? (
          <div className="space-y-3 pt-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-2">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
            <span className="sr-only">Cargando ejercicios…</span>
          </div>
        ) : error ? (
          <EmptyState
            title="No pudimos cargar los ejercicios"
            description={error}
            action={
              <Button size="sm" variant="secondary" onClick={refresh}>
                Reintentar
              </Button>
            }
          />
        ) : results.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={trimmed ? `No encontramos «${trimmed}»` : "No hay ejercicios con esos filtros"}
            description={trimmed ? "Probá con otra palabra o crealo vos." : undefined}
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                {trimmed ? `+ Crear «${trimmed}»` : "+ Crear ejercicio"}
              </Button>
            }
          />
        ) : (
          <>
            {recentEntries.length > 0 && (
              <section aria-label="Recientes">
                <SectionTitle>Recientes</SectionTitle>
                <ul className="space-y-0.5">{renderRows(recentEntries, false)}</ul>
                <SectionTitle>Todos</SectionTitle>
              </section>
            )}
            <ul className="space-y-0.5" aria-label={browsing ? "Todos los ejercicios" : "Resultados"}>
              {renderRows(results, browsing)}
            </ul>
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
                {trimmed ? `+ Crear «${trimmed}»` : "+ Crear ejercicio"}
              </Button>
            </div>
          </>
        )}
      </div>

      {multiple && (
        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border bg-surface-1 px-4 pb-4 pt-3">
          <Button fullWidth size="lg" disabled={selected.length === 0} onClick={() => confirm(selected)}>
            Agregar ({selected.length})
          </Button>
        </div>
      )}

      <CreateExerciseSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialName={trimmed}
        onCreated={(ex) => {
          setQuery("");
          setGroupKey(undefined);
          setEquipment(undefined);
          if (multiple) setSelected((s) => (s.some((x) => x.id === ex.id) ? s : [...s, ex]));
          else confirm([ex]);
        }}
      />
      {/* filtros activos para lectores de pantalla */}
      <p className="sr-only" aria-live="polite">
        {loading ? "" : `${results.length} ejercicios${filters.groupKey || filters.equipment ? " con filtros" : ""}`}
      </p>
    </div>
  );
}
