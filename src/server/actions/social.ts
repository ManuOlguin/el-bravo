"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { follow, searchUsers, SocialError, unfollow } from "@/src/server/social/follows";

const userIdSchema = z.string({ error: "Usuario inválido." }).min(1, { error: "Usuario inválido." }).max(64);

/** Traduce los errores de dominio de social a ActionResult. */
async function socialAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof SocialError) return fail(e.userMessage);
      throw e;
    }
  });
}

export async function followAction(userId: string): Promise<ActionResult<{ isFollowing: true; isFriend: boolean }>> {
  return socialAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(userIdSchema, userId);
    if (!parsed.ok) return parsed.result;
    const r = await follow(me.id, parsed.data);
    revalidatePath(`/u/${parsed.data}`);
    return ok(r);
  });
}

export async function unfollowAction(userId: string): Promise<ActionResult<{ isFollowing: false }>> {
  return socialAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(userIdSchema, userId);
    if (!parsed.ok) return parsed.result;
    const r = await unfollow(me.id, parsed.data);
    revalidatePath(`/u/${parsed.data}`);
    return ok(r);
  });
}

export async function searchUsersAction(
  query: string
): Promise<ActionResult<{ id: string; name: string | null; photoUrl: string | null; isFollowing: boolean }[]>> {
  return socialAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(z.string().max(80), query);
    if (!parsed.ok) return parsed.result;
    return ok(await searchUsers(me.id, parsed.data));
  });
}
