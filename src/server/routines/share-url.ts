import "server-only";
import { absoluteUrl } from "@/src/emails/render";
import { appUrl } from "@/src/server/notifications/email";

/** Link absoluto de una rutina (pie "Hecho con El Bravo · …" del texto de Compartir). Solo para rutinas públicas. */
export function routineShareUrl(routineId: string): string {
  return absoluteUrl(appUrl(), `/routines/${routineId}`);
}
