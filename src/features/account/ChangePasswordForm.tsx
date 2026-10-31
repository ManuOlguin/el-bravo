"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, toastResult } from "@/src/components/ui";
import { changePasswordAction } from "@/src/server/actions/account";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: ["Las contraseñas no coinciden."] });
      return;
    }
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      if (toastResult(result)) {
        setCurrent("");
        setNew("");
        setConfirm("");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Contraseña actual" htmlFor="currentPassword" error={errors.currentPassword?.[0]}>
        <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Contraseña nueva" htmlFor="newPassword" hint="Mínimo 8 caracteres." error={errors.newPassword?.[0]}>
        <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
      </Field>
      <Field label="Repetí la contraseña nueva" htmlFor="confirmPassword" error={errors.confirmPassword?.[0]}>
        <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <p className="text-xs text-fg-subtle">Al cambiarla cerramos tu sesión en los demás dispositivos.</p>
      <Button type="submit" size="lg" fullWidth pending={pending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
