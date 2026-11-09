import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { isAiEnabled } from "@/src/server/ai/openai";
import { ImportScreen } from "@/src/features/routines-share/ImportScreen";

export const metadata: Metadata = { title: "Importar rutina" };
/**
 * "Leer con IA" (texto o archivos, hasta 7 rutinas) espera a OpenAI hasta AI_IMPORT_TIMEOUT_MS (85 s); las Server
 * Actions usan el límite de la página. 120 s necesita Fluid Compute (activado en el proyecto de Vercel, Hobby permite hasta 300 s) o plan Pro.
 */
export const maxDuration = 120;

export default async function ImportRoutinePage() {
  await requirePageUser();
  return <ImportScreen aiEnabled={isAiEnabled()} />;
}
