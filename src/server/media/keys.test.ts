import { describe, it, expect } from "vitest";
import {
  ALLOWED_MIME,
  MAX_BYTES,
  extForMime,
  isOwnKeyFor,
  keyFromPublicUrl,
  keyPrefix,
  mediaKey,
  publicUrlFor,
  thumbKeyFor,
} from "./keys";

const BASE = "https://media.elbravo.app";

describe("media keys", () => {
  it("expone límites", () => {
    expect(ALLOWED_MIME).toEqual(["image/webp", "image/jpeg", "image/png"]);
    expect(MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("arma la key según el destino", () => {
    expect(mediaKey({ kind: "activity", activityId: "act1" }, "webp", "abc")).toBe("activities/act1/abc.webp");
    expect(mediaKey({ kind: "avatar", userId: "u1" }, "jpg", "abc")).toBe("avatars/u1/abc.jpg");
    expect(mediaKey({ kind: "group", groupId: "g1" }, "png", "abc")).toBe("groups/g1/abc.png");
  });

  it("rechaza ids o rand con caracteres que romperían la key", () => {
    expect(() => mediaKey({ kind: "activity", activityId: "../x" }, "webp", "abc")).toThrow();
    expect(() => mediaKey({ kind: "avatar", userId: "u1" }, "webp", "a/b")).toThrow();
  });

  it("deriva la key de la miniatura con sufijo -thumb", () => {
    expect(thumbKeyFor("activities/act1/abc.webp")).toBe("activities/act1/abc-thumb.webp");
    expect(thumbKeyFor("avatars/u1/abc.jpg")).toBe("avatars/u1/abc-thumb.jpg");
  });

  it("mapea mime → extensión", () => {
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/png")).toBe("png");
  });

  it("ida y vuelta entre key y URL pública (con o sin / final en la base)", () => {
    const key = "activities/act1/abc.webp";
    expect(publicUrlFor(key, BASE)).toBe(`${BASE}/${key}`);
    expect(publicUrlFor(key, `${BASE}/`)).toBe(`${BASE}/${key}`);
    expect(keyFromPublicUrl(publicUrlFor(key, BASE), BASE)).toBe(key);
    expect(keyFromPublicUrl(`${BASE}/${key}`, `${BASE}/`)).toBe(key);
  });

  it("funciona con base path-style (MinIO)", () => {
    const base = "http://127.0.0.1:9000/elbravo-media";
    const key = "avatars/u1/abc.webp";
    expect(keyFromPublicUrl(publicUrlFor(key, base), base)).toBe(key);
  });

  it("keyFromPublicUrl devuelve null para otros hosts o URLs inválidas", () => {
    expect(keyFromPublicUrl("https://blob.vercel-storage.com/a.jpg", BASE)).toBeNull();
    expect(keyFromPublicUrl("https://media.elbravo.app.evil.com/a.jpg", BASE)).toBeNull();
    expect(keyFromPublicUrl("http://127.0.0.1:9000/other-bucket/a.webp", "http://127.0.0.1:9000/elbravo-media")).toBeNull();
    expect(keyFromPublicUrl(BASE, BASE)).toBeNull();
    expect(keyFromPublicUrl("", BASE)).toBeNull();
    expect(keyFromPublicUrl(null, BASE)).toBeNull();
  });

  it("valida que una key pertenezca al destino (y que no sea una miniatura)", () => {
    const t = { kind: "activity", activityId: "act1" } as const;
    expect(keyPrefix(t)).toBe("activities/act1/");
    expect(isOwnKeyFor(t, "activities/act1/abc.webp")).toBe(true);
    expect(isOwnKeyFor(t, "activities/act2/abc.webp")).toBe(false);
    expect(isOwnKeyFor(t, "activities/act1/abc-thumb.webp")).toBe(false);
    expect(isOwnKeyFor(t, "activities/act1/../act2/abc.webp")).toBe(false);
    expect(isOwnKeyFor(t, "activities/act1/abc.gif")).toBe(false);
    expect(isOwnKeyFor({ kind: "avatar", userId: "u1" }, "avatars/u1/abc.jpg")).toBe(true);
    expect(isOwnKeyFor({ kind: "avatar", userId: "u1" }, "avatars/u10/abc.jpg")).toBe(false);
    expect(isOwnKeyFor({ kind: "group", groupId: "g1" }, "groups/g1/x_Y-9.png")).toBe(true);
  });
});
