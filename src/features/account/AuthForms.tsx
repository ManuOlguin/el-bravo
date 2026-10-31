"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { loginAction, registerAction, requestPasswordResetAction, resetPasswordAction } from "@/src/server/actions/account";
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
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-fg-muted hover:text-fg">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
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

/** Paso 1: pedir el link de recuperación por email. */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);
  const [email, setEmail] = useState("");
  const sent = state?.ok ? state.data.message : null;

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te mandamos un link por email para elegir una contraseña nueva.">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 text-sm">
            {sent}
          </p>
          <p className="text-xs text-fg-subtle">El link vence en 30 minutos y sirve una sola vez.</p>
        </div>
      ) : (
        <form action={formAction} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={state && !state.ok ? state.fieldErrors?.email?.[0] : undefined}>
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
          <FormError message={state && !state.ok && !state.fieldErrors?.email ? state.error : null} />
          <Button type="submit" size="lg" fullWidth pending={pending}>
            Mandarme el link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-fg-muted">
        <Link href="/login" className="font-semibold text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}

/** Paso 2 (desde el link del email): elegir la contraseña nueva. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);
  useAuthRedirect(state);

  if (!token) {
    return (
      <AuthCard title="Link inválido" subtitle="Este link no sirve para cambiar la contraseña.">
        <Link href="/forgot-password" className="font-semibold text-primary">
          Pedir un link nuevo
        </Link>
      </AuthCard>
    );
  }

  const failed = state && !state.ok && !state.fieldErrors ? state.error : null;
  return (
    <AuthCard title="Contraseña nueva" subtitle="Elegí una contraseña nueva. Al guardarla se cierran tus otras sesiones.">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <Field label="Contraseña nueva" htmlFor="newPassword" error={firstError(state as AuthState, "newPassword")}>
          <Input name="newPassword" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" required />
        </Field>
        <Field label="Repetila" htmlFor="confirmPassword" error={firstError(state as AuthState, "confirmPassword")}>
          <Input name="confirmPassword" type="password" autoComplete="new-password" placeholder="La misma contraseña" required />
        </Field>
        <FormError message={failed} />
        {failed && (
          <p className="text-sm">
            <Link href="/forgot-password" className="font-semibold text-primary">
              Pedir un link nuevo
            </Link>
          </p>
        )}
        <Button type="submit" size="lg" fullWidth pending={pending || !!state?.ok}>
          Guardar y entrar
        </Button>
      </form>
    </AuthCard>
  );
}
