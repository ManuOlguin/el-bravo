import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

const BASE = "https://media.test";
vi.mock("@/src/server/media/storage", () => ({
  isStorageConfigured: () => true,
  publicBaseUrl: () => BASE,
  putObject: vi.fn(async () => {}),
  presignPut: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
}));

import { putObject } from "@/src/server/media/storage";
import { migrateImages, type MigrateOptions } from "./migrate-images-to-r2";

const put = vi.mocked(putObject);
const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), "elbravo-migrate-images-"));
afterAll(() => fs.rmSync(reportDir, { recursive: true, force: true }));

let smallJpeg: Buffer;
let bigPng: Buffer;

/** `fetch` falso: sirve un mapa url → respuesta; lo demás da 404. */
function fakeFetch(files: Record<string, { body: Buffer; type: string } | number>) {
  return vi.fn(async (url: string | URL | Request) => {
    const f = files[String(url)];
    if (f === undefined || typeof f === "number") return new Response("nope", { status: typeof f === "number" ? f : 404 });
    return new Response(new Uint8Array(f.body), { status: 200, headers: { "content-type": f.type } });
  });
}

const run = (fetchImpl: ReturnType<typeof fakeFetch>, opts: Partial<MigrateOptions> = {}) =>
  migrateImages({ dryRun: false, exercises: false, reportDir, fetch: fetchImpl as unknown as typeof fetch, log: () => {}, ...opts });

async function fixtures() {
  const user = await prisma.user.create({
    data: { email: "a@a.com", passwordHash: "x", photoUrl: "https://blob.vercel-storage.com/avatar.jpg" },
  });
  const noPhoto = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x" } });
  const group = await prisma.group.create({ data: { name: "G", photoUrl: "https://old.host/group.png" } });
  const cat = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  const activity = await prisma.activity.create({
    data: { userId: user.id, activityCategoryId: cat.id, startedAt: new Date(), durationMinutes: 30 },
  });
  const media = await prisma.activityMedia.create({ data: { activityId: activity.id, url: "https://old.host/run.png" } });
  const exercise = await prisma.exercise.create({ data: { slug: "sentadilla", name: "Sentadilla", mediaUrl: "https://old.host/squat.jpg" } });
  return { user, noPhoto, group, activity, media, exercise };
}

describe("migrate-images-to-r2", () => {
  beforeEach(async () => {
    await resetDb();
    put.mockClear();
    smallJpeg ??= await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 50, b: 50 } } }).jpeg().toBuffer();
    // Ruido aleatorio: un PNG de 1200×1200 pesa varios MB.
    bigPng ??= await sharp(Buffer.from(Array.from({ length: 1200 * 1200 * 3 }, () => Math.floor(Math.random() * 256))), {
      raw: { width: 1200, height: 1200, channels: 3 },
    })
      .png()
      .toBuffer();
  });

  const allFiles = () => ({
    "https://blob.vercel-storage.com/avatar.jpg": { body: smallJpeg, type: "image/jpeg" },
    "https://old.host/group.png": { body: bigPng, type: "image/png" },
    "https://old.host/run.png": { body: smallJpeg, type: "image/jpeg; charset=binary" },
    "https://old.host/squat.jpg": { body: smallJpeg, type: "image/jpeg" },
  });

  it("dry-run: descarga para validar pero no sube ni escribe en la DB", async () => {
    const { user, group, media } = await fixtures();
    const { rows } = await run(fakeFetch(allFiles()), { dryRun: true });
    expect(put).not.toHaveBeenCalled();
    expect(rows.map((r) => [r.table, r.status])).toEqual([
      ["User", "dry-run"],
      ["Group", "dry-run"],
      ["ActivityMedia", "dry-run"],
    ]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).photoUrl).toBe("https://blob.vercel-storage.com/avatar.jpg");
    expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).photoUrl).toBe("https://old.host/group.png");
    expect((await prisma.activityMedia.findUniqueOrThrow({ where: { id: media.id } })).url).toBe("https://old.host/run.png");
  });

  it("migra avatar, grupo y fotos de actividad (con miniatura) y actualiza las filas", async () => {
    const { user, group, activity, media, exercise } = await fixtures();
    const { rows, reportPath } = await run(fakeFetch(allFiles()));
    expect(rows.every((r) => r.status === "migrated")).toBe(true);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.photoUrl).toMatch(new RegExp(`^${BASE}/avatars/${user.id}/[A-Za-z0-9_-]+\\.jpg$`));
    const g = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(g.photoUrl).toMatch(new RegExp(`^${BASE}/groups/${group.id}/[A-Za-z0-9_-]+\\.webp$`));
    const m = await prisma.activityMedia.findUniqueOrThrow({ where: { id: media.id } });
    expect(m.url).toMatch(new RegExp(`^${BASE}/activities/${activity.id}/[A-Za-z0-9_-]+\\.webp$`));
    expect(m.storageKey).toBe(m.url.slice(BASE.length + 1));
    expect(m.thumbUrl).toBe(m.url.replace(/\.webp$/, "-thumb.webp"));
    expect(m).toMatchObject({ width: 800, height: 600, mimeType: "image/webp" });
    // Sin --exercises, el catálogo no se toca.
    expect((await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })).mediaUrl).toBe("https://old.host/squat.jpg");

    // Avatar chico en formato permitido: se sube tal cual. Grupo > 1 MB: recomprimido a WebP.
    const putFor = (prefix: string) => put.mock.calls.filter(([k]) => k.startsWith(prefix));
    expect(putFor(`avatars/${user.id}/`)[0][2]).toBe("image/jpeg");
    expect(putFor(`avatars/${user.id}/`)[0][1].equals(smallJpeg)).toBe(true);
    const [, groupBody, groupType] = putFor(`groups/${group.id}/`)[0];
    expect(groupType).toBe("image/webp");
    expect(groupBody.length).toBeLessThan(bigPng.length);
    expect(putFor(`activities/${activity.id}/`)).toHaveLength(2); // original + miniatura
    const thumbMeta = await sharp(putFor(`activities/${activity.id}/`).find(([k]) => k.includes("-thumb"))![1]).metadata();
    expect(Math.max(thumbMeta.width!, thumbMeta.height!)).toBe(400);

    const csv = fs.readFileSync(reportPath, "utf8").trim().split("\n");
    expect(csv[0]).toBe("tabla,id,url_vieja,url_nueva,estado,detalle");
    expect(csv).toHaveLength(4);
  });

  it("es idempotente: la segunda corrida no descarga ni sube nada", async () => {
    await fixtures();
    await run(fakeFetch(allFiles()));
    put.mockClear();
    const f = fakeFetch(allFiles());
    const { rows } = await run(f);
    expect(f).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(rows.every((r) => r.status === "skipped")).toBe(true);
  });

  it("404 o contenido que no es imagen → failed y la URL queda como estaba", async () => {
    const { user, group } = await fixtures();
    const files = { ...allFiles(), "https://blob.vercel-storage.com/avatar.jpg": 404, "https://old.host/group.png": { body: Buffer.from("<html>"), type: "text/html" } };
    const { rows } = await run(fakeFetch(files) as never);
    const byTable = Object.fromEntries(rows.map((r) => [r.table, r]));
    expect(byTable.User).toMatchObject({ status: "failed", detail: "HTTP 404", newUrl: "" });
    expect(byTable.Group).toMatchObject({ status: "failed" });
    expect(byTable.ActivityMedia.status).toBe("migrated");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).photoUrl).toBe("https://blob.vercel-storage.com/avatar.jpg");
    expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).photoUrl).toBe("https://old.host/group.png");
  });

  it("--limit N procesa como mucho N filas pendientes", async () => {
    await fixtures();
    const { rows } = await run(fakeFetch(allFiles()), { limit: 1 });
    expect(rows.filter((r) => r.status === "migrated")).toHaveLength(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("--exercises incluye el catálogo de ejercicios", async () => {
    const { exercise } = await fixtures();
    await run(fakeFetch(allFiles()), { exercises: true });
    expect((await prisma.exercise.findUniqueOrThrow({ where: { id: exercise.id } })).mediaUrl).toMatch(
      new RegExp(`^${BASE}/exercises/${exercise.id}/[A-Za-z0-9_-]+\\.jpg$`)
    );
  });
});
