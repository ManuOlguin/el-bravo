import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getPublicProfile } from "@/src/server/social/profile";
import { getUserBadges } from "@/src/server/badges";
import { getUserStats } from "@/src/server/stats";
import { getWorkoutHistory } from "@/src/server/stats/history";
import { listRoutines } from "@/src/server/routines/service";
import { ProfileView } from "@/src/features/profile/ProfileView";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function MyProfilePage() {
  const me = await requirePageUser();
  const [profile, badges, stats, history, routines] = await Promise.all([
    getPublicProfile(me.id, me.id),
    getUserBadges(me.id),
    getUserStats(me.id),
    getWorkoutHistory(me.id, { limit: 20 }),
    listRoutines(me.id),
  ]);
  if (!profile) notFound();
  return <ProfileView profile={profile} badges={badges} viewerTz={me.timezone} stats={stats} isOwner history={history} routines={routines} />;
}
