import { describe, it, expect } from "vitest";
import { isOversizedServerAction } from "./action-body-limit";

const req = (o: { method?: string; pathname?: string; action?: boolean; length?: string }) => {
  const headers = new Headers();
  if (o.action ?? true) headers.set("next-action", "abc");
  if (o.length !== undefined) headers.set("content-length", o.length);
  return { method: o.method ?? "POST", pathname: o.pathname ?? "/login", headers };
};

describe("isOversizedServerAction", () => {
  it("rechaza una acción de más de 1 MiB fuera de /routines/import", () => {
    expect(isOversizedServerAction(req({ length: "1048577" }))).toBe(true);
    expect(isOversizedServerAction(req({ pathname: "/home", length: "4000000" }))).toBe(true);
  });
  it("deja pasar hasta 1 MiB", () => {
    expect(isOversizedServerAction(req({ length: "1048576" }))).toBe(false);
  });
  it("no toca /routines/import, GET ni POST sin next-action", () => {
    expect(isOversizedServerAction(req({ pathname: "/routines/import", length: "4500000" }))).toBe(false);
    expect(isOversizedServerAction(req({ method: "GET", length: "4500000" }))).toBe(false);
    expect(isOversizedServerAction(req({ action: false, length: "4500000" }))).toBe(false);
  });
});
