import { describe, expect, it } from "vitest";
import { buildVisibleNameIndex } from "./name-index";

const row = (id: string, name: string, createdByUserId: string | null = null) => ({ id, name, createdByUserId });

describe("buildVisibleNameIndex", () => {
  it("indexa por nombre normalizado (mayúsculas, espacios y acentos no cuentan)", () => {
    const index = buildVisibleNameIndex([row("a", "Remo  Hammer"), row("b", "Sentadilla búlgara")]);
    expect(index.get("remo hammer")).toBe("a");
    expect(index.get("sentadilla bulgara")).toBe("b");
  });

  it("ante un choque gana el ejercicio oficial sobre el propio, sin importar el orden", () => {
    expect(buildVisibleNameIndex([row("mine", "Press banca", "me"), row("official", "press banca")]).get("press banca")).toBe("official");
    expect(buildVisibleNameIndex([row("official", "Press banca"), row("mine", "press banca", "me")]).get("press banca")).toBe("official");
  });

  it("entre iguales gana el primero en el orden de entrada", () => {
    expect(buildVisibleNameIndex([row("x", "Remo", "me"), row("y", "remo", "me")]).get("remo")).toBe("x");
    expect(buildVisibleNameIndex([row("o1", "Remo"), row("o2", "remo")]).get("remo")).toBe("o1");
  });

  it("no indexa nombres que normalizan a vacío (solo emoji o escritura no latina)", () => {
    const index = buildVisibleNameIndex([row("e1", "💪💪"), row("e2", "Жим лёжа"), row("a", "Remo")]);
    expect(index.has("")).toBe(false);
    expect([...index.keys()]).toEqual(["remo"]);
  });
});
