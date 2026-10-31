-- Escenario v1 chico para probar la migración v2_core (scripts/migrate-v2-data.int.test.ts).
-- Escrito a mano contra el schema v1 (migraciones hasta 20261031050136_sync_schema_drift).

INSERT INTO `User` (`id`, `email`, `passwordHash`, `name`, `weeklyGoal`, `timezone`, `isActive`, `createdAt`) VALUES
  ('u1', 'ana@example.com', 'x', 'Ana', 3, NULL, true, '2026-09-01 12:00:00.000'),
  ('u2', 'beto@example.com', 'x', 'Beto', 3, 'America/Argentina/Buenos_Aires', true, '2026-09-01 12:00:00.000');

INSERT INTO `ActivityCategory` (`id`, `slug`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`) VALUES
  ('cat_strength', 'strength', 'Fuerza', 1, true, '2026-09-01 12:00:00.000', '2026-09-01 12:00:00.000'),
  ('cat_running', 'running', 'Running', 2, true, '2026-09-01 12:00:00.000', '2026-09-01 12:00:00.000');

INSERT INTO `Group` (`id`, `name`, `createdBy`, `createdAt`, `inviteCode`) VALUES
  ('g1', 'Los Bravos', 'u1', '2026-09-01 12:00:00.000', '123456');

INSERT INTO `GroupMember` (`id`, `groupId`, `userId`, `role`, `status`, `joinedAt`) VALUES
  ('gm1', 'g1', 'u1', 'admin', 'accepted', '2026-09-01 12:00:00.000'),
  ('gm2', 'g1', 'u2', 'member', 'accepted', '2026-09-01 12:00:00.000');

INSERT INTO `Season` (`id`, `groupId`, `name`, `startDate`, `endDate`, `createdBy`, `createdAt`, `isActive`, `weeklyGoal`,
  `basePointsPerActivity`, `weeklyStreakBonus`, `perfectWeekBonus`) VALUES
  ('s1', 'g1', 'Primavera', '2026-10-01 12:00:00.000', '2026-10-31 12:00:00.000', 'u1', '2026-09-30 12:00:00.000', true, 3, 10, 5, 15);

INSERT INTO `SeasonMember` (`id`, `seasonId`, `userId`, `joinedAt`) VALUES
  ('sm1', 's1', 'u1', '2026-09-30 12:00:00.000'),
  ('sm2', 's1', 'u2', '2026-09-30 12:00:00.000');

INSERT INTO `SeasonAllowedActivityType` (`id`, `seasonId`, `activityCategoryId`, `createdAt`) VALUES
  ('sa1', 's1', 'cat_strength', '2026-09-30 12:00:00.000');

INSERT INTO `Exercise` (`id`, `name`, `measureType`) VALUES
  ('ex1', 'Press de banca', 'reps'),
  ('ex2', 'Plancha abdominal', 'duration');

INSERT INTO `Routine` (`id`, `name`, `userId`, `createdAt`) VALUES
  ('r1', 'Pecho', 'u1', '2026-09-15 12:00:00.000');

INSERT INTO `RoutineExercise` (`id`, `routineId`, `exerciseId`, `sets`, `reps`, `durationSeconds`, `weightKg`) VALUES
  ('re1', 'r1', 'ex1', 4, 8, NULL, 50);

-- a1: fuerza con 1 ejercicio de 3x10x40. a2: running sin categoría ni duración (se derivan).
-- a3: borrada (isDeleted=1): no tiene que sobrevivir, ni sus series.
INSERT INTO `Activity` (`id`, `userId`, `routineId`, `type`, `activityCategoryId`, `startedAt`, `endedAt`, `durationMinutes`,
  `notes`, `isDeleted`, `deletedAt`, `createdAt`) VALUES
  ('a1', 'u1', 'r1', 'gym', 'cat_strength', '2026-10-05 21:00:00.000', '2026-10-05 22:10:00.000', 70, 'Buen día', false, NULL, '2026-10-05 22:10:00.000'),
  ('a2', 'u2', NULL, 'run', NULL, '2026-10-06 10:00:00.000', '2026-10-06 10:45:00.000', NULL, NULL, false, NULL, '2026-10-06 10:45:00.000'),
  ('a3', 'u1', NULL, 'gym', 'cat_strength', '2026-10-07 21:00:00.000', '2026-10-07 22:00:00.000', 60, NULL, true, '2026-10-08 12:00:00.000', '2026-10-07 22:00:00.000');

INSERT INTO `ActivityExercise` (`id`, `activityId`, `exerciseId`, `sets`, `reps`, `durationSeconds`, `weightKg`) VALUES
  ('ae1', 'a1', 'ex1', 3, 10, NULL, 40),
  ('ae3', 'a3', 'ex1', 2, 12, NULL, 30);

-- Datos de puntos/insignias v1: se descartan (se recalculan en v2).
INSERT INTO `ScoreEvent` (`id`, `seasonId`, `userId`, `activityId`, `type`, `points`, `createdAt`) VALUES
  ('se1', 's1', 'u1', 'a1', 'activity_base', 10, '2026-10-05 22:10:00.000');

INSERT INTO `AwardDefinition` (`id`, `code`, `name`, `scope`, `pointsBonus`, `isActive`, `createdAt`) VALUES
  ('ad1', 'gym_rat_1', 'Gym Rat I', 'profile', 0, true, '2026-09-01 12:00:00.000');

INSERT INTO `AwardEarned` (`id`, `awardId`, `userId`, `earnedAt`, `dedupeKey`) VALUES
  ('aw1', 'ad1', 'u1', '2026-10-05 22:10:00.000', 'gym_rat_1:u1');
