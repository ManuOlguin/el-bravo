// Registro de entrenamientos y rutinas tipo Strong (W2-1). API pública para pantallas y otros workstreams.
export {
  workoutReducer,
  newDraft,
  draftFromRoutine,
  draftFromActivity,
  toActivityInput,
  toRoutineInput,
  draftSummary,
  WorkoutDraftError,
} from "./state";
export type { WorkoutDraft, WorkoutAction, WorkoutMode, ExerciseDraft, SetDraft, SetKind } from "./state";
export { WorkoutEditor } from "./WorkoutEditor";
export type { PreviousLoader } from "./WorkoutEditor";
export { ExerciseBlock } from "./ExerciseBlock";
export { SetTable } from "./SetTable";
export { SetRow } from "./SetRow";
export { RestTimer } from "./RestTimer";
export type { RestTimerState } from "./RestTimer";
export { DeleteWorkoutButton } from "./DeleteWorkoutButton";
export { useDraftPersistence, draftKey, readDraft, writeDraft, clearDraft } from "./useDraftPersistence";
export { formatVolume, formatKg, formatSeconds, setText, setLabels } from "./format";
export { remaining, formatClock, adjustRest, restFor } from "./rest-timer";
