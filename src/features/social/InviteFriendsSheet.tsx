"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Avatar, Button, EmptyState, Input, Sheet, Spinner, cn, toast, toastResult } from "@/src/components/ui";
import { listFriendsAction } from "@/src/server/actions/social";
import { inviteFriendsToGroupAction } from "@/src/server/actions/groups";

type Friend = { id: string; name: string | null; photoUrl: string | null };

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Invitar amigos (seguimiento mutuo) a un grupo, sin código. Solo para admins. */
export function InviteFriendsSheet({
  groupId,
  open,
  onClose,
  memberIds = [],
}: {
  groupId: string;
  open: boolean;
  onClose(): void;
  /** Miembros actuales: aparecen deshabilitados ("Ya está en el grupo"). */
  memberIds?: string[];
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();
  const members = useMemo(() => new Set(memberIds), [memberIds]);

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const r = await listFriendsAction();
      if (r.ok) setFriends(r.data);
      else toast.error(r.error);
    });
  }, [open]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return (friends ?? []).filter((f) => !q || normalize(f.name ?? "").includes(q));
  }, [friends, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function close() {
    setSelected(new Set());
    setQuery("");
    onClose();
  }

  function invite() {
    startSending(async () => {
      const r = await inviteFriendsToGroupAction(groupId, [...selected]);
      if (toastResult(r)) close();
    });
  }

  return (
    <Sheet open={open} onClose={close} title="Invitar amigos">
      <div className="space-y-3">
        <Input type="search" aria-label="Buscar amigos" placeholder="Buscá entre tus amigos" value={query} onChange={(e) => setQuery(e.target.value)} />

        {loading && !friends ? (
          <div className="flex justify-center py-6 text-fg-muted">
            <Spinner />
          </div>
        ) : friends && friends.length === 0 ? (
          <EmptyState title="Todavía no tenés amigos" description="Cuando vos y otra persona se sigan mutuamente, aparece acá." />
        ) : (
          <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto">
            {visible.map((f) => {
              const isMember = members.has(f.id);
              const checked = selected.has(f.id);
              return (
                <li key={f.id}>
                  <label className={cn("flex items-center gap-3 py-2.5", isMember ? "opacity-60" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-primary"
                      checked={checked}
                      disabled={isMember}
                      onChange={() => toggle(f.id)}
                    />
                    <Avatar name={f.name} src={f.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{f.name ?? "Usuario"}</span>
                      {isMember && <span className="block text-xs text-fg-muted">Ya está en el grupo</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <Button fullWidth size="lg" pending={sending} disabled={selected.size === 0} onClick={invite}>
          Invitar ({selected.size})
        </Button>
      </div>
    </Sheet>
  );
}
