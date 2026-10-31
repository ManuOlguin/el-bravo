import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import { getFriendsFeed, getFriendsLatestWithPhoto } from "./feed";

async function setup() {
  const mk = (name: string) => prisma.user.create({ data: { email: `${name}@t.com`, passwordHash: "x", name } });
  const ana = await mk("ana");
  const beto = await mk("beto");
  const caro = await mk("caro");
  const cat = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  await prisma.follow.create({ data: { followerId: ana.id, followingId: beto.id } }); // Ana sigue a Beto (no a Caro)
  await prisma.follow.create({ data: { followerId: caro.id, followingId: ana.id } }); // Caro sigue a Ana: no suma al feed de Ana
  const act = (userId: string, iso: string, notes = "NOTA-SECRETA") =>
    prisma.activity.create({ data: { userId, activityCategoryId: cat.id, startedAt: new Date(iso), durationMinutes: 40, notes } });
  return { ana, beto, caro, cat, act };
}

describe("feed de amigos", () => {
  beforeEach(resetDb);

  it("solo seguidos y propias, en orden descendente, sin notas", async () => {
    const { ana, beto, caro, act } = await setup();
    const b1 = await act(beto.id, "2026-10-30T10:00:00Z");
    const a1 = await act(ana.id, "2026-10-30T12:00:00Z");
    await act(caro.id, "2026-10-30T13:00:00Z");
    const { items, nextCursor } = await getFriendsFeed(ana.id, {});
    expect(items.map((i) => i.activityId)).toEqual([a1.id, b1.id]);
    expect(nextCursor).toBeNull();
    expect(items[1]).toEqual({
      activityId: b1.id,
      user: { id: beto.id, name: "beto", photoUrl: null },
      categoryName: "Running",
      startedAt: b1.startedAt,
      durationMinutes: 40,
      thumbUrl: null,
      photoUrl: null,
      reactions: [],
    });
    expect(JSON.stringify(items)).not.toContain("NOTA-SECRETA");
    expect(JSON.stringify(items)).not.toContain("@t.com");
  });

  it("pagina con cursor sin duplicados ni huecos (incluye empates de startedAt)", async () => {
    const { ana, beto, act } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push((await act(beto.id, `2026-10-${10 + i}T10:00:00Z`)).id);
    for (let i = 0; i < 3; i++) ids.push((await act(ana.id, "2026-10-20T10:00:00Z")).id); // mismo instante
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await getFriendsFeed(ana.id, { cursor, limit: 3 });
      seen.push(...page.items.map((i) => i.activityId));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(4);
    expect(new Set(seen).size).toBe(10);
    expect(seen.sort()).toEqual([...ids].sort());
  });

  it("trae las reacciones resumidas y la foto (miniatura)", async () => {
    const { ana, beto, act } = await setup();
    const b1 = await act(beto.id, "2026-10-30T10:00:00Z");
    await prisma.activityMedia.create({ data: { activityId: b1.id, url: "https://img/full.webp", thumbUrl: "https://img/t.webp", position: 0 } });
    await prisma.reaction.create({ data: { activityId: b1.id, userId: ana.id, emoji: "fire" } });
    const { items } = await getFriendsFeed(ana.id, {});
    expect(items[0]).toMatchObject({
      thumbUrl: "https://img/t.webp",
      photoUrl: "https://img/full.webp",
      reactions: [{ emoji: "🔥", count: 1, mine: true, users: [{ id: ana.id, name: "ana" }] }],
    });
  });

  it("getFriendsLatestWithPhoto: solo seguidos con foto", async () => {
    const { ana, beto, caro, act } = await setup();
    const withPhoto = await act(beto.id, "2026-10-30T10:00:00Z");
    await act(beto.id, "2026-10-31T10:00:00Z"); // sin foto
    const mine = await act(ana.id, "2026-10-31T11:00:00Z");
    const stranger = await act(caro.id, "2026-10-31T12:00:00Z");
    for (const a of [withPhoto, mine, stranger]) await prisma.activityMedia.create({ data: { activityId: a.id, url: `https://img/${a.id}` } });
    const items = await getFriendsLatestWithPhoto(ana.id, 10);
    expect(items.map((i) => i.activityId)).toEqual([withPhoto.id]);
  });
});
