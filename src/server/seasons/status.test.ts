import { describe, it, expect } from "vitest";
import { seasonStatus } from "./status";

const s = (finalizedAt: Date | null = null) => ({ startDate: "2026-11-02", endDate: "2026-11-29", finalizedAt });

describe("seasonStatus", () => {
  it("upcoming antes del inicio", () => expect(seasonStatus(s(), "2026-11-01")).toBe("upcoming"));
  it("active el día de inicio", () => expect(seasonStatus(s(), "2026-11-02")).toBe("active"));
  it("active en el medio", () => expect(seasonStatus(s(), "2026-11-15")).toBe("active"));
  it("active el día de fin", () => expect(seasonStatus(s(), "2026-11-29")).toBe("active"));
  it("ended después del fin", () => expect(seasonStatus(s(), "2026-11-30")).toBe("ended"));
  it("finalized gana siempre", () => {
    expect(seasonStatus(s(new Date()), "2026-11-30")).toBe("finalized");
    expect(seasonStatus(s(new Date()), "2026-11-10")).toBe("finalized");
  });
});
