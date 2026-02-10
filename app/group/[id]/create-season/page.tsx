"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";

function toDateInputValue(d: Date) {
  // YYYY-MM-DD en horario local
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  function validateAll(): string | null {
    if (!groupId) return "No se encontró el grupo";
    if (!name.trim()) return "El nombre de la temporada es requerido";
    if (!startDate || !endDate) return "Fechas incorrectas";

    // reglas: no pasado + end >= start
    if (startDate < todayStr) return "La fecha de inicio no puede ser en el pasado";
    if (endDate < todayStr) return "La fecha de fin no puede ser en el pasado";
    if (endDate < startDate) return "La fecha de fin no puede ser anterior a la de inicio";

    if (!Number.isFinite(minPerWeek) || minPerWeek < 1 || minPerWeek > 7) {
      return "El objetivo debe estar entre 1 y 7";
    }

    return null;
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    const err = validateAll();
    if (err) {
      setError(err);
      // te manda al paso correcto
      if (err.includes("nombre")) setStep(0);
      else if (err.includes("fecha")) setStep(1);
      else if (err.includes("objetivo")) setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seasons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, name, startDate, endDate, minPerWeek, description }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Error creando la temporada");
        setLoading(false);
        return;
      }

      router.push(`/group/${groupId}`);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-semibold mb-4">Crear temporada</h1>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-300">Paso {step + 1} de 4</div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              if (step !== 3) {
                e.preventDefault();
                return;
              }
              handleCreate(e);
            }}
            className="space-y-4"
          >
            {step === 0 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">Nombre de la temporada</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
                />
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    min={todayStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartDate(v);
                      // si endDate quedó inválida, la movemos al menos a startDate
                      if (endDate && endDate < v) setEndDate(v);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || todayStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">
                  Objetivo (entrenos mínimos por semana)
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={minPerWeek}
                  onChange={(e) => setMinPerWeek(Number(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  className="w-28 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md"
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Confirma los datos</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div><strong>Nombre:</strong> {name || "—"}</div>
                  <div><strong>Inicio:</strong> {startDate || "—"}</div>
                  <div><strong>Fin:</strong> {endDate || "—"}</div>
                  <div><strong>Objetivo:</strong> {minPerWeek} por semana</div>
                  <div><strong>Descripción:</strong> {description || "—"}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                className="px-3 py-2 bg-gray-700 rounded-md text-white disabled:opacity-50"
                disabled={step === 0 || loading}
              >
                Atrás
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    // validación por paso (simple)
                    setError(null);
                    if (step === 0 && !name.trim()) {
                      setError("El nombre de la temporada es requerido");
                      return;
                    }
                    if (step === 1) {
                      if (!startDate || !endDate) { setError("Fechas incorrectas"); return; }
                      if (startDate < todayStr) { setError("La fecha de inicio no puede ser en el pasado"); return; }
                      if (endDate < (startDate || todayStr)) { setError("La fecha de fin no puede ser anterior a la de inicio"); return; }
                    }
                    if (step === 2 && (!Number.isFinite(minPerWeek) || minPerWeek < 1 || minPerWeek > 7)) {
                      setError("El objetivo debe estar entre 1 y 7");
                      return;
                    }
                    next();
                  }}
                  className="px-4 py-2 bg-indigo-600 rounded-md text-white disabled:opacity-50"
                  disabled={loading}
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 rounded-md text-white disabled:opacity-50"
                >
                  {loading ? "Creando..." : "Crear temporada"}
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push(`/group/${groupId}`)}
                className="ml-auto px-3 py-2 bg-gray-600 rounded-md text-white disabled:opacity-50"
                disabled={loading}
              >
                Cancelar
              </button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}
