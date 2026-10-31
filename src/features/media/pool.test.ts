import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./pool";

describe("mapWithConcurrency", () => {
  it("respeta el límite de tareas simultáneas y conserva el orden", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("lista vacía", async () => {
    expect(await mapWithConcurrency([], 2, async () => 1)).toEqual([]);
  });
});
