/**
 * W3 Task 3: TODA Server Action exportada exige sesión. Se importa cada módulo "use server" y se llama
 * a cada export sin cookie de sesión: tiene que devolver `ok: false` con "Tenés que iniciar sesión."
 * ANTES de tocar la DB (el mock de Prisma explota si alguien la usa sin autenticar).
 * Un módulo o export nuevo entra solo en el test; las excepciones (públicas) están listadas abajo.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));
// Cualquier acceso a Prisma sin sesión es un bug: el proxy lanza y el test lo ve como "Algo salió mal".
vi.mock("@/src/lib/db", () => {
  const boom = (): never => {
    throw new Error("La acción tocó la DB sin autenticar");
  };
  const deep: object = new Proxy(boom, { get: () => deep, apply: boom });
  return { prisma: deep };
});

const ROOT = path.resolve(__dirname, "../../..");
/** Acciones públicas a propósito (login/registro) o que solo borran la cookie. */
const PUBLIC = new Set(["account.loginAction", "account.registerAction", "account.logoutAction"]);

function findUseServerModules(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /^\s*["']use server["']/.test(readFileSync(p, "utf8"))) out.push(p);
    }
  };
  walk(path.join(ROOT, "src"));
  walk(path.join(ROOT, "app"));
  return out.sort();
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const modules = findUseServerModules();
const loaded = new Map<string, Record<string, unknown>>();

beforeAll(async () => {
  for (const file of modules) loaded.set(file, (await import(file)) as Record<string, unknown>);
});

describe("cobertura de auth de las Server Actions", () => {
  it("encuentra los módulos \"use server\"", () => {
    expect(modules.map((f) => path.relative(ROOT, f))).toEqual(
      expect.arrayContaining(["src/server/actions/activities.ts", "src/server/actions/seasons.ts", "src/features/group/actions.ts"])
    );
  });

  for (const file of modules) {
    const rel = path.relative(ROOT, file);
    const mod = path.basename(file).replace(/\.tsx?$/, "");
    it(`${rel}: cada export pide sesión`, async () => {
      const exports = loaded.get(file)!;
      const names = Object.keys(exports).filter((k) => typeof exports[k] === "function");
      expect(names.length).toBeGreaterThan(0);
      const wrong: Record<string, unknown> = {};
      for (const name of names) {
        if (PUBLIC.has(`${mod}.${name}`)) continue;
        const fn = exports[name] as Fn;
        // Argumentos con forma plausible: ids, objetos vacíos o FormData (acciones de useActionState).
        const args = fn.length === 2 && /^(login|register)/.test(name) ? [null, new FormData()] : ["x", "x", "x"].slice(0, Math.max(fn.length, 1));
        const result = await fn(...args);
        if (JSON.stringify(result) !== JSON.stringify({ ok: false, error: "Tenés que iniciar sesión." })) wrong[name] = result;
      }
      expect(wrong, `${rel}: exports que no exigen sesión primero`).toEqual({});
    });
  }

  it("logoutAction sin sesión solo borra la cookie y redirige a /login", async () => {
    const account = [...loaded.entries()].find(([f]) => f.endsWith("/actions/account.ts"))![1];
    await expect((account.logoutAction as Fn)()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});
