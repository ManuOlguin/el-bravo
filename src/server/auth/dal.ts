// TEMP W0-B: se reemplaza al mergear W0-A
// Stub mínimo con la firma de 00-roadmap §5.2 para que el layout compile antes
// de que exista el DAL real. Al mergear, quedarse con la versión de W0-A.
import { cache } from "react";
import { getCurrentUser } from "@/src/lib/currentUser";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  photoUrl: string | null;
  timezone: string;
};

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export const getSession: () => Promise<SessionUser | null> = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photoUrl,
    timezone: DEFAULT_TZ,
  };
});
