"use client";

import { useState } from "react";

type EditProfileUser = {
  id: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
  weeklyGoal: number;
};

export default function EditProfileForm({ user }: { user: EditProfileUser }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? "");
  const [weeklyGoal, setWeeklyGoal] = useState(String(user?.weeklyGoal ?? 3));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        setResetPasswordMessage("");

        if (!name.trim()) {
          setSaving(false);
          setError("El nombre es obligatorio.");
          return;
        }

        const parsedWeeklyGoal = Number(weeklyGoal);

        if (!Number.isInteger(parsedWeeklyGoal) || parsedWeeklyGoal < 1 || parsedWeeklyGoal > 14) {
          setSaving(false);
          setError("El objetivo semanal debe ser un número entero entre 1 y 14.");
          return;
        }

        try {
          const res = await fetch("/api/profile/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              photoUrl: photoUrl.trim() || null,
              weeklyGoal: parsedWeeklyGoal,
            }),
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            setError(data?.error || "Error guardando perfil");
          } else {
            setSuccess("Perfil actualizado correctamente.");
            setTimeout(() => {
              window.location.href = "/profile";
            }, 700);
          }
        } catch (err) {
          console.error(err);
          setError("Error de red");
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-200">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
            placeholder="tuemail@mail.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-200">URL de foto</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">
            Objetivo semanal personal
          </label>
          <input
            type="number"
            min={1}
            max={14}
            value={weeklyGoal}
            onChange={(e) => setWeeklyGoal(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
          />
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Contraseña
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Restablecé tu contraseña desde tu email.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setResetPasswordMessage(
                "Próximamente te enviaremos un email para restablecer la contraseña."
              );
            }}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-lg bg-green-500/15 px-3 py-2 text-sm text-green-300">
          {success}
        </div>
      ) : null}

      {resetPasswordMessage ? (
        <div className="rounded-lg bg-sky-500/15 px-3 py-2 text-sm text-sky-300">
          {resetPasswordMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-6 py-2 font-semibold text-white shadow-md hover:from-lime-500 hover:to-lime-700 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>

        <a
          href="/profile"
          className="rounded-md bg-slate-600 px-4 py-2 font-medium hover:bg-slate-500"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}