"use server";

import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { getWorkoutHistory, type HistoryItem } from "./history";

const cursorSchema = z.string().max(200).nullable();

/** "Ver más" del historial propio (`/profile`). Solo devuelve entrenamientos del usuario logueado. */
export async function loadWorkoutHistoryAction(cursor: string | null): Promise<ActionResult<{ items: HistoryItem[]; nextCursor: string | null }>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(cursorSchema, cursor);
    if (!parsed.ok) return parsed.result;
    return ok(await getWorkoutHistory(me.id, { cursor: parsed.data }));
  });
}
