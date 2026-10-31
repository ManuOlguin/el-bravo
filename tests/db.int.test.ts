import { describe, it, expect } from "vitest";
import { prisma, resetDb } from "./setup/db";

describe("integration DB", () => {
  it("apunta a la DB de test y resetDb la vacía", async () => {
    const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>("SELECT DATABASE() AS db");
    expect(db).toMatch(/_test$/);
    await resetDb();
    await prisma.muscle.create({ data: { name: "Test", slug: "test-muscle", groupKey: "test" } });
    expect(await prisma.muscle.count()).toBeGreaterThan(0);
    await resetDb();
    expect(await prisma.muscle.count()).toBe(0);
  });
});
