"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Modal, toastResult } from "@/src/components/ui";
import { joinGroupAction } from "@/src/server/actions/groups";

export default function JoinGroupModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function closeModal() {
    setOpen(false);
    setCode("");
    setError(null);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await joinGroupAction(code);
      if (toastResult(r)) {
        closeModal();
        router.push(`/group/${r.data.groupId}`);
      } else setError(r.error);
    });
  }

  return (
    <div className="inline-block">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Unirte a grupo
      </Button>

      <Modal open={open} onClose={closeModal} title="Unirte a grupo">
        <form onSubmit={handleJoin} className="space-y-4">
          <p className="text-sm text-fg-muted">Ingresá el código de invitación que te pasó un admin del grupo.</p>
          <Field label="Código de invitación" htmlFor="join-group-code" error={error}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 16))}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD2345"
              className="font-mono uppercase tracking-widest"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" pending={pending} disabled={code.trim().length === 0}>
              Unirme
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
