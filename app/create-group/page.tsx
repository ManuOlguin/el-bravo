"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = ["Detalles", "Foto", "Descripción", "Confirmar"];

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    setError(null);

    if (step === 0 && !name.trim()) {
      setError("El nombre del grupo es requerido.");
      return;
    }

    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre del grupo es requerido.");
      setStep(0);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          photoUrl: photoUrl || null,
          description: description || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Error creando el grupo.");
        setLoading(false);
        return;
      }

      router.push("/group");
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500"
          >
            ← Volver atrás
          </button>
        </div>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">
                Crear grupo
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Configurá los datos básicos del grupo antes de invitar miembros.
              </p>
            </div>

            <div className="rounded-xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              Paso <span className="font-semibold text-white">{step + 1}</span> de{" "}
              <span className="font-semibold text-white">{STEPS.length}</span>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {STEPS.map((label, index) => (
              <StepCard
                key={label}
                label={label}
                active={step === index}
                completed={step > index}
              />
            ))}
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-5 md:p-6">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Nombre del grupo
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Runners Madrid"
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-lime-500"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Este nombre será visible para todos los miembros del grupo.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    URL de la foto
                  </label>
                  <input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/foto.jpg"
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-lime-500"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Más adelante podemos reemplazar esto por una subida real de imagen.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-800 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-200">
                    Vista previa
                  </div>

                  {photoUrl ? (
                    <div className="h-40 w-40 overflow-hidden rounded-2xl bg-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt="Vista previa del grupo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-700 text-4xl font-bold text-slate-300">
                      {name?.trim()?.charAt(0)?.toUpperCase() || "G"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contá un poco sobre el grupo, el objetivo o el tipo de entrenamientos..."
                    rows={5}
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-lime-500"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Opcional. Ayuda a que nuevos miembros entiendan de qué se trata el grupo.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl bg-slate-800 p-5">
                  <div className="mb-4 text-lg font-semibold text-white">
                    Confirmación
                  </div>

                  <div className="space-y-3 text-sm text-slate-300">
                    <div>
                      <span className="block text-xs uppercase tracking-wide text-slate-400">
                        Nombre
                      </span>
                      <span className="font-medium text-white">{name || "—"}</span>
                    </div>

                    <div>
                      <span className="block text-xs uppercase tracking-wide text-slate-400">
                        Foto
                      </span>
                      <span className="font-medium text-white">
                        {photoUrl ? "Cargada" : "Sin foto"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs uppercase tracking-wide text-slate-400">
                        Descripción
                      </span>
                      <span className="font-medium text-white">
                        {description || "Sin descripción"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-800 p-5">
                  <div className="mb-4 text-lg font-semibold text-white">
                    Vista previa del grupo
                  </div>

                  <div className="flex items-center gap-4 rounded-2xl bg-slate-900 p-4">
                    {photoUrl ? (
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl}
                          alt="Preview grupo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-700 text-3xl font-bold text-white">
                        {name?.trim()?.charAt(0)?.toUpperCase() || "G"}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="truncate text-2xl font-bold text-white">
                        {name || "Nombre del grupo"}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {description || "Todavía sin descripción"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0}
                className="rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Atrás
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-md bg-lime-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-lime-500"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCreate()}
                  disabled={loading}
                  className="rounded-md bg-lime-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Creando..." : "Crear grupo"}
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push("/home")}
                className="ml-auto rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepCard({
  label,
  active,
  completed,
}: {
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition ${
        active
          ? "border-lime-500 bg-lime-500/10"
          : completed
          ? "border-slate-600 bg-slate-800"
          : "border-slate-700 bg-slate-900/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            active
              ? "bg-lime-500 text-white"
              : completed
              ? "bg-slate-500 text-white"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {completed ? "✓" : ""}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-slate-400">
            {active ? "Paso actual" : completed ? "Completo" : "Pendiente"}
          </div>
        </div>
      </div>
    </div>
  );
}