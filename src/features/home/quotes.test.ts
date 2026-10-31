import { describe, expect, it } from "vitest";
import { CHANGELOG } from "./changelog";
import { QUOTES, pickQuote } from "./quotes";

describe("frases y novedades", () => {
  it("pickQuote cubre de la primera a la última sin salirse", () => {
    expect(pickQuote(0)).toBe(QUOTES[0]);
    expect(pickQuote(0.999999)).toBe(QUOTES[QUOTES.length - 1]);
    expect(QUOTES.every((q) => q.quote.length > 0 && q.author.length > 0)).toBe(true);
  });

  it("el changelog avisa que las cuentas empiezan de cero", () => {
    expect(CHANGELOG[0]).toMatchObject({ tone: "important" });
    expect(CHANGELOG.flatMap((s) => s.items).length).toBeGreaterThan(5);
  });
});
