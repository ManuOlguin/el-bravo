import type { Metadata } from "next";
import { Card, EmptyState, LinkButton, PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { getUserStats, isStatsRange, type StatsRange } from "@/src/server/stats";
import { LOG_WORKOUT_HREF } from "@/src/features/home/QuickStart";
import { CategoryBreakdown } from "@/src/features/stats/CategoryBreakdown";
import { MuscleBalance } from "@/src/features/stats/MuscleBalance";
import { PersonalRecords } from "@/src/features/stats/PersonalRecords";
import { RangeTabs } from "@/src/features/stats/RangeTabs";
import { StatsSummary } from "@/src/features/stats/StatsSummary";
import { WeekdayHeatmap } from "@/src/features/stats/WeekdayHeatmap";
import { WeeklyBarChart } from "@/src/features/stats/WeeklyBarChart";

export const metadata: Metadata = { title: "Stats" };

const RANGE_LABEL: Record<StatsRange, string> = { "4w": "últimas 4 semanas", "12w": "últimas 12 semanas", all: "desde que empezaste" };

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="space-y-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-fg-subtle">{subtitle}</p>}
      </div>
      {children}
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
          description="Acá vas a ver tus semanas, tus categorías, tus récords y qué músculos trabajás."
          action={<LinkButton href={LOG_WORKOUT_HREF}>Registrar entrenamiento</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm space-y-4">
      <PageHeader title="Stats" subtitle="Tus números, en tu zona horaria." />

      <StatsSummary stats={stats} />

      <RangeTabs value={range} />

      <Section title="Entrenamientos por semana" subtitle={RANGE_LABEL[range]}>
        <WeeklyBarChart weeks={stats.weekly} goal={stats.thisWeek.goal} />
      </Section>

      <Section title="Por categoría" subtitle={`Minutos, ${RANGE_LABEL[range]}`}>
        <CategoryBreakdown categories={stats.byCategory} />
      </Section>

      <Section title="Días de la semana" subtitle="Cuántas veces entrenaste cada día, desde que empezaste">
        <WeekdayHeatmap byWeekday={stats.byWeekday} />
      </Section>

      <Section title="Balance muscular" subtitle="Series completadas por grupo, desde que empezaste">
        <MuscleBalance groups={stats.byMuscleGroup} />
      </Section>

      <Section title="Récords personales" subtitle="Tu mejor peso por ejercicio">
        <PersonalRecords records={stats.personalRecords} />
      </Section>
    </div>
  );
}
