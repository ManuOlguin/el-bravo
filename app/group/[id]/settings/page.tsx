import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/src/components/ui";
import { AuthError, requirePageUser } from "@/src/server/auth/dal";
import { getGroupForMember } from "@/src/server/groups/queries";
import { otherTimezones } from "@/src/features/account/timezones";
import { GroupSettings } from "@/src/features/group/GroupSettings";

export const metadata: Metadata = { title: "Configuración del grupo" };

export default async function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  let group;
  try {
    group = await getGroupForMember(id, user.id);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }
  if (group.myRole !== "admin") redirect(`/group/${group.id}`);

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Configuración" subtitle={group.name} back={`/group/${group.id}`} />
      <GroupSettings
        groupId={group.id}
        initial={{ name: group.name, description: group.description, timezone: group.timezone, photoUrl: group.photoUrl }}
        otherTimezones={otherTimezones()}
        memberCount={group.members.length}
      />
    </div>
  );
}
