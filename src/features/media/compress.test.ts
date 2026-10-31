import { describe, it, expect } from "vitest";
import { fitWithin } from "./compress";

describe("fitWithin", () => {
  it("reduce manteniendo la proporción (lado mayor = max)", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4000, 3000, 400)).toEqual({ width: 400, height: 300 });
  });

  it("una imagen chica no cambia (nunca agranda)", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("redondea y nunca devuelve 0", () => {
    expect(fitWithin(4033, 3025, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(10000, 3, 400)).toEqual({ width: 400, height: 1 });
  });
});
