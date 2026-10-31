"use server";
// Lecturas paginadas de la página de grupo. Las MUTACIONES de grupos y temporadas viven en
// src/server/actions/{groups,seasons}.ts (W1-4 / W1-1); acá solo hay lecturas para la UI.
import { z } from "zod";
import { requireGroupMember } from "@/src/server/auth/dal";
import { ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { getGroupFeed, type GroupFeedPage } from "./data";

const input = z.object({ groupId: z.string().min(1).max(64), cursor: z.string().max(200).nullable() });

export async function loadGroupFeedAction(groupId: string, cursor: string | null): Promise<ActionResult<GroupFeedPage>> {
  return runAction(async () => {
    const parsed = parseInput(input, { groupId, cursor });
    if (!parsed.ok) return parsed.result;
    const { user } = await requireGroupMember(parsed.data.groupId);
    return ok(await getGroupFeed(parsed.data.groupId, user.id, { cursor: parsed.data.cursor }));
  });
}
