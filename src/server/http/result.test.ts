import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ok, fail, parseInput, runAction } from "./result";
import { AuthError } from "@/src/server/auth/errors";

describe("parseInput", () => {
  const schema = z.object({ name: z.string().min(1, "Poné un nombre"), n: z.coerce.number().int() });
  it("devuelve data válida", () => {
    const r = parseInput(schema, { name: "a", n: "3" });
    expect(r).toEqual({ ok: true, data: { name: "a", n: 3 } });
  });
  it("mapea issues a fieldErrors con el primer mensaje como error", () => {
    const r = parseInput(schema, { name: "", n: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.result).toMatchObject({ ok: false, error: "Poné un nombre" });
      expect(r.result.ok === false && r.result.fieldErrors?.name).toEqual(["Poné un nombre"]);
      expect(r.result.ok === false && r.result.fieldErrors?.n?.length).toBe(1);
    }
  });
  it("usa rutas con punto para campos anidados", () => {
    const nested = z.object({ items: z.array(z.object({ qty: z.number().min(1, "Mínimo 1") })) });
    const r = parseInput(nested, { items: [{ qty: 0 }] });
    expect(!r.ok && r.result.ok === false && r.result.fieldErrors).toEqual({ "items.0.qty": ["Mínimo 1"] });
  });
});

describe("runAction", () => {
  it("pasa resultados ok", async () => {
    expect(await runAction(async () => ok(1, "Listo"))).toEqual({ ok: true, data: 1, message: "Listo" });
  });
  it("traduce AuthError", async () => {
    expect(await runAction(async () => { throw new AuthError("UNAUTHENTICATED"); }))
      .toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    expect(await runAction(async () => { throw new AuthError("FORBIDDEN"); }))
      .toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
    expect(await runAction(async () => { throw new AuthError("NOT_FOUND"); }))
      .toEqual({ ok: false, error: "No encontramos lo que buscabas." });
  });
  it("traduce P2002 y P2025 de Prisma", async () => {
    const e = Object.assign(new Error("dup"), { code: "P2002" });
    expect(await runAction(async () => { throw e; })).toEqual({ ok: false, error: "Ya existe un registro con esos datos." });
    const nf = Object.assign(new Error("nf"), { code: "P2025" });
    expect(await runAction(async () => { throw nf; })).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
  });
  it("errores desconocidos → mensaje genérico y log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runAction(async () => { throw new Error("boom"); }))
      .toEqual({ ok: false, error: "Algo salió mal. Probá de nuevo." });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("re-lanza los redirect/notFound de Next", async () => {
    const e = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/home;307;" });
    await expect(runAction(async () => { throw e; })).rejects.toBe(e);
    const nf = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(runAction(async () => { throw nf; })).rejects.toBe(nf);
  });
  it("fail arma el error", () => {
    expect(fail("x", { a: ["b"] })).toEqual({ ok: false, error: "x", fieldErrors: { a: ["b"] } });
    expect(fail("x")).toEqual({ ok: false, error: "x" });
  });
  it("ok sin mensaje no agrega la clave", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });
});
