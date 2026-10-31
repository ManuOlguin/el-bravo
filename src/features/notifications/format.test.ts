import { describe, it, expect } from "vitest";
import { badgeCount, dayLabel, groupByDay, highlight, relativeTime } from "./format";

const TZ = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-11-04T18:00:00Z"); // 15:00 en Buenos Aires

describe("relativeTime", () => {
  it("escalas", () => {
    expect(relativeTime("2026-11-04T17:59:40Z", NOW, TZ)).toBe("recién");
    expect(relativeTime("2026-11-04T17:55:00Z", NOW, TZ)).toBe("hace 5 min");
    expect(relativeTime("2026-11-04T15:00:00Z", NOW, TZ)).toBe("hace 3 h");
    expect(relativeTime("2026-11-02T15:00:00Z", NOW, TZ)).toBe("hace 2 d");
    expect(relativeTime("2026-10-01T15:00:00Z", NOW, TZ)).not.toMatch(/^hace/);
  });
});

describe("groupByDay", () => {
  it("agrupa por día local (zona del usuario) con Hoy y Ayer", () => {
    const items = [
      { id: "1", createdAt: "2026-11-04T17:00:00Z" },
      { id: "2", createdAt: "2026-11-04T04:00:00Z" }, // 01:00 del 4/11 local
      { id: "3", createdAt: "2026-11-04T02:00:00Z" }, // 23:00 del 3/11 local
      { id: "4", createdAt: "2026-11-01T12:00:00Z" },
    ];
    const g = groupByDay(items, NOW, TZ);
    expect(g.map((x) => [x.day, x.items.map((i) => i.id)])).toEqual([
      ["2026-11-04", ["1", "2"]],
      ["2026-11-03", ["3"]],
      ["2026-11-01", ["4"]],
    ]);
    expect(g[0].label).toBe("Hoy");
    expect(g[1].label).toBe("Ayer");
  });
  it("dayLabel de otros días es la fecha larga", () => {
    expect(dayLabel("2026-11-01", "2026-11-04")).not.toBe("Hoy");
  });
});

describe("highlight", () => {
  it("resalta los nombres", () => {
    expect(highlight("Manu fue el primero en arrancar la semana en Los Bravos", ["Manu", "Los Bravos"])).toEqual([
      { text: "Manu", strong: true },
      { text: " fue el primero en arrancar la semana en ", strong: false },
      { text: "Los Bravos", strong: true },
    ]);
  });
  it("sin coincidencias devuelve el texto entero", () => {
    expect(highlight("Hola", ["Chau"])).toEqual([{ text: "Hola", strong: false }]);
  });
});

it("badgeCount", () => {
  expect(badgeCount(3)).toBe("3");
  expect(badgeCount(10)).toBe("9+");
});
