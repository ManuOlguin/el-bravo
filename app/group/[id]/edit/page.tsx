import { redirect } from "next/navigation";
import { PageHeader } from "@/src/components/ui";
import EditGroupForm from "@/src/components/EditGroupForm";
import { requirePageUser } from "@/src/server/auth/dal";
import { getGroupForMember } from "@/src/server/groups/queries";

// W2-2 la reemplaza por /group/[id]/settings. Usa el DTO sin inviteCode ni emails (W1-4).
export default async function EditGroupByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id: groupId } = await params;
  const group = await getGroupForMember(groupId, user.id).catch(() => null);
  if (!group) redirect("/home");
  if (group.myRole !== "admin") redirect(`/group/${groupId}`);

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Editar grupo" back={`/group/${groupId}`} />
      <EditGroupForm
        group={{ id: group.id, name: group.name, description: group.description, photoUrl: group.photoUrl, timezone: group.timezone }}
      />
    </div>
  );
}
