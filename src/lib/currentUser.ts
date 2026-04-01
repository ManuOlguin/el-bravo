import { prisma } from "@/src/lib/db";
import { verifyAuthToken } from "@/src/lib/auth";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || "elbravo_token";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    return null;
  }

  try {
    const { userId } = await verifyAuthToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.error("[getCurrentUser] user not found for token userId:", userId);
      return null;
    }

    return user;
  } catch (error) {
    console.error("[getCurrentUser] failed:", error);
    return null;
  }
}