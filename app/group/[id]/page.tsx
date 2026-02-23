// app/group/[id]/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import GroupPageClient from "./GroupPageClient";

function getWeekKey(d: Date) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(
      0,
      1 + ((4 - target.getUTCDay()) + 7) % 7
    );
  }
  const week =
    1 + Math.round(
      (firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000)
    );
  return `${d.getUTCFullYear()}-W${week}`;
}

function computeStreaks(
  activities: any[],
  weeksLookback = 16,
  goldenThresh = 2
) {
  const now = new Date();
  const currentWeekKey = getWeekKey(now); // 🔹 semana actual (ISO / lunes-based)

  // Generamos las keys de las últimas N semanas para calcular las rachas
  const weekKeys: string[] = [];
  for (let i = 0; i < weeksLookback; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weekKeys.push(getWeekKey(d));
  }

  // Contamos cuántos entrenos hay por semana
  const counts: Record<string, number> = {};
  activities.forEach((a) => {
    const k = getWeekKey(new Date(a.startedAt));
    counts[k] = (counts[k] || 0) + 1;
  });

  let common = 0;
  let golden = 0;

  // 🔹 Racha común: semanas seguidas con >= 1 entreno
  for (const k of weekKeys) {
    const c = counts[k] || 0;
    if (c >= 1) common += 1;
    else break;
  }

  // 🔹 Racha golden: semanas seguidas con >= goldenThresh entrenos
  for (const k of weekKeys) {
    const c = counts[k] || 0;
    if (c >= goldenThresh) golden += 1;
    else break;
  }

  // 🔹 Entrenamientos en la semana ACTUAL
  const currentWeekCount = counts[currentWeekKey] || 0;

  return { commonStreak: common, goldenStreak: golden, currentWeekCount };
}

export default async function GroupByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: groupId } = await params;

  if (!groupId) redirect("/dashboard");

  // Validar que el user sea miembro activo de ESTE grupo
  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, groupId, leftAt: null },
    include: { group: true },
  });

  if (!membership?.group) redirect("/dashboard");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoUrl: true,
            },
          },
        },
      },
      seasons: {
        orderBy: { startDate: "desc" },
        include: {
          members: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!group) redirect("/dashboard");

  const isAdmin = membership.role === "admin";

  // Actividad reciente del grupo
  const memberIds = group.members.map((m) => m.userId);
  const activities = await prisma.activity.findMany({
    where: { userId: { in: memberIds } },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          photoUrl: true,
        },
      },
    },
  });

  const membersWithStats = await Promise.all(
    group.members.map(async (m) => {
      const acts = await prisma.activity.findMany({
        where: { userId: m.userId },
        orderBy: { startedAt: "desc" },
        take: 200,
      });
      const s = computeStreaks(
        acts.map((a) => ({ startedAt: a.startedAt })),
        16,
        2
      );
      return {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        photoUrl: m.user.photoUrl,
        ...s,
      };
    })
  );

  membersWithStats.sort(
    (a, b) =>
      b.goldenStreak - a.goldenStreak ||
      b.commonStreak - a.commonStreak
  );

  const actData = activities.map((a) => ({
    id: a.id,
    type: a.type,
    notes: a.notes,
    startedAt: a.startedAt,
    user: a.user,
  }));

  const now = new Date();
  const activeSeason =
    group.seasons.find(
      (s) =>
        new Date(s.startDate) <= now &&
        new Date(s.endDate) >= now
    ) ?? null;
  const upcomingSeason =
    group.seasons.find(
      (s) => new Date(s.startDate) > now
    ) ?? null;
  const pastSeasons = group.seasons.filter(
    (s) => new Date(s.endDate) < now
  );

  return (
    <GroupPageClient
      group={group}
      isAdmin={isAdmin}
      activities={actData}
      membersWithStats={membersWithStats}
      activeSeason={activeSeason}
      upcomingSeason={upcomingSeason}
      pastSeasons={pastSeasons}
    />
  );
}
