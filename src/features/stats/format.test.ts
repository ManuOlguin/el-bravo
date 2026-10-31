import { describe, expect, it } from "vitest";
import { DEFAULT_TZ, zonedToUtc } from "@/src/lib/time";
import { formatHours, formatKg, formatMonthKey, groupByMonth } from "./format";

describe("formatos", () => {
  it("horas y kilos", () => {
    expect(formatHours(45)).toBe("45 min");
    expect(formatHours(90)).toBe("1,5 h");
    expect(formatHours(600)).toBe("10 h");
    expect(formatKg(1234)).toBe("1234 kg".replace("1234", new Intl.NumberFormat("es-AR").format(1234)));
    expect(formatKg(12_340)).toBe("12,3 t");
  });
  it("mes en español", () => {
    expect(formatMonthKey("2026-10")).toBe("octubre de 2026");
  });
});

describe("groupByMonth", () => {
  it("agrupa por mes LOCAL: 1/11 00:30 AR es noviembre aunque en UTC sea 1/11 03:30 y 31/10 23:30 AR es octubre", () => {
    const items = [
      { id: "a", startedAt: zonedToUtc("2026-11-01", "00:30", DEFAULT_TZ) },
      { id: "b", startedAt: zonedToUtc("2026-10-31", "23:30", DEFAULT_TZ) },
      { id: "c", startedAt: zonedToUtc("2026-10-02", "10:00", DEFAULT_TZ) },
    ];
    expect(groupByMonth(items, DEFAULT_TZ).map((g) => [g.month, g.items.map((i) => i.id)])).toEqual([
      ["2026-11", ["a"]],
      ["2026-10", ["b", "c"]],
    ]);
  });
});
