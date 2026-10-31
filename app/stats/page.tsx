import type { Metadata } from "next";
import { Card, EmptyState, LinkButton, PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { getUserStats, isStatsRange, type StatsRange } from "@/src/server/stats";
import { LOG_WORKOUT_HREF } from "@/src/features/home/QuickStart";
import { CategoryBreakdown } from "@/src/features/stats/CategoryBreakdown";
import { DaypartBreakdown } from "@/src/features/stats/DaypartBreakdown";
import { GoalDots } from "@/src/features/stats/GoalDots";
import { MuscleGroupMinutes, TopMuscleMinutes } from "@/src/features/stats/MuscleMinutes";
import { PersonalRecords } from "@/src/features/stats/PersonalRecords";
import { RangeTabs } from "@/src/features/stats/RangeTabs";
import { StatsSummary } from "@/src/features/stats/StatsSummary";
import { StreakCards } from "@/src/features/stats/StreakCards";
import { WeekdayBars } from "@/src/features/stats/WeekdayBars";
import { WeeklyBarChart } from "@/src/features/stats/WeeklyBarChart";

export const metadata: Metadata = { title: "Stats" };

const RANGE_LABEL: Record<StatsRange, string> = { "4w": "últimas 4 semanas", "12w": "últimas 12 semanas", all: "desde que empezaste" };

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="p-0">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-base font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-fg-subtle">{subtitle}</p>}
      </header>
      <div className="p-4">{children}</div>
    </Card>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requirePageUser();
  const { range: raw } = await searchParams;
  const range: StatsRange = isStatsRange(raw) ? raw : "12w";
  const stats = await getUserStats(user.id, { range });

  if (stats.totals.workouts === 0) {
    return (
      <div className="mx-auto max-w-screen-sm">
        <PageHeader title="Stats" />
        <EmptyState
          icon={<span className="text-xl">📊</span>}
          title="Registrá entrenamientos para ver tus stats"
          description="Acá vas a ver tus rachas, tu objetivo semanal, cuándo entrenás, tus récords y qué músculos trabajás."
          action={<LinkButton href={LOG_WORKOUT_HREF}>Registrar entrenamiento</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm space-y-4">
      <PageHeader title="Stats" subtitle="Tus números, en tu zona horaria." />

      <StreakCards stats={stats} />

      <StatsSummary stats={stats} />

      <RangeTabs value={range} />

      <Section title="Objetivo semanal" subtitle={`Un punto por cada entrenamiento de tu objetivo, ${RANGE_LABEL[range]}`}>
        <GoalDots weeks={stats.goalProgress} />
      </Section>

      <Section title="Por semana" subtitle={RANGE_LABEL[range]}>
        <WeeklyBarChart weeks={stats.weekly} goal={stats.thisWeek.goal} />
      </Section>

      <Section title="Minutos por día de la semana" subtitle={RANGE_LABEL[range]}>
        <WeekdayBars days={stats.byWeekdayInRange} />
      </Section>

      <Section title="Minutos por horario" subtitle={`Según la hora de inicio, ${RANGE_LABEL[range]}`}>
        <DaypartBreakdown dayparts={stats.byDaypart} />
      </Section>

      <Section title="Por categoría" subtitle={`Minutos, ${RANGE_LABEL[range]}`}>
        <CategoryBreakdown categories={stats.byCategory} />
      </Section>

      <Section title="Minutos por grupo muscular" subtitle={`El tiempo de cada entrenamiento repartido entre sus ejercicios, ${RANGE_LABEL[range]}`}>
        <MuscleGroupMinutes data={stats.muscleMinutes} />
      </Section>

      <Section title="Minutos por músculo" subtitle={RANGE_LABEL[range]}>
        <TopMuscleMinutes data={stats.muscleMinutes} />
      </Section>

      <Section title="Récords personales" subtitle="Tu mejor peso por ejercicio">
        <PersonalRecords records={stats.personalRecords} />
      </Section>
    </div>
  );
}
