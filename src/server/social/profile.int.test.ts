import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import { getPublicProfile } from "./profile";

async function setup() {
  const ana = await prisma.user.create({ data: { email: "ana@secret.com", passwordHash: "x", name: "Ana", bio: "Hola" } });
  const beto = await prisma.user.create({ data: { email: "beto@secret.com", passwordHash: "x", name: "Beto" } });
  const cat = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  return { ana, beto, cat };
}

describe("getPublicProfile", () => {
  beforeEach(resetDb);

  it("no expone email, notas ni hash", async () => {
    const { ana, beto, cat } = await setup();
    const act = await prisma.activity.create({
      data: { userId: beto.id, activityCategoryId: cat.id, startedAt: new Date("2026-10-30T12:00:00Z"), durationMinutes: 45, notes: "NOTA-PRIVADA" },
    });
    await prisma.activityMedia.create({ data: { activityId: act.id, url: "https://img/full.webp", thumbUrl: "https://img/thumb.webp" } });

    const p = await getPublicProfile(ana.id, beto.id);
    expect(p).not.toBeNull();
    const json = JSON.stringify(p);
    expect(json).not.toContain("@secret.com");
    expect(json).not.toContain("NOTA-PRIVADA");
    expect(json).not.toContain("passwordHash");
    expect(p!.user).toEqual({ id: beto.id, name: "Beto", photoUrl: null, bio: null, createdAt: expect.any(Date) });
    expect(p!.recentActivities).toEqual([
      { id: act.id, categoryName: "Running", startedAt: act.startedAt, durationMinutes: 45, photoUrl: "https://img/thumb.webp" },
    ]);
  });

  it("conteos, relación y grupos en común", async () => {
    const { ana, beto, cat } = await setup();
    const caro = await prisma.user.create({ data: { email: "c@c.com", passwordHash: "x", name: "Caro" } });
    await prisma.follow.createMany({
      data: [
        { followerId: ana.id, followingId: beto.id },
        { followerId: beto.id, followingId: ana.id },
        { followerId: caro.id, followingId: beto.id },
      ],
    });
    const shared = await prisma.group.create({ data: { name: "Compartido" } });
    const left = await prisma.group.create({ data: { name: "Ana se fue" } });
    const onlyBeto = await prisma.group.create({ data: { name: "Solo Beto" } });
    await prisma.groupMember.createMany({
      data: [
        { groupId: shared.id, userId: ana.id, role: "member" },
        { groupId: shared.id, userId: beto.id, role: "admin" },
        { groupId: left.id, userId: ana.id, role: "member", leftAt: new Date(), status: "removed" },
        { groupId: left.id, userId: beto.id, role: "member" },
        { groupId: onlyBeto.id, userId: beto.id, role: "admin" },
      ],
    });
    for (let i = 0; i < 12; i++) {
      await prisma.activity.create({
        data: { userId: beto.id, activityCategoryId: cat.id, startedAt: new Date(Date.UTC(2026, 9, 1 + i, 12)), durationMinutes: 30 + i },
      });
    }

    const p = (await getPublicProfile(ana.id, beto.id))!;
    expect(p.counts).toEqual({ followers: 2, following: 1, workouts: 12 });
    expect(p.relation).toEqual({ isMe: false, isFollowing: true, followsMe: true, isFriend: true });
    expect(p.sharedGroups).toEqual([{ id: shared.id, name: "Compartido" }]);
    expect(p.recentActivities).toHaveLength(10);
    expect(p.recentActivities[0].durationMinutes).toBe(41); // la más reciente primero

    const mine = (await getPublicProfile(ana.id, ana.id))!;
    expect(mine.relation).toEqual({ isMe: true, isFollowing: false, followsMe: false, isFriend: false });
  });

  it("null si el usuario no existe o está inactivo", async () => {
    const { ana } = await setup();
    const off = await prisma.user.create({ data: { email: "off@t.com", passwordHash: "x", isActive: false } });
    expect(await getPublicProfile(ana.id, "nope")).toBeNull();
    expect(await getPublicProfile(ana.id, off.id)).toBeNull();
  });
});
