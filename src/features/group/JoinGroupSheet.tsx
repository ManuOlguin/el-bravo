"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, Input, Sheet, toastResult, type ButtonProps } from "@/src/components/ui";
import { joinGroupAction } from "@/src/server/actions/groups";

/** Formulario "Unirme con código". Reutilizable en la sheet y en /groups/join?code=… */
export function JoinGroupForm({ initialCode = "", onJoined }: { initialCode?: string; onJoined?(): void }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await joinGroupAction(code);
      if (toastResult(r)) {
        onJoined?.();
        router.push(`/group/${r.data.groupId}`);
      } else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Código de invitación" htmlFor="join-group-code" error={error} hint="Te lo pasa un admin del grupo. No distingue mayúsculas.">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 16))}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD2345"
          className="text-center font-mono text-xl uppercase tracking-[0.25em]"
        />
      </Field>
      <Button type="submit" size="lg" fullWidth pending={pending} disabled={code.trim().length === 0}>
        Unirme
      </Button>
    </form>
  );
}

/** Botón + sheet para unirse a un grupo con código. */
export function JoinGroupButton({ label = "Tengo un código", variant = "secondary" }: { label?: string; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Unirme a un grupo">
        {open && <JoinGroupForm onJoined={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}
