"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  groupId: string;
  userId: string;
  userName?: string | null;
};

export default function KickMemberButton({ groupId, userId, userName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onKick() {
    if (loading) return;

    const label = userName ? `(${userName})` : "";
    const ok = confirm(`¿Querés expulsar a ${label}? También saldrá de todas las temporadas del grupo.`);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/groups/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, userId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "No se pudo expulsar al miembro");
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
      onClick={onKick}
      disabled={loading}
      className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-xs disabled:opacity-60"
    >
      {loading ? "..." : "Expulsar"}
    </button>
  );
}
