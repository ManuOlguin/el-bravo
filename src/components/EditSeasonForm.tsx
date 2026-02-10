"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SeasonShape = {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  minPerWeek: number;
};

function toDateInputValue(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asDateInput(v: Date | string) {
  const d = typeof v === "string" ? new Date(v) : v;
  return toDateInputValue(d);
}

export default function EditSeasonForm({
  groupId,
  season,
}: {
  groupId: string;
  season: SeasonShape;
}) {
  const router = useRouter();

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const initialStart = useMemo(() => asDateInput(season.startDate), [season.startDate]);
  const initialEnd = useMemo(() => asDateInput(season.endDate), [season.endDate]);

  const seasonEnded = new Date(season.endDate).getTime() < Date.now();

  const [name, setName] = useState(season.name ?? "");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [minPerWeek, setMinPerWeek] = useState<number>(season.minPerWeek ?? 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "El nombre es requerido";
    if (!startDate || !endDate) return "Fechas incorrectas";

    if (startDate < todayStr) return "La fecha de inicio no puede ser en el pasado";
    if (endDate < todayStr) return "La fecha de fin no puede ser en el pasado";
    if (endDate < startDate) return "La fecha de fin no puede ser anterior a la de inicio";

    if (!Number.isFinite(minPerWeek) || minPerWeek < 1) return "El objetivo debe ser >= 1";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (seasonEnded) {
      setError("No podés editar una temporada que ya terminó.");
      return;
    }

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seasons/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          seasonId: season.id,
          name,
          startDate,
          endDate,
          minPerWeek,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar");
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
    <form onSubmit={onSubmit} className="space-y-4">
      {seasonEnded && (
        <div className="rounded-md border border-yellow-700 bg-yellow-900/30 p-3 text-sm text-yellow-200">
          Esta temporada ya terminó. No se puede editar.
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-200 mb-1">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading || seasonEnded}
          className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md disabled:opacity-60"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-200 mb-1">Fecha inicio</label>
          <input
            type="date"
            value={startDate}
            min={todayStr}
            disabled={loading || seasonEnded}
            onChange={(e) => {
              const v = e.target.value;
              setStartDate(v);
              if (endDate && endDate < v) setEndDate(v);
            }}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-200 mb-1">Fecha fin</label>
          <input
            type="date"
            value={endDate}
            min={startDate || todayStr}
            disabled={loading || seasonEnded}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-200 mb-1">Objetivo (por semana)</label>
        <input
          type="number"
          min={1}
          value={minPerWeek}
          disabled={loading || seasonEnded}
          onChange={(e) => setMinPerWeek(Number(e.target.value))}
          className="w-28 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/group/${groupId}`)}
          className="px-3 py-2 bg-gray-700 rounded-md text-white disabled:opacity-50"
          disabled={loading}
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading || seasonEnded}
          className="ml-auto px-4 py-2 bg-indigo-600 rounded-md text-white disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
