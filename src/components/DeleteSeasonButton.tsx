"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  seasonId: string;
};

export default function DeleteSeasonButton({ seasonId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (loading) return;
    const ok = confirm("¿Eliminar esta temporada? Se borrarán también sus inscripciones.");
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/seasons/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "No se pudo eliminar la temporada");
        return;
      }

      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      title="Eliminar temporada"
      className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-60"
    >
      {loading ? "…" : "🗑️"}
    </button>
  );
}
