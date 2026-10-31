import { describe, it, expect } from "vitest";
import { membershipRole, safeNextPath } from "./policies";

describe("membershipRole", () => {
  it("null si no hay membresía", () => expect(membershipRole(null)).toBeNull());
  it("null si se fue o fue removido", () => {
    expect(membershipRole({ role: "admin", status: "accepted", leftAt: new Date() })).toBeNull();
    expect(membershipRole({ role: "member", status: "removed", leftAt: null })).toBeNull();
    expect(membershipRole({ role: "member", status: "pending", leftAt: null })).toBeNull();
  });
  it("rol si está aceptado y activo", () => {
    expect(membershipRole({ role: "admin", status: "accepted", leftAt: null })).toBe("admin");
    expect(membershipRole({ role: "member", status: "accepted", leftAt: null })).toBe("member");
  });
});

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/group/abc?tab=ranking")).toBe("/group/abc?tab=ranking");
  });
  it("rechaza URLs externas o protocol-relative y cae en /home", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath("")).toBe("/home");
    expect(safeNextPath("https://evil.com")).toBe("/home");
    expect(safeNextPath("//evil.com")).toBe("/home");
    expect(safeNextPath("/\\evil.com")).toBe("/home");
  });
  it("no vuelve a mandar al login", () => {
    expect(safeNextPath("/login?next=/x")).toBe("/home");
  });
});
