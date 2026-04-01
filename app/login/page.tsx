"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      window.location.href = "/home";
    } catch (err) {
      console.error("/login submit error:", err);
      setLoading(false);
      setError("Error iniciando sesión");
    }
  }

  return (
    <main className="min-h-screen bg-[#08142d] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-[28px] bg-slate-800/85 p-8 shadow-2xl">
          <div className="mb-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              El Bravo
            </div>
            <h1 className="mt-2 text-4xl font-bold leading-tight text-white">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Entrá para seguir cargando entrenamientos, mantener tus rachas y competir con tu grupo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-200">
                Email
              </label>
              <input
                placeholder="tu@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-200">
                Contraseña
              </label>
              <input
                placeholder="Tu contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/60"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-3 text-base font-semibold text-white shadow-md transition hover:from-lime-500 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300">
            ¿No tenés cuenta?
            <button
              type="button"
              onClick={() => {
                window.location.href = "/register";
              }}
              className="ml-2 font-semibold text-lime-400 transition hover:text-lime-300"
            >
              Registrate
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}