import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
