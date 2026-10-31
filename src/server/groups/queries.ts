import "server-only";
import { prisma } from "@/src/lib/db";
import { AuthError } from "@/src/server/auth/errors";
import { membershipRole } from "@/src/server/auth/policies";

/** DTO del grupo para sus miembros. NUNCA incluye `inviteCode` ni emails. */
export type GroupDTO = {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  timezone: string;
  myRole: "admin" | "member";
  members: { userId: string; name: string | null; photoUrl: string | null; role: "admin" | "member"; joinedAt: Date }[];
};

/** Lanza `AuthError("NOT_FOUND")` si no existe o nunca fue miembro y `FORBIDDEN` si ya no lo es. */
export async function getGroupForMember(groupId: string, userId: string): Promise<GroupDTO> {
  const me = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true, leftAt: true },
  });
  const myRole = membershipRole(me);
  if (!myRole) throw new AuthError(me ? "FORBIDDEN" : "NOT_FOUND");

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      photoUrl: true,
      timezone: true,
      members: {
        where: { leftAt: null, status: "accepted" },
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        select: { userId: true, role: true, joinedAt: true, user: { select: { name: true, photoUrl: true } } },
      },
    },
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    photoUrl: group.photoUrl,
    timezone: group.timezone,
    myRole,
    members: group.members
      .map((m) => ({ userId: m.userId, name: m.user.name, photoUrl: m.user.photoUrl, role: m.role, joinedAt: m.joinedAt }))
      // admins primero, después por antigüedad
      .sort((a, b) => (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1)),
  };
}

/** Ids de miembros vigentes del grupo. */
export async function activeMemberIds(groupId: string): Promise<string[]> {
  const rows = await prisma.groupMember.findMany({ where: { groupId, leftAt: null, status: "accepted" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
