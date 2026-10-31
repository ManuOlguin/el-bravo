"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGroupAdmin, requireGroupMember, requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { rateLimit, retryAfterMinutes } from "@/src/server/account/rate-limit";
import {
  createGroup,
  deleteGroup,
  getOrCreateInviteCode,
  inviteFriends,
  joinGroupByInviteToken,
  GroupError,
  joinGroupByCode,
  kickMember,
  leaveGroup,
  setMemberRole,
  updateGroup,
} from "@/src/server/groups/membership";
import { createGroupSchema, idSchema, inviteCodeInputSchema, roleSchema, updateGroupSchema } from "@/src/server/groups/schemas";

const JOIN_LIMIT = { max: 10, windowMs: 15 * 60_000 };

/** runAction + errores de regla de negocio de grupos. */
async function groupAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GroupError) return fail(e.userMessage);
      throw e;
    }
  });
}

function parseId(id: unknown) {
  return parseInput(idSchema, id);
}

export async function createGroupAction(input: {
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  timezone?: string;
}): Promise<ActionResult<{ groupId: string }>> {
  return groupAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(createGroupSchema, input);
    if (!parsed.ok) return parsed.result;
    const r = await createGroup(me.id, parsed.data);
    return ok(r, "Grupo creado.");
  });
}

export async function updateGroupAction(
  groupId: string,
  input: { name: string; description?: string | null; photoUrl?: string | null; timezone: string }
): Promise<ActionResult<void>> {
  return groupAction(async () => {
    const id = parseId(groupId);
    if (!id.ok) return id.result;
    await requireGroupAdmin(id.data);
    const parsed = parseInput(updateGroupSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateGroup(id.data, parsed.data);
    revalidatePath(`/group/${id.data}`);
    return ok(undefined, "Grupo actualizado.");
  });
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult<void>> {
  return groupAction(async () => {
    const id = parseId(groupId);
    if (!id.ok) return id.result;
    await requireGroupAdmin(id.data);
    await deleteGroup(id.data);
    return ok(undefined, "Grupo borrado.");
  });
}

export async function getInviteCodeAction(groupId: string): Promise<ActionResult<{ code: string; expiresAt: Date }>> {
  return groupAction(async () => {
    const id = parseId(groupId);
    if (!id.ok) return id.result;
    await requireGroupAdmin(id.data);
    return ok(await getOrCreateInviteCode(id.data, false));
  });
}

export async function regenerateInviteCodeAction(groupId: string): Promise<ActionResult<{ code: string; expiresAt: Date }>> {
  return groupAction(async () => {
    const id = parseId(groupId);
    if (!id.ok) return id.result;
    await requireGroupAdmin(id.data);
    return ok(await getOrCreateInviteCode(id.data, true), "Generamos un código nuevo. El anterior ya no sirve.");
  });
}

export async function joinGroupAction(code: string): Promise<ActionResult<{ groupId: string }>> {
  return groupAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(inviteCodeInputSchema, code);
    if (!parsed.ok) return parsed.result;
    const limit = rateLimit(`join:${me.id}`, JOIN_LIMIT);
    if (!limit.ok) return fail(`Demasiados intentos. Probá de nuevo en ${retryAfterMinutes(limit.retryAfterS)} minutos.`);
    const r = await joinGroupByCode(me.id, parsed.data);
    revalidatePath(`/group/${r.groupId}`);
    return ok({ groupId: r.groupId }, r.alreadyMember ? "Ya sos miembro de este grupo." : "¡Te uniste al grupo!");
  });
}

export async function leaveGroupAction(groupId: string): Promise<ActionResult<void>> {
  return groupAction(async () => {
    const id = parseId(groupId);
    if (!id.ok) return id.result;
    const { user } = await requireGroupMember(id.data);
    const r = await leaveGroup(user.id, id.data);
    return ok(undefined, r.deleted ? "Saliste y el grupo se borró porque no quedaba nadie." : "Saliste del grupo.");
  });
}

export async function kickMemberAction(groupId: string, userId: string): Promise<ActionResult<void>> {
  return groupAction(async () => {
    const gid = parseId(groupId);
    if (!gid.ok) return gid.result;
    const uid = parseId(userId);
    if (!uid.ok) return uid.result;
    const admin = await requireGroupAdmin(gid.data);
    await kickMember(admin.id, gid.data, uid.data);
    revalidatePath(`/group/${gid.data}`);
    return ok(undefined, "Lo sacamos del grupo.");
  });
}

export async function inviteFriendsToGroupAction(groupId: string, userIds: string[]): Promise<ActionResult<{ invited: number }>> {
  return groupAction(async () => {
    await requireUser();
    const gid = parseId(groupId);
    if (!gid.ok) return gid.result;
    const ids = parseInput(z.array(idSchema).min(1, { error: "Elegí al menos un amigo." }).max(100), userIds);
    if (!ids.ok) return ids.result;
    const admin = await requireGroupAdmin(gid.data);
    const r = await inviteFriends(admin.id, gid.data, ids.data);
    const msg =
      r.invited === 0 ? "Ya estaban todos en el grupo." : r.invited === 1 ? "Mandamos 1 invitación." : `Mandamos ${r.invited} invitaciones.`;
    return ok(r, msg);
  });
}

export async function joinGroupByInviteTokenAction(token: string): Promise<ActionResult<{ groupId: string }>> {
  return groupAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(z.string().min(1).max(2048), token);
    if (!parsed.ok) return fail("La invitación no es válida o ya venció.");
    const r = await joinGroupByInviteToken(me.id, parsed.data);
    revalidatePath(`/group/${r.groupId}`);
    return ok({ groupId: r.groupId }, r.alreadyMember ? "Ya sos miembro de este grupo." : "¡Te uniste al grupo!");
  });
}

export async function setMemberRoleAction(groupId: string, userId: string, role: "admin" | "member"): Promise<ActionResult<void>> {
  return groupAction(async () => {
    await requireUser();
    const gid = parseId(groupId);
    if (!gid.ok) return gid.result;
    const uid = parseId(userId);
    if (!uid.ok) return uid.result;
    const r = parseInput(roleSchema, role);
    if (!r.ok) return r.result;
    await requireGroupAdmin(gid.data);
    await setMemberRole(gid.data, uid.data, r.data);
    revalidatePath(`/group/${gid.data}`);
    return ok(undefined, r.data === "admin" ? "Ahora es admin." : "Ya no es admin.");
  });
}
