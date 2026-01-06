import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import JoinGroupModal from "@/src/components/JoinGroupModal";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const membership = user?.groupMembers && user.groupMembers.length > 0 ? user.groupMembers[0] : null;
  const group = membership?.group ?? null;

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <a href="/profile" aria-label="Profile">
              <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                {user?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoUrl} alt={user.name ?? user.email} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-300">{(user?.name || user?.email || "U").charAt(0)}</span>
                )}
              </div>
            </a>

            <div>
              <p className="text-sm text-gray-300">Hola,</p>
              <p className="text-lg font-semibold">{user?.name ?? user?.email}</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center" />
        </header>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <a href="/load" className="w-full sm:w-auto px-4 py-2 bg-indigo-600 rounded-md text-white text-center hover:bg-indigo-500">Cargar entrenamiento</a>

          {group ? (
            <>
              <a
                href="/group"
                className="w-full sm:w-auto px-4 py-2 bg-gray-700 rounded-md text-white text-center hover:bg-gray-600"
              >
                Ir al grupo
              </a>

              <a
                href="/routine"
                className="w-full sm:w-auto px-4 py-2 bg-indigo-500 rounded-md text-white text-center hover:bg-indigo-400"
              >
                Mis rutinas
              </a>
            </>
          ) : (
            <>
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
            </>
          )}


          <form action="/api/auth/logout" method="POST" className="w-full sm:w-auto">
            <button type="submit" className="w-full sm:w-auto px-3 py-2 bg-red-600 rounded-md text-white hover:bg-red-500">Logout</button>
          </form>
        </div>

        <section className="bg-gray-800 rounded-lg p-6 shadow">
          {group ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  <p className="text-sm text-gray-300">Miembros ({group.members?.length ?? 0})</p>
                </div>
                <a href="/group" className="text-indigo-400 hover:underline">Ver grupo</a>
              </div>

              <ul className="space-y-3">
                {group.members?.map((m: any) => (
                  <li key={m.user.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                      {m.user.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.user.photoUrl} alt={m.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300">{(m.user.name || m.user.email || "U").charAt(0)}</span>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{m.user.name ?? m.user.email}</div>
                        <div className="text-sm text-gray-400">{m.role}</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Última actividad:{" "}
                        {m.user.activities && m.user.activities[0]
                          ? new Date(m.user.activities[0].startedAt).toLocaleString()
                          : "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">No estás en un grupo</h2>
              <p className="text-sm text-gray-300 mb-4">Unite a uno con un código o crea un nuevo grupo.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
