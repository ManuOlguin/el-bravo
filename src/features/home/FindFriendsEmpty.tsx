"use client";

import { useState } from "react";
import { Button, EmptyState, Sheet } from "@/src/components/ui";
import { UserList, type UserListItem } from "@/src/features/social/UserList";
import { UserSearch } from "@/src/features/social/UserSearch";

/** Estado vacío del feed de amigos: buscar personas (en un sheet) + sugerencias de gente de tus grupos. */
export function FindFriendsEmpty({ suggestions }: { suggestions: UserListItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <EmptyState
        icon={<span className="text-xl">👋</span>}
        title="Seguí a tus amigos para ver sus entrenamientos"
        description="Cuando los sigas, vas a ver acá lo que entrenan y vas a poder reaccionar."
        action={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Buscar personas
          </Button>
        }
      />
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">De tus grupos</h3>
          <UserList users={suggestions} emptyTitle="" />
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Buscar personas">
        <div className="min-h-[40dvh]">
          <UserSearch autoFocus />
        </div>
      </Sheet>
    </div>
  );
}
