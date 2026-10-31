import { NextResponse } from "next/server";
import { requireUser } from "@/src/server/auth/dal";
import { deleteActivity } from "@/src/server/activities/service";
import { activityErrorResponse } from "@/src/server/activities/legacy";

// PUENTE (W0-C): borrado duro vía el servicio. W2-1 lo reemplaza por una Server Action.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { effects } = await deleteActivity(user.id, id);
    return NextResponse.json({ ok: true, effects });
  } catch (e) {
    return activityErrorResponse(e);
  }
}
