"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { loginAction, registerAction } from "@/src/server/actions/account";
import type { ActionResult } from "@/src/server/http/result";

type AuthState = ActionResult<{ next: string }> | null;

function firstError(state: AuthState, field: string) {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

/** Error general (los de campo ya se muestran debajo de cada input). */
function generalError(state: AuthState) {
  if (!state || state.ok) return null;
  return state.fieldErrors && Object.keys(state.fieldErrors).length ? null : state.error;
}

function useAuthRedirect(state: AuthState) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      // La acción ya escribió la cookie: refresh para que el layout (navbar) lea la sesión nueva.
      router.replace(state.data.next);
      router.refresh();
    }
  }, [state, router]);
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">El Bravo</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function LoginForm({ next, expired }: { next: string | null; expired: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [email, setEmail] = useState("");
  useAuthRedirect(state);

  return (
    <AuthCard title="Iniciar sesión" subtitle="Entrá para cargar entrenamientos, mantener tus rachas y competir con tu grupo.">
      <form action={formAction} className="space-y-4" noValidate>
        {expired && !state && (
          <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
            Tu sesión se cerró. Iniciá sesión de nuevo.
          </p>
        )}
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email" htmlFor="email" error={firstError(state, "email")}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={firstError(state, "password")}>
          <Input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required />
        </Field>
        <FormError message={generalError(state)} />
        <Button type="submit" size="lg" fullWidth pending={pending || !!state?.ok}>
          Ingresar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-muted">
        ¿No tenés cuenta?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-primary">
          Registrate
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useAuthRedirect(state);

  return (
    <AuthCard title="Crear cuenta" subtitle="Registrate para cargar entrenamientos, crear rutinas y sumarte a grupos.">
      <form action={formAction} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Nombre" htmlFor="name" error={firstError(state, "name")}>
          <Input name="name" autoComplete="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="email" error={firstError(state, "email")}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres." error={firstError(state, "password")}>
          <Input name="password" type="password" autoComplete="new-password" placeholder="Elegí una contraseña" required />
        </Field>
        <FormError message={generalError(state)} />
        <Button type="submit" size="lg" fullWidth pending={pending || !!state?.ok}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary">
          Iniciá sesión
        </Link>
      </p>
    </AuthCard>
  );
}
