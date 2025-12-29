"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateSeasonPage() {
  const router = useRouter();
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

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre de la temporada es requerido");
      setStep(0);
      return;
    }
    if (!startDate || !endDate) {
      setError("Fechas incorrectas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seasons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate, minPerWeek, description }),
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Error creando la temporada");
        return;
      }

      router.push(`/group`);
    } catch (err) {
      setLoading(false);
      setError("Error de red");
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

          <form onSubmit={handleCreate} className="space-y-4">
            {step === 0 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">Nombre de la temporada</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md" />
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Fecha inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Fecha fin</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">Objetivo (entrenos mínimos por semana)</label>
                <input type="number" min={1} value={minPerWeek} onChange={(e) => setMinPerWeek(Number(e.target.value))} className="w-28 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md" />
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
              <button type="button" onClick={back} className="px-3 py-2 bg-gray-700 rounded-md text-white" disabled={step===0}>Atrás</button>
              {step < 3 ? <button type="button" onClick={next} className="px-4 py-2 bg-indigo-600 rounded-md text-white">Siguiente</button> : <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 rounded-md text-white disabled:opacity-50">{loading ? 'Creando...' : 'Crear temporada'}</button>}
              <button type="button" onClick={() => router.push('/group')} className="ml-auto px-3 py-2 bg-gray-600 rounded-md text-white">Cancelar</button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}
