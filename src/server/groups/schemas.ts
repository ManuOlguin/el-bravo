import { z } from "zod";
import { DEFAULT_TZ } from "@/src/lib/time";
import { isValidTimeZone, optionalUrl } from "@/src/server/account/schemas";

const groupName = z
  .string({ error: "Poné un nombre para el grupo." })
  .trim()
  .min(1, { error: "Poné un nombre para el grupo." })
  .max(80, { error: "El nombre tiene como máximo 80 caracteres." });

const description = z
  .string().trim().nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.union([z.string().max(1000, { error: "La descripción tiene como máximo 1000 caracteres." }), z.null()]));

const timezone = z.string().refine(isValidTimeZone, { error: "Elegí una zona horaria válida." });

export const createGroupSchema = z.object({
  name: groupName,
  description,
  photoUrl: optionalUrl,
  timezone: timezone.nullish().transform((v) => v ?? DEFAULT_TZ),
});

export const updateGroupSchema = z.object({
  name: groupName,
  description,
  photoUrl: optionalUrl,
  timezone,
});

export const idSchema = z.string({ error: "Identificador inválido." }).min(1, { error: "Identificador inválido." }).max(64);
export const roleSchema = z.enum(["admin", "member"], { error: "Rol inválido." });
export const inviteCodeInputSchema = z.string({ error: "Ingresá el código." }).max(64, { error: "El código no es válido o ya venció." });
