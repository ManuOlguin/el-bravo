import { z } from "zod";
import { ALLOWED_MIME, MAX_BYTES } from "./keys";

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Id inválido");

export const uploadTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("activity"), activityId: id }),
  z.object({ kind: z.literal("avatar") }),
  z.object({ kind: z.literal("group"), groupId: id }),
]);

export const uploadFileSchema = z.object({
  contentType: z.enum(ALLOWED_MIME, { error: "Formato no soportado. Usá JPG, PNG o WebP." }),
  size: z
    .number()
    .int()
    .positive("El archivo está vacío.")
    .max(MAX_BYTES, "La foto pesa más de 5 MB."),
  /** Tamaño de la miniatura: también se firma en su URL. */
  thumbSize: z.number().int().positive("La miniatura está vacía.").max(MAX_BYTES, "La miniatura pesa más de 5 MB."),
});

export const createUploadSchema = z.object({ target: uploadTargetSchema, file: uploadFileSchema });

export const confirmUploadSchema = z.object({
  target: uploadTargetSchema,
  key: z.string().min(1).max(255),
  meta: z.object({
    width: z.number().int().min(1).max(20000),
    height: z.number().int().min(1).max(20000),
  }),
});

export const reorderSchema = z.object({
  activityId: id,
  mediaIds: z
    .array(id)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Hay fotos repetidas."),
});
