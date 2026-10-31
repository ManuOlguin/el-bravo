// API pública del catálogo de ejercicios (contrato 00-roadmap §5.7).
export { ExercisePicker } from "./ExercisePicker";
export type { ExercisePickerProps } from "./ExercisePicker";
export { ExerciseInfoButton } from "./ExerciseInfoButton";
export { CreateExerciseSheet } from "./CreateExerciseSheet";
export { MuscleShareEditor } from "./MuscleShareEditor";
export type { MuscleShare } from "./MuscleShareEditor";
export { ExerciseRow } from "./ExerciseRow";
export { ExerciseThumb, GroupIcon } from "./ExerciseThumb";
export { useExerciseCatalog, upsertCatalogEntry } from "./useExerciseCatalog";
export { searchExercises, normalize } from "./search";
export { recent } from "./recent";
export { EQUIPMENT, EQUIPMENT_LABEL, GROUP_KEYS, GROUP_LABEL } from "./types";
export type { CatalogEntry, CatalogMuscle, Equipment, ExerciseDetail, ExerciseSummary, MeasureType } from "./types";
