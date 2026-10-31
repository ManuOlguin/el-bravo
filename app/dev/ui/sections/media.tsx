"use client";
import { useState } from "react";
import { Avatar, Card, Field, Input, toastResult } from "@/src/components/ui";
import { PendingPhotoPicker, PhotoGrid, PhotoUploader, type GridPhoto } from "@/src/features/media";
import { deleteActivityMediaAction } from "@/src/server/actions/media";

// Fotos (W1-5). Necesita sesión iniciada y el bucket configurado (R2 o MinIO, ver docs/r2-setup.md).
export function MediaSection() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  const [activityId, setActivityId] = useState("");
  const [photos, setPhotos] = useState<GridPhoto[]>([]);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Fotos</h2>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name="Vos" src={avatar} size="xl" />
          <PhotoUploader target={{ kind: "avatar" }} onUploaded={(m) => setAvatar(m.url)} label="Cambiar foto de perfil" />
        </div>
        {avatar && <p className="break-all text-xs text-fg-subtle">{avatar}</p>}
      </Card>
      <Card className="space-y-2">
        <p className="text-sm text-fg-muted">Selector previo a crear la actividad (no sube nada).</p>
        <PendingPhotoPicker value={pending} onChange={setPending} />
      </Card>
      <Card className="space-y-3">
        <Field label="ID de una actividad tuya" htmlFor="dev-media-activity">
          <Input id="dev-media-activity" value={activityId} onChange={(e) => setActivityId(e.target.value.trim())} placeholder="cl…" />
        </Field>
        {activityId && (
          <PhotoUploader
            key={activityId}
            target={{ kind: "activity", activityId }}
            multiple
            max={Math.max(1, 4 - photos.length)}
            onUploaded={(m) => setPhotos((p) => [...p, m])}
          />
        )}
        <PhotoGrid
          photos={photos}
          onDelete={async (id) => {
            if (toastResult(await deleteActivityMediaAction(id), "Foto borrada")) {
              setPhotos((p) => p.filter((x) => x.id !== id));
            }
          }}
        />
      </Card>
    </section>
  );
}
