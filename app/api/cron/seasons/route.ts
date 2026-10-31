import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/src/server/http/cron-auth";
import { finalizeDueSeasons } from "@/src/server/seasons/lifecycle";

// Cron diario (D3): finaliza y publica las temporadas `auto` que ya terminaron en la zona de su grupo.
// Vercel manda `Authorization: Bearer $CRON_SECRET` si la variable está definida (W3 agrega el schedule en vercel.json).

export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const finalized = await finalizeDueSeasons();
  return NextResponse.json({ ok: true, finalized });
}
