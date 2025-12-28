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
    <main style={{ padding: 32 }}>
      <h1>Register</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 320 }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <br />

        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />

        <input
          placeholder="Password (min 8)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />

        <button disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
