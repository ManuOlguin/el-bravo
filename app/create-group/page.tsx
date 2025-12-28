"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre del grupo es requerido");
      setStep(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, photoUrl: photoUrl || null, description: description || null }),
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Error creando el grupo");
        return;
      }

      router.push("/group");
    } catch (err) {
      setLoading(false);
      setError("Error de red");
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-semibold mb-4">Crear grupo</h1>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <StepDot active={step >= 0} label="Detalles" />
              <div className="h-px bg-gray-700 flex-1" />
              <StepDot active={step >= 1} label="Foto" />
              <div className="h-px bg-gray-700 flex-1" />
              <StepDot active={step >= 2} label="Descripción" />
              <div className="h-px bg-gray-700 flex-1" />
              <StepDot active={step >= 3} label="Confirmar" />
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {step === 0 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">Nombre del grupo</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Runners Madrid"
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 mt-2">Este nombre será visible para otros miembros.</p>
              </div>
            )}

            {step === 1 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">URL de la foto (opcional)</label>
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/foto.jpg"
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400"
                />

                {photoUrl && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-300 mb-2">Vista previa</p>
                    <div className="w-32 h-32 rounded-full bg-gray-700 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Cuenta un poco sobre el grupo..."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400"
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Confirma los datos</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>
                    <strong>Nombre:</strong> {name || "—"}
                  </div>
                  <div>
                    <strong>Foto:</strong> {photoUrl ? <span className="text-indigo-300">Sí</span> : <span>—</span>}
                  </div>
                  <div>
                    <strong>Descripción:</strong> {description || "—"}
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex items-center gap-3">
              <button type="button" onClick={back} className="px-3 py-2 bg-gray-700 rounded-md text-white" disabled={step===0}>
                Atrás
              </button>

              {step < 3 ? (
                <button type="button" onClick={next} className="px-4 py-2 bg-indigo-600 rounded-md text-white">
                  Siguiente
                </button>
              ) : (
                <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 rounded-md text-white disabled:opacity-50">
                  {loading ? "Creando..." : "Crear grupo"}
                </button>
              )}

              <button type="button" onClick={() => router.push("/dashboard")} className="ml-auto px-3 py-2 bg-gray-600 rounded-md text-white">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? "bg-indigo-500" : "bg-gray-700"}`}>
        <div className="w-3 h-3 rounded-full bg-white/80" />
      </div>
      <div className="text-xs text-gray-300 hidden sm:block">{label}</div>
    </div>
  );
}
