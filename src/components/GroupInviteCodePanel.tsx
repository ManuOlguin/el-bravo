"use client";

import { useEffect, useState } from "react";

type GroupInviteCodePanelProps = {
  groupId: string;
  open: boolean;
  onClose: () => void;
};

export default function GroupInviteCodePanel({
  groupId,
  open,
  onClose,
}: GroupInviteCodePanelProps) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchCode(regenerate = false) {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/groups/invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "No se pudo obtener el código");
        return;
      }
      setCode(data.code || null);
      setExpiresAt(
        data.expiresAt
          ? new Date(data.expiresAt).toLocaleString()
          : null
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setMsg("Copiado ✅");
    setTimeout(() => setMsg(null), 1200);
  }

  // Traer/actualizar el código cuando se abre el popup
  useEffect(() => {
    if (open) {
      fetchCode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Si no está abierto, no renderizamos nada
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Contenido del popup */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-gray-900 border border-gray-700 p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold text-lg">
              Código de invitación
            </div>
            <div className="text-sm text-gray-300">
              Compartilo para que se unan al grupo.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            type="button"
            onClick={() => fetchCode(true)}
            disabled={loading}
            className="px-3 py-2 bg-gray-800 rounded-md text-sm hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? "..." : "Regenerar código"}
          </button>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-gray-800 rounded-md font-mono text-lg tracking-widest text-center">
            {code ?? "— — — — — —"}
          </div>

          <button
            type="button"
            onClick={copy}
            disabled={!code}
            className="px-3 py-2 bg-indigo-600 rounded-md text-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            Copiar
          </button>
        </div>

        {expiresAt && (
          <div className="mt-2 text-sm text-gray-400">
            Expira: {expiresAt}
          </div>
        )}

        {msg && (
          <div className="mt-2 text-sm text-yellow-300">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
