import { Card, StatCard } from "@/src/components/ui";
import { WEEKDAY_NAMES, weekLabel } from "./format";
import type { MyNumbers, SeasonStats as Stats } from "./data";

function hours(minutes: number) {
  const h = minutes / 60;
  return h >= 10 ? String(Math.round(h)) : String(Math.round(h * 10) / 10).replace(".", ",");
}

/** Stats de la temporada del grupo. */
export function SeasonStats({ stats }: { stats: Stats }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">La temporada en números</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard label="Días entrenados" value={stats.daysTrained} hint={`entre ${stats.participants} ${stats.participants === 1 ? "persona" : "personas"}`} />
        <StatCard label="Entrenamientos" value={stats.activities} />
        <StatCard label="Horas" value={hours(stats.minutes)} hint="entrenadas en total" />
        <StatCard label="La más popular" value={<span className="text-xl">{stats.topCategory?.name ?? "—"}</span>} hint={stats.topCategory ? `${stats.topCategory.count} entrenamientos` : undefined} />
        <StatCard
          label="Día más activo"
          value={<span className="text-xl capitalize">{stats.topWeekday ? WEEKDAY_NAMES[stats.topWeekday.index] : "—"}</span>}
          hint={stats.topWeekday ? `${stats.topWeekday.days} días entrenados` : undefined}
        />
        <StatCard
          label="Mejor semana"
          value={<span className="text-xl">{stats.bestWeek ? stats.bestWeek.days : "—"}</span>}
          hint={stats.bestWeek ? `días entrenados la ${weekLabel(stats.bestWeek.weekKey)}` : undefined}
        />
      </div>
    </section>
  );
}

/** "Tus números": puesto, puntos, mejor racha y comparación con el promedio del grupo. */
export function MyNumbersCard({ me, participants }: { me: MyNumbers; participants: number }) {
  const diff = me.points - me.averagePoints;
  return (
    <Card className="space-y-3 border-primary/40">
      <h2 className="text-lg font-bold">Tus números</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-extrabold tabular-nums">{me.rank}°</p>
          <p className="text-xs text-fg-muted">de {participants}</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold tabular-nums text-primary">{me.points}</p>
          <p className="text-xs text-fg-muted">puntos</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold tabular-nums">{me.bestStreak}🔥</p>
          <p className="text-xs text-fg-muted">mejor racha</p>
        </div>
      </div>
      <p className="text-sm text-fg-muted">
        {diff > 0
          ? `Sacaste ${diff} pts más que el promedio del grupo (${me.averagePoints}). 💪`
          : diff < 0
            ? `Quedaste ${-diff} pts debajo del promedio del grupo (${me.averagePoints}). La próxima se viene.`
            : `Justo en el promedio del grupo (${me.averagePoints} pts).`}{" "}
        Entrenaste {me.daysTrained} {me.daysTrained === 1 ? "día" : "días"}.
      </p>
    </Card>
  );
}
