"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

const res = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ email, password, name }),
});

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 p-6 text-white">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold mb-6 text-white">Register</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Name</label>
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Email</label>
            <input
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Password</label>
            <input
              placeholder="Password (min 8)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        <div className="mt-4 text-center text-sm text-gray-300">
          Already have an account?
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="ml-2 text-indigo-400 hover:underline"
          >
            Login
          </button>
        </div>
      </div>
    </main>
  );
}
