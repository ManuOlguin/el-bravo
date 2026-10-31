import { Card } from "@/src/components/ui";
import { PublishResultsButton } from "./SeasonAdminActions";

/**
 * La temporada terminó y los resultados todavía no se publicaron. Los miembros esperan; el admin ve
 * el botón "Publicar resultados" (si todavía no se cerró, la cierra y publica).
 */
export function ResultsPendingCard({
  seasonId,
  admins,
  isAdmin,
  finalized,
}: {
  seasonId: string;
  admins: { name: string | null }[];
  isAdmin: boolean;
  finalized: boolean;
}) {
  const adminName = admins.length === 1 ? (admins[0].name ?? "un admin") : "un admin";
  return (
    <Card className="space-y-3 border-gold/50 bg-gold/10 text-center">
      <p className="text-4xl" aria-hidden="true">
        🥁
      </p>
      {isAdmin ? (
        <>
          <p className="text-lg font-bold">La temporada terminó</p>
          <p className="text-sm text-fg-muted">
            Los miembros están esperando. Revisá la vista previa y publicá cuando quieras: se cierran los puntos, se entregan los
            premios y todos ven el podio.
          </p>
          <PublishResultsButton seasonId={seasonId} finalized={finalized} />
        </>
      ) : (
        <>
          <p className="text-lg font-bold">La temporada terminó</p>
          <p className="text-sm text-fg-muted">Esperando que {adminName} publique los resultados…</p>
        </>
      )}
    </Card>
  );
}
