import type { Metadata } from "next";
import { Card, EmptyState, LinkButton, PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { previewInviteToken } from "@/src/server/groups/membership";
import { JoinByInviteButton } from "@/src/features/social/JoinByInviteButton";

export const metadata: Metadata = { title: "Invitación a un grupo" };

// Destino del `href` de las invitaciones personales (W1-4). W2-2 puede rediseñarla.
// El GET no une a nadie: hay que confirmar con el botón.
export default async function JoinByInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const user = await requirePageUser();
  const { token } = await searchParams;
  const preview = token ? await previewInviteToken(user.id, token) : ({ ok: false, error: "Falta la invitación." } as const);

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Invitación" back="/home" />
      {!preview.ok ? (
        <EmptyState title={preview.error} action={<LinkButton href="/home">Ir al inicio</LinkButton>} />
      ) : preview.alreadyMember ? (
        <EmptyState
          title={`Ya sos parte de ${preview.groupName}`}
          action={<LinkButton href={`/group/${preview.groupId}`}>Ir al grupo</LinkButton>}
        />
      ) : (
        <Card className="space-y-4 text-center">
          <p className="text-lg">
            <strong>{preview.inviterName ?? "Un amigo"}</strong> te invitó a <strong>{preview.groupName}</strong>.
          </p>
          <JoinByInviteButton token={token!} groupName={preview.groupName} />
        </Card>
      )}
    </div>
  );
}
