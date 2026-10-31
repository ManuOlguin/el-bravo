"use server";

import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { listNotifications, markAllRead, markRead, unreadCount, type NotificationView } from "@/src/server/notifications/queries";
import { CONFIGURABLE_TYPES, setPreference } from "@/src/server/notifications/preferences";

const idSchema = z.string({ error: "Notificación inválida." }).min(1, { error: "Notificación inválida." }).max(64);
const cursorSchema = idSchema.nullish();

export async function listNotificationsAction(
  cursor?: string | null,
  limit?: number
): Promise<ActionResult<{ items: NotificationView[]; nextCursor: string | null }>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(cursorSchema, cursor);
    if (!parsed.ok) return parsed.result;
    const lim = parseInput(z.number().int().min(1).max(50).optional(), limit);
    if (!lim.ok) return lim.result;
    return ok(await listNotifications(me.id, { cursor: parsed.data, limit: lim.data }));
  });
}

export async function unreadCountAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    const me = await requireUser();
    return ok(await unreadCount(me.id));
  });
}

export async function markReadAction(id: string): Promise<ActionResult<{ unread: number }>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(idSchema, id);
    if (!parsed.ok) return parsed.result;
    await markRead(me.id, parsed.data);
    return ok({ unread: await unreadCount(me.id) });
  });
}

const preferenceSchema = z.object({
  type: z.enum([...CONFIGURABLE_TYPES, "weekly_digest"], { error: "Tipo de notificación inválido." }),
  channel: z.enum(["inApp", "email", "push"], { error: "Canal inválido." }),
  value: z.boolean({ error: "Valor inválido." }),
});

/** Prende o apaga un canal de un tipo. El resumen semanal es `{ type: "weekly_digest", channel: "email" }`. */
export async function updatePreferenceAction(input: {
  type: string;
  channel: string;
  value: boolean;
}): Promise<ActionResult<{ inApp: boolean; email: boolean; push: boolean }>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(preferenceSchema, input);
    if (!parsed.ok) return parsed.result;
    const { type, channel, value } = parsed.data;
    if (type === "weekly_digest" && channel !== "email") return fail("El resumen semanal solo se configura por email.");
    return ok(await setPreference(me.id, type, channel, value));
  });
}

export async function markAllReadAction(): Promise<ActionResult<{ marked: number }>> {
  return runAction(async () => {
    const me = await requireUser();
    const marked = await markAllRead(me.id);
    return ok({ marked }, marked ? "Listo, todo leído" : "No tenías notificaciones sin leer");
  });
}
