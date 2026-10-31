"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, toastResult } from "@/src/components/ui";
import { createSeasonAction } from "@/src/server/actions/seasons";

type ActivityCategoryOption = {
  id: string;
  slug: string;
  name: string;
};

function toDateInputValue(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getActivityTypeLabel(
  id: string,
  items: ActivityCategoryOption[]
) {
  return items.find((option) => option.id === id)?.name ?? id;
}

export default function CreateSeasonPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = params?.id;

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minPerWeek, setMinPerWeek] = useState(2);
  const [allowedActivityCategoryIds, setAllowedActivityCategoryIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityCategories, setActivityCategories] = useState<ActivityCategoryOption[]>([]);

  const totalSteps = 5;

  useEffect(() => {
    let alive = true;

    async function loadData() {
      if (!groupId) return;

      try {
        // La superposición con otras temporadas la valida createSeasonAction.
        const categoryRes = await fetch("/api/activity-types/list", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (categoryRes.ok) {
          const data = await categoryRes.json().catch(() => []);
          if (alive) {
            const categories = Array.isArray(data) ? data : [];
            setActivityCategories(categories);
            if (categories.length > 0) {
              setAllowedActivityCategoryIds((prev) =>
                prev.length > 0 ? prev : [categories[0].id]
              );
            }
          }
        }
      } catch {
        // silencioso
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [groupId]);

  const stepTitles = [
    "Detalles",
    "Fechas",
    "Objetivo",
    "Actividades permitidas",
    "Confirmar",
  ];

  function toggleActivityType(value: string) {
    setAllowedActivityCategoryIds((current) => {
      if (current.includes(value)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  }

  function next() {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function validateStep(currentStep: number): string | null {
    if (!groupId) return "No se encontró el grupo";

    if (currentStep === 0) {
      if (!name.trim()) return "El nombre de la temporada es requerido";
    }

    if (currentStep === 1) {
      if (!startDate || !endDate) return "Fechas incorrectas";
      if (startDate < todayStr) return "La fecha de inicio no puede ser en el pasado";
      if (endDate < todayStr) return "La fecha de fin no puede ser en el pasado";
      if (endDate < startDate) return "La fecha de fin no puede ser anterior a la de inicio";
    }

    if (currentStep === 2) {
      if (!Number.isFinite(minPerWeek) || minPerWeek < 1 || minPerWeek > 7) {
        return "El objetivo debe estar entre 1 y 7";
      }
    }

    if (currentStep === 3) {
      if (allowedActivityCategoryIds.length === 0) {
        return "Tenés que seleccionar al menos un tipo de actividad permitido";
      }
    }

    return null;
  }

  function validateAll(): string | null {
    for (let i = 0; i < totalSteps - 1; i += 1) {
      const err = validateStep(i);
      if (err) return err;
    }
    return null;
  }

  async function handleCreate() {
    setError(null);

    const err = validateAll();
    if (err) {
      setError(err);
      if (err.includes("nombre")) setStep(0);
      else if (err.includes("fecha")) setStep(1);
      else if (err.includes("objetivo")) setStep(2);
      else if (err.includes("actividad")) setStep(3);
      return;
    }

    if (!groupId) return;
    setLoading(true);
    try {
      const result = await createSeasonAction({
        groupId,
        name,
        description,
        startDate,
        endDate,
        weeklyGoal: minPerWeek,
        minDailyMinutes: 20,
        resultsReveal: "auto",
        categories: allowedActivityCategoryIds.map((activityCategoryId) => ({ activityCategoryId, weight: 1 })),
        awards: [],
      });
      if (!toastResult(result)) {
        setError(result.ok ? null : result.error);
        return;
      }
      router.push(`/group/${groupId}`);
      router.refresh();
    } catch {
      toastResult({ ok: false, error: "Error de red. Probá de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
          >
            ← Volver atrás
          </button>
        </div>

        <section className="rounded-[28px] bg-slate-800/85 p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white">Crear temporada</h1>
            <p className="mt-2 text-sm text-slate-400">
              Definí fechas, objetivo semanal y qué tipos de entrenamiento van a sumar puntos.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {stepTitles.map((title, index) => {
              const isActive = index === step;
              const isDone = index < step;

              return (
                <div
                  key={title}
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    isActive
                      ? "border-lime-500 bg-slate-900 text-white"
                      : isDone
                      ? "border-slate-700 bg-slate-900/70 text-slate-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Paso {index + 1}
                  </div>
                  <div className="mt-1 font-semibold">{title}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-5">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Nombre de la temporada
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Abril Explosivo"
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Contá de qué se trata esta temporada."
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    min={todayStr}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStartDate(value);
                      if (endDate && endDate < value) setEndDate(value);
                    }}
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
                    min={startDate || todayStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500/60"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="max-w-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-200">
                  Objetivo semanal
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={minPerWeek}
                  onChange={(e) => setMinPerWeek(Number(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-lime-500/60"
                />
                <p className="mt-2 text-sm text-slate-400">
                  Cantidad mínima de días entrenados por semana para cumplir el objetivo.
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-white">Tipos permitidos</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Solo estos tipos de actividad van a sumar puntos en esta temporada.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activityCategories.map((option) => {
                    const selected = allowedActivityCategoryIds.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleActivityType(option.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-lime-500 bg-lime-500/10 text-white"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        <div className="font-semibold">{option.name}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {selected ? "Incluido en el score" : "No suma puntos"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-white">Confirmar temporada</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-800 p-4">
                    <div className="text-sm text-slate-400">Nombre</div>
                    <div className="mt-1 font-semibold text-white">{name || "—"}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-4">
                    <div className="text-sm text-slate-400">Objetivo semanal</div>
                    <div className="mt-1 font-semibold text-white">
                      {minPerWeek} día{minPerWeek === 1 ? "" : "s"} por semana
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-4">
                    <div className="text-sm text-slate-400">Inicio</div>
                    <div className="mt-1 font-semibold text-white">{startDate || "—"}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-4">
                    <div className="text-sm text-slate-400">Fin</div>
                    <div className="mt-1 font-semibold text-white">{endDate || "—"}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-4 md:col-span-2">
                    <div className="text-sm text-slate-400">Tipos permitidos</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allowedActivityCategoryIds.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-slate-700 px-3 py-1 text-sm text-white"
                        >
                          {getActivityTypeLabel(id, activityCategories)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-4 md:col-span-2">
                    <div className="text-sm text-slate-400">Descripción</div>
                    <div className="mt-1 text-white">{description || "—"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || loading}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atrás
            </button>

            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const err = validateStep(step);
                  if (err) {
                    setError(err);
                    return;
                  }
                  setError(null);
                  next();
                }}
                disabled={loading}
                className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-2 text-sm font-medium text-white hover:from-lime-500 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Siguiente
              </button>
            ) : (
              <Button size="sm" onClick={handleCreate} pending={loading}>
                Crear temporada
              </Button>
            )}

            <button
              type="button"
              onClick={() => router.push(`/group/${groupId}`)}
              className="ml-auto rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}