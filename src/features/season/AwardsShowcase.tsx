import Link from "next/link";
import { Avatar, Card, Pill, cn } from "@/src/components/ui";
import { SEASON_AWARD_INFO } from "@/src/server/scoring/awards";
import type { SeasonAwardView } from "./data";

const KG = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function formatAwardValue(award: Pick<SeasonAwardView, "awardType">, value: number) {
  const info = SEASON_AWARD_INFO[award.awardType];
  const n = Math.round(value * 10) / 10;
  if (info.format === "kg") return `${KG.format(Math.round(n))} kg`;
  if (info.format === "minutes") {
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  }
  return `${String(n).replace(".", ",")} ${n === 1 ? info.unit.replace(/s$/, "") : info.unit}`;
}

/** Tarjeta del premio: ícono, nombre, ganador(es), valor y bonus. `links={false}` en el reveal (va dentro de un botón). */
export function AwardCard({ award, viewerId, className, links = true }: { award: SeasonAwardView; viewerId: string; className?: string; links?: boolean }) {
  const info = SEASON_AWARD_INFO[award.awardType];
  const value = award.winners[0]?.value;
  return (
    <Card className={cn("flex items-start gap-3", award.winners.some((w) => w.userId === viewerId) && "border-gold/60 bg-gold/10", className)}>
      <span className="text-3xl" aria-hidden="true">
        {info.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold">{info.name}</p>
            <p className="text-xs text-fg-muted">{info.description}</p>
          </div>
          {award.bonusPoints > 0 && <Pill tone="primary">+{award.bonusPoints} pts</Pill>}
        </div>
        {award.winners.length === 0 ? (
          <p className="text-sm text-fg-subtle">Sin ganador</p>
        ) : (
          <ul className="space-y-1">
            {award.winners.map((w) => (
              <li key={w.userId} className="flex items-center gap-2">
                <Avatar name={w.name} src={w.photoUrl} size="sm" href={links ? `/u/${w.userId}` : undefined} />
                {links ? (
                  <Link href={`/u/${w.userId}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                    {w.userId === viewerId ? "Vos" : (w.name ?? "Usuario")}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{w.userId === viewerId ? "Vos" : (w.name ?? "Usuario")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {value !== undefined && <p className="text-sm font-semibold text-gold">{formatAwardValue(award, value)}</p>}
      </div>
    </Card>
  );
}

/** Premios de la temporada con sus ganadores (los empates ganan todos). */
export function AwardsShowcase({ awards, viewerId }: { awards: SeasonAwardView[]; viewerId: string }) {
  if (awards.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">Premios</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {awards.map((a) => (
          <li key={a.awardType}>
            <AwardCard award={a} viewerId={viewerId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
