"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Avatar, Input, Pill, Spinner } from "@/src/components/ui";
import { searchUsersAction } from "@/src/server/actions/social";

type Result = { id: string; name: string | null; photoUrl: string | null; isFollowing: boolean };

/** Buscar personas por nombre (prefijo, sin acentos). Cada resultado lleva a `/u/[id]`. */
export function UserSearch({ autoFocus }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersAction(q);
        if (r.ok) {
          setResults(r.data);
          setError(null);
        } else setError(r.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const short = query.trim().length < 2;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          type="search"
          aria-label="Buscar personas"
          placeholder="Buscá por nombre"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        {pending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">
            <Spinner />
          </span>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!short && results && results.length === 0 && !pending && (
        <p className="text-sm text-fg-muted">No encontramos a nadie con ese nombre.</p>
      )}
      {!short && results && results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
          {results.map((u) => (
            <li key={u.id}>
              <Link
                href={`/u/${u.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
              >
                <Avatar name={u.name} src={u.photoUrl} size="md" />
                <span className="min-w-0 flex-1 truncate font-semibold">{u.name ?? "Usuario"}</span>
                {u.isFollowing && <Pill tone="primary">Siguiendo</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
