import { z } from "zod";

// Schemas de cuenta (sin "server-only": los formularios pueden reutilizar los límites).

/**
 * Zona IANA válida. `Intl.supportedValuesOf("timeZone")` solo lista los nombres canónicos de ICU
 * (en Node 22 devuelve "America/Buenos_Aires" y no "America/Argentina/Buenos_Aires", que es el default
 * de la app), así que también se aceptan los alias que `Intl.DateTimeFormat` reconoce. Se excluyen los
 * offsets crudos ("+03:00").
 */
export function isValidTimeZone(tz: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false;
  if (supportedTimeZones().has(tz)) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

let tzCache: Set<string> | null = null;
function supportedTimeZones() {
  tzCache ??= new Set(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);
  return tzCache;
}

export const emailSchema = z
  .string({ error: "Ingresá tu email." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresá un email válido." }).max(191, { error: "El email es demasiado largo." }));

export const newPasswordSchema = z
  .string({ error: "Ingresá una contraseña." })
  .min(8, { error: "La contraseña tiene que tener al menos 8 caracteres." })
  .max(200, { error: "La contraseña es demasiado larga." });

export const nameSchema = z
  .string({ error: "Ingresá tu nombre." })
  .trim()
  .min(2, { error: "El nombre tiene que tener entre 2 y 80 caracteres." })
  .max(80, { error: "El nombre tiene que tener entre 2 y 80 caracteres." });

const nextSchema = z.string().optional().nullable();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Ingresá tu contraseña." }).min(1, { error: "Ingresá tu contraseña." }),
  next: nextSchema,
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  next: nextSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Ingresá tu contraseña actual." }).min(1, { error: "Ingresá tu contraseña actual." }),
  newPassword: newPasswordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, { error: "El link no es válido. Pedí uno nuevo." }),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], error: "Las contraseñas no coinciden." });

export const optionalUrl = z
  .string().trim().nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.union([z.url({ protocol: /^https?$/, error: "Ingresá una URL válida (https://…)." }).max(2048), z.null()]));

export const updateProfileSchema = z.object({
  name: nameSchema,
  bio: z
    .string().trim().nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.union([z.string().max(280, { error: "La bio tiene como máximo 280 caracteres." }), z.null()])),
  weeklyGoal: z.coerce
    .number({ error: "Elegí un objetivo semanal." })
    .int({ error: "El objetivo semanal es un número entero." })
    .min(1, { error: "El objetivo semanal va de 1 a 7 días." })
    .max(7, { error: "El objetivo semanal va de 1 a 7 días." }),
  timezone: z.string().refine(isValidTimeZone, { error: "Elegí una zona horaria válida." }),
  photoUrl: optionalUrl,
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
