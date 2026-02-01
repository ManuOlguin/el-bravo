"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  groupId: string;
  groupName: string;
};

export default function DeleteGroupButton({ groupId, groupName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (loading) return;

    const ok = confirm(
      `⚠️ Estás a punto de BORRAR el grupo "${groupName}".\n\nEsto elimina miembros y temporadas asociadas. No se puede deshacer.\n\n¿Estás seguro?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/groups/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "No se pudo borrar el grupo");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
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
      className="inline-flex items-center px-3 py-2 bg-red-700 rounded-md text-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
      title="Solo admins"
    >
      {loading ? "Borrando..." : "Borrar grupo"}
    </button>
  );
}
