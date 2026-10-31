/**
 * HTML de los emails (W2-3): un layout simple con estilos inline, sin librería de templates.
 * Los clientes de email no soportan variables CSS: la paleta replica los tokens de `app/globals.css` en rgb().
 */

const C = {
  bg: "rgb(10, 10, 10)", // --color-bg
  surface: "rgb(23, 23, 23)", // --color-surface-1
  border: "rgb(42, 42, 42)", // --color-border
  fg: "rgb(255, 255, 255)", // --color-fg
  muted: "rgb(163, 163, 163)", // --color-fg-muted
  subtle: "rgb(110, 110, 110)", // --color-fg-subtle
  primary: "rgb(138, 198, 23)", // --color-primary
  onPrimary: "rgb(11, 21, 0)", // --color-on-primary
} as const;

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** URL absoluta a partir de `APP_URL` (sin barra final) y una ruta interna. */
export function absoluteUrl(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function layout(opts: { appUrl: string; preheader: string; content: string; footer?: string }): string {
  const settings = absoluteUrl(opts.appUrl, "/settings/notifications");
  const footer =
    opts.footer ??
    `Recibís este email porque tenés una cuenta en El Bravo.
<a href="${escapeHtml(settings)}" style="color:${C.muted};text-decoration:underline;">Dejar de recibir estos emails</a>`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>El Bravo</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Montserrat,Helvetica,Arial,sans-serif;color:${C.fg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 4px 16px;font-size:20px;font-weight:800;color:${C.fg};">El <span style="color:${C.primary};">Bravo</span></td></tr>
<tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:24px;">
${opts.content}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:18px;color:${C.subtle};">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:20px;padding:12px 20px;border-radius:12px;background:${C.primary};color:${C.onPrimary};font-weight:700;font-size:14px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

/** Email instantáneo de una notificación ya renderizada (`renderNotification`). */
export function renderNotificationEmail(
  n: { icon: string; title: string; body?: string; href: string },
  appUrl: string
): RenderedEmail {
  const href = absoluteUrl(appUrl, n.href);
  const content = [
    `<p style="margin:0;font-size:32px;line-height:40px;">${escapeHtml(n.icon)}</p>`,
    `<p style="margin:8px 0 0;font-size:18px;line-height:26px;font-weight:700;color:${C.fg};">${escapeHtml(n.title)}</p>`,
    n.body ? `<p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${C.muted};">${escapeHtml(n.body)}</p>` : "",
    button(href, "Ver en El Bravo"),
  ].join("\n");
  return {
    subject: `${n.icon} ${n.title}`,
    html: layout({ appUrl, preheader: n.body ?? n.title, content }),
    text: [n.title, n.body, "", `Ver en El Bravo: ${href}`, "", `Dejar de recibir estos emails: ${absoluteUrl(appUrl, "/settings/notifications")}`]
      .filter((l) => l !== undefined)
      .join("\n"),
  };
}

export type DigestData = {
  name: string | null;
  weekLabel: string; // "semana del 26 de octubre"
  workouts: number;
  daysTrained: number;
  seasons: { seasonName: string; groupName: string; rank: number; points: number; members: number; href: string }[];
  news: { icon: string; title: string }[];
};

/** Resumen semanal: posiciones en temporadas activas, entrenamientos y novedades de la semana. */
export function renderDigestEmail(d: DigestData, appUrl: string): RenderedEmail {
  const hello = d.name ? `¡Hola, ${d.name}!` : "¡Hola!";
  const trained =
    d.workouts === 0
      ? "Esta semana no registraste entrenamientos. ¡La próxima arrancás con todo!"
      : `Registraste ${d.workouts} ${d.workouts === 1 ? "entrenamiento" : "entrenamientos"} en ${d.daysTrained} ${d.daysTrained === 1 ? "día" : "días"}.`;
  const seasons = d.seasons.length
    ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.subtle};">Tus temporadas</p>
${d.seasons
  .map(
    (s) =>
      `<p style="margin:0 0 8px;font-size:14px;line-height:20px;color:${C.fg};"><a href="${escapeHtml(absoluteUrl(appUrl, s.href))}" style="color:${C.fg};text-decoration:none;"><strong>${escapeHtml(s.seasonName)}</strong> <span style="color:${C.muted};">(${escapeHtml(s.groupName)})</span></a><br><span style="color:${C.primary};font-weight:700;">#${s.rank}</span> <span style="color:${C.muted};">de ${s.members} · ${s.points} pts</span></p>`
  )
  .join("\n")}`
    : "";
  const news = d.news.length
    ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.subtle};">Novedades</p>
${d.news.map((n) => `<p style="margin:0 0 6px;font-size:14px;line-height:20px;color:${C.fg};">${escapeHtml(n.icon)} ${escapeHtml(n.title)}</p>`).join("\n")}`
    : "";
  const content = [
    `<p style="margin:0;font-size:18px;line-height:26px;font-weight:700;color:${C.fg};">${escapeHtml(hello)}</p>`,
    `<p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${C.muted};">Tu resumen de la ${escapeHtml(d.weekLabel)}.</p>`,
    `<p style="margin:16px 0 0;font-size:15px;line-height:22px;color:${C.fg};">${escapeHtml(trained)}</p>`,
    seasons,
    news,
    button(absoluteUrl(appUrl, "/home"), "Abrir El Bravo"),
  ].join("\n");
  const text = [
    hello,
    `Tu resumen de la ${d.weekLabel}.`,
    trained,
    ...(d.seasons.length ? ["", "Tus temporadas:", ...d.seasons.map((s) => `- ${s.seasonName} (${s.groupName}): #${s.rank} de ${s.members}, ${s.points} pts`)] : []),
    ...(d.news.length ? ["", "Novedades:", ...d.news.map((n) => `- ${n.icon} ${n.title}`)] : []),
    "",
    `Abrir El Bravo: ${absoluteUrl(appUrl, "/home")}`,
    `Dejar de recibir estos emails: ${absoluteUrl(appUrl, "/settings/notifications")}`,
  ].join("\n");
  return { subject: `📬 Tu semana en El Bravo`, html: layout({ appUrl, preheader: trained, content }), text };
}

/** Recuperar contraseña: link de un solo uso que vence en 30 minutos. */
export function renderPasswordResetEmail(resetUrl: string, appUrl: string): RenderedEmail {
  const content = [
    `<p style="margin:0;font-size:18px;line-height:26px;font-weight:700;color:${C.fg};">Recuperar contraseña</p>`,
    `<p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${C.muted};">Recibimos un pedido para cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva.</p>`,
    button(resetUrl, "Elegir contraseña nueva"),
    `<p style="margin:20px 0 0;font-size:12px;line-height:18px;color:${C.subtle};">El link vence en 30 minutos y sirve una sola vez. Al cambiarla, se cierran tus sesiones abiertas.</p>`,
    `<p style="margin:8px 0 0;font-size:11px;line-height:16px;color:${C.subtle};word-break:break-all;">O copiá: ${escapeHtml(resetUrl)}</p>`,
  ].join("\n");
  return {
    subject: "Recuperar contraseña — El Bravo",
    html: layout({
      appUrl,
      preheader: "Elegí una contraseña nueva (el link vence en 30 minutos).",
      content,
      footer: "Si no lo pediste vos, ignorá este email: tu contraseña no cambia.",
    }),
    text: [
      "Recibimos un pedido para cambiar la contraseña de tu cuenta en El Bravo.",
      "",
      "Elegí una nueva acá (vence en 30 minutos y sirve una sola vez):",
      resetUrl,
      "",
      "Si no lo pediste vos, ignorá este email: tu contraseña no cambia.",
    ].join("\n"),
  };
}
