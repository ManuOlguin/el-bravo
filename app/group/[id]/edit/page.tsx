import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import EditGroupForm from "@/src/components/EditGroupForm";
import LogoutButton from "@/src/components/LogoutButton";

export default async function EditGroupByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: groupId } = await params; // ✅ clave
  if (!groupId) redirect("/dashboard"); // ✅ guard extra

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, groupId, leftAt: null },
    include: { group: true },
  });

  if (!membership?.group) redirect("/dashboard");
  if (membership.role !== "admin") redirect(`/group/${groupId}`);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { where: { leftAt: null } } },
  });

  if (!group) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <a
            href={`/group/${groupId}`}
            className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600"
          >
            ← Volver al grupo
          </a>
          <LogoutButton />
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Editar grupo</h1>
          <EditGroupForm group={group} />
        </div>
      </div>
    </main>
  );
}
