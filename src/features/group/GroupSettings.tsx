"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, CardHeader, toastResult } from "@/src/components/ui";
import { PhotoUploader } from "@/src/features/media";
import { updateGroupAction } from "@/src/server/actions/groups";
import { GroupActionsMenu } from "./GroupActionsMenu";
import { GroupForm, type GroupFormValues } from "./GroupForm";

/** Configuración del grupo (solo admins): foto, datos, zona horaria y zona de peligro. */
export function GroupSettings({
  groupId,
  initial,
  otherTimezones,
  memberCount,
}: {
  groupId: string;
  initial: GroupFormValues;
  otherTimezones: string[];
  memberCount: number;
}) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [removing, startRemove] = useTransition();

  function removePhoto() {
    startRemove(async () => {
      // Se guarda con los datos ya guardados: lo que se esté editando abajo no se pisa (queda en el formulario).
      const r = await updateGroupAction(groupId, { ...initial, photoUrl: null });
      if (toastResult(r, "Sacamos la foto.")) {
        setPhotoUrl(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Foto del grupo" />
        <div className="flex items-center gap-4">
          <Avatar name={initial.name} src={photoUrl} size="xl" className="rounded-2xl" />
          <div className="flex flex-col gap-2">
            <PhotoUploader
              target={{ kind: "group", groupId }}
              label={photoUrl ? "Cambiar foto" : "Subir foto"}
              onUploaded={(m) => {
                setPhotoUrl(m.url);
                router.refresh();
              }}
            />
            {photoUrl && (
              <Button variant="ghost" size="sm" pending={removing} onClick={removePhoto}>
                Quitar foto
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Datos del grupo" />
        <GroupForm groupId={groupId} initial={initial} otherTimezones={otherTimezones} photoUrl={photoUrl} />
      </Card>

      <Card className="border-danger/40">
        <CardHeader title="Zona de peligro" subtitle="Borrar el grupo elimina sus temporadas y rankings para todos." />
        <GroupActionsMenu groupId={groupId} groupName={initial.name} isAdmin memberCount={memberCount} />
      </Card>
    </div>
  );
}
