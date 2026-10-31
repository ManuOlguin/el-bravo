// Lógica pura de keys y URLs de medios (sin red ni env): la usan el server, el cliente y los scripts.

export const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];
export type MediaExt = "webp" | "jpg" | "png";

/** Tamaño máximo por objeto (original o miniatura). */
export const MAX_BYTES = 5 * 1024 * 1024;
/** Fotos por actividad. */
export const MAX_ACTIVITY_PHOTOS = 4;

/** Destino de una subida tal como lo pide el cliente (§5.8). El avatar siempre es del usuario de la sesión. */
export type UploadTarget = { kind: "activity"; activityId: string } | { kind: "avatar" } | { kind: "group"; groupId: string };

/** Destino ya resuelto en el server (el avatar lleva el id del usuario de la sesión). */
export type KeyTarget =
  | { kind: "activity"; activityId: string }
  | { kind: "avatar"; userId: string }
  | { kind: "group"; groupId: string };

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const THUMB_SUFFIX = "-thumb";

const MIME_EXT: Record<AllowedMime, MediaExt> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function isAllowedMime(m: string): m is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(m);
}

export function extForMime(m: AllowedMime): MediaExt {
  return MIME_EXT[m];
}

function segment(value: string, what: string) {
  if (!SEGMENT.test(value)) throw new Error(`Invalid ${what} for media key: ${JSON.stringify(value)}`);
  return value;
}

/** Carpeta de un destino: `activities/<id>/`, `avatars/<userId>/` o `groups/<id>/`. */
export function keyPrefix(target: KeyTarget): string {
  switch (target.kind) {
    case "activity":
      return `activities/${segment(target.activityId, "activityId")}/`;
    case "avatar":
      return `avatars/${segment(target.userId, "userId")}/`;
    case "group":
      return `groups/${segment(target.groupId, "groupId")}/`;
  }
}

export function mediaKey(target: KeyTarget, ext: MediaExt, rand: string): string {
  return `${keyPrefix(target)}${segment(rand, "rand")}.${ext}`;
}

/** Misma key con `-thumb` antes de la extensión (`<rand>-thumb.webp`). */
export function thumbKeyFor(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot <= key.lastIndexOf("/")) return `${key}${THUMB_SUFFIX}`;
  return `${key.slice(0, dot)}${THUMB_SUFFIX}${key.slice(dot)}`;
}

/** ¿`key` es un original (no miniatura) con formato válido dentro de la carpeta del destino? */
export function isOwnKeyFor(target: KeyTarget, key: string): boolean {
  let prefix: string;
  try {
    prefix = keyPrefix(target);
  } catch {
    return false;
  }
  if (!key.startsWith(prefix)) return false;
  const m = /^([A-Za-z0-9_-]{1,64})\.(webp|jpg|png)$/.exec(key.slice(prefix.length));
  return !!m && !m[1].endsWith(THUMB_SUFFIX);
}

function trimBase(base: string) {
  return base.replace(/\/+$/, "");
}

export function publicUrlFor(key: string, base: string): string {
  return `${trimBase(base)}/${key}`;
}

/** Inversa de `publicUrlFor`. `null` si la URL no es del bucket propio (otro host, otro bucket o vacía). */
export function keyFromPublicUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  const prefix = `${trimBase(base)}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split(/[?#]/)[0];
  return key && !key.split("/").includes("..") ? key : null;
}
