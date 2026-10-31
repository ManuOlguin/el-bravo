import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { EditProfileForm } from "@/src/features/account/EditProfileForm";
import { otherTimezones } from "@/src/features/account/timezones";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function SettingsProfilePage() {
  const session = await requirePageUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, bio: true, photoUrl: true, weeklyGoal: true, timezone: true },
  });
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Perfil" subtitle="Así te ven los demás" back="/settings" />
      <EditProfileForm initial={user} otherTimezones={otherTimezones()} />
    </div>
  );
}
