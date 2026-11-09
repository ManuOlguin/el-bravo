import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { isAiEnabled } from "@/src/server/ai/openai";
import { ImportScreen } from "@/src/features/routines-share/ImportScreen";

export const metadata: Metadata = { title: "Importar rutina" };
/**
 * "Leer con IA" (texto o archivos, hasta 7 rutinas) espera a OpenAI hasta AI_IMPORT_TIMEOUT_MS (85 s); las Server
 * Actions usan el límite de la página. 100 s necesita Fluid Compute o plan Pro en Vercel (plan 3b, Task 1).
 */
export const maxDuration = 100;

export default async function ImportRoutinePage() {
  await requirePageUser();
  return <ImportScreen aiEnabled={isAiEnabled()} />;
}
