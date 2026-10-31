import { NextResponse } from "next/server";
import { requireUser } from "@/src/server/auth/dal";
import { createActivity } from "@/src/server/activities/service";
import {
  activityErrorResponse,
  legacyBodyToActivityInput,
  type LegacyActivityBody,
} from "@/src/server/activities/legacy";

// PUENTE (W0-C): delega en el servicio de actividades. W2-1 lo reemplaza por una Server Action.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = ((await req.json().catch(() => null)) ?? {}) as LegacyActivityBody;
    const input = legacyBodyToActivityInput(body, user.timezone);
    const { activityId, effects } = await createActivity(user.id, input);
    return NextResponse.json({ ok: true, activityId, effects }, { status: 201 });
  } catch (e) {
    return activityErrorResponse(e);
  }
}
