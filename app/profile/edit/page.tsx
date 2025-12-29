import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import EditProfileForm from "@/src/components/EditProfileForm";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, photoUrl: true } });
  if (!dbUser) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Editar perfil</h1>
          <EditProfileForm user={dbUser} />
        </div>
      </div>
    </main>
  );
}
