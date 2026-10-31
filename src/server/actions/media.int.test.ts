import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

// Sesión real (JWT firmado) leída por el DAL a través de una cookie falsa.
let sessionToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (sessionToken ? { name, value: sessionToken } : undefined) }),
  headers: async () => new Headers(),
}));

const BASE = "https://media.test";
const storageState = { configured: true };
vi.mock("@/src/server/media/storage", () => ({
  isStorageConfigured: () => storageState.configured,
  publicBaseUrl: () => BASE,
  presignPut: vi.fn(async (key: string, contentType: string) => `https://signed.test/${key}?ct=${contentType}`),
  headObject: vi.fn(async () => null),
  deleteObject: vi.fn(async () => {}),
  putObject: vi.fn(async () => {}),
}));

vi.mock("@/src/server/activities/effects", async (orig) => ({
  ...(await orig<typeof import("@/src/server/activities/effects")>()),
  runActivityEffects: vi.fn(async () => ({ scoring: [], badges: [] })),
}));

import { signSessionToken } from "@/src/server/auth/session";
import { headObject, deleteObject, presignPut } from "@/src/server/media/storage";
import { MAX_BYTES, thumbKeyFor } from "@/src/server/media/keys";
import { deleteActivity } from "@/src/server/activities/service";
import {
  createUploadAction,
  confirmUploadAction,
  deleteActivityMediaAction,
  reorderActivityMediaAction,
} from "./media";

const head = vi.mocked(headObject);
const del = vi.mocked(deleteObject);
const presign = vi.mocked(presignPut);

async function loginAs(u: { id: string; email: string } | null) {
  sessionToken = u ? await signSessionToken({ userId: u.id, email: u.email }) : undefined;
}

/** Simula que el bucket tiene estas keys (tamaño en bytes). */
function bucketHas(objects: Record<string, number>, contentType = "image/webp") {
  head.mockImplementation(async (key: string) => (key in objects ? { size: objects[key], contentType } : null));
}

async function fixtures() {
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const other = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x", name: "B" } });
  const cat = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  const activity = await prisma.activity.create({
    data: { userId: user.id, activityCategoryId: cat.id, startedAt: new Date("2026-10-30T21:00:00Z"), durationMinutes: 40 },
  });
  const group = await prisma.group.create({ data: { name: "Los Bravos" } });
  await prisma.groupMember.create({ data: { groupId: group.id, userId: user.id, role: "admin" } });
  await prisma.groupMember.create({ data: { groupId: group.id, userId: other.id, role: "member" } });
  return { user, other, activity, group };
}

const webp = { contentType: "image/webp", size: 300_000, thumbSize: 20_000 };
const meta = { width: 1600, height: 1200 };

async function addMedia(activityId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await prisma.activityMedia.create({
      data: {
        activityId,
        url: `${BASE}/activities/${activityId}/m${i}.webp`,
        storageKey: `activities/${activityId}/m${i}.webp`,
        thumbUrl: `${BASE}/activities/${activityId}/m${i}-thumb.webp`,
        position: i,
      },
    });
  }
}

describe("media actions", () => {
  beforeEach(async () => {
    await resetDb();
    storageState.configured = true;
    head.mockReset();
    head.mockResolvedValue(null);
    del.mockClear();
    presign.mockClear();
    sessionToken = undefined;
  });

  describe("createUploadAction", () => {
    it("actividad propia: devuelve URLs prefirmadas para original y miniatura", async () => {
      const { user, activity } = await fixtures();
      await loginAs(user);
      const r = await createUploadAction({ kind: "activity", activityId: activity.id }, webp);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.key).toMatch(new RegExp(`^activities/${activity.id}/[A-Za-z0-9_-]+\\.webp$`));
      expect(r.data.thumbKey).toBe(thumbKeyFor(r.data.key));
      expect(r.data.publicUrl).toBe(`${BASE}/${r.data.key}`);
      expect(r.data.thumbPublicUrl).toBe(`${BASE}/${r.data.thumbKey}`);
      expect(r.data.uploadUrl).toBe(`https://signed.test/${r.data.key}?ct=image/webp`);
      expect(r.data.thumbUploadUrl).toBe(`https://signed.test/${r.data.thumbKey}?ct=image/webp`);
      // El tamaño queda firmado en cada URL (no se puede subir otro archivo más grande).
      expect(presign).toHaveBeenCalledWith(r.data.key, "image/webp", 300_000);
      expect(presign).toHaveBeenCalledWith(r.data.thumbKey, "image/webp", 20_000);
    });

    it("jpeg usa extensión .jpg", async () => {
      const { user } = await fixtures();
      await loginAs(user);
      const r = await createUploadAction({ kind: "avatar" }, { contentType: "image/jpeg", size: 1000, thumbSize: 100 });
      expect(r.ok && r.data.key).toMatch(new RegExp(`^avatars/${user.id}/[A-Za-z0-9_-]+\\.jpg$`));
    });

    it("actividad ajena: no encontrada y no firma nada", async () => {
      const { other, activity } = await fixtures();
      await loginAs(other);
      const r = await createUploadAction({ kind: "activity", activityId: activity.id }, webp);
      expect(r).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
      expect(presign).not.toHaveBeenCalled();
    });

    it("máximo 4 fotos por actividad", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 4);
      await loginAs(user);
      const r = await createUploadAction({ kind: "activity", activityId: activity.id }, webp);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/4 fotos/);
    });

    it("rechaza tipos no permitidos y archivos pesados", async () => {
      const { user } = await fixtures();
      await loginAs(user);
      const gif = await createUploadAction({ kind: "avatar" }, { contentType: "image/gif", size: 1000, thumbSize: 100 });
      expect(gif.ok).toBe(false);
      expect(!gif.ok && gif.fieldErrors?.["file.contentType"]).toBeTruthy();
      const big = await createUploadAction({ kind: "avatar" }, { contentType: "image/webp", size: MAX_BYTES + 1, thumbSize: 100 });
      expect(big.ok).toBe(false);
      expect(!big.ok && big.fieldErrors?.["file.size"]).toBeTruthy();
      expect(presign).not.toHaveBeenCalled();
    });

    it("grupo: solo el admin", async () => {
      const { user, other, group } = await fixtures();
      await loginAs(user);
      const okR = await createUploadAction({ kind: "group", groupId: group.id }, webp);
      expect(okR.ok && okR.data.key.startsWith(`groups/${group.id}/`)).toBe(true);
      await loginAs(other);
      const no = await createUploadAction({ kind: "group", groupId: group.id }, webp);
      expect(no).toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
    });

    it("sin sesión", async () => {
      await fixtures();
      const r = await createUploadAction({ kind: "avatar" }, webp);
      expect(r).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    });

    it("sin storage configurado: error claro", async () => {
      const { user } = await fixtures();
      await loginAs(user);
      storageState.configured = false;
      const r = await createUploadAction({ kind: "avatar" }, webp);
      expect(r).toEqual({ ok: false, error: "Las fotos todavía no están configuradas." });
    });
  });

  describe("confirmUploadAction", () => {
    it("actividad: crea ActivityMedia con posición, miniatura y metadatos", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 1);
      await loginAs(user);
      const key = `activities/${activity.id}/abc123.webp`;
      bucketHas({ [key]: 250_000, [thumbKeyFor(key)]: 30_000 });
      const r = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      expect(r.ok).toBe(true);
      const m = await prisma.activityMedia.findFirstOrThrow({ where: { storageKey: key } });
      expect(r.ok && r.data).toEqual({ id: m.id, url: `${BASE}/${key}` });
      expect(m).toMatchObject({
        activityId: activity.id,
        url: `${BASE}/${key}`,
        thumbUrl: `${BASE}/activities/${activity.id}/abc123-thumb.webp`,
        position: 1,
        mimeType: "image/webp",
        sizeBytes: 250_000,
        width: 1600,
        height: 1200,
        status: "ready",
      });
    });

    it("sin miniatura en el bucket: thumbUrl null", async () => {
      const { user, activity } = await fixtures();
      await loginAs(user);
      const key = `activities/${activity.id}/abc123.webp`;
      bucketHas({ [key]: 250_000 });
      const r = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      expect(r.ok).toBe(true);
      expect((await prisma.activityMedia.findFirstOrThrow({ where: { storageKey: key } })).thumbUrl).toBeNull();
    });

    it("rechaza keys de otro destino o de otro usuario sin consultar el bucket", async () => {
      const { user, other, activity } = await fixtures();
      await loginAs(user);
      const r1 = await confirmUploadAction({ kind: "activity", activityId: activity.id }, "activities/otra/abc.webp", meta);
      const r2 = await confirmUploadAction({ kind: "avatar" }, `avatars/${other.id}/abc.webp`, meta);
      const r3 = await confirmUploadAction({ kind: "activity", activityId: activity.id }, `activities/${activity.id}/abc-thumb.webp`, meta);
      for (const r of [r1, r2, r3]) expect(r).toEqual({ ok: false, error: "La foto no corresponde a este destino." });
      expect(head).not.toHaveBeenCalled();
      expect(await prisma.activityMedia.count()).toBe(0);
    });

    it("objeto inexistente: falla sin escribir", async () => {
      const { user, activity } = await fixtures();
      await loginAs(user);
      const r = await confirmUploadAction({ kind: "activity", activityId: activity.id }, `activities/${activity.id}/nope.webp`, meta);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/No encontramos la foto/);
      expect(await prisma.activityMedia.count()).toBe(0);
    });

    it("objeto más pesado que el límite: falla y lo borra del bucket", async () => {
      const { user, activity } = await fixtures();
      await loginAs(user);
      const key = `activities/${activity.id}/big.webp`;
      bucketHas({ [key]: MAX_BYTES + 1 });
      const r = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/5 MB/);
      expect(del).toHaveBeenCalledWith(key);
      expect(del).toHaveBeenCalledWith(thumbKeyFor(key));
      expect(await prisma.activityMedia.count()).toBe(0);
    });

    it("objeto con tipo no permitido: falla y lo borra", async () => {
      const { user } = await fixtures();
      await loginAs(user);
      const key = `avatars/${user.id}/x.webp`;
      bucketHas({ [key]: 1000 }, "text/html");
      const r = await confirmUploadAction({ kind: "avatar" }, key, meta);
      expect(r.ok).toBe(false);
      expect(del).toHaveBeenCalledWith(key);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).photoUrl).toBeNull();
    });

    it("es idempotente: confirmar dos veces la misma key crea una sola fila", async () => {
      const { user, activity } = await fixtures();
      await loginAs(user);
      const key = `activities/${activity.id}/abc.webp`;
      bucketHas({ [key]: 1000 });
      const a = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      const b = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      expect(a.ok && b.ok && a.data.id === b.data.id).toBe(true);
      expect(await prisma.activityMedia.count()).toBe(1);
    });

    it("quinta foto: falla y borra el objeto subido", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 4);
      await loginAs(user);
      const key = `activities/${activity.id}/fifth.webp`;
      bucketHas({ [key]: 1000, [thumbKeyFor(key)]: 100 });
      const r = await confirmUploadAction({ kind: "activity", activityId: activity.id }, key, meta);
      expect(r.ok).toBe(false);
      expect(del).toHaveBeenCalledWith(key);
      expect(del).toHaveBeenCalledWith(thumbKeyFor(key));
      expect(await prisma.activityMedia.count()).toBe(4);
    });

    it("confirmaciones concurrentes no superan el máximo", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 3);
      await loginAs(user);
      const keys = ["c1", "c2", "c3"].map((k) => `activities/${activity.id}/${k}.webp`);
      bucketHas(Object.fromEntries(keys.map((k) => [k, 1000])));
      const rs = await Promise.all(keys.map((k) => confirmUploadAction({ kind: "activity", activityId: activity.id }, k, meta)));
      expect(rs.filter((r) => r.ok)).toHaveLength(1);
      const rows = await prisma.activityMedia.findMany({ where: { activityId: activity.id }, orderBy: { position: "asc" } });
      expect(rows.map((m) => m.position)).toEqual([0, 1, 2, 3]);
    });

    it("avatar: actualiza photoUrl y borra el anterior si era del bucket propio", async () => {
      const { user } = await fixtures();
      const oldKey = `avatars/${user.id}/old.webp`;
      await prisma.user.update({ where: { id: user.id }, data: { photoUrl: `${BASE}/${oldKey}` } });
      await loginAs(user);
      const key = `avatars/${user.id}/new.webp`;
      bucketHas({ [key]: 1000, [thumbKeyFor(key)]: 100 });
      const r = await confirmUploadAction({ kind: "avatar" }, key, meta);
      expect(r).toEqual({ ok: true, data: { url: `${BASE}/${key}` }, message: "Foto actualizada" });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).photoUrl).toBe(`${BASE}/${key}`);
      expect(del).toHaveBeenCalledWith(oldKey);
      expect(del).toHaveBeenCalledWith(thumbKeyFor(oldKey));
      expect(del).not.toHaveBeenCalledWith(key);
    });

    it("avatar: no toca URLs viejas de otros hosts", async () => {
      const { user } = await fixtures();
      await prisma.user.update({ where: { id: user.id }, data: { photoUrl: "https://blob.vercel-storage.com/x.jpg" } });
      await loginAs(user);
      const key = `avatars/${user.id}/new.webp`;
      bucketHas({ [key]: 1000 });
      expect((await confirmUploadAction({ kind: "avatar" }, key, meta)).ok).toBe(true);
      expect(del).not.toHaveBeenCalled();
    });

    it("grupo: el admin cambia la foto; un miembro no", async () => {
      const { user, other, group } = await fixtures();
      const key = `groups/${group.id}/g.webp`;
      bucketHas({ [key]: 1000 });
      await loginAs(other);
      expect((await confirmUploadAction({ kind: "group", groupId: group.id }, key, meta)).ok).toBe(false);
      await loginAs(user);
      expect((await confirmUploadAction({ kind: "group", groupId: group.id }, key, meta)).ok).toBe(true);
      expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).photoUrl).toBe(`${BASE}/${key}`);
    });
  });

  describe("deleteActivityMediaAction", () => {
    it("borra fila y objetos (original y miniatura) y compacta posiciones", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 3);
      const middle = await prisma.activityMedia.findFirstOrThrow({ where: { position: 1 } });
      await loginAs(user);
      const r = await deleteActivityMediaAction(middle.id);
      expect(r.ok).toBe(true);
      const rows = await prisma.activityMedia.findMany({ where: { activityId: activity.id }, orderBy: { position: "asc" } });
      expect(rows.map((m) => [m.storageKey, m.position])).toEqual([
        [`activities/${activity.id}/m0.webp`, 0],
        [`activities/${activity.id}/m2.webp`, 1],
      ]);
      expect(del).toHaveBeenCalledWith(`activities/${activity.id}/m1.webp`);
      expect(del).toHaveBeenCalledWith(`activities/${activity.id}/m1-thumb.webp`);
    });

    it("foto de una actividad ajena: no encontrada", async () => {
      const { other, activity } = await fixtures();
      await addMedia(activity.id, 1);
      const m = await prisma.activityMedia.findFirstOrThrow();
      await loginAs(other);
      expect(await deleteActivityMediaAction(m.id)).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
      expect(await prisma.activityMedia.count()).toBe(1);
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("reorderActivityMediaAction", () => {
    it("reordena según la lista", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 3);
      const rows = await prisma.activityMedia.findMany({ orderBy: { position: "asc" } });
      await loginAs(user);
      const order = [rows[2].id, rows[0].id, rows[1].id];
      expect((await reorderActivityMediaAction(activity.id, order)).ok).toBe(true);
      const after = await prisma.activityMedia.findMany({ orderBy: { position: "asc" } });
      expect(after.map((m) => m.id)).toEqual(order);
    });

    it("rechaza listas que no coinciden con las fotos o actividades ajenas", async () => {
      const { user, other, activity } = await fixtures();
      await addMedia(activity.id, 2);
      const rows = await prisma.activityMedia.findMany({ orderBy: { position: "asc" } });
      await loginAs(user);
      expect((await reorderActivityMediaAction(activity.id, [rows[0].id])).ok).toBe(false);
      expect((await reorderActivityMediaAction(activity.id, [rows[0].id, rows[0].id])).ok).toBe(false);
      await loginAs(other);
      expect((await reorderActivityMediaAction(activity.id, [rows[1].id, rows[0].id])).ok).toBe(false);
      const after = await prisma.activityMedia.findMany({ orderBy: { position: "asc" } });
      expect(after.map((m) => m.id)).toEqual(rows.map((m) => m.id));
    });
  });

  describe("deleteActivity (servicio de actividades)", () => {
    it("borra del bucket las fotos de la actividad", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 2);
      await deleteActivity(user.id, activity.id);
      expect(await prisma.activity.count()).toBe(0);
      for (const k of ["m0", "m1"]) {
        expect(del).toHaveBeenCalledWith(`activities/${activity.id}/${k}.webp`);
        expect(del).toHaveBeenCalledWith(`activities/${activity.id}/${k}-thumb.webp`);
      }
    });

    it("si el bucket falla, la actividad se borra igual", async () => {
      const { user, activity } = await fixtures();
      await addMedia(activity.id, 1);
      del.mockRejectedValueOnce(new Error("R2 down"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      await deleteActivity(user.id, activity.id);
      spy.mockRestore();
      expect(await prisma.activity.count()).toBe(0);
    });
  });
});
