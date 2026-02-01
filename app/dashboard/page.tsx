import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import LogoutButton from "@/src/components/LogoutButton";
import JoinGroupModal from "@/src/components/JoinGroupModal";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Traer TODAS las membresías activas del usuario
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id, leftAt: null },
    orderBy: { joinedAt: "desc" },
    include: {
      group: {
        include: {
          members: {
            where: { leftAt: null },
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true, photoUrl: true } },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <a href="/profile" aria-label="Profile">
              <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                {user.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoUrl}
                    alt={user.name ?? user.email ?? "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-300">
                    {(user.name || user.email || "U").charAt(0)}
                  </span>
                )}
              </div>
            </a>

            <div>
              <p className="text-sm text-gray-300">Hola,</p>
              <p className="text-lg font-semibold">{user.name ?? user.email}</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center">
            <LogoutButton />
          </div>
        </header>

        {/* Botonera principal: siempre disponible */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <a
            href="/load"
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 rounded-md text-white text-center hover:bg-indigo-500"
          >
            Cargar entrenamiento
          </a>

          <div className="w-full sm:w-auto">
            <JoinGroupModal />
          </div>

          <a
            href="/create-group"
            className="w-full sm:w-auto px-3 py-2 bg-green-600 rounded-md text-white text-center hover:bg-green-500"
          >
            Crear grupo
          </a>

          <a
            href="/routine"
            className="w-full sm:w-auto px-4 py-2 bg-indigo-500 rounded-md text-white text-center hover:bg-indigo-400"
          >
            Mis rutinas
          </a>
        </div>

        {/* Tus grupos */}
        <section className="bg-gray-800 rounded-lg p-6 shadow">
          {memberships.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold mb-4">Tus grupos</h2>

              <ul className="space-y-3">
                {memberships.map((m) => (
                  <li
                    key={m.groupId}
                    className="bg-gray-900 rounded-md p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xl font-semibold truncate">{m.group.name}</div>
                      <div className="text-sm text-gray-300">
                        Miembros ({m.group.members?.length ?? 0}) · Tu rol: {m.role}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={`/group/${m.groupId}`}
                        className="text-indigo-400 hover:underline whitespace-nowrap"
                      >
                        Ver grupo
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">No estás en ningún grupo</h2>
              <p className="text-sm text-gray-300 mb-4">
                Uníte a uno con un código o creá un nuevo grupo.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
