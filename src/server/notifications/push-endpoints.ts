/**
 * Hosts de los servicios de Web Push de los navegadores. El servidor hace un POST al endpoint de la
 * suscripción: aceptar cualquier URL https permitía usarlo para pegarle a hosts internos (SSRF ciego).
 */
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Opera, Samsung Internet, Brave
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge legacy / WNS
  "push.apple.com", // Safari (web.push.apple.com)
];

export function isKnownPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}
