/**
 * Canal email (D9): outbox sobre `Notification.emailedAt` + resumen semanal. Lo corre el cron
 * `/api/cron/notifications`. Sin proveedor configurado (Resend o SMTP, ver `src/server/email/transport.ts`)
 * queda deshabilitado (loguea y no falla).
 */
import { emailProvider, getMailSender, type MailMessage, type MailSender } from "@/src/server/email/transport";
import { prisma } from "@/src/lib/db";
import { addDays, addWeeks, formatLocalDate, localDateOf, weekKeyOf, zonedToUtc } from "@/src/lib/time";
import { renderDigestEmail, renderNotificationEmail, type RenderedEmail } from "@/src/emails/render";
import { loadPrefs } from "./preferences";
import { renderData } from "./queries";
import { renderNotification } from "./rules";

export type EmailMessage = MailMessage & RenderedEmail;
/** Envía o lanza. */
export type EmailSender = MailSender;

const HOUR_MS = 3_600_000;
/** Solo se mandan por email las notificaciones de las últimas 48 h (no un backlog viejo al activar el canal). */
const EMAIL_WINDOW_MS = 48 * HOUR_MS;
const BATCH = 100;

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function isEmailEnabled(): boolean {
  return emailProvider() !== null;
}

/** Sender real (Resend o SMTP), o `null` si no hay proveedor configurado. */
export function getEmailSender(): EmailSender | null {
  return getMailSender();
}

export type EmailRunResult = { disabled: boolean; sent: number; failed: number; skipped: number };

function disabled(): EmailRunResult {
  console.info("[email] email deshabilitado (falta RESEND_API_KEY o EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD)");
  return { disabled: true, sent: 0, failed: 0, skipped: 0 };
}

/**
 * Envía por email las notificaciones pendientes (`emailedAt = null`) permitidas por las preferencias.
 * Si el envío falla, `emailedAt` queda en null y se reintenta en la próxima corrida.
 */
export async function sendPendingEmails(now: Date = new Date(), opts: { sender?: EmailSender | null } = {}): Promise<EmailRunResult> {
  const sender = opts.sender === undefined ? getEmailSender() : opts.sender;
  if (!sender) return disabled();

  const rows = await prisma.notification.findMany({
    where: {
      emailedAt: null,
      readAt: null, // si ya la vio en la app, no hace falta el email
      type: { not: "weekly_digest" },
      createdAt: { gte: new Date(now.getTime() - EMAIL_WINDOW_MS), lte: now },
      recipient: { isActive: true },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH * 5,
    select: {
      id: true,
      type: true,
      recipientId: true,
      actorId: true,
      groupId: true,
      seasonId: true,
      activityId: true,
      data: true,
      dedupeKey: true,
      recipient: { select: { email: true } },
      actor: { select: { id: true, name: true, photoUrl: true } },
      group: { select: { name: true } },
      season: { select: { name: true } },
    },
  });
  const prefs = await loadPrefs([...new Set(rows.map((r) => r.recipientId))], [...new Set(rows.map((r) => r.type))]);
  const allowed = rows.filter((r) => prefs(r.recipientId, r.type).email).slice(0, BATCH);

  const result: EmailRunResult = { disabled: false, sent: 0, failed: 0, skipped: rows.length - allowed.length };
  const base = appUrl();
  for (const r of allowed) {
    try {
      const rendered = renderNotification(r.type, renderData(r), r.recipientId);
      await sender({ ...renderNotificationEmail(rendered, base), to: r.recipient.email, idempotencyKey: `n:${r.id}` });
      await prisma.notification.update({ where: { id: r.id }, data: { emailedAt: new Date() } });
      result.sent++;
    } catch (e) {
      result.failed++;
      console.error("[email] no se pudo enviar", r.id, e);
    }
  }
  return result;
}

/** Lunes desde las 9:00 (o martes, de respaldo) en la zona de Argentina: hora de mandar el resumen. */
export function isDigestTime(now: Date, tz = "America/Argentina/Buenos_Aires"): boolean {
  const today = localDateOf(now, tz);
  const monday = weekKeyOf(now, tz);
  if (today === monday) return now >= zonedToUtc(monday, "09:00", tz);
  return today === addDays(monday, 1);
}

/**
 * Resumen semanal de la semana que terminó (en la zona de cada usuario). Solo a quien tiene el resumen
 * activado (preferencia `weekly_digest.email`, activa por defecto) y tuvo actividad o novedades.
 * Cada envío queda registrado como `Notification` `weekly_digest` con `dedupeKey` `digest:<userId>:<weekKey>`.
 */
export async function sendWeeklyDigests(now: Date = new Date(), opts: { sender?: EmailSender | null } = {}): Promise<EmailRunResult> {
  const sender = opts.sender === undefined ? getEmailSender() : opts.sender;
  if (!sender) return disabled();

  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true, name: true, timezone: true } });
  const prefs = await loadPrefs(
    users.map((u) => u.id),
    ["weekly_digest"]
  );
  const result: EmailRunResult = { disabled: false, sent: 0, failed: 0, skipped: 0 };
  const base = appUrl();

  for (const u of users) {
    if (!prefs(u.id, "weekly_digest").email) {
      result.skipped++;
      continue;
    }
    const weekKey = addWeeks(weekKeyOf(now, u.timezone), -1);
    const dedupeKey = `digest:${u.id}:${weekKey}`;
    if (await prisma.notification.findUnique({ where: { dedupeKey }, select: { id: true } })) {
      result.skipped++;
      continue;
    }
    const from = zonedToUtc(weekKey, "00:00", u.timezone);
    const to = zonedToUtc(addDays(weekKey, 7), "00:00", u.timezone);

    const [activities, news, seasons] = await Promise.all([
      prisma.activity.findMany({ where: { userId: u.id, startedAt: { gte: from, lt: to } }, select: { startedAt: true } }),
      prisma.notification.findMany({
        where: { recipientId: u.id, type: { not: "weekly_digest" }, createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          type: true,
          actorId: true,
          groupId: true,
          seasonId: true,
          activityId: true,
          data: true,
          actor: { select: { id: true, name: true, photoUrl: true } },
          group: { select: { name: true } },
          season: { select: { name: true } },
        },
      }),
      prisma.seasonMember.findMany({
        where: { userId: u.id, leftAt: null, season: { finalizedAt: null, startDate: { lt: to }, endDate: { gte: from } } },
        select: {
          season: {
            select: {
              id: true,
              name: true,
              groupId: true,
              group: { select: { name: true } },
              standings: { select: { userId: true, rank: true, points: true } },
            },
          },
        },
      }),
    ]);

    if (activities.length === 0 && news.length === 0) {
      result.skipped++; // sin actividad ni novedades: no se manda
      continue;
    }

    const digest = renderDigestEmail(
      {
        name: u.name,
        weekLabel: `semana del ${formatLocalDate(weekKey, "long")}`,
        workouts: activities.length,
        daysTrained: new Set(activities.map((a) => localDateOf(a.startedAt, u.timezone))).size,
        seasons: seasons
          .map(({ season: s }) => {
            const mine = s.standings.find((r) => r.userId === u.id);
            return mine
              ? {
                  seasonName: s.name,
                  groupName: s.group.name,
                  rank: mine.rank,
                  points: mine.points,
                  members: s.standings.length,
                  href: `/group/${s.groupId}/season/${s.id}`,
                }
              : null;
          })
          .filter((s): s is NonNullable<typeof s> => !!s),
        news: news.map((n) => {
          const r = renderNotification(n.type, renderData(n), u.id);
          return { icon: r.icon, title: r.title };
        }),
      },
      base
    );

    try {
      await sender({ ...digest, to: u.email, idempotencyKey: dedupeKey });
      const sentAt = new Date();
      await prisma.notification.createMany({
        data: [{ recipientId: u.id, type: "weekly_digest", dedupeKey, data: { weekKey }, emailedAt: sentAt, readAt: sentAt }],
        skipDuplicates: true,
      });
      result.sent++;
    } catch (e) {
      result.failed++;
      console.error("[email] no se pudo enviar el resumen", u.id, e);
    }
  }
  return result;
}
