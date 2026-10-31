import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Nunca lanza: un hash vacío o corrupto es simplemente "no coincide". */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// Cuando el usuario no existe se compara igual contra un hash descartable: iguala el tiempo de
// respuesta y evita revelar qué emails tienen cuenta.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= hashPassword("el-bravo-dummy-password");
  await verifyPassword(plain, await dummyHash);
}
