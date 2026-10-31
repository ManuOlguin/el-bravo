import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { localDateToDbDate } from "@/src/lib/time";
import { requireGroupAdmin } from "@/src/server/auth/dal";
import { routeError, isLocalDate } from "../../bridge";

// PUENTE (W0-C): fechas locales (@db.Date) + SeasonCategory (peso 1). W1-1/W2-2 lo reemplazan.

function normalizeAllowedActivityCategoryIds(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.filter((value): value is string => typeof value === "string" && value.length > 0))
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      groupId,
      name,
      startDate,
      endDate,
      minPerWeek,
      description,
      allowedActivityCategoryIds,
    } = body ?? {};

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    const user = await requireGroupAdmin(groupId);

    if (!name || typeof name !== "string" || !name.trim() || !isLocalDate(startDate) || !isLocalDate(endDate)) {
      return NextResponse.json({ error: "Completá el nombre y las fechas." }, { status: 400 });
    }

    const normalizedWeeklyGoal = Number(minPerWeek);

    if (
      !Number.isInteger(normalizedWeeklyGoal) ||
      normalizedWeeklyGoal < 1 ||
      normalizedWeeklyGoal > 7
    ) {
      return NextResponse.json({ error: "Invalid weekly goal" }, { status: 400 });
    }

    const normalizedAllowedActivityCategoryIds =
      normalizeAllowedActivityCategoryIds(allowedActivityCategoryIds);

    if (normalizedAllowedActivityCategoryIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one allowed activity type" },
        { status: 400 }
      );
    }

    const start = localDateToDbDate(startDate);
    const end = localDateToDbDate(endDate);

    if (start > end) {
      return NextResponse.json({ error: "La fecha de fin tiene que ser posterior al inicio." }, { status: 400 });
    }

    const overlappingSeason = await prisma.season.findFirst({
      where: {
        groupId,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    if (overlappingSeason) {
      return NextResponse.json(
        {
          error: `Las fechas se superponen con la temporada "${overlappingSeason.name}"`,
        },
        { status: 400 }
      );
    }

    const categories = await prisma.activityCategory.findMany({
      where: {
        id: { in: normalizedAllowedActivityCategoryIds },
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    if (categories.length !== normalizedAllowedActivityCategoryIds.length) {
      return NextResponse.json(
        { error: "One or more activity categories are invalid" },
        { status: 400 }
      );
    }

    const season = await prisma.$transaction(async (tx) => {
      const created = await tx.season.create({
        data: {
          groupId,
          name: name.trim().slice(0, 80),
          description:
            typeof description === "string" && description.trim().length > 0
              ? description.trim()
              : null,
          startDate: start,
          endDate: end,
          weeklyGoal: normalizedWeeklyGoal,
          createdBy: user.id,
          categories: {
            create: categories.map((item) => ({ activityCategoryId: item.id, weight: 1 })),
          },
        },
      });

      await tx.seasonMember.createMany({
        data: [
          {
            seasonId: created.id,
            userId: user.id,
          },
        ],
        skipDuplicates: true,
      });

      return created;
    });

    return NextResponse.json({ id: season.id }, { status: 201 });
  } catch (err) {
    return routeError(err, "No se pudo crear la temporada.");
  }
}