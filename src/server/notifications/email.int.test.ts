import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { localDateToDbDate, zonedToUtc } from "@/src/lib/time";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { getEmailSender, isDigestTime, sendPendingEmails, sendWeeklyDigests } from "./email";
import { notify } from "./notify";

const TZ = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-11-04T18:00:00Z");

async function user(name: string) {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name, timezone: TZ } });
}

describe("email (Resend mockeado)", () => {
  const prevKey = process.env.RESEND_API_KEY;
  beforeEach(async () => {
    await resetDb();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "em_1" }, error: null });
    process.env.RESEND_API_KEY = "re_test_123";
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
  });

  async function seedNotifs() {
    const manu = await user("Manu");
    const ana = await user("Ana");
    const at = new Date(NOW.getTime() - 3600_000);
    await prisma.notification.createMany({
      data: [
        { recipientId: manu.id, actorId: ana.id, type: "new_follower", dedupeKey: "a", createdAt: at }, // email por defecto: sí
        { recipientId: manu.id, actorId: ana.id, type: "first_workout_of_week", dedupeKey: "b", createdAt: at }, // por defecto: no
      ],
    });
    return { manu, ana };
  }

  it("sin RESEND_API_KEY: deshabilitado, no falla y no toca nada", async () => {
    delete process.env.RESEND_API_KEY;
    await seedNotifs();
    expect(getEmailSender()).toBeNull();
    expect(await sendPendingEmails(NOW)).toMatchObject({ disabled: true, sent: 0 });
    expect(await sendWeeklyDigests(NOW)).toMatchObject({ disabled: true, sent: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(await prisma.notification.count({ where: { emailedAt: { not: null } } })).toBe(0);
  });

  it("con preferencias por defecto solo envía lo permitido, setea emailedAt y no reenvía", async () => {
    const { manu } = await seedNotifs();
    const r = await sendPendingEmails(NOW);
    expect(r).toMatchObject({ disabled: false, sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    const [payload, reqOpts] = send.mock.calls[0];
    expect(payload).toMatchObject({ to: manu.email, subject: "👋 Ana empezó a seguirte" });
    expect(payload.html).toContain("Dejar de recibir estos emails");
    expect(payload.html).toContain("/settings/notifications");
    expect(reqOpts.idempotencyKey).toMatch(/^n:/);
    expect(await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "a" } })).toHaveProperty("emailedAt", expect.any(Date));
    expect((await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "b" } })).emailedAt).toBeNull();

    await sendPendingEmails(NOW);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("respeta email=true explícito y email=false explícito", async () => {
    const { manu } = await seedNotifs();
    await prisma.notificationPreference.createMany({
      data: [
        { userId: manu.id, type: "new_follower", email: false },
        { userId: manu.id, type: "first_workout_of_week", email: true },
      ],
    });
    await sendPendingEmails(NOW);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain("fue el primero");
  });

  it("si Resend falla, emailedAt queda null y se reintenta en la próxima corrida", async () => {
    await seedNotifs();
    send.mockResolvedValueOnce({ data: null, error: { message: "rate limited", statusCode: 429, name: "rate_limit_exceeded" } });
    expect(await sendPendingEmails(NOW)).toMatchObject({ sent: 0, failed: 1 });
    expect((await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "a" } })).emailedAt).toBeNull();
    expect(await sendPendingEmails(NOW)).toMatchObject({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("no manda notificaciones ya leídas ni viejas (más de 48 h)", async () => {
    const { manu, ana } = await seedNotifs();
    await prisma.notification.update({ where: { dedupeKey: "a" }, data: { readAt: NOW } });
    await prisma.notification.create({
      data: { recipientId: manu.id, actorId: ana.id, type: "new_follower", dedupeKey: "old", createdAt: new Date(NOW.getTime() - 72 * 3600_000) },
    });
    expect(await sendPendingEmails(NOW)).toMatchObject({ sent: 0 });
  });

  describe("resumen semanal", () => {
    const MONDAY = new Date("2026-11-09T12:30:00Z"); // lunes 9/11 09:30 AR → resume la semana del 2/11

    it("isDigestTime: lunes desde las 9 (AR) y martes de respaldo", () => {
      expect(isDigestTime(new Date("2026-11-09T11:59:00Z"))).toBe(false); // lunes 08:59
      expect(isDigestTime(new Date("2026-11-09T12:00:00Z"))).toBe(true); // lunes 09:00
      expect(isDigestTime(new Date("2026-11-10T20:00:00Z"))).toBe(true); // martes
      expect(isDigestTime(new Date("2026-11-11T12:00:00Z"))).toBe(false); // miércoles
    });

    it("se manda solo con actividad, incluye posiciones y entrenamientos, y queda registrado sin mostrarse", async () => {
      const manu = await user("Manu");
      const lucio = await user("Lucio");
      await user("Quieto"); // sin actividad ni novedades → no recibe
      const cat = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gimnasio" } });
      const g = await prisma.group.create({ data: { name: "Los Bravos", timezone: TZ } });
      const s = await prisma.season.create({
        data: {
          groupId: g.id,
          name: "Temporada Verano",
          startDate: localDateToDbDate("2026-11-02"),
          endDate: localDateToDbDate("2026-11-29"),
          members: { create: [{ userId: manu.id }, { userId: lucio.id }] },
        },
      });
      await prisma.seasonStanding.createMany({
        data: [
          { seasonId: s.id, userId: manu.id, rank: 1, points: 60, daysTrained: 2, activities: 2, minutes: 90, weeksGoalMet: 0, currentStreak: 0, bestStreak: 0 },
          { seasonId: s.id, userId: lucio.id, rank: 2, points: 10, daysTrained: 1, activities: 1, minutes: 45, weeksGoalMet: 0, currentStreak: 0, bestStreak: 0 },
        ],
      });
      for (const d of ["2026-11-03", "2026-11-05"]) {
        await prisma.activity.create({ data: { userId: manu.id, activityCategoryId: cat.id, startedAt: zonedToUtc(d, "18:00", TZ), durationMinutes: 45 } });
      }
      // Lucio no entrenó, pero tuvo una novedad esa semana.
      await prisma.notification.create({
        data: { recipientId: lucio.id, actorId: manu.id, type: "rank_overtaken", seasonId: s.id, groupId: g.id, dedupeKey: "o", createdAt: zonedToUtc("2026-11-05", "19:00", TZ) },
      });

      const r = await sendWeeklyDigests(MONDAY);
      expect(r).toMatchObject({ sent: 2, failed: 0 });
      const byTo = new Map(send.mock.calls.map(([p, o]) => [p.to, { p, o }]));
      expect([...byTo.keys()].sort()).toEqual([lucio.email, manu.email].sort());
      const m = byTo.get(manu.email)!;
      expect(m.p.text).toContain("Registraste 2 entrenamientos en 2 días");
      expect(m.p.text).toContain("Temporada Verano (Los Bravos): #1 de 2, 60 pts");
      expect(m.o.idempotencyKey).toBe(`digest:${manu.id}:2026-11-02`);
      expect(byTo.get(lucio.email)!.p.text).toContain("Manu te pasó en Temporada Verano");

      const logged = await prisma.notification.findMany({ where: { type: "weekly_digest" } });
      expect(logged).toHaveLength(2);
      expect(logged.every((n) => n.emailedAt && n.dedupeKey.startsWith("digest:"))).toBe(true);

      await sendWeeklyDigests(MONDAY); // idempotente
      expect(send).toHaveBeenCalledTimes(2);
    });

    it("resumen apagado en preferencias: no se manda", async () => {
      const manu = await user("Manu");
      const ana = await user("Ana");
      await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: () => "x" });
      await prisma.notification.update({ where: { dedupeKey: "x" }, data: { createdAt: new Date("2026-11-04T12:00:00Z") } });
      await prisma.notificationPreference.create({ data: { userId: manu.id, type: "weekly_digest", email: false } });
      expect(await sendWeeklyDigests(MONDAY)).toMatchObject({ sent: 0 });
    });
  });
});
