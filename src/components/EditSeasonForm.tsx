"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, toastResult } from "@/src/components/ui";
import { updateSeasonAction } from "@/src/server/actions/seasons";

type ActivityCategoryOption = {
  id: string;
  slug: string;
  name: string;
};

type EditSeasonFormProps = {
  groupId: string;
  seasonId: string;
  initialName: string;
  initialDescription: string;
  initialStartDate: string;
  initialEndDate: string;
  initialWeeklyGoal: number;
  initialAllowedActivityCategoryIds: string[];
  /** Configuración actual que este formulario (puente) no edita y hay que conservar al guardar. */
  initialConfig?: {
    minDailyMinutes: number;
    resultsReveal: "auto" | "manual";
    weights: Record<string, number>;
    awards: { awardType: string; bonusPoints: number }[];
  };
};

export default function EditSeasonForm({
  groupId,
  seasonId,
  initialName,
  initialDescription,
  initialStartDate,
  initialEndDate,
  initialWeeklyGoal,
  initialAllowedActivityCategoryIds,
  initialConfig,
}: EditSeasonFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [minPerWeek, setMinPerWeek] = useState(initialWeeklyGoal);
  const [allowedActivityCategoryIds, setAllowedActivityCategoryIds] = useState<string[]>(
    initialAllowedActivityCategoryIds
  );
  const [activityCategories, setActivityCategories] = useState<ActivityCategoryOption[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const activityTypeSet = useMemo(
    () => new Set(allowedActivityCategoryIds),
    [allowedActivityCategoryIds]
  );

  useEffect(() => {
    let alive = true;

    async function loadActivityCategories() {
      try {
        setLoadingCategories(true);

        const res = await fetch("/api/activity-types/list", {
          cache: "no-store",
        });

        const data = await res.json().catch(() => []);

        if (!res.ok || !alive) return;

        const categories = Array.isArray(data) ? data : [];
        setActivityCategories(categories);

        if (categories.length > 0 && allowedActivityCategoryIds.length === 0) {
          setAllowedActivityCategoryIds([categories[0].id]);
        }
      } catch {
        // noop
      } finally {
        if (alive) setLoadingCategories(false);
      }
    }

    loadActivityCategories();

    return () => {
      alive = false;
    };
  }, [allowedActivityCategoryIds.length]);

  function toggleActivityType(value: string) {
    setAllowedActivityCategoryIds((current) => {
      if (current.includes(value)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== value);
      }

      return [...current, value];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre de la temporada es requerido");
      return;
    }

    if (!startDate || !endDate) {
      setError("Tenés que completar las fechas");
      return;
    }

    if (endDate < startDate) {
      setError("La fecha de fin no puede ser anterior a la de inicio");
      return;
    }

    if (!Number.isInteger(minPerWeek) || minPerWeek < 1 || minPerWeek > 7) {
      setError("El objetivo semanal debe estar entre 1 y 7");
      return;
    }

    if (allowedActivityCategoryIds.length === 0) {
      setError("Tenés que seleccionar al menos un tipo de actividad permitido");
      return;
    }

    setLoading(true);

    try {
      const result = await updateSeasonAction(seasonId, {
        groupId,
        name: name.trim(),
        description: description.trim(),
        startDate,
        endDate,
        weeklyGoal: minPerWeek,
        minDailyMinutes: initialConfig?.minDailyMinutes ?? 20,
        resultsReveal: initialConfig?.resultsReveal ?? "auto",
        categories: allowedActivityCategoryIds.map((activityCategoryId) => ({
          activityCategoryId,
          weight: initialConfig?.weights[activityCategoryId] ?? 1,
        })),
        awards: (initialConfig?.awards ?? []) as Parameters<typeof updateSeasonAction>[1]["awards"],
      });
      if (!toastResult(result)) {
        setLoading(false);
        setError(result.ok ? null : result.error);
        return;
      }

      router.push(`/group/${groupId}`);
      router.refresh();
    } catch (err) {
      console.error("/season edit submit error:", err);
      setLoading(false);
      toastResult({ ok: false, error: "Error de red al actualizar la temporada" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl bg-slate-900/70 p-5">
        <h2 className="mb-4 text-xl font-semibold text-white">Detalles</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Nombre de la temporada
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Descripción
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la temporada"
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/70 p-5">
        <h2 className="mb-4 text-xl font-semibold text-white">Fechas y objetivo</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Fecha de inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500/60"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Fecha de fin
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500/60"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Objetivo semanal
            </label>
            <input
              type="number"
              min={1}
              max={7}
              value={minPerWeek}
              onChange={(e) => setMinPerWeek(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500/60"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/70 p-5">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Tipos permitidos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Solo estos tipos de actividad van a sumar puntos en esta temporada.
          </p>
        </div>

        {loadingCategories ? (
          <div className="rounded-xl bg-slate-800 px-4 py-4 text-sm text-slate-400">
            Cargando tipos de actividad...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activityCategories.map((option) => {
              const checked = activityTypeSet.has(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleActivityType(option.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    checked
                      ? "border-lime-500 bg-lime-500/10 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <div className="font-semibold">{option.name}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {checked ? "Actualmente incluido" : "Disponible para incluir"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/group/${groupId}`)}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
        >
          Cancelar
        </button>

        <Button type="submit" size="sm" pending={loading} disabled={loadingCategories}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}