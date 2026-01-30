import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import LogoutButton from "@/src/components/LogoutButton";
import GroupTabs from "@/src/components/GroupTabs";

function getWeekKey(d: Date) {
  // ISO week number
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.round((firstThursday - target.valueOf()) /  (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${week}`;
}

function computeStreaks(activities: any[], weeksLookback = 12, goldenThresh = 2) {
  const now = new Date();
  const weekKeys: string[] = [];
  for (let i = 0; i < weeksLookback; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weekKeys.push(getWeekKey(d));
  }

  const counts: Record<string, number> = {};
  activities.forEach((a) => {
    const k = getWeekKey(new Date(a.startedAt));
    counts[k] = (counts[k] || 0) + 1;
  });

  let common = 0;
  let golden = 0;
  for (const k of weekKeys) {
    const c = counts[k] || 0;
    if (c >= 1) {
      common += 1;
    } else break;
  }
  for (const k of weekKeys) {
    const c = counts[k] || 0;
    if (c >= goldenThresh) {
      golden += 1;
    } else break;
  }

  return { commonStreak: common, goldenStreak: golden };
}

export default async function GroupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // find the group where user is an active member
  const membership = await prisma.groupMember.findFirst({
    where: { userId: user!.id, leftAt: null },
    include: { group: true },
  });

  if (!membership?.group) {
    redirect("/dashboard");
  }

  const group = await prisma.group.findUnique({
    where: { id: membership!.groupId },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          user: { select: { id: true, name: true, email: true, photoUrl: true } },
        },
      },
      seasons: {
        orderBy: { startDate: "desc" },
        include: { members: { where: { leftAt: null }, include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } } } },
      },
    },
  });

  if (!group) redirect("/dashboard");

  const isAdmin = membership?.role === "admin";

  // collect recent activities of members
  const memberIds = group.members.map((m) => m.userId);
  const activities = await prisma.activity.findMany({
    where: { userId: { in: memberIds } },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
  });

  // prepare members with streaks
  const membersWithStats = await Promise.all(group.members.map(async (m) => {
    const acts = await prisma.activity.findMany({ where: { userId: m.userId }, orderBy: { startedAt: "desc" }, take: 200 });
    const s = computeStreaks(acts.map(a => ({ startedAt: a.startedAt })), 16, 2);
    return { id: m.user.id, name: m.user.name, email: m.user.email, photoUrl: m.user.photoUrl, ...s };
  }));

  // order members by golden then common desc
  membersWithStats.sort((a, b) => (b.goldenStreak - a.goldenStreak) || (b.commonStreak - a.commonStreak));

  // flatten activities (already fetched)
  const actData = activities.map((a) => ({ id: a.id, type: a.type, notes: a.notes, startedAt: a.startedAt, user: a.user }));

  const now = new Date();
  const activeSeason = group.seasons.find((s) => new Date(s.startDate) <= now && new Date(s.endDate) >= now) ?? null;
  const upcomingSeason = group.seasons.find((s) => new Date(s.startDate) > now) ?? null;
  const pastSeasons = group.seasons.filter((s) => new Date(s.endDate) < now);

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <a href="/dashboard" className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600">
          ← Volver al dashboard
        </a>
        <LogoutButton />
      </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-28 h-28 rounded-full bg-gray-700 overflow-hidden">
              {group.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.photoUrl} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">{group.name.charAt(0)}</div>
              )}
            </div>

            {isAdmin && (
              <div className="mt-4 sm:mt-0 sm:ml-4 flex gap-2">
                <a href="/group/edit" className="px-3 py-2 bg-gray-700 rounded-md text-white hover:bg-gray-600">Editar grupo</a>
                <a href="/create-season" className="px-3 py-2 bg-indigo-600 rounded-md text-white hover:bg-indigo-500">Crear temporada</a>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-semibold">{group.name}</h1>
              {group.description && <p className="text-sm text-gray-300 mt-2">{group.description}</p>}
              <div className="mt-3 text-sm text-gray-400">Creado: {new Date(group.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {activeSeason && (
            <div className="mt-6 bg-gray-900 p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Temporada activa: {activeSeason.name}</div>
                  <div className="text-sm text-gray-300">Finaliza: {new Date(activeSeason.endDate).toLocaleDateString()}</div>
                </div>
                <div className="text-sm text-gray-300">Días restantes: {Math.max(0, Math.ceil((new Date(activeSeason.endDate).getTime() - Date.now()) / (1000*60*60*24)))}</div>
              </div>

              <GroupTabs activities={actData} members={membersWithStats} activeSeason={upcomingSeason} pastSeasons={pastSeasons} />
            </div>
          )}

          {!activeSeason && (
            <div className="mt-6">
              <GroupTabs activities={actData} members={membersWithStats} activeSeason={upcomingSeason} pastSeasons={pastSeasons} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
