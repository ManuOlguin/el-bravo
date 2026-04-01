"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteActivityButtonProps = {
  activityId: string;
};

export default function DeleteActivityButton({
  activityId,
}: DeleteActivityButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("¿Querés eliminar esta actividad?");
    if (!confirmed) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/activities/${activityId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "No se pudo eliminar la actividad.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Error deleting activity:", err);
      alert("Ocurrió un error de red al eliminar la actividad.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      title="Eliminar actividad"
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 text-lg text-slate-200 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {deleting ? "…" : "🗑️"}
    </button>
  );
}