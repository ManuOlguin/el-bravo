import { describe, it, expect } from "vitest";
import { adjustRest, formatClock, remaining, restFor } from "./rest-timer";

describe("remaining", () => {
  it("cuenta hacia atrás en segundos enteros (redondeando hacia arriba)", () => {
    expect(remaining(1_000, 90, 1_000)).toBe(90);
    expect(remaining(1_000, 90, 1_001)).toBe(90);
    expect(remaining(1_000, 90, 2_000)).toBe(89);
    expect(remaining(1_000, 90, 90_500)).toBe(1);
  });

  it("nunca es negativo", () => {
    expect(remaining(0, 60, 60_000)).toBe(0);
    expect(remaining(0, 60, 999_999)).toBe(0);
  });
});

describe("adjustRest", () => {
  it("suma o resta sin bajar de 0 ni pasar de 1 h", () => {
    expect(adjustRest(90, 15)).toBe(105);
    expect(adjustRest(10, -15)).toBe(0);
    expect(adjustRest(3590, 15)).toBe(3600);
  });
});

describe("formatClock", () => {
  it("muestra m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(605)).toBe("10:05");
  });

  it("con horas muestra h:mm:ss", () => {
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("restFor", () => {
  it("usa el descanso de la serie, si no el del ejercicio y si no 90 s", () => {
    expect(restFor({ restSeconds: 45 }, { restSeconds: 120 })).toBe(45);
    expect(restFor({ restSeconds: null }, { restSeconds: 120 })).toBe(120);
    expect(restFor({ restSeconds: null }, { restSeconds: null })).toBe(90);
    expect(restFor({ restSeconds: 0 }, { restSeconds: 120 })).toBe(0);
  });
});
