/**
 * La columna `Exercise.instructions` (Json) guarda `{ steps: string[], reviewed: boolean }` (decisión W1-3:
 * `reviewed` viaja ahí para no cambiar el schema). También acepta el formato viejo `string[]`.
 */
export type StoredInstructions = { steps: string[]; reviewed: boolean };

export function parseInstructions(json: unknown): StoredInstructions {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : []);
  if (Array.isArray(json)) return { steps: strings(json), reviewed: false };
  if (json && typeof json === "object") {
    const o = json as { steps?: unknown; reviewed?: unknown };
    return { steps: strings(o.steps), reviewed: o.reviewed === true };
  }
  return { steps: [], reviewed: false };
}
