import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import EditProfileForm from "@/src/components/EditProfileForm";
import LogoutButton from "@/src/components/LogoutButton";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) redirect("/dashboard");

  const weeklyGoal =
  (dbUser as typeof dbUser & { weeklyGoal?: number | null }).weeklyGoal ?? 3;

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <a
            href="/profile"
            className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-500"
          >
            ← Volver al perfil
          </a>

          <LogoutButton />
        </div>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <div className="mb-6 rounded-2xl bg-slate-900/60 p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="h-24 w-24 overflow-hidden rounded-3xl bg-slate-700">
                  {dbUser.photoUrl ? (
                    <img
                      src={dbUser.photoUrl}
                      alt={dbUser.name ?? dbUser.email}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-slate-200">
                      {(dbUser.name || dbUser.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <h1 className="text-3xl font-bold leading-tight">Editar perfil</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-700 p-4">
                  <div className="text-sm text-slate-300">Email actual</div>
                  <div className="mt-1 font-semibold text-white">{dbUser.email}</div>
                </div>

                <div className="rounded-xl bg-slate-700 p-4">
                  <div className="text-sm text-slate-300">Objetivo semanal</div>
                  <div className="mt-1 font-semibold text-white">
                    {weeklyGoal} entrenamientos
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_360px]">
            <div className="rounded-2xl bg-slate-900/70 p-5">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Datos del perfil</h2>
              </div>

              <EditProfileForm
                user={{
                  id: dbUser.id,
                  name: dbUser.name,
                  email: dbUser.email,
                  photoUrl: dbUser.photoUrl,
                  weeklyGoal,
                }}
              />
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-slate-900/70 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Vista previa
                </h3>

                <div className="mt-4 rounded-2xl bg-slate-800 p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-700">
                      {dbUser.photoUrl ? (
                        <img
                          src={dbUser.photoUrl}
                          alt={dbUser.name ?? dbUser.email}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl text-slate-200">
                          {(dbUser.name || dbUser.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-lg font-semibold text-white">
                        {dbUser.name ?? "Sin nombre"}
                      </div>
                      <div className="text-sm text-slate-400">{dbUser.email}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-700 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-300">
                      Objetivo semanal
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {weeklyGoal} entrenamientos
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}