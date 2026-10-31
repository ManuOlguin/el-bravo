import { describe, it, expect } from "vitest";
import { INVITE_ALPHABET, INVITE_CODE_LENGTH, INVITE_TTL_DAYS, generateInviteCode, inviteExpiresAt, normalizeInviteCode, isInviteCodeShape } from "./invite";

describe("códigos de invitación", () => {
  it("alfabeto sin caracteres ambiguos (0/O, 1/I/L)", () => {
    expect(INVITE_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    for (const c of "01IO") expect(INVITE_ALPHABET).not.toContain(c);
  });

  it("genera 8 caracteres del alfabeto", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(INVITE_CODE_LENGTH).toBe(8);
      for (const c of code) expect(INVITE_ALPHABET).toContain(c);
    }
  });

  it("no se repiten en la práctica (aleatorio criptográfico)", () => {
    const set = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(set.size).toBe(1000);
  });

  it("usa crypto.randomInt (inyectable para test)", () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 31];
    let i = 0;
    expect(generateInviteCode(() => seq[i++])).toBe("ABCDEFG9");
  });

  it("normaliza: mayúsculas, sin espacios ni guiones", () => {
    expect(normalizeInviteCode("  abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ab cd ef gh")).toBe("ABCDEFGH");
  });

  it("valida la forma del código normalizado", () => {
    expect(isInviteCodeShape("ABCDEFGH")).toBe(true);
    expect(isInviteCodeShape("ABCDEFG")).toBe(false);
    expect(isInviteCodeShape("ABCDEFG0")).toBe(false); // 0 no está en el alfabeto
    expect(isInviteCodeShape("123456")).toBe(false); // códigos viejos de 6 dígitos
  });

  it("vence a los 7 días", () => {
    expect(INVITE_TTL_DAYS).toBe(7);
    const now = new Date("2026-10-31T12:00:00Z");
    expect(inviteExpiresAt(now).toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });
});
