// Lista corta del selector de zona horaria (el resto va en "Otra…").
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "UTC", label: "UTC" },
];

/** Todas las zonas IANA que conoce el runtime, sin las de la lista corta. */
export function otherTimezones(): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const common = new Set(COMMON_TIMEZONES.map((t) => t.value));
  // ICU lista "America/Buenos_Aires" (canónica): ya está cubierta por la opción de Argentina.
  common.add("America/Buenos_Aires");
  return all.filter((tz) => !common.has(tz));
}
