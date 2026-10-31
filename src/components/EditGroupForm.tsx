"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, Input, LinkButton, Select, Textarea, toastResult } from "@/src/components/ui";
import { COMMON_TIMEZONES } from "@/src/features/account/timezones";
import { updateGroupAction } from "@/src/server/actions/groups";

type EditableGroup = { id: string; name: string; description: string | null; photoUrl: string | null; timezone: string };

export default function EditGroupForm({ group }: { group: EditableGroup }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(group.photoUrl ?? "");
  const [timezone, setTimezone] = useState(group.timezone);
  const tzOptions = COMMON_TIMEZONES.some((t) => t.value === timezone)
    ? COMMON_TIMEZONES
    : [...COMMON_TIMEZONES, { value: timezone, label: timezone.replaceAll("_", " ") }];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateGroupAction(group.id, { name, description: description || null, photoUrl: photoUrl || null, timezone });
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (toastResult(r)) {
        router.push(`/group/${group.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nombre" htmlFor="group-name" error={errors.name?.[0]}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Field label="Descripción" htmlFor="group-description" hint="Opcional." error={errors.description?.[0]}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </Field>
      {/* TODO(W1-5): reemplazar por PhotoUploader target={{ kind: "group", groupId }} */}
      <Field label="Foto (URL)" htmlFor="group-photo" error={errors.photoUrl?.[0]}>
        <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} inputMode="url" placeholder="https://…" />
      </Field>
      <Field label="Zona horaria" htmlFor="group-timezone" hint="Define los días y semanas de las temporadas." error={errors.timezone?.[0]}>
        <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {tzOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" pending={pending}>
          Guardar
        </Button>
        <LinkButton href={`/group/${group.id}`} variant="ghost">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
