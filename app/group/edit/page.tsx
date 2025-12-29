import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import EditGroupForm from "@/src/components/EditGroupForm";

export default async function EditGroupPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const membership = await prisma.groupMember.findFirst({ where: { userId: user.id, leftAt: null }, include: { group: true } });
  if (!membership?.group) redirect('/dashboard');

  const group = await prisma.group.findUnique({ where: { id: membership.groupId }, include: { members: { where: { leftAt: null } } } });
  if (!group) redirect('/dashboard');

  // only admins can edit
  if (membership.role !== 'admin') redirect('/group');

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Editar grupo</h1>
          <EditGroupForm group={group} />
        </div>
      </div>
    </main>
  );
}
