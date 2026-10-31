import { NextResponse } from "next/server";
import { finalizeDueSeasons } from "@/src/server/seasons/lifecycle";

// Cron diario (D3): finaliza y publica las temporadas `auto` que ya terminaron en la zona de su grupo.
// Vercel manda `Authorization: Bearer $CRON_SECRET` si la variable está definida (W3 agrega el schedule en vercel.json).

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const finalized = await finalizeDueSeasons();
  return NextResponse.json({ ok: true, finalized });
}
