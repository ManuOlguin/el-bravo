/**
 * Copia a R2 las imágenes que todavía están en otros hosts (Vercel Blob, etc.) y actualiza las filas.
 * Idempotente: las URLs que ya empiezan con `R2_PUBLIC_BASE_URL` se saltean. Ver docs/r2-setup.md.
 *
 *   npx tsx --conditions=react-server scripts/migrate-images-to-r2.ts [--dry-run] [--limit N] [--exercises]
 *
 * (`--conditions=react-server` hace que `server-only` no falle fuera de Next.)
 *
 * Recorre User.photoUrl, Group.photoUrl, ActivityMedia.url y, con --exercises, Exercise.mediaUrl.
 * Por cada URL externa: descarga (timeout 15 s, tiene que ser imagen), recomprime con sharp si pesa
 * más de 1 MB o el formato no está permitido, sube con `putObject` y actualiza la fila. Las fotos de
 * actividades se guardan siempre en WebP y con miniatura de 400 px. Si una URL falla (404, no es
 * imagen…), la fila queda como estaba y el reporte la marca `failed`.
 * Reporte CSV: scripts/out/migrate-images-<fecha>.csv.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ALLOWED_MIME, mediaKey, publicUrlFor, thumbKeyFor, type MediaExt } from "@/src/server/media/keys";

const TIMEOUT_MS = 15_000;
const RECOMPRESS_OVER = 1024 * 1024;
const MAX_DOWNLOAD = 50 * 1024 * 1024;

export type MigrateOptions = {
  dryRun: boolean;
  limit?: number;
  exercises: boolean;
  reportDir?: string;
  fetch?: typeof fetch;
  log?: (msg: string) => void;
};

type Table = "User" | "Group" | "ActivityMedia" | "Exercise";
export type ReportRow = {
  table: Table;
  id: string;
  oldUrl: string;
  newUrl: string;
  status: "migrated" | "skipped" | "failed" | "dry-run";
  detail: string;
};

type Candidate = { table: Table; id: string; url: string; ownerId: string };
type Prepared = { body: Buffer; contentType: string; ext: MediaExt | "gif"; width?: number; height?: number };

const EXT: Record<string, MediaExt | "gif"> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

async function toWebp(input: Buffer, maxSide: number, quality: number, animated = false) {
  return sharp(input, { animated })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

async function dims(buf: Buffer) {
  const m = await sharp(buf).metadata();
  return { width: m.width, height: m.pageHeight ?? m.height };
}

/** Deja la imagen lista para subir según la tabla destino. */
async function prepare(table: Table, body: Buffer, contentType: string): Promise<Prepared> {
  // Fotos de actividad: siempre WebP (como las sube la app), para que la miniatura comparta formato.
  if (table === "ActivityMedia") {
    const out = contentType === "image/webp" && body.length <= RECOMPRESS_OVER ? body : await toWebp(body, 1600, 82);
    return { body: out, contentType: "image/webp", ext: "webp", ...(await dims(out)) };
  }
  const allowed =
    (ALLOWED_MIME as readonly string[]).includes(contentType) || (table === "Exercise" && contentType === "image/gif");
  if (allowed && body.length <= RECOMPRESS_OVER) return { body, contentType, ext: EXT[contentType] };
  const out = await toWebp(body, 1600, 82, contentType === "image/gif");
  return { body: out, contentType: "image/webp", ext: "webp" };
}

function keyFor(c: Candidate, ext: MediaExt | "gif"): string {
  const rand = randomBytes(12).toString("base64url");
  switch (c.table) {
    case "User":
      return mediaKey({ kind: "avatar", userId: c.ownerId }, ext as MediaExt, rand);
    case "Group":
      return mediaKey({ kind: "group", groupId: c.ownerId }, ext as MediaExt, rand);
    case "ActivityMedia":
      return mediaKey({ kind: "activity", activityId: c.ownerId }, ext as MediaExt, rand);
    case "Exercise":
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(c.ownerId)) throw new Error(`Invalid exercise id ${c.ownerId}`);
      return `exercises/${c.ownerId}/${rand}.${ext}`;
  }
}

async function download(url: string, fetchImpl: typeof fetch): Promise<{ body: Buffer; contentType: string }> {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL no absoluta");
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error(`No es una imagen (${contentType || "sin content-type"})`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0) throw new Error("Archivo vacío");
  if (body.length > MAX_DOWNLOAD) throw new Error("Archivo demasiado grande");
  return { body, contentType };
}

function csvCell(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeReport(dir: string, rows: ReportRow[]) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `migrate-images-${stamp}.csv`);
  const lines = [
    "tabla,id,url_vieja,url_nueva,estado,detalle",
    ...rows.map((r) => [r.table, r.id, r.oldUrl, r.newUrl, r.status, r.detail].map(csvCell).join(",")),
  ];
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  return file;
}

type Deps = {
  prisma: (typeof import("@/src/lib/db"))["prisma"];
  putObject: (key: string, body: Buffer, contentType: string) => Promise<void>;
  base: string;
};

/** Sube la imagen (y la miniatura si es foto de actividad) y actualiza la fila. */
async function uploadAndUpdate({ prisma, putObject, base }: Deps, c: Candidate, row: ReportRow, key: string, p: Prepared) {
  await putObject(key, p.body, p.contentType);
  switch (c.table) {
    case "User":
      await prisma.user.update({ where: { id: c.id }, data: { photoUrl: row.newUrl } });
      break;
    case "Group":
      await prisma.group.update({ where: { id: c.id }, data: { photoUrl: row.newUrl } });
      break;
    case "Exercise":
      await prisma.exercise.update({ where: { id: c.id }, data: { mediaUrl: row.newUrl } });
      break;
    case "ActivityMedia": {
      const thumbKey = thumbKeyFor(key);
      let thumbUrl: string | null = null;
      try {
        await putObject(thumbKey, await toWebp(p.body, 400, 70), "image/webp");
        thumbUrl = publicUrlFor(thumbKey, base);
      } catch (e) {
        row.detail += ` (sin miniatura: ${(e as Error).message})`;
      }
      await prisma.activityMedia.update({
        where: { id: c.id },
        data: {
          url: row.newUrl,
          storageKey: key,
          thumbUrl,
          mimeType: p.contentType,
          sizeBytes: p.body.length,
          width: p.width ?? null,
          height: p.height ?? null,
          status: "ready",
        },
      });
      break;
    }
  }
}

export async function migrateImages(opts: MigrateOptions): Promise<{ rows: ReportRow[]; reportPath: string }> {
  // Imports dinámicos: `src/lib/db` lee DATABASE_URL al importarse (después de cargar el .env).
  const { prisma } = await import("@/src/lib/db");
  const { publicBaseUrl, putObject, isStorageConfigured } = await import("@/src/server/media/storage");
  if (!isStorageConfigured()) throw new Error("Faltan variables R2_* (ver docs/r2-setup.md).");
  const fetchImpl = opts.fetch ?? fetch;
  const log = opts.log ?? console.log;
  const base = publicBaseUrl();
  const isOurs = (url: string) => url.startsWith(`${base.replace(/\/+$/, "")}/`);

  const [users, groups, media, exercises] = await Promise.all([
    prisma.user.findMany({ where: { photoUrl: { not: null } }, select: { id: true, photoUrl: true }, orderBy: { id: "asc" } }),
    prisma.group.findMany({ where: { photoUrl: { not: null } }, select: { id: true, photoUrl: true }, orderBy: { id: "asc" } }),
    prisma.activityMedia.findMany({ select: { id: true, url: true, activityId: true }, orderBy: { id: "asc" } }),
    opts.exercises
      ? prisma.exercise.findMany({
          where: { mediaUrl: { not: null } },
          select: { id: true, mediaUrl: true },
          orderBy: { id: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const candidates: Candidate[] = [
    ...users.map((u) => ({ table: "User" as const, id: u.id, url: u.photoUrl!, ownerId: u.id })),
    ...groups.map((g) => ({ table: "Group" as const, id: g.id, url: g.photoUrl!, ownerId: g.id })),
    ...media.map((m) => ({ table: "ActivityMedia" as const, id: m.id, url: m.url, ownerId: m.activityId })),
    ...exercises.map((e) => ({ table: "Exercise" as const, id: e.id, url: e.mediaUrl!, ownerId: e.id })),
  ].filter((c) => c.url.trim() !== "");

  const rows: ReportRow[] = [];
  let processed = 0;
  for (const c of candidates) {
    const row: ReportRow = { table: c.table, id: c.id, oldUrl: c.url, newUrl: "", status: "skipped", detail: "" };
    rows.push(row);
    if (isOurs(c.url)) {
      row.newUrl = c.url;
      row.detail = "ya está en R2";
      continue;
    }
    if (opts.limit !== undefined && processed >= opts.limit) {
      row.detail = "fuera del --limit";
      continue;
    }
    processed++;
    try {
      const { body, contentType } = await download(c.url, fetchImpl);
      const p = await prepare(c.table, body, contentType);
      const key = keyFor(c, p.ext);
      row.newUrl = publicUrlFor(key, base);
      row.detail = `${contentType} ${body.length} B → ${p.contentType} ${p.body.length} B`;
      if (opts.dryRun) {
        row.status = "dry-run";
      } else {
        await uploadAndUpdate({ prisma, putObject, base }, c, row, key, p);
        row.status = "migrated";
      }
    } catch (e) {
      row.status = "failed";
      row.newUrl = "";
      row.detail = e instanceof Error ? (e.name === "TimeoutError" ? "Timeout (15 s)" : e.message) : String(e);
    }
    log(`${row.status.padEnd(8)} ${c.table} ${c.id} ${row.detail}`);
  }

  const reportPath = writeReport(opts.reportDir ?? path.resolve(process.cwd(), "scripts/out"), rows);
  const count = (s: ReportRow["status"]) => rows.filter((r) => r.status === s).length;
  log(
    `${opts.dryRun ? "[dry-run] " : ""}migradas ${count("migrated")} · dry-run ${count("dry-run")} · salteadas ${count("skipped")} · fallidas ${count("failed")}`,
  );
  log(`Reporte: ${reportPath}`);
  return { rows, reportPath };
}

function parseArgs(argv: string[]): MigrateOptions {
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new Error("--limit espera un entero ≥ 0");
  return { dryRun: argv.includes("--dry-run"), exercises: argv.includes("--exercises"), limit };
}

if (process.argv[1]?.endsWith("migrate-images-to-r2.ts")) {
  // .env.local (por worktree) tiene prioridad sobre .env; ninguno pisa variables ya definidas.
  config({ path: ".env.local", quiet: true });
  config({ quiet: true });
  migrateImages(parseArgs(process.argv.slice(2)))
    .then(async () => {
      const { prisma } = await import("@/src/lib/db");
      await prisma.$disconnect();
    })
    .catch((e) => {
      if (String(e?.message).includes("Server Component")) {
        console.error("Corré el script con: npx tsx --conditions=react-server scripts/migrate-images-to-r2.ts");
      }
      console.error(e);
      process.exit(1);
    });
}
