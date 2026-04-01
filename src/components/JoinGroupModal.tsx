"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinGroupModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function closeModal() {
    setOpen(false);
    setCode("");
    setError(null);
    setLoading(false);
  }

  async function handleJoin() {
    setError(null);

    if (!/^[0-9]{6}$/.test(code)) {
      setError("Ingresá un código válido de 6 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "No se pudo unir al grupo.");
        setLoading(false);
        return;
      }

      closeModal();
      router.refresh();
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500"
      >
        Unirte a grupo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-2xl font-bold text-white">Unirte a grupo</h3>
              <p className="mt-2 text-sm text-slate-300">
                Ingresá el código de 6 dígitos para sumarte a un grupo.
              </p>
            </div>

            <div className="rounded-xl bg-slate-900/70 p-4">
              <label
                htmlFor="join-group-code"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Código de invitación
              </label>

              <input
                id="join-group-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-lime-500"
              />

              {error && (
                <p className="mt-3 text-sm font-medium text-red-400">{error}</p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="flex-1 rounded-md bg-slate-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleJoin}
                disabled={loading}
                className="flex-1 rounded-md bg-lime-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Uniéndote..." : "Unirme"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}