import { randomInt } from "node:crypto";

// Códigos de invitación a grupos: 8 caracteres sin ambigüedades (sin 0/O ni 1/I),
// generados con aleatoriedad criptográfica. 32^8 ≈ 1,1 billones de combinaciones.
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_DAYS = 7;

export function generateInviteCode(rand: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[rand(INVITE_ALPHABET.length)];
  return code;
}

/** La comparación no distingue mayúsculas; también se ignoran espacios y guiones al pegar. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]+/g, "").toUpperCase();
}

const SHAPE = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);
export function isInviteCodeShape(normalized: string): boolean {
  return SHAPE.test(normalized);
}

export function inviteExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
