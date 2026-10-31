"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, Input, Select, Textarea, toastResult } from "@/src/components/ui";
import { COMMON_TIMEZONES } from "@/src/features/account/timezones";
import { createGroupAction, updateGroupAction } from "@/src/server/actions/groups";

export type GroupFormValues = { name: string; description: string | null; timezone: string; photoUrl: string | null };

function TimezoneSelect({ value, onChange, otherTimezones }: { value: string; onChange(v: string): void; otherTimezones: string[] }) {
  const known = COMMON_TIMEZONES.some((t) => t.value === value) || otherTimezones.includes(value);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value.replaceAll("_", " ")}</option>}
      {COMMON_TIMEZONES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      {otherTimezones.length > 0 && (
        <optgroup label="Otras">
          {otherTimezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}

/**
 * Formulario de grupo. `groupId` ausente = crear (y después ir al grupo); presente = editar.
 * La foto se maneja aparte (en configuración, con `PhotoUploader`): acá solo se reenvía `photoUrl`.
 */
export function GroupForm({
  groupId,
  initial,
  otherTimezones,
  photoUrl = initial.photoUrl,
}: {
  groupId?: string;
  initial: GroupFormValues;
  otherTimezones: string[];
  /** Foto vigente (la puede cambiar el uploader de afuera sin pasar por este formulario). */
  photoUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [timezone, setTimezone] = useState(initial.timezone);
  const err = (k: string) => errors[k]?.[0];
  const editing = !!groupId;
  const tzChanged = editing && timezone !== initial.timezone;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = { name, description: description.trim() || null, timezone, photoUrl };
      if (groupId) {
        const r = await updateGroupAction(groupId, payload);
        setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
        if (toastResult(r)) router.refresh();
      } else {
        const r = await createGroupAction(payload);
        setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
        if (toastResult(r)) router.push(`/group/${r.data.groupId}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nombre" htmlFor="group-name" error={err("name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Los Bravos del gym" autoComplete="off" />
      </Field>
      <Field label="Descripción" htmlFor="group-description" hint="Opcional." error={err("description")}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="¿Quiénes son? ¿Qué se juegan?" />
      </Field>
      <Field
        label="Zona horaria"
        htmlFor="group-timezone"
        hint={tzChanged ? "Al cambiarla se recalculan los puntos de las temporadas abiertas." : "Define qué día cae cada entrenamiento en las temporadas."}
        error={err("timezone")}
      >
        <TimezoneSelect value={timezone} onChange={setTimezone} otherTimezones={otherTimezones} />
      </Field>
      <Button type="submit" size="lg" fullWidth pending={pending}>
        {editing ? "Guardar cambios" : "Crear grupo"}
      </Button>
    </form>
  );
}
