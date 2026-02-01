import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export default async function GroupCompatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, leftAt: null },
    orderBy: { joinedAt: "desc" },
    select: { groupId: true },
  });

  if (!membership) redirect("/dashboard");

  redirect(`/group/${membership.groupId}`);
}
