import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { ImportScreen } from "@/src/features/routines-share/ImportScreen";

export const metadata: Metadata = { title: "Importar rutina" };

export default async function ImportRoutinePage() {
  await requirePageUser();
  return <ImportScreen />;
}
