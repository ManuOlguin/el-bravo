import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

function getWeekKey(d: Date) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(target.getUTCMonth(), 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.round((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${week}`;
}

function computeStreaks(activities: any[], weeksLookback = 16, goldenThresh = 2) {
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

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, photoUrl: true, createdAt: true } });
  if (!dbUser) redirect('/dashboard');

  const activities = await prisma.activity.findMany({ where: { userId: user.id }, orderBy: { startedAt: 'desc' }, take: 200 });
  const memberships = await prisma.groupMember.findMany({ where: { userId: user.id }, include: { group: true } });

  const totalActivities = activities.length;
  const lastActivity = activities[0]?.startedAt ?? null;
  const streaks = computeStreaks(activities.map(a => ({ startedAt: a.startedAt })), 16, 2);

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-2">
          <a href="/dashboard" className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600">← Volver al dashboard</a>
          <a href="/profile/edit" className="inline-flex items-center px-3 py-2 bg-indigo-600 rounded-md text-sm hover:bg-indigo-500">Editar perfil</a>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Perfil</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="col-span-1 flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full bg-gray-700 overflow-hidden">
                {dbUser.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dbUser.photoUrl} alt={dbUser.name ?? dbUser.email} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">{(dbUser.name || dbUser.email || 'U').charAt(0)}</div>
                )}
              </div>
              <div className="text-center">
                <div className="font-medium">{dbUser.name ?? 'Sin nombre'}</div>
                <div className="text-sm text-gray-400">{dbUser.email}</div>
              </div>
            </div>

            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-700 rounded p-4">
                  <div className="text-sm text-gray-400">Creado</div>
                  <div className="font-medium">{new Date(dbUser.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="bg-gray-700 rounded p-4">
                  <div className="text-sm text-gray-400">Actividades</div>
                  <div className="font-medium">{totalActivities}</div>
                </div>
                <div className="bg-gray-700 rounded p-4">
                  <div className="text-sm text-gray-400">Última actividad</div>
                  <div className="font-medium">{lastActivity ? new Date(lastActivity).toLocaleString() : '—'}</div>
                </div>
                <div className="bg-gray-700 rounded p-4">
                  <div className="text-sm text-gray-400">Rachas (golden / common)</div>
                  <div className="font-medium">{streaks.goldenStreak} / {streaks.commonStreak}</div>
                </div>
              </div>

              <div className="bg-gray-700 rounded p-4">
                <h2 className="text-lg font-semibold mb-2">Miembro en grupos</h2>
                <div className="space-y-2">
                  {memberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden">
                          {m.group.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.group.photoUrl} alt={m.group.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">{m.group.name.charAt(0)}</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{m.group.name}</div>
                          <div className="text-xs text-gray-400">Role: {m.role}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">Joined: {new Date(m.joinedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Actividad reciente</h2>
            <div className="space-y-2">
              {activities.length === 0 && <div className="text-sm text-gray-400">No hay actividad.</div>}
              {activities.map((a) => (
                <div key={a.id} className="p-3 bg-gray-700 rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.type ?? 'Actividad'}</div>
                    <div className="text-sm text-gray-400">{a.notes ?? ''}</div>
                  </div>
                  <div className="text-sm text-gray-400">{new Date(a.startedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
