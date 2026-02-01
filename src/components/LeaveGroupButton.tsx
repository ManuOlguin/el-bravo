"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  groupId: string;
  isAdmin: boolean;
  activeMemberCount: number;
};

export default function LeaveGroupButton({ groupId, isAdmin, activeMemberCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLeave() {
    if (loading) return;

    const isLastMemberAdmin = isAdmin && activeMemberCount === 1;

    const message = isLastMemberAdmin
      ? "Sos el único miembro restante del grupo.\n\nSalir del grupo borrará el grupo actual (incluyendo temporadas asociadas). ¿Querés continuar?"
      : "¿Seguro que querés salir del grupo? También vas a salir de las temporadas activas de este grupo.";

    const ok = confirm(message);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/groups/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "No se pudo salir del grupo");
        return;
      }

      router.push("/dashboard");
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
      onClick={onLeave}
      disabled={loading}
      className="inline-flex items-center px-3 py-2 bg-red-600 rounded-md text-sm hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? "Saliendo..." : "Salir del grupo"}
    </button>
  );
}
