"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinGroupModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    setError(null);
    if (!/^[0-9]{6}$/.test(code)) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Failed to join group");
        return;
      }

      setOpen(false);
      setCode("");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("Network error");
    }
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
      >
        Unirte a grupo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Unirte a grupo</h3>
            <p className="text-sm text-gray-300 mb-4">Introduce el código de 6 dígitos</p>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400 mb-3"
            />

            {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-md"
              >
                Cancel
              </button>

              <button
                onClick={handleJoin}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
