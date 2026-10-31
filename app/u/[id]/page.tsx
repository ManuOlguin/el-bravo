import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getPublicProfile } from "@/src/server/social/profile";
import { getUserBadges } from "@/src/server/badges";
import { getUserStats } from "@/src/server/stats";
import { ProfileView } from "@/src/features/profile/ProfileView";
import { prisma } from "@/src/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: u?.name ?? "Perfil" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePageUser();
  const { id } = await params;
  if (id === viewer.id) redirect("/profile");
  const profile = await getPublicProfile(viewer.id, id);
  if (!profile) notFound();
  const [badges, stats] = await Promise.all([getUserBadges(id), getUserStats(id)]);
  return <ProfileView profile={profile} badges={badges} viewerTz={viewer.timezone} stats={stats} isOwner={false} />;
}
