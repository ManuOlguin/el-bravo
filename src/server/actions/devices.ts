"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { prisma } from "@/src/lib/db";

// Dispositivos para Web Push (D12). W4 agrega los nativos (FCM) y el widget en src/server/devices.

const subscriptionSchema = z.object({
  endpoint: z
    .url({ error: "Suscripción inválida." })
    .max(2048)
    .refine((u) => u.startsWith("https://"), { error: "Suscripción inválida." }),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});
const labelSchema = z.string().trim().max(80).optional();
const deviceIdSchema = z.string({ error: "Dispositivo inválido." }).min(1, { error: "Dispositivo inválido." }).max(64);

const hashEndpoint = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

/**
 * Registra (o reasigna al usuario actual) la suscripción Web Push de este navegador.
 * El endpoint se deduplica por hash: si el mismo navegador se loguea con otra cuenta, pasa a la nueva.
 */
export async function registerWebPushAction(subscription: unknown, label?: string): Promise<ActionResult<{ deviceId: string }>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(subscriptionSchema, subscription);
    if (!parsed.ok) return parsed.result;
    const lbl = parseInput(labelSchema, label);
    if (!lbl.ok) return lbl.result;
    const sub = { endpoint: parsed.data.endpoint, keys: parsed.data.keys };
    const device = await prisma.device.upsert({
      where: { pushEndpointHash: hashEndpoint(sub.endpoint) },
      create: { userId: me.id, platform: "web", pushEndpointHash: hashEndpoint(sub.endpoint), pushSubscription: sub, label: lbl.data || null },
      update: { userId: me.id, pushSubscription: sub, label: lbl.data || null, lastSeenAt: new Date() },
      select: { id: true },
    });
    revalidatePath("/settings/notifications");
    return ok({ deviceId: device.id }, "Listo, vas a recibir notificaciones en este dispositivo");
  });
}

/** Quita la suscripción de este navegador (por endpoint), por ejemplo al desactivar el push acá. */
export async function unregisterWebPushAction(endpoint: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(z.string().min(1).max(2048), endpoint);
    if (!parsed.ok) return parsed.result;
    await prisma.device.deleteMany({ where: { userId: me.id, pushEndpointHash: hashEndpoint(parsed.data) } });
    revalidatePath("/settings/notifications");
    return ok(undefined, "Desactivaste las notificaciones en este dispositivo");
  });
}

/** Quita un dispositivo propio desde la lista de ajustes. */
export async function unregisterDeviceAction(deviceId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(deviceIdSchema, deviceId);
    if (!parsed.ok) return parsed.result;
    await prisma.device.deleteMany({ where: { id: parsed.data, userId: me.id } });
    revalidatePath("/settings/notifications");
    return ok(undefined, "Dispositivo quitado");
  });
}
