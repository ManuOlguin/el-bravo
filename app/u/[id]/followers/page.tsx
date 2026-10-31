import type { Metadata } from "next";
import { FollowListPage } from "@/src/features/social/follow-list-page";

export const metadata: Metadata = { title: "Seguidores" };

export default async function FollowersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FollowListPage userId={id} kind="followers" />;
}
