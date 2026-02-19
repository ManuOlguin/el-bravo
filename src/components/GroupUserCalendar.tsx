"use client";

import React, { useEffect, useMemo, useRef } from "react";

// props
type WorkoutLike = {
  date?: Date | string;
  startedAt?: Date | string;
};

interface Props {
  seasonStart: Date;
  seasonEnd: Date;
  weeklyRequired: number;
  workouts?: WorkoutLike[];
}

function toLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isMonday(d: Date) {
  return d.getDay() === 1;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// clave estable por día local (año-mes-día)
function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

type WeekKind = "none" | "common" | "golden";

export default function GroupUserCalendar({
  seasonStart,
  seasonEnd,
  weeklyRequired,
  workouts = [],
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => toLocalDay(new Date()), []);

  // semanas SOLO del rango real de temporada
  const weeks = useMemo(() => {
    const start = toLocalDay(new Date(seasonStart));
    const end = toLocalDay(new Date(seasonEnd));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    if (start > end) return [];

    const allDays: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDays.push(new Date(d));
    }

    const result: Date[][] = [];
    let currentWeek: Date[] = [];

    for (let i = 0; i < allDays.length; i++) {
      const day = allDays[i];

      if (isMonday(day) && currentWeek.length > 0) {
        result.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);
    }

    if (currentWeek.length > 0) result.push(currentWeek);
    return result;
  }, [seasonStart, seasonEnd]);

  // 7 días extra al principio y al final (solo referencia)
  const paddingDays = useMemo(() => {
    const start = toLocalDay(new Date(seasonStart));
    const end = toLocalDay(new Date(seasonEnd));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { prefix: [] as Date[], suffix: [] as Date[] };
    }

    const prefix: Date[] = [];
    const suffix: Date[] = [];

    for (let i = 7; i >= 1; i--) prefix.push(addDays(start, -i));
    for (let i = 1; i <= 7; i++) suffix.push(addDays(end, i));

    return { prefix, suffix };
  }, [seasonStart, seasonEnd]);

  // normaliza workouts -> { días locales, conteo por día }
  const { workoutDays, workoutCounts } = useMemo(() => {
    const days: Date[] = [];
    const counts: Record<string, number> = {};

    for (const w of workouts ?? []) {
      const raw = (w as any)?.date ?? (w as any)?.startedAt;
      if (!raw) continue;

      const dt = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(dt.getTime())) continue;

      const local = toLocalDay(dt);
      const key = dateKey(local);

      days.push(local);
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return { workoutDays: days, workoutCounts: counts };
  }, [workouts]);

  // scroll a "hoy" si está en rango, centrado
  useEffect(() => {
    const container = scrollRef.current;
    const target = todayRef.current;
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const currentScrollLeft = container.scrollLeft;
    const targetCenter =
      targetRect.left -
      containerRect.left +
      currentScrollLeft +
      targetRect.width / 2;

    const nextScrollLeft = targetCenter - containerRect.width / 2;

    container.scrollTo({
      left: Math.max(0, nextScrollLeft),
      behavior: "smooth",
    });
  }, [weeks]);

  function getWeekKind(weekWorkouts: number): WeekKind {
    if (weekWorkouts >= weeklyRequired) return "golden";
    if (weekWorkouts >= 1 && weekWorkouts < weeklyRequired) return "common";
    return "none";
  }

  function weekBgClass(kind: WeekKind) {
    if (kind === "golden") return "bg-calendarweekgoldenstreak";
    if (kind === "common") return "bg-calendarweekcommonstreak";
    return "bg-calendarweek";
  }

  function dayBgVar(kind: WeekKind, isWorkoutDay: boolean) {
    if (!isWorkoutDay) return "";
    if (kind === "golden") return "var(--color-calendargreen)";
    if (kind === "common") return "var(--color-calendargray)";
    return "";
  }

  function dayTextClass(isWorkoutDay: boolean, kind: WeekKind, dim: boolean) {
    if (dim) return "text-graytext/40";
    if (isWorkoutDay && (kind === "golden" || kind === "common")) return "text-white";
    return "text-graytext";
  }

  // Render del círculo del día con badge x2/x3/x4
  function DayCircle({
    day,
    kind,
    dim = false,
  }: {
    day: Date;
    kind: WeekKind;
    dim?: boolean;
  }) {
    const isToday = isSameLocalDay(day, today);
    const key = dateKey(day);
    const count = workoutCounts[key] ?? 0;
    const isWorkoutDay = count > 0;
    const bg = dim ? "" : dayBgVar(kind, isWorkoutDay);

    return (
      <div className="relative">
        <div
          ref={isToday ? todayRef : undefined}
          style={{ background: bg }}
          className={
            "w-12 h-12 rounded-full flex items-center justify-center text-3xl font-medium " +
            dayTextClass(isWorkoutDay, kind, dim)
          }
          title={day.toLocaleDateString()}
        >
          {day.getDate()}
        </div>

        {/* badge xN solo si hay más de 1 workout */}
        {count > 1 && (
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center text-[10px] text-white leading-none pointer-events-none"
          >
            x{count}
          </div>
        )}
      </div>
    );
  }

  /**
   * Wrapper genérico para una "tira" de días con:
   * - opcional pill background (inner)
   * - rayita de hoy en overlay (abajo del pill)
   * - etiqueta de mes en overlay (arriba del día 1 de cada mes)
   */
  function DaysStrip({
    days,
    kind,
    withPillBg,
    pillBgClassName,
    pillPxClass,
    dimDays,
  }: {
    days: Date[];
    kind: WeekKind;
    withPillBg: boolean;
    pillBgClassName?: string; // ej bg-calendarweek...
    pillPxClass: string; // ej "px-5" o "px-2"
    dimDays: boolean;
  }) {
    // Constantes de layout (coinciden con Tailwind)
    const DAY_W = 48; // w-12
    const GAP = 20; // gap-5
    const UNDERLINE_W = 32; // w-8
    const UNDERLINE_BOTTOM = -15; // px hacia abajo del pill
    const MONTH_LABEL_TOP = -18; // px hacia arriba del círculo

    const todayIdx = days.findIndex((d) => isSameLocalDay(d, today));
    const hasToday = todayIdx !== -1;

    // padding-left en px según clase (px-5=20, px-2=8)
    const padLeft = pillPxClass === "px-5" ? 20 : pillPxClass === "px-2" ? 8 : 0;

    // centra la rayita bajo el círculo del día (ancho 32 dentro de 48)
    const underlineLeft =
      padLeft + todayIdx * (DAY_W + GAP) + (DAY_W - UNDERLINE_W) / 2;

    // días que son 1° de mes
    const firstOfMonth = days
      .map((d, idx) => ({ day: d, idx }))
      .filter(({ day }) => day.getDate() === 1);

    // pill real
    const pill = (
      <div
        className={[
          "flex items-center gap-5 rounded-full",
          pillPxClass,
          withPillBg ? pillBgClassName : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {days.map((day) => (
          <DayCircle key={day.toISOString()} day={day} kind={kind} dim={dimDays} />
        ))}
      </div>
    );

    return (
      <div className="relative">
        {pill}

        {/* Etiquetas de mes en overlay por encima del círculo */}
        {firstOfMonth.map(({ day, idx }) => {
          const centerLeft = padLeft + idx * (DAY_W + GAP) + DAY_W / 2;
          const monthLabel = day
            .toLocaleString("es-AR", { month: "short" })
            .toUpperCase();

          return (
            <div
              key={`month-${day.toISOString()}`}
              className="absolute text-[12px] font-medium text-gray-400 pointer-events-none bg-calendarweek px-3 rounded-t-md"
              style={{
                left: centerLeft,
                top: MONTH_LABEL_TOP,
                transform: "translateX(-50%)",
              }}
            >
              {monthLabel}
            </div>
          );
        })}

        {/* Rayita en overlay: NO afecta el layout, y queda POR DEBAJO del pill */}
        {hasToday && (
          <div
            className="absolute h-[7px] w-8 rounded-full bg-white/9 pointer-events-none"
            style={{
              left: underlineLeft,
              bottom: UNDERLINE_BOTTOM,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full mt-[10px]">
      <div
        ref={scrollRef}
        className="w-full h-28 bg-surface rounded-lg flex items-center overflow-x-auto overflow-y-hidden px-3 minimal-scrollbar"
      >
        <div className="flex items-center gap-2 min-w-max">
          {/* 7 días previos (sin background/pill) */}
          <DaysStrip
            days={paddingDays.prefix}
            kind="none"
            withPillBg={false}
            pillPxClass="px-2"
            dimDays
          />

          {/* semanas reales */}
          {weeks.map((week, weekIdx) => {
            const weekWorkouts = week.filter((day) =>
              workoutDays.some((wd) => isSameLocalDay(wd, day))
            ).length;

            const kind = getWeekKind(weekWorkouts);

            return (
              <DaysStrip
                key={weekIdx}
                days={week}
                kind={kind}
                withPillBg
                pillBgClassName={weekBgClass(kind)}
                pillPxClass="px-5"
                dimDays={false}
              />
            );
          })}

          {/* 7 días posteriores (sin background/pill) */}
          <DaysStrip
            days={paddingDays.suffix}
            kind="none"
            withPillBg={false}
            pillPxClass="px-2"
            dimDays
          />
        </div>
      </div>
    </div>
  );
}
