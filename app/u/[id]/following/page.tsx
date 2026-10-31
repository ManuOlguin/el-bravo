import type { Metadata } from "next";
import { FollowListPage } from "@/src/features/social/follow-list-page";

export const metadata: Metadata = { title: "Seguidos" };

export default async function FollowingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FollowListPage userId={id} kind="following" />;
}
