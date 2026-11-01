import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { isAiEnabled } from "@/src/server/ai/openai";
import { ImportScreen } from "@/src/features/routines-share/ImportScreen";

export const metadata: Metadata = { title: "Importar rutina" };
/** "Leer con IA" puede tardar hasta 30 s (timeout del cliente de OpenAI): las Server Actions usan el límite de la página. */
export const maxDuration = 60;

export default async function ImportRoutinePage() {
  await requirePageUser();
  return <ImportScreen aiEnabled={isAiEnabled()} />;
}
