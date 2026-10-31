/**
 * Herramienta de desarrollo (W2-3): imprime el HTML de un email para revisarlo en el navegador sin Resend.
 *
 *   npx tsx scripts/dev/preview-email.ts > /tmp/x.html            # notificación instantánea
 *   npx tsx scripts/dev/preview-email.ts digest > /tmp/x.html     # resumen semanal
 */
import { renderDigestEmail, renderNotificationEmail } from "@/src/emails/render";
import { renderNotification } from "@/src/server/notifications/rules";

const appUrl = process.env.APP_URL || "http://localhost:3000";
const kind = process.argv[2] ?? "notification";

if (kind === "digest") {
  const email = renderDigestEmail(
    {
      name: "Manu",
      weekLabel: "semana del 26 de octubre",
      workouts: 4,
      daysTrained: 3,
      seasons: [{ seasonName: "Temporada Verano", groupName: "Los Bravos", rank: 2, points: 145, members: 6, href: "/group/g1/season/s1" }],
      news: [
        renderNotification("first_workout_of_week", { actorName: "Lucio", groupName: "Los Bravos", groupId: "g1" }, "manu"),
        renderNotification("rank_overtaken", { actorName: "Leo", seasonName: "Temporada Verano", groupId: "g1", seasonId: "s1" }, "manu"),
      ],
    },
    appUrl
  );
  process.stdout.write(email.html);
} else {
  const n = renderNotification(
    "season_results_published",
    { seasonName: "Temporada Verano", groupName: "Los Bravos", groupId: "g1", seasonId: "s1" },
    "manu"
  );
  process.stdout.write(renderNotificationEmail(n, appUrl).html);
}
