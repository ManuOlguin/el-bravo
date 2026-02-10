"use client";

import { useEffect, useState } from "react";

export default function GroupInviteCodePanel({ groupId }: { groupId: string }) {
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
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).toLocaleString() : null);
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

  useEffect(() => {
    fetchCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-900 rounded-md p-4 border border-gray-700 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Código de invitación</div>
          <div className="text-sm text-gray-300">
            Compartilo para que se unan al grupo.
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchCode(true)}
          disabled={loading}
          className="px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600 disabled:opacity-60"
        >
          {loading ? "..." : "Regenerar"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
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
        <div className="mt-2 text-sm text-gray-400">Expira: {expiresAt}</div>
      )}

      {msg && <div className="mt-2 text-sm text-yellow-300">{msg}</div>}
    </div>
  );
}
