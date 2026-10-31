import { describe, it, expect } from "vitest";
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import {
  planActivityNotifications,
  renderNotification,
  pushWindowKey,
  type RuleContext,
  type GroupContext,
  type SeasonContext,
} from "./rules";

const ACT = "act1";

function group(o: Partial<GroupContext> = {}): GroupContext {
  return {
    groupId: "g1",
    groupName: "Los Bravos",
    memberIds: ["manu", "lucio", "leo"],
    weekKey: "2026-11-02",
    isCurrentWeek: true,
    isNewDay: true,
    actorWorkoutsThisWeek: 1,
    othersWithWorkoutThisWeek: 0,
    weeklyGoal: 3,
    ...o,
  };
}

function effect(o: Partial<ScoringEffect> = {}): ScoringEffect {
  return {
    seasonId: "s1",
    seasonName: "Temporada Verano",
    groupId: "g1",
    groupName: "Los Bravos",
    activityPoints: 10,
    activityReason: null,
    totalBefore: 50,
    totalAfter: 60,
    rankBefore: 2,
    rankAfter: 2,
    ...o,
  };
}

function season(o: Partial<SeasonContext> = {}): SeasonContext {
  return {
    seasonId: "s1",
    seasonName: "Temporada Verano",
    groupId: "g1",
    weekKey: "2026-11-02",
    memberIds: ["manu", "lucio", "leo"],
    actorStreak: 1,
    others: [
      { userId: "lucio", points: 80, rank: 1 },
      { userId: "leo", points: 30, rank: 3 },
    ],
    ...o,
  };
}

function badge(o: Partial<BadgeChange> = {}): BadgeChange {
  return {
    code: "gym_rat",
    name: "Gym Rat",
    iconKey: null,
    levelBefore: 1,
    levelAfter: 2,
    progressBefore: 9,
    progressAfter: 10,
    nextThreshold: 25,
    ...o,
  };
}

function ctx(o: Partial<RuleContext> = {}): RuleContext {
  return {
    actor: { id: "manu", name: "Manu" },
    groups: [group({ actorWorkoutsThisWeek: 2 })],
    seasons: [],
    effects: { scoring: [], badges: [] },
    isNewActivity: true,
    followerIds: [],
    friendIdsOutsideGroups: [],
    activity: { categoryName: "Gimnasio", durationMinutes: 45 },
    windowKey: "2026-11-02T18",
    ...o,
  };
}

const types = (ps: ReturnType<typeof planActivityNotifications>) => ps.map((p) => p.type);
const byType = (ps: ReturnType<typeof planActivityNotifications>, t: string) => ps.filter((p) => p.type === t);

describe("planActivityNotifications", () => {
  it("editar o borrar (actividad no nueva) no notifica nada", () => {
    const c = ctx({
      isNewActivity: false,
      groups: [group()],
      effects: { scoring: [effect()], badges: [badge()] },
      followerIds: ["ana"],
      friendIdsOutsideGroups: ["ana"],
    });
    expect(planActivityNotifications(c, ACT)).toEqual([]);
  });

  describe("first_workout_of_week", () => {
    it("primer día del actor y nadie más entrenó: notifica a los otros miembros", () => {
      const ps = byType(planActivityNotifications(ctx({ groups: [group()] }), ACT), "first_workout_of_week");
      expect(ps).toHaveLength(1);
      expect(ps[0].recipientIds).toEqual(["lucio", "leo"]);
      expect(ps[0].groupId).toBe("g1");
      expect(ps[0].activityId).toBe(ACT);
      expect(ps[0].dedupe("lucio")).toBe("first_week:g1:2026-11-02:lucio");
    });
    it("no notifica si otro miembro ya entrenó esa semana", () => {
      expect(types(planActivityNotifications(ctx({ groups: [group({ othersWithWorkoutThisWeek: 1 })] }), ACT))).not.toContain(
        "first_workout_of_week"
      );
    });
    it("no notifica en el segundo entrenamiento del mismo día ni en el segundo día", () => {
      expect(types(planActivityNotifications(ctx({ groups: [group({ isNewDay: false })] }), ACT))).not.toContain("first_workout_of_week");
      expect(types(planActivityNotifications(ctx({ groups: [group({ actorWorkoutsThisWeek: 2 })] }), ACT))).not.toContain(
        "first_workout_of_week"
      );
    });
    it("no notifica si la actividad es de una semana pasada", () => {
      expect(types(planActivityNotifications(ctx({ groups: [group({ isCurrentWeek: false })] }), ACT))).not.toContain(
        "first_workout_of_week"
      );
    });
    it("un grupo sin otros miembros no genera nada", () => {
      expect(planActivityNotifications(ctx({ groups: [group({ memberIds: ["manu"] })] }), ACT)).toEqual([]);
    });
  });

  describe("weekly_goal_met", () => {
    it("cuando los días llegan exactamente al objetivo con un día nuevo", () => {
      const ps = byType(planActivityNotifications(ctx({ groups: [group({ actorWorkoutsThisWeek: 3, othersWithWorkoutThisWeek: 2 })] }), ACT), "weekly_goal_met");
      expect(ps).toHaveLength(1);
      expect(ps[0].recipientIds).toEqual(["lucio", "leo"]);
      expect(ps[0].dedupe("leo")).toBe("goal:g1:2026-11-02:manu:leo");
    });
    it("no notifica antes ni después del objetivo, ni si es el mismo día", () => {
      for (const g of [group({ actorWorkoutsThisWeek: 2 }), group({ actorWorkoutsThisWeek: 4 }), group({ actorWorkoutsThisWeek: 3, isNewDay: false })]) {
        expect(types(planActivityNotifications(ctx({ groups: [g] }), ACT))).not.toContain("weekly_goal_met");
      }
    });
    it("objetivo de 1 día: el primer día también cumple", () => {
      expect(types(planActivityNotifications(ctx({ groups: [group({ weeklyGoal: 1 })] }), ACT)).sort()).toEqual([
        "first_workout_of_week",
        "weekly_goal_met",
      ]);
    });
  });

  describe("streak_milestone", () => {
    it("racha de 3, 5 o 10 notifica a los otros miembros de la temporada", () => {
      for (const n of [3, 5, 10]) {
        const c = ctx({ seasons: [season({ actorStreak: n })], effects: { scoring: [effect()], badges: [] } });
        const ps = byType(planActivityNotifications(c, ACT), "streak_milestone");
        expect(ps).toHaveLength(1);
        expect(ps[0].recipientIds).toEqual(["lucio", "leo"]);
        expect(ps[0].seasonId).toBe("s1");
        expect(ps[0].data).toMatchObject({ n });
        expect(ps[0].dedupe("lucio")).toBe(`streak:s1:manu:${n}:lucio`);
      }
    });
    it("otras rachas no notifican", () => {
      for (const n of [0, 1, 2, 4, 6, 11]) {
        const c = ctx({ seasons: [season({ actorStreak: n })], effects: { scoring: [effect()], badges: [] } });
        expect(types(planActivityNotifications(c, ACT))).not.toContain("streak_milestone");
      }
    });
  });

  describe("rank_overtaken", () => {
    it("avisa solo a los que el actor pasó", () => {
      // Manu: 50 → 90 pts. Lucio (80) queda atrás; Leo (30) ya estaba atrás.
      const c = ctx({
        seasons: [season({ others: [{ userId: "lucio", points: 80, rank: 2 }, { userId: "leo", points: 30, rank: 3 }] })],
        effects: { scoring: [effect({ totalBefore: 50, totalAfter: 90, rankBefore: 2, rankAfter: 1 })], badges: [] },
      });
      const ps = byType(planActivityNotifications(c, ACT), "rank_overtaken");
      expect(ps).toHaveLength(1);
      expect(ps[0].recipientIds).toEqual(["lucio"]);
      expect(ps[0].dedupe("lucio")).toBe("overtaken:s1:manu:lucio:2026-11-02");
    });
    it("si el actor no pasa a nadie no notifica", () => {
      const c = ctx({
        seasons: [season()],
        effects: { scoring: [effect({ totalBefore: 50, totalAfter: 60, rankBefore: 2, rankAfter: 2 })], badges: [] },
      });
      expect(types(planActivityNotifications(c, ACT))).not.toContain("rank_overtaken");
    });
    it("sin standing previo (rankBefore null) cuenta desde 0 puntos", () => {
      const c = ctx({
        seasons: [season({ others: [{ userId: "lucio", points: 5, rank: 2 }] })],
        effects: { scoring: [effect({ totalBefore: 0, totalAfter: 10, rankBefore: null, rankAfter: 1 })], badges: [] },
      });
      expect(byType(planActivityNotifications(c, ACT), "rank_overtaken")[0]?.recipientIds).toEqual(["lucio"]);
    });
  });

  describe("badge_level_up", () => {
    it("notifica al actor y a sus seguidores", () => {
      const c = ctx({ effects: { scoring: [], badges: [badge()] }, followerIds: ["ana", "lucio"] });
      const ps = byType(planActivityNotifications(c, ACT), "badge_level_up");
      expect(ps).toHaveLength(1);
      expect(ps[0].recipientIds).toEqual(["manu", "ana", "lucio"]);
      expect(ps[0].data).toMatchObject({ badgeName: "Gym Rat", level: 2, code: "gym_rat" });
      expect(ps[0].dedupe("ana")).toBe("badge:manu:gym_rat:2:ana");
    });
    it("solo cuando sube de nivel", () => {
      const c = ctx({ effects: { scoring: [], badges: [badge({ levelAfter: 1 }), badge({ levelBefore: 2, levelAfter: 1 })] } });
      expect(types(planActivityNotifications(c, ACT))).not.toContain("badge_level_up");
    });
  });

  describe("friend_workout", () => {
    it("notifica a los amigos que no comparten grupo, con throttle por ventana de 2 h", () => {
      const c = ctx({ friendIdsOutsideGroups: ["ana"], windowKey: "2026-11-02T18" });
      const ps = byType(planActivityNotifications(c, ACT), "friend_workout");
      expect(ps).toHaveLength(1);
      expect(ps[0].recipientIds).toEqual(["ana"]);
      expect(ps[0].activityId).toBe(ACT);
      expect(ps[0].data).toMatchObject({ categoryName: "Gimnasio", durationMinutes: 45 });
      expect(ps[0].dedupe("ana")).toBe("friend_workout:manu:ana:2026-11-02T18");
    });
    it("sin amigos fuera de los grupos no notifica; editar tampoco", () => {
      expect(types(planActivityNotifications(ctx(), ACT))).not.toContain("friend_workout");
      expect(planActivityNotifications(ctx({ friendIdsOutsideGroups: ["ana"], isNewActivity: false }), ACT)).toEqual([]);
    });
    it("nunca se notifica a sí mismo", () => {
      expect(byType(planActivityNotifications(ctx({ friendIdsOutsideGroups: ["manu", "ana"] }), ACT), "friend_workout")[0].recipientIds).toEqual(["ana"]);
    });
    it("pushWindowKey redondea a ventanas de 2 h (UTC)", () => {
      expect(pushWindowKey(new Date("2026-11-02T18:59:00Z"))).toBe("2026-11-02T18");
      expect(pushWindowKey(new Date("2026-11-02T19:59:00Z"))).toBe("2026-11-02T18");
      expect(pushWindowKey(new Date("2026-11-02T20:00:00Z"))).toBe("2026-11-02T20");
      expect(pushWindowKey(new Date("2026-11-02T01:00:00Z"))).toBe("2026-11-02T00");
    });
  });

  it("nunca incluye al actor como destinatario de reglas de grupo", () => {
    const c = ctx({ groups: [group({ weeklyGoal: 1 })], seasons: [season({ actorStreak: 3 })], effects: { scoring: [effect()], badges: [] } });
    for (const p of planActivityNotifications(c, ACT)) expect(p.recipientIds).not.toContain("manu");
  });
});

describe("renderNotification", () => {
  const base = { actorId: "manu", actorName: "Manu", groupId: "g1", groupName: "Los Bravos", seasonId: "s1", seasonName: "Temporada Verano", activityId: "a1" };

  it("first_workout_of_week", () => {
    expect(renderNotification("first_workout_of_week", base, "lucio")).toMatchObject({
      icon: "🔥",
      title: "Manu fue el primero en arrancar la semana en Los Bravos",
      href: "/group/g1",
    });
  });
  it("weekly_goal_met", () => {
    const r = renderNotification("weekly_goal_met", { ...base, actorName: "Lucio" }, "manu");
    expect(r).toMatchObject({ icon: "✅", title: "Lucio cumplió su objetivo semanal", body: "Los Bravos", href: "/group/g1" });
  });
  it("streak_milestone", () => {
    expect(renderNotification("streak_milestone", { ...base, actorName: "Leo", n: 5 }, "manu")).toMatchObject({
      icon: "⚡",
      title: "Leo lleva 5 semanas seguidas",
      href: "/group/g1/season/s1",
    });
  });
  it("rank_overtaken", () => {
    expect(renderNotification("rank_overtaken", base, "lucio")).toMatchObject({
      icon: "📉",
      title: "Manu te pasó en Temporada Verano. ¡A entrenar!",
      href: "/group/g1/season/s1",
    });
  });
  it("badge_level_up: para los demás y para el propio actor", () => {
    const d = { ...base, actorName: "Lucio", actorId: "lucio", badgeName: "Gym Rat", level: 2 };
    expect(renderNotification("badge_level_up", d, "manu")).toMatchObject({ icon: "🏅", title: "Lucio subió a Gym Rat II", href: "/u/lucio" });
    expect(renderNotification("badge_level_up", d, "lucio")).toMatchObject({ title: "Subiste a Gym Rat II", href: "/profile" });
  });
  it("season_results_published y season_started", () => {
    expect(renderNotification("season_results_published", base, "x")).toMatchObject({
      icon: "🏆",
      title: "Se publicaron los resultados de Temporada Verano",
      href: "/group/g1/season/s1",
    });
    expect(renderNotification("season_started", base, "x")).toMatchObject({ title: "Arrancó Temporada Verano en Los Bravos", href: "/group/g1/season/s1" });
  });
  it("new_follower", () => {
    expect(renderNotification("new_follower", { actorId: "ana", actorName: "Ana" }, "manu")).toMatchObject({
      icon: "👋",
      title: "Ana empezó a seguirte",
      href: "/u/ana",
    });
  });
  it("member_joined e invitación", () => {
    expect(renderNotification("member_joined", { ...base, actorName: "Ana" }, "manu")).toMatchObject({
      icon: "🙌",
      title: "Ana se unió a Los Bravos",
      href: "/group/g1",
    });
    const invite = renderNotification("member_joined", { ...base, kind: "invite", href: "/groups/join?token=abc" }, "ana");
    expect(invite).toMatchObject({ title: "Manu te invitó a Los Bravos", href: "/groups/join?token=abc" });
  });
  it("una invitación con href externo cae en el grupo (no abre links de afuera)", () => {
    expect(renderNotification("member_joined", { ...base, kind: "invite", href: "https://evil.com" }, "ana").href).toBe("/group/g1");
    expect(renderNotification("member_joined", { ...base, kind: "invite", href: "//evil.com" }, "ana").href).toBe("/group/g1");
  });
  it("friend_workout", () => {
    expect(renderNotification("friend_workout", { ...base, categoryName: "Running", durationMinutes: 70 }, "ana")).toMatchObject({
      title: "Manu entrenó",
      body: "Running · 1 h 10 min",
      href: "/workout/a1",
    });
  });
  it("reaction_received agrupada", () => {
    expect(renderNotification("reaction_received", { ...base, actorName: "Lucio", emoji: "muscle", othersCount: 3 }, "manu")).toMatchObject({
      icon: "💪",
      title: "Lucio y 3 más reaccionaron a tu entrenamiento",
    });
  });
  it("reaction_received: emoji por clave ASCII o literal", () => {
    expect(renderNotification("reaction_received", { ...base, emoji: "muscle" }, "lucio")).toMatchObject({
      icon: "💪",
      title: "Manu reaccionó 💪 a tu entrenamiento",
      href: "/workout/a1",
    });
    expect(renderNotification("reaction_received", { ...base, emoji: "🔥" }, "lucio").icon).toBe("🔥");
  });
  it("sin nombre de actor usa 'Alguien'", () => {
    expect(renderNotification("new_follower", { actorId: "x", actorName: null }, "manu").title).toBe("Alguien empezó a seguirte");
  });
  it("devuelve los nombres a resaltar", () => {
    expect(renderNotification("first_workout_of_week", base, "lucio").emphasis).toEqual(["Manu", "Los Bravos"]);
  });
});
