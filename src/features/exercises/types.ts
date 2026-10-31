/** Tipos compartidos del catálogo de ejercicios (contrato 00-roadmap §5.7). Sin dependencias de servidor. */

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "cardio", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barra",
  dumbbell: "Mancuernas",
  machine: "Máquina",
  cable: "Polea",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Banda elástica",
  cardio: "Cardio",
  other: "Otro",
};

export type MeasureType = "reps" | "duration";

/** Grupos musculares (`Muscle.groupKey`) en el orden en que se muestran. */
export const GROUP_KEYS = ["chest", "back", "legs", "shoulders", "arms", "core"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUP_LABEL: Record<string, string> = {
  chest: "Pecho",
  back: "Espalda",
  legs: "Piernas",
  shoulders: "Hombros",
  arms: "Brazos",
  core: "Core",
};

export type ExerciseSummary = {
  id: string;
  name: string;
  nameEn: string | null;
  measureType: MeasureType;
  equipment: Equipment;
  tracksWeight: boolean;
  primaryGroupKey: string | null;
  mediaUrl: string | null;
};

/** Ítem del catálogo en el cliente: el resumen + datos para buscar y filtrar. */
export type CatalogEntry = ExerciseSummary & {
  /** Alias normalizados (minúsculas, sin acentos), en español e inglés. */
  aliases: string[];
  /** `groupKey` de todos los músculos que trabaja (para filtrar). */
  groupKeys: string[];
  /** Lo creó el usuario actual. */
  isMine: boolean;
};

export type ExerciseDetail = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  instructions: string[];
  /** false = texto en borrador, todavía no revisado por un humano. */
  reviewed: boolean;
  mediaUrl: string | null;
  equipment: Equipment;
  primaryGroupKey: string | null;
  muscles: { name: string; groupKey: string; percentage: number }[];
};
