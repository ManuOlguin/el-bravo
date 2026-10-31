import type { Metadata } from "next";
import { Card, EmptyState, LinkButton, PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { previewInviteToken } from "@/src/server/groups/membership";
import { JoinByInviteButton } from "@/src/features/social/JoinByInviteButton";
import { JoinGroupForm } from "@/src/features/group/JoinGroupSheet";

export const metadata: Metadata = { title: "Unirme a un grupo" };

/**
 * Destino de las invitaciones:
 * - `?token=` invitación personal de un amigo (W1-4): muestra quién te invitó y a qué grupo.
 * - `?code=` link compartido desde "Invitar" (código del grupo, precargado).
 * - sin parámetros: formulario para pegar el código.
 * El GET nunca une a nadie: hay que confirmar con el botón.
 */
export default async function JoinGroupPage({ searchParams }: { searchParams: Promise<{ token?: string; code?: string }> }) {
  const user = await requirePageUser();
  const { token, code } = await searchParams;

  if (token) {
    const preview = await previewInviteToken(user.id, token);
    return (
      <div className="mx-auto max-w-screen-sm">
        <PageHeader title="Invitación" back="/groups" />
        {!preview.ok ? (
          <EmptyState title={preview.error} action={<LinkButton href="/groups">Ir a mis grupos</LinkButton>} />
        ) : preview.alreadyMember ? (
          <EmptyState
            icon={<span className="text-2xl">👋</span>}
            title={`Ya sos parte de ${preview.groupName}`}
            action={<LinkButton href={`/group/${preview.groupId}`}>Ir al grupo</LinkButton>}
          />
        ) : (
          <Card className="space-y-4 text-center">
            <p className="text-4xl" aria-hidden="true">
              🏋️
            </p>
            <p className="text-lg">
              <strong>{preview.inviterName ?? "Un amigo"}</strong> te invitó a <strong>{preview.groupName}</strong>.
            </p>
            <JoinByInviteButton token={token} groupName={preview.groupName} />
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader
        title="Unirme a un grupo"
        subtitle={code ? "Te pasaron una invitación. Confirmá para entrar." : "Ingresá el código que te pasó un admin."}
        back="/groups"
      />
      <Card>
        <JoinGroupForm initialCode={(code ?? "").slice(0, 16)} />
      </Card>
    </div>
  );
}
