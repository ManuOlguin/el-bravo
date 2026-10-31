import { dayPoints } from "@/src/server/scoring/compute";
import { SEASON_AWARD_INFO } from "@/src/server/scoring/awards";
import { formatDuration } from "@/src/lib/time";
import { formatWeight, weightExplanation } from "./format";
import { scoringRulesOf, type SeasonSummary } from "./types";

export const EXAMPLE_MINUTES = [30, 45, 60, 120, 180] as const;

/** Reglas de D1 en lenguaje simple, con los valores de ESTA temporada (pesos y premios incluidos). */
export function PointsRules({ season }: { season: Pick<SeasonSummary, "rules" | "categories" | "awards"> }) {
  const r = season.rules;
  const rules = scoringRulesOf(r);
  const counted = season.categories.filter((c) => c.weight > 0);
  const weighted = counted.some((c) => c.weight !== 1);
  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h3 className="font-bold">📅 Cada día que entrenás</h3>
        <p className="text-fg-muted">
          Un día suma si entrenaste al menos <strong className="text-fg">{r.minDailyMinutes} min</strong>. Te da{" "}
          <strong className="text-fg">{r.dayBasePoints} pts</strong> por presentarte, más puntos por el tiempo, que crecen cada vez más
          despacio. Varias actividades el mismo día se suman al tiempo del día (cuenta hasta {formatDuration(r.maxDailyMinutes)}).
        </p>
        <table className="w-full overflow-hidden rounded-xl text-left">
          <thead className="bg-surface-2 text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-1.5 font-semibold">Tu día</th>
              <th className="px-3 py-1.5 text-right font-semibold">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_MINUTES.map((m) => (
              <tr key={m} className="border-t border-border">
                <td className="px-3 py-1.5">{formatDuration(m)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{dayPoints(rules, m)} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-fg-subtle">
          Dos días de 30 min ({2 * dayPoints(rules, 30)} pts) valen más que uno de 3 h ({dayPoints(rules, 180)} pts): lo que manda es la constancia.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold">✅ Objetivo semanal</h3>
        <p className="text-fg-muted">
          <strong className="text-fg">+{r.weeklyGoalBonus} pts</strong> cada semana (lunes a domingo) en la que entrenás{" "}
          <strong className="text-fg">{r.weeklyGoal} días</strong> o más. Si la temporada empieza o termina a mitad de semana, el objetivo se
          achica a los días que entran.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="font-bold">🔥 Racha</h3>
        <p className="text-fg-muted">
          Cada semana cumplida seguida suma <strong className="text-fg">+{r.streakBonusStep} pts</strong> extra por semana de racha (hasta{" "}
          <strong className="text-fg">+{r.streakBonusCap}</strong>). La semana en curso no corta la racha hasta que termina.
        </p>
        {r.activeStreakBonusStep > 0 && (
          <p className="text-fg-muted">
            <strong className="text-fg">Racha activa</strong>, aparte y más chica: cada semana seguida en la que entrenás al menos 1 día suma{" "}
            <strong className="text-fg">+{r.activeStreakBonusStep} pts</strong> extra por semana (hasta{" "}
            <strong className="text-fg">+{r.activeStreakBonusCap}</strong>), aunque no llegues al objetivo.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">🏋️ Qué actividades cuentan</h3>
        {weighted && <p className="text-fg-muted">Algunas actividades valen más (o menos) tiempo:</p>}
        <ul className="divide-y divide-border rounded-xl bg-surface-2">
          {counted.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-fg-muted" title={weightExplanation(c.weight)}>
                {c.weight === 1 ? "normal" : weightExplanation(c.weight)}
              </span>
            </li>
          ))}
        </ul>
        {season.categories.length > counted.length && (
          <p className="text-xs text-fg-subtle">
            No suman: {season.categories.filter((c) => c.weight <= 0).map((c) => c.name).join(", ")}.
          </p>
        )}
      </section>

      {season.awards.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold">🏆 Premios al final</h3>
          <ul className="space-y-1.5">
            {season.awards.map((a) => {
              const info = SEASON_AWARD_INFO[a.awardType];
              return (
                <li key={a.awardType} className="flex items-start gap-2">
                  <span aria-hidden="true">{info.icon}</span>
                  <span className="min-w-0 flex-1">
                    <strong>{info.name}</strong> <span className="text-fg-muted">· {info.description}</span>
                  </span>
                  {a.bonusPoints > 0 && <span className="shrink-0 font-semibold text-primary">+{a.bonusPoints}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs text-fg-subtle">
        Ranking: puntos, después semanas cumplidas y después días entrenados. Los empates comparten puesto.
        {weighted ? ` Ejemplo de peso: ${formatWeight(1.5)} hace que 30 min cuenten como 45.` : ""}
      </p>
    </div>
  );
}
