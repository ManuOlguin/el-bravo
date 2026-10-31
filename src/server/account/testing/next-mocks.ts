// Dobles de `next/headers` para tests de integración de Server Actions:
// un cookie jar y headers en memoria, controlables desde el test.
// Uso (vi.mock se hoistea, por eso el factory importa este módulo):
//   vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
export const cookieJar = new Map<string, string>();
export const requestHeaders = new Map<string, string>();

export const nextHeadersMock = {
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => ({
    get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
  }),
};

/** `redirect()` de Next lanza un error con digest NEXT_REDIRECT; lo imitamos para que runAction lo deje pasar. */
export function redirectMock(url: string): never {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
}

export function resetNextMocks() {
  cookieJar.clear();
  requestHeaders.clear();
}
