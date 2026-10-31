import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/src/server/http/cron-auth";
import { emitDueSeasonStarts, emitRecentlyPublishedSeasons } from "@/src/server/notifications/emit";
import { isDigestTime, sendPendingEmails, sendWeeklyDigests } from "@/src/server/notifications/email";
import { sendPendingPush } from "@/src/server/notifications/push";

// Cron de notificaciones (D9). Seguro de correr seguido (cada hora o una vez por día): todo es idempotente.
// - "Arrancó la temporada" para las que empiezan hoy en la zona de su grupo.
// - "Se publicaron los resultados" de las publicadas en los últimos 7 días (auto y manual).
// - Push pendientes (los que fallaron en el envío inmediato).
// - Emails pendientes según preferencias, y los lunes desde las 9:00 AR el resumen semanal.
// Vercel manda `Authorization: Bearer $CRON_SECRET` si la variable está definida.

export const dynamic = "force-dynamic";

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cron notifications] ${name}`, e); // un paso roto no frena al resto
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const now = new Date();
  const seasonsStarted = await step("season_started", () => emitDueSeasonStarts(now));
  const seasonsPublished = await step("season_results_published", () => emitRecentlyPublishedSeasons(now));
  const push = await step("push", () => sendPendingPush(now));
  const emails = await step("emails", () => sendPendingEmails(now));
  const digests = isDigestTime(now) ? await step("weekly_digest", () => sendWeeklyDigests(now)) : null;
  return NextResponse.json({ ok: true, seasonsStarted, seasonsPublished, push, emails, digests });
}
