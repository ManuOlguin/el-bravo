import "server-only";
import type { GroupRole, Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { notify } from "@/src/server/notifications";
import { recomputeSeason } from "@/src/server/scoring";
import { AuthError } from "@/src/server/auth/errors";
import { membershipRole } from "@/src/server/auth/policies";
import { generateInviteCode, inviteExpiresAt, isInviteCodeShape, normalizeInviteCode } from "./invite";
import { signGroupInviteToken, verifyGroupInviteToken } from "./invite-token";

/** Error de regla de negocio con mensaje para el usuario (es-AR). */
export class GroupError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
    this.name = "GroupError";
  }
}

const INVALID_CODE = "El código no es válido o ya venció.";

type Tx = Prisma.TransactionClient;

async function activeRole(db: Tx | typeof prisma, groupId: string, userId: string) {
  const m = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true, leftAt: true },
  });
  return membershipRole(m);
}

/**
 * Saca al usuario de las temporadas NO finalizadas del grupo (las finalizadas quedan congeladas).
 * Devuelve los ids a recalcular DESPUÉS del commit.
 */
async function leaveOpenSeasons(tx: Tx, groupId: string, userId: string, now: Date): Promise<string[]> {
  const rows = await tx.seasonMember.findMany({
    where: { userId, leftAt: null, season: { groupId, finalizedAt: null } },
    select: { id: true, seasonId: true },
  });
  if (rows.length) await tx.seasonMember.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { leftAt: now } });
  return rows.map((r) => r.seasonId);
}

async function recomputeAll(seasonIds: string[]) {
  for (const id of seasonIds) await recomputeSeason(id);
}

async function safeNotify(input: Parameters<typeof notify>[0]) {
  try {
    await notify(input);
  } catch (e) {
    console.error(`[notify ${input.type}]`, e); // una notificación nunca rompe la acción
  }
}

export async function createGroup(
  creatorId: string,
  input: { name: string; description: string | null; photoUrl: string | null; timezone: string }
): Promise<{ groupId: string }> {
  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      photoUrl: input.photoUrl,
      timezone: input.timezone,
      createdBy: creatorId,
      members: { create: { userId: creatorId, role: "admin", status: "accepted", acceptedAt: new Date() } },
    },
    select: { id: true },
  });
  return { groupId: group.id };
}

export async function updateGroup(
  groupId: string,
  input: { name: string; description: string | null; photoUrl: string | null; timezone: string }
): Promise<void> {
  const before = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { timezone: true } });
  await prisma.group.update({ where: { id: groupId }, data: input });
  // Las fechas locales (y por lo tanto los puntos) dependen de la zona del grupo.
  if (before.timezone !== input.timezone) {
    const open = await prisma.season.findMany({ where: { groupId, finalizedAt: null }, select: { id: true } });
    await recomputeAll(open.map((s) => s.id));
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Miembros, temporadas, puntos y notificaciones caen por ON DELETE CASCADE.
  await prisma.group.delete({ where: { id: groupId } });
}

export async function getOrCreateInviteCode(groupId: string, regenerate: boolean): Promise<{ code: string; expiresAt: Date }> {
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { inviteCode: true, inviteCodeExpiresAt: true } });
  const now = new Date();
  const stillValid = g.inviteCode && isInviteCodeShape(g.inviteCode) && g.inviteCodeExpiresAt && g.inviteCodeExpiresAt > now;
  if (stillValid && !regenerate) return { code: g.inviteCode!, expiresAt: g.inviteCodeExpiresAt! };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const u = await prisma.group.update({
        where: { id: groupId },
        data: { inviteCode: code, inviteCodeExpiresAt: inviteExpiresAt(now) },
        select: { inviteCode: true, inviteCodeExpiresAt: true },
      });
      return { code: u.inviteCode!, expiresAt: u.inviteCodeExpiresAt! };
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e; // choque de unique: probar otro
    }
  }
  throw new Error("No se pudo generar un código de invitación único");
}

/**
 * Alta (o reingreso) de un usuario a un grupo. Siempre queda como `member`: un admin que se fue y
 * vuelve NO recupera el rol. No lo suma a ninguna temporada (eso es `joinSeasonAction`).
 * `allowRemoved`: un expulsado solo puede volver con una invitación personal de un admin.
 */
export async function addMember(
  groupId: string,
  userId: string,
  opts: { allowRemoved: boolean }
): Promise<{ groupId: string; alreadyMember: boolean }> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (existing && membershipRole(existing)) return { alreadyMember: true, joinedAt: existing.joinedAt };
    if (existing?.status === "removed" && !opts.allowRemoved) {
      throw new GroupError("Un admin te sacó de este grupo. Pedile que te invite de nuevo.");
    }
    const data = { role: "member" as GroupRole, status: "accepted" as const, leftAt: null, joinedAt: now, acceptedAt: now };
    if (existing) await tx.groupMember.update({ where: { id: existing.id }, data });
    else await tx.groupMember.create({ data: { groupId, userId, ...data } });
    return { alreadyMember: false, joinedAt: now };
  });

  if (!result.alreadyMember) {
    const admins = await prisma.groupMember.findMany({
      where: { groupId, role: "admin", leftAt: null, status: "accepted", userId: { not: userId } },
      select: { userId: true },
    });
    if (admins.length) {
      const stamp = result.joinedAt.getTime();
      await safeNotify({
        recipientIds: admins.map((a) => a.userId),
        type: "member_joined",
        actorId: userId,
        groupId,
        dedupeKey: (recipientId) => `member_joined:${groupId}:${userId}:${stamp}:${recipientId}`,
      });
    }
  }
  return { groupId, alreadyMember: result.alreadyMember };
}

export async function joinGroupByCode(userId: string, rawCode: string): Promise<{ groupId: string; alreadyMember: boolean }> {
  const code = normalizeInviteCode(rawCode);
  if (!isInviteCodeShape(code)) throw new GroupError(INVALID_CODE);
  const group = await prisma.group.findFirst({
    where: { inviteCode: code, inviteCodeExpiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!group) throw new GroupError(INVALID_CODE);
  return addMember(group.id, userId, { allowRemoved: false });
}

/** Salir. El último admin no puede salir si quedan otros miembros; si es el único miembro, se borra el grupo. */
export async function leaveGroup(userId: string, groupId: string): Promise<{ deleted: boolean }> {
  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const role = await activeRole(tx, groupId, userId);
    if (!role) throw new AuthError("NOT_FOUND");
    const others = await tx.groupMember.findMany({
      where: { groupId, leftAt: null, status: "accepted", userId: { not: userId } },
      select: { role: true },
    });
    if (others.length === 0) {
      await tx.group.delete({ where: { id: groupId } });
      return { deleted: true, seasonIds: [] as string[] };
    }
    if (role === "admin" && !others.some((o) => o.role === "admin")) {
      throw new GroupError("Nombrá a otro admin antes de salir.");
    }
    await tx.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { leftAt: now } });
    return { deleted: false, seasonIds: await leaveOpenSeasons(tx, groupId, userId, now) };
  });
  await recomputeAll(outcome.seasonIds);
  return { deleted: outcome.deleted };
}

/** Expulsar (solo admins; el chequeo de rol lo hace la acción). */
export async function kickMember(adminId: string, groupId: string, targetId: string): Promise<void> {
  if (adminId === targetId) throw new GroupError("No podés expulsarte a vos mismo.");
  const now = new Date();
  const seasonIds = await prisma.$transaction(async (tx) => {
    if (!(await activeRole(tx, groupId, targetId))) throw new GroupError("Esa persona ya no es miembro del grupo.");
    await tx.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetId } },
      data: { leftAt: now, status: "removed", respondedAt: now, respondedBy: adminId },
    });
    return leaveOpenSeasons(tx, groupId, targetId, now);
  });
  await recomputeAll(seasonIds);
}

export async function setMemberRole(groupId: string, targetId: string, role: GroupRole): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await activeRole(tx, groupId, targetId);
    if (!current) throw new GroupError("Esa persona ya no es miembro del grupo.");
    if (current === role) return;
    if (current === "admin" && role === "member") {
      const admins = await tx.groupMember.count({ where: { groupId, role: "admin", leftAt: null, status: "accepted" } });
      if (admins <= 1) throw new GroupError("Tiene que quedar al menos un admin.");
    }
    await tx.groupMember.update({ where: { groupId_userId: { groupId, userId: targetId } }, data: { role } });
  });
}

/**
 * Invitar amigos (seguimiento mutuo) a un grupo. Los que ya son miembros se saltean.
 * La invitación viaja como notificación `member_joined` con `data.kind = "invite"` (no hace falta un
 * tipo nuevo) y un `href` a `/groups/join?token=<JWT de 7 días>` que solo sirve para ese usuario.
 */
export async function inviteFriends(inviterId: string, groupId: string, userIds: string[]): Promise<{ invited: number }> {
  const ids = [...new Set(userIds)].filter((id) => id !== inviterId);
  if (ids.length === 0) return { invited: 0 };

  const friends = await prisma.user.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      followers: { some: { followerId: inviterId } },
      following: { some: { followingId: inviterId } },
    },
    select: { id: true },
  });
  if (friends.length !== ids.length) throw new GroupError("Solo podés invitar a tus amigos.");

  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { in: ids }, leftAt: null, status: "accepted" },
    select: { userId: true },
  });
  const already = new Set(members.map((m) => m.userId));
  const targets = ids.filter((id) => !already.has(id));

  const day = new Date().toISOString().slice(0, 10);
  for (const userId of targets) {
    const token = await signGroupInviteToken({ groupId, userId, inviterId });
    await safeNotify({
      recipientIds: [userId],
      type: "member_joined",
      actorId: inviterId,
      groupId,
      data: { kind: "invite", groupId, inviterId, href: `/groups/join?token=${encodeURIComponent(token)}` },
      // una invitación por grupo/destinatario por día (reintentos o doble click no duplican)
      dedupeKey: (recipientId) => `group_invite:${groupId}:${recipientId}:${day}`,
    });
  }
  return { invited: targets.length };
}

/** Unirse con una invitación personal. Solo funciona para el destinatario; permite volver a un expulsado. */
export async function joinGroupByInviteToken(userId: string, token: string): Promise<{ groupId: string; alreadyMember: boolean }> {
  const payload = await verifyGroupInviteToken(token);
  if (!payload) throw new GroupError("La invitación no es válida o ya venció.");
  if (payload.userId !== userId) throw new GroupError("Esta invitación no es para vos.");
  const group = await prisma.group.findUnique({ where: { id: payload.groupId }, select: { id: true } });
  if (!group) throw new GroupError("El grupo ya no existe.");
  // La invitación vale mientras quien la mandó siga siendo admin, y no sirve para volver si te
  // expulsaron DESPUÉS de recibirla (antes, cualquier invitación vieja anulaba la expulsión).
  if ((await activeRole(prisma, group.id, payload.inviterId)) !== "admin") {
    throw new GroupError("La invitación ya no es válida: pedile una nueva a un admin del grupo.");
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
    select: { status: true, respondedAt: true },
  });
  // `iat` tiene precisión de segundos: si la expulsión cae en el mismo segundo, la invitación vale.
  if (membership?.status === "removed" && membership.respondedAt && Math.floor(membership.respondedAt.getTime() / 1000) * 1000 > payload.issuedAt.getTime()) {
    throw new GroupError("Te sacaron del grupo después de esta invitación: pedile una nueva a un admin.");
  }
  return addMember(group.id, userId, { allowRemoved: true });
}

/** Datos mínimos para la pantalla "Te invitaron a…" (sin unirse todavía). */
export async function previewInviteToken(
  userId: string,
  token: string
): Promise<{ ok: true; groupId: string; groupName: string; inviterName: string | null; alreadyMember: boolean } | { ok: false; error: string }> {
  const payload = await verifyGroupInviteToken(token);
  if (!payload) return { ok: false, error: "La invitación no es válida o ya venció." };
  if (payload.userId !== userId) return { ok: false, error: "Esta invitación no es para vos." };
  const [group, inviter, role] = await Promise.all([
    prisma.group.findUnique({ where: { id: payload.groupId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: payload.inviterId }, select: { name: true } }),
    activeRole(prisma, payload.groupId, userId),
  ]);
  if (!group) return { ok: false, error: "El grupo ya no existe." };
  return { ok: true, groupId: group.id, groupName: group.name, inviterName: inviter?.name ?? null, alreadyMember: !!role };
}
