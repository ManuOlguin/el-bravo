import { getSession } from "@/src/server/auth/dal";

/** @deprecated usar getSession/requireUser/requirePageUser de src/server/auth/dal */
export async function getCurrentUser() {
  return getSession();
}
