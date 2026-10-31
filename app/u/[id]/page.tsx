import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getPublicProfile } from "@/src/server/social/profile";
import { getUserBadges } from "@/src/server/badges";
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
  const profile = await getPublicProfile(viewer.id, id);
  if (!profile) notFound();
  const badges = await getUserBadges(id);
  return <ProfileView profile={profile} badges={badges} viewerTz={viewer.timezone} />;
}
