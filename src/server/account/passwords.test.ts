import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, BCRYPT_COST } from "./passwords";

describe("passwords", () => {
  it("usa costo 12", () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it("hashea y verifica", async () => {
    const h = await hashPassword("secreto123");
    expect(h).not.toContain("secreto123");
    expect(h.startsWith("$2")).toBe(true);
    expect(h.split("$")[2]).toBe("12");
    expect(await verifyPassword("secreto123", h)).toBe(true);
    expect(await verifyPassword("otra-cosa", h)).toBe(false);
  });

  it("verifyPassword con hash inválido o vacío devuelve false (no lanza)", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "no-es-un-hash")).toBe(false);
  });
});
