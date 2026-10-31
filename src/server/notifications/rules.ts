/**
 * Reglas PURAS de notificaciones (W2-3): qué emitir ante una actividad nueva y cómo se lee cada tipo.
 * Sin DB ni "server-only": se testean como funciones puras y `renderNotification` también sirve en el cliente.
 */
import type { NotificationType } from "@prisma/client";
import type { ActivityEffects } from "@/src/server/activities/effects";
import { romanLevel } from "@/src/features/badges/levels";
import { formatDuration } from "@/src/lib/time";
import { emojiFromKey, isReactionEmoji } from "@/src/server/social/reaction-types";

export type GroupContext = {
  groupId: string;
  groupName: string;
  /** Miembros vigentes del grupo (puede incluir al actor; las reglas lo excluyen). */
  memberIds: string[];
  /** Semana local (zona del grupo) de la actividad. */
  weekKey: string;
  /** La semana de la actividad es la semana en curso (en la zona del grupo). */
  isCurrentWeek: boolean;
  /** La actividad agregó un día entrenado (el actor no tenía otra ese día local). */
  isNewDay: boolean;
  /** Días entrenados del actor en esa semana, contando la actividad nueva. */
  actorWorkoutsThisWeek: number;
  /** Cuántos otros miembros tienen al menos una actividad esa semana. */
  othersWithWorkoutThisWeek: number;
  weeklyGoal: number;
};

export type SeasonContext = {
  seasonId: string;
  seasonName: string;
  groupId: string;
  /** Semana en curso en la zona del grupo (para limitar "te pasaron" a 1 por semana y par). */
  weekKey: string;
  /** Miembros vigentes de la temporada (puede incluir al actor). */
  memberIds: string[];
  /** Racha del actor después del recálculo (`SeasonStanding.currentStreak`). */
  actorStreak: number;
  /** Standings después del recálculo de los demás miembros (sus puntos no cambian con la actividad del actor). */
  others: { userId: string; points: number; rank: number }[];
};

export type RuleContext = {
  actor: { id: string; name: string | null };
  groups: GroupContext[];
  seasons: SeasonContext[];
  effects: ActivityEffects; // ScoringEffect[] incluye rankBefore/After y totalBefore/After por temporada
  isNewActivity: boolean;
  /** Seguidores del actor (para `badge_level_up`). */
  followerIds: string[];
  /** Amigos (seguimiento mutuo) del actor que no comparten ningún grupo con él (para `friend_workout`). */
  friendIdsOutsideGroups: string[];
  activity: { categoryName: string | null; durationMinutes: number };
  /** Ventana de 2 h (ver `pushWindowKey`) para el throttle de `friend_workout`. */
  windowKey: string;
};

export type PlannedNotification = {
  recipientIds: string[];
  type: NotificationType;
  actorId: string;
  groupId?: string;
  seasonId?: string;
  activityId?: string;
  data: Record<string, unknown>;
  dedupe: (recipientId: string) => string;
};

/** Ventana de 2 h (UTC) para el throttle de `friend_workout`: "YYYY-MM-DDTHH" con HH par. */
export function pushWindowKey(now: Date): string {
  const iso = now.toISOString();
  const hour = Number(iso.slice(11, 13));
  return `${iso.slice(0, 11)}${String(hour - (hour % 2)).padStart(2, "0")}`;
}

export const STREAK_MILESTONES = [3, 5, 10] as const;

const others = (ids: string[], actorId: string) => [...new Set(ids)].filter((id) => id !== actorId);

export function planActivityNotifications(ctx: RuleContext, activityId: string): PlannedNotification[] {
  if (!ctx.isNewActivity) return [];
  const actorId = ctx.actor.id;
  const out: PlannedNotification[] = [];
  const push = (p: PlannedNotification) => {
    if (p.recipientIds.length) out.push(p);
  };

  for (const g of ctx.groups) {
    const recipients = others(g.memberIds, actorId);
    const data = { groupName: g.groupName, weekKey: g.weekKey };
    if (g.isCurrentWeek && g.isNewDay && g.actorWorkoutsThisWeek === 1 && g.othersWithWorkoutThisWeek === 0) {
      push({
        recipientIds: recipients,
        type: "first_workout_of_week",
        actorId,
        groupId: g.groupId,
        activityId,
        data,
        dedupe: (r) => `first_week:${g.groupId}:${g.weekKey}:${r}`,
      });
    }
    if (g.isNewDay && g.weeklyGoal > 0 && g.actorWorkoutsThisWeek === g.weeklyGoal) {
      push({
        recipientIds: recipients,
        type: "weekly_goal_met",
        actorId,
        groupId: g.groupId,
        activityId,
        data: { ...data, goal: g.weeklyGoal },
        dedupe: (r) => `goal:${g.groupId}:${g.weekKey}:${actorId}:${r}`,
      });
    }
  }

  for (const s of ctx.seasons) {
    const recipients = others(s.memberIds, actorId);
    const data = { seasonName: s.seasonName };
    if ((STREAK_MILESTONES as readonly number[]).includes(s.actorStreak)) {
      const n = s.actorStreak;
      push({
        recipientIds: recipients,
        type: "streak_milestone",
        actorId,
        groupId: s.groupId,
        seasonId: s.seasonId,
        activityId,
        data: { ...data, n },
        dedupe: (r) => `streak:${s.seasonId}:${actorId}:${n}:${r}`,
      });
    }
    const eff = ctx.effects.scoring.find((e) => e.seasonId === s.seasonId);
    if (eff) {
      // Fue pasado: estaba adelante del actor (más puntos que los que tenía antes) y ahora quedó atrás.
      const overtaken = s.others
        .filter((o) => o.userId !== actorId && recipients.includes(o.userId))
        .filter((o) => o.points > eff.totalBefore && o.rank > eff.rankAfter)
        .map((o) => o.userId);
      push({
        recipientIds: overtaken,
        type: "rank_overtaken",
        actorId,
        groupId: s.groupId,
        seasonId: s.seasonId,
        activityId,
        data: { ...data, rankAfter: eff.rankAfter },
        dedupe: (r) => `overtaken:${s.seasonId}:${actorId}:${r}:${s.weekKey}`,
      });
    }
  }

  for (const b of ctx.effects.badges) {
    if (b.levelAfter <= b.levelBefore) continue;
    push({
      recipientIds: [...new Set([actorId, ...ctx.followerIds])],
      type: "badge_level_up",
      actorId,
      activityId,
      data: { code: b.code, badgeName: b.name, iconKey: b.iconKey, level: b.levelAfter },
      dedupe: (r) => `badge:${actorId}:${b.code}:${b.levelAfter}:${r}`,
    });
  }

  const friends = others(ctx.friendIdsOutsideGroups, actorId);
  push({
    recipientIds: friends,
    type: "friend_workout",
    actorId,
    activityId,
    data: { categoryName: ctx.activity.categoryName, durationMinutes: ctx.activity.durationMinutes },
    // Throttle: como máximo 1 cada ventana de 2 h por par actor-destinatario.
    dedupe: (r) => `friend_workout:${actorId}:${r}:${ctx.windowKey}`,
  });

  return out;
}

// --- Presentación ---

export type RenderedNotification = {
  title: string;
  body?: string;
  href: string;
  icon: string;
  /** Fragmentos del título que la UI resalta en negrita (nombres). */
  emphasis: string[];
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Solo rutas internas ("/algo", no "//host" ni "https://…"). */
function internalHref(v: unknown): string | null {
  const s = str(v);
  return s && s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : null;
}

function reactionEmoji(v: unknown): string {
  const s = str(v);
  if (!s) return "💪";
  return emojiFromKey(s) ?? (isReactionEmoji(s) ? s : "💪");
}

/**
 * Texto es-AR de una notificación. `data` es el JSON guardado más los campos de la fila
 * (`actorId`, `groupId`, `seasonId`, `activityId`) y los nombres actuales (`actorName`, `groupName`, `seasonName`).
 */
export function renderNotification(type: NotificationType, data: Record<string, unknown>, viewerId: string): RenderedNotification {
  const actor = str(data.actorName) ?? "Alguien";
  const actorId = str(data.actorId);
  const group = str(data.groupName) ?? "tu grupo";
  const season = str(data.seasonName) ?? "la temporada";
  const groupId = str(data.groupId);
  const seasonId = str(data.seasonId);
  const activityId = str(data.activityId);

  const groupHref = groupId ? `/group/${groupId}` : "/groups";
  const seasonHref = groupId && seasonId ? `/group/${groupId}/season/${seasonId}` : groupHref;
  const profileHref = actorId ? (actorId === viewerId ? "/profile" : `/u/${actorId}`) : "/home";
  const activityHref = activityId ? `/workout/${activityId}` : "/home";

  switch (type) {
    case "first_workout_of_week":
      return { icon: "🔥", title: `${actor} fue el primero en arrancar la semana en ${group}`, href: groupHref, emphasis: [actor, group] };
    case "weekly_goal_met":
      return { icon: "✅", title: `${actor} cumplió su objetivo semanal`, body: group, href: groupHref, emphasis: [actor] };
    case "streak_milestone": {
      const n = num(data.n) ?? 0;
      return { icon: "⚡", title: `${actor} lleva ${n} semanas seguidas`, body: season, href: seasonHref, emphasis: [actor] };
    }
    case "rank_overtaken":
      return { icon: "📉", title: `${actor} te pasó en ${season}. ¡A entrenar!`, href: seasonHref, emphasis: [actor, season] };
    case "badge_level_up": {
      const badge = [str(data.badgeName) ?? "una insignia", romanLevel(num(data.level) ?? 0)].filter(Boolean).join(" ");
      const self = actorId === viewerId;
      return {
        icon: "🏅",
        title: self ? `Subiste a ${badge}` : `${actor} subió a ${badge}`,
        href: profileHref,
        emphasis: self ? [badge] : [actor, badge],
      };
    }
    case "season_started":
      return { icon: "🚀", title: `Arrancó ${season} en ${group}`, body: "¡Que empiece la competencia!", href: seasonHref, emphasis: [season] };
    case "season_results_published":
      return { icon: "🏆", title: `Se publicaron los resultados de ${season}`, href: seasonHref, emphasis: [season] };
    case "new_follower":
      return { icon: "👋", title: `${actor} empezó a seguirte`, href: profileHref, emphasis: [actor] };
    case "member_joined":
      if (data.kind === "invite") {
        return { icon: "✉️", title: `${actor} te invitó a ${group}`, href: internalHref(data.href) ?? groupHref, emphasis: [actor, group] };
      }
      return { icon: "🙌", title: `${actor} se unió a ${group}`, href: groupHref, emphasis: [actor, group] };
    case "friend_workout": {
      const minutes = num(data.durationMinutes);
      const body = [str(data.categoryName), minutes ? formatDuration(minutes) : null].filter(Boolean).join(" · ");
      return { icon: "🏋️", title: `${actor} entrenó`, ...(body ? { body } : {}), href: activityHref, emphasis: [actor] };
    }
    case "reaction_received": {
      const emoji = reactionEmoji(data.emoji);
      const more = num(data.othersCount) ?? 0;
      if (more > 0) {
        return { icon: emoji, title: `${actor} y ${more} más reaccionaron a tu entrenamiento`, href: activityHref, emphasis: [actor] };
      }
      return { icon: emoji, title: `${actor} reaccionó ${emoji} a tu entrenamiento`, href: activityHref, emphasis: [actor] };
    }
    case "weekly_digest":
      return { icon: "📬", title: "Tu resumen semanal", href: "/home", emphasis: [] };
  }
}
