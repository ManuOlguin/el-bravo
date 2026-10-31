"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, Button, Field, Input, NumberInput, Select, Textarea, toastResult } from "@/src/components/ui";
import { updateProfileAction } from "@/src/server/actions/account";
import { COMMON_TIMEZONES } from "./timezones";

const OTHER = "__other__";

export type EditProfileValues = {
  name: string | null;
  email: string;
  bio: string | null;
  photoUrl: string | null;
  weeklyGoal: number;
  timezone: string;
};

export function EditProfileForm({ initial, otherTimezones }: { initial: EditProfileValues; otherTimezones: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [name, setName] = useState(initial.name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? "");
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(initial.weeklyGoal);
  const [timezone, setTimezone] = useState(initial.timezone);
  const isCommon = COMMON_TIMEZONES.some((t) => t.value === timezone);
  const [showOther, setShowOther] = useState(!isCommon);

  const err = (k: string) => errors[k]?.[0];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfileAction({
        name,
        bio: bio || null,
        weeklyGoal: weeklyGoal ?? 0,
        timezone,
        photoUrl: photoUrl || null,
      });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      if (toastResult(result, "Perfil actualizado.")) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={photoUrl || null} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{name || "Tu nombre"}</p>
          <p className="truncate text-sm text-fg-muted">{initial.email}</p>
        </div>
      </div>

      <Field label="Nombre" htmlFor="name" error={err("name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
      </Field>

      <Field label="Bio" htmlFor="bio" hint="Opcional. Hasta 280 caracteres." error={err("bio")}>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder="Contá algo sobre vos" />
      </Field>

      {/* TODO(W1-5): reemplazar por PhotoUploader target={{ kind: "avatar" }} */}
      <Field label="Foto (URL)" htmlFor="photoUrl" hint="Pegá el link a una imagen." error={err("photoUrl")}>
        <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} inputMode="url" placeholder="https://…" />
      </Field>

      <Field
        label="Objetivo semanal"
        htmlFor="weeklyGoal"
        hint="Días por semana que querés entrenar (1 a 7)."
        error={err("weeklyGoal")}
      >
        <NumberInput value={weeklyGoal} onChange={setWeeklyGoal} min={1} max={7} step={1} suffix="días" />
      </Field>

      <Field label="Zona horaria" htmlFor="timezone" error={err("timezone")}>
        <Select
          value={showOther ? OTHER : timezone}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setShowOther(true);
            } else {
              setShowOther(false);
              setTimezone(e.target.value);
            }
          }}
        >
          {COMMON_TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value={OTHER}>Otra…</option>
        </Select>
      </Field>
      {showOther && (
        <Field label="Otra zona horaria" htmlFor="timezone-other">
          <Select value={isCommon ? "" : timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="" disabled>
              Elegí una zona
            </option>
            {otherTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <p className="text-xs text-fg-subtle">El email no se puede cambiar por ahora.</p>

      <Button type="submit" size="lg" fullWidth pending={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
