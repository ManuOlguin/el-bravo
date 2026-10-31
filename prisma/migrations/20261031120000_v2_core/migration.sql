-- El Bravo v2 core: todo el modelo de datos de v2 en una sola migración.
-- Orden obligatorio: AGREGAR → COPIAR → AJUSTAR → BORRAR, para no perder datos de v1.
-- Siempre con los nombres de tabla exactos de Prisma (PascalCase): funciona con
-- lower_case_table_names=1 (local) y con 0 (MySQL en Linux, que distingue mayúsculas).
-- Los puntos y las insignias NO se migran: se recalculan (scripts/migrate-v2-data.ts).

-- ============================================================================
-- 1) AGREGAR
-- ============================================================================

-- FKs que cambian de comportamiento (se recrean en el paso 3).
ALTER TABLE `Activity` DROP FOREIGN KEY `Activity_activityCategoryId_fkey`;
ALTER TABLE `RoutineExercise` DROP FOREIGN KEY `RoutineExercise_exerciseId_fkey`;
ALTER TABLE `ActivityExercise` DROP FOREIGN KEY `ActivityExercise_exerciseId_fkey`;

-- Columnas nuevas: NULL-ables o con default. Las obligatorias se ajustan en el paso 3.
ALTER TABLE `User` ADD COLUMN `bio` VARCHAR(280) NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `Group` ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

ALTER TABLE `Season` ADD COLUMN `dayBasePoints` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `finalizedAt` DATETIME(3) NULL,
    ADD COLUMN `lastComputedAt` DATETIME(3) NULL,
    ADD COLUMN `maxDailyMinutes` INTEGER NOT NULL DEFAULT 240,
    ADD COLUMN `minDailyMinutes` INTEGER NOT NULL DEFAULT 20,
    ADD COLUMN `resultsPublishedAt` DATETIME(3) NULL,
    ADD COLUMN `resultsReveal` ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
    ADD COLUMN `streakBonusCap` INTEGER NOT NULL DEFAULT 25,
    ADD COLUMN `streakBonusStep` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `timeCurveMinutes` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `timePointsFactor` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `updatedAt` DATETIME(3) NULL,
    ADD COLUMN `weeklyGoalBonus` INTEGER NOT NULL DEFAULT 20;

ALTER TABLE `Exercise` ADD COLUMN `createdByUserId` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `equipment` ENUM('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'cardio', 'other') NOT NULL DEFAULT 'other',
    ADD COLUMN `instructions` JSON NULL,
    ADD COLUMN `mediaUrl` VARCHAR(2048) NULL,
    ADD COLUMN `nameEn` VARCHAR(100) NULL,
    ADD COLUMN `slug` VARCHAR(80) NULL,
    ADD COLUMN `tracksWeight` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Activity` ADD COLUMN `clientRequestId` VARCHAR(64) NULL;

ALTER TABLE `ActivityMedia` ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('pending', 'ready') NOT NULL DEFAULT 'ready',
    ADD COLUMN `thumbUrl` VARCHAR(2048) NULL;

ALTER TABLE `Routine` ADD COLUMN `notes` TEXT NULL;

ALTER TABLE `RoutineExercise` ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `position` INTEGER NULL,
    ADD COLUMN `restSeconds` INTEGER NULL;

ALTER TABLE `ActivityExercise` ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `position` INTEGER NULL;

ALTER TABLE `ActivityCategory` ADD COLUMN `usesExercises` BOOLEAN NOT NULL DEFAULT false;

-- Tablas nuevas.
-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `platform` ENUM('web', 'android', 'ios') NOT NULL,
    `pushEndpointHash` VARCHAR(64) NULL,
    `pushSubscription` JSON NULL,
    `fcmToken` VARCHAR(255) NULL,
    `widgetTokenHash` VARCHAR(64) NULL,
    `label` VARCHAR(80) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Device_pushEndpointHash_key`(`pushEndpointHash`),
    UNIQUE INDEX `Device_fcmToken_key`(`fcmToken`),
    UNIQUE INDEX `Device_widgetTokenHash_key`(`widgetTokenHash`),
    INDEX `Device_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Follow` (
    `followerId` VARCHAR(191) NOT NULL,
    `followingId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Follow_followingId_idx`(`followingId`),
    PRIMARY KEY (`followerId`, `followingId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonCategory` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `activityCategoryId` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(3, 2) NOT NULL DEFAULT 1.00,

    INDEX `SeasonCategory_activityCategoryId_idx`(`activityCategoryId`),
    UNIQUE INDEX `SeasonCategory_seasonId_activityCategoryId_key`(`seasonId`, `activityCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonAward` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `awardType` VARCHAR(48) NOT NULL,
    `bonusPoints` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `SeasonAward_seasonId_awardType_key`(`seasonId`, `awardType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonAwardWinner` (
    `id` VARCHAR(191) NOT NULL,
    `seasonAwardId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,

    INDEX `SeasonAwardWinner_userId_idx`(`userId`),
    UNIQUE INDEX `SeasonAwardWinner_seasonAwardId_userId_key`(`seasonAwardId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoreEntry` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NULL,
    `kind` ENUM('workout', 'weekly_goal', 'streak', 'award', 'adjustment') NOT NULL,
    `weekKey` CHAR(10) NULL,
    `points` INTEGER NOT NULL,
    `reason` VARCHAR(160) NULL,
    `detail` JSON NULL,

    INDEX `ScoreEntry_seasonId_userId_idx`(`seasonId`, `userId`),
    INDEX `ScoreEntry_activityId_idx`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonStanding` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `daysTrained` INTEGER NOT NULL,
    `activities` INTEGER NOT NULL,
    `minutes` INTEGER NOT NULL,
    `weeksGoalMet` INTEGER NOT NULL,
    `currentStreak` INTEGER NOT NULL,
    `bestStreak` INTEGER NOT NULL,

    INDEX `SeasonStanding_seasonId_rank_idx`(`seasonId`, `rank`),
    UNIQUE INDEX `SeasonStanding_seasonId_userId_key`(`seasonId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseAlias` (
    `id` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(100) NOT NULL,
    `locale` VARCHAR(8) NOT NULL DEFAULT 'es',

    INDEX `ExerciseAlias_alias_idx`(`alias`),
    UNIQUE INDEX `ExerciseAlias_exerciseId_alias_key`(`exerciseId`, `alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutineSet` (
    `id` VARCHAR(191) NOT NULL,
    `routineExerciseId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `kind` ENUM('warmup', 'normal', 'drop', 'failure') NOT NULL DEFAULT 'normal',
    `targetReps` INTEGER NULL,
    `targetDurationSeconds` INTEGER NULL,
    `targetWeightKg` DOUBLE NULL,
    `restSeconds` INTEGER NULL,

    UNIQUE INDEX `RoutineSet_routineExerciseId_position_key`(`routineExerciseId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reaction` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Reaction_activityId_idx`(`activityId`),
    UNIQUE INDEX `Reaction_activityId_userId_emoji_key`(`activityId`, `userId`, `emoji`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivitySet` (
    `id` VARCHAR(191) NOT NULL,
    `activityExerciseId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `kind` ENUM('warmup', 'normal', 'drop', 'failure') NOT NULL DEFAULT 'normal',
    `reps` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `weightKg` DOUBLE NULL,
    `restSeconds` INTEGER NULL,
    `completed` BOOLEAN NOT NULL DEFAULT true,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ActivitySet_activityExerciseId_position_key`(`activityExerciseId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,
    `metric` VARCHAR(48) NOT NULL,
    `params` JSON NULL,
    `iconKey` VARCHAR(64) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Badge_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BadgeLevel` (
    `id` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `threshold` INTEGER NOT NULL,

    UNIQUE INDEX `BadgeLevel_badgeId_level_key`(`badgeId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBadge` (
    `userId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `achievedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `badgeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `type` ENUM('first_workout_of_week', 'weekly_goal_met', 'streak_milestone', 'badge_level_up', 'rank_overtaken', 'season_started', 'season_results_published', 'new_follower', 'member_joined', 'weekly_digest', 'friend_workout', 'reaction_received') NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `seasonId` VARCHAR(191) NULL,
    `activityId` VARCHAR(191) NULL,
    `data` JSON NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `emailedAt` DATETIME(3) NULL,
    `pushedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_dedupeKey_key`(`dedupeKey`),
    INDEX `Notification_recipientId_readAt_createdAt_idx`(`recipientId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('first_workout_of_week', 'weekly_goal_met', 'streak_milestone', 'badge_level_up', 'rank_overtaken', 'season_started', 'season_results_published', 'new_follower', 'member_joined', 'weekly_digest', 'friend_workout', 'reaction_received') NOT NULL,
    `inApp` BOOLEAN NOT NULL DEFAULT true,
    `email` BOOLEAN NOT NULL DEFAULT false,
    `push` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`userId`, `type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ============================================================================
-- 2) COPIAR
-- ============================================================================

-- Categorías que usan el formulario de ejercicios.
UPDATE `ActivityCategory` SET `usesExercises` = true
WHERE `slug` IN ('strength', 'calisthenics', 'crossfit', 'hiit_functional');

-- Si hay actividades sin categoría y faltan las categorías del mapeo legacy (DB sin sembrar),
-- se crean acá. El seed después las actualiza por slug.
INSERT INTO `ActivityCategory` (`id`, `slug`, `name`, `sortOrder`, `isActive`, `usesExercises`, `createdAt`, `updatedAt`)
SELECT CONCAT('mig', SUBSTRING(MD5(m.slug), 1, 22)), m.slug, m.name, m.sortOrder, true, m.usesExercises, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'strength' AS slug, 'Fuerza' AS name, 1 AS sortOrder, true AS usesExercises
  UNION ALL SELECT 'running', 'Running', 2, false
  UNION ALL SELECT 'yoga_pilates', 'Yoga / Pilates', 8, false
  UNION ALL SELECT 'hiit_functional', 'HIIT / Funcional', 9, true
) m
-- COLLATE explícito: los literales toman la collation de la conexión (en TiDB, utf8mb4_general_ci) y
-- compararlos con una columna utf8mb4_unicode_ci da "Illegal mix of collations".
WHERE NOT EXISTS (SELECT 1 FROM `ActivityCategory` c WHERE c.`slug` = m.slug COLLATE utf8mb4_unicode_ci)
  AND EXISTS (SELECT 1 FROM `Activity` a WHERE a.`activityCategoryId` IS NULL);

-- Actividades: categoría obligatoria. Si falta, se mapea el tipo legacy a una categoría.
UPDATE `Activity` a
LEFT JOIN `ActivityCategory` c ON c.`slug` = CASE a.`type`
  WHEN 'gym' THEN 'strength' WHEN 'run' THEN 'running' WHEN 'mobility' THEN 'yoga_pilates'
  WHEN 'sport' THEN 'hiit_functional' ELSE 'strength' END
SET a.`activityCategoryId` = COALESCE(a.`activityCategoryId`, c.`id`)
WHERE a.`activityCategoryId` IS NULL;

-- durationMinutes obligatorio: derivar de endedAt si falta.
UPDATE `Activity` SET `durationMinutes` = GREATEST(1, TIMESTAMPDIFF(MINUTE, `startedAt`, `endedAt`))
WHERE `durationMinutes` IS NULL OR `durationMinutes` <= 0;

-- Borrado duro (D7): eliminar lo que estaba marcado como borrado.
-- Los hijos caen por cascade (ejercicios, medios, ActivitySeason) o quedan en NULL (ScoreEvent, AwardEarned).
DELETE FROM `Activity` WHERE `isDeleted` = true;

-- Posiciones de los ejercicios dentro de cada actividad/rutina (orden de carga = id).
UPDATE `ActivityExercise` ae JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `activityId` ORDER BY `id`) - 1 AS pos FROM `ActivityExercise`
) x ON x.`id` = ae.`id` SET ae.`position` = x.pos;

UPDATE `RoutineExercise` re JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `routineId` ORDER BY `id`) - 1 AS pos FROM `RoutineExercise`
) x ON x.`id` = re.`id` SET re.`position` = x.pos;

-- Series: una fila ActivitySet por cada "set" del formato viejo (máx. 20).
INSERT INTO `ActivitySet` (`id`, `activityExerciseId`, `position`, `kind`, `reps`, `durationSeconds`, `weightKg`, `completed`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(ae.`id`, '-', n.n)), 1, 22)), ae.`id`, n.n, 'normal', ae.`reps`, ae.`durationSeconds`, ae.`weightKg`, true
FROM `ActivityExercise` ae
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
      UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
      UNION ALL SELECT 18 UNION ALL SELECT 19) n ON n.n < LEAST(GREATEST(ae.`sets`, 1), 20);

-- Igual para rutinas.
INSERT INTO `RoutineSet` (`id`, `routineExerciseId`, `position`, `kind`, `targetReps`, `targetDurationSeconds`, `targetWeightKg`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(re.`id`, '-', n.n)), 1, 22)), re.`id`, n.n, 'normal', re.`reps`, re.`durationSeconds`, re.`weightKg`
FROM `RoutineExercise` re
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
      UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17
      UNION ALL SELECT 18 UNION ALL SELECT 19) n ON n.n < LEAST(GREATEST(re.`sets`, 1), 20);

-- Categorías habilitadas por temporada: SeasonAllowedActivityType → SeasonCategory (peso 1).
INSERT INTO `SeasonCategory` (`id`, `seasonId`, `activityCategoryId`, `weight`)
SELECT s.`id`, s.`seasonId`, s.`activityCategoryId`, 1.00 FROM `SeasonAllowedActivityType` s;

-- Temporadas sin categorías: habilitar todas (comportamiento v1 = todo cuenta).
INSERT INTO `SeasonCategory` (`id`, `seasonId`, `activityCategoryId`, `weight`)
SELECT CONCAT('mig', SUBSTRING(MD5(CONCAT(se.`id`, '-', c.`id`)), 1, 22)), se.`id`, c.`id`, 1.00
FROM `Season` se CROSS JOIN `ActivityCategory` c
WHERE NOT EXISTS (SELECT 1 FROM `SeasonAllowedActivityType` sa WHERE sa.`seasonId` = se.`id`);

-- Temporadas finalizadas en v1 → finalizedAt y resultados publicados.
UPDATE `Season` SET `finalizedAt` = `endedAt`, `resultsPublishedAt` = `endedAt` WHERE `endedAt` IS NOT NULL;

-- Fechas de temporada: v1 las guardaba como DATETIME (mediodía UTC). Se normalizan a medianoche
-- antes de pasar a DATE (MySQL redondea las fracciones de segundo y podría correr el día).
UPDATE `Season` SET `startDate` = DATE(`startDate`), `endDate` = DATE(`endDate`);

-- Usuarios sin timezone → default.
UPDATE `User` SET `timezone` = 'America/Argentina/Buenos_Aires' WHERE `timezone` IS NULL OR `timezone` = '';

-- Slug obligatorio y único: valor temporal; scripts/migrate-v2-data.ts (y el seed) lo reemplazan.
UPDATE `Exercise` SET `slug` = CONCAT('tmp-', `id`) WHERE `slug` IS NULL;

-- Nombres más cortos en v2: recortar lo que exceda (modo estricto).
UPDATE `User` SET `name` = LEFT(`name`, 80) WHERE CHAR_LENGTH(`name`) > 80;
UPDATE `Group` SET `name` = LEFT(`name`, 80) WHERE CHAR_LENGTH(`name`) > 80;
UPDATE `Season` SET `name` = LEFT(`name`, 80) WHERE CHAR_LENGTH(`name`) > 80;
UPDATE `Exercise` SET `name` = LEFT(`name`, 100) WHERE CHAR_LENGTH(`name`) > 100;
UPDATE `Routine` SET `name` = LEFT(`name`, 100) WHERE CHAR_LENGTH(`name`) > 100;

-- ============================================================================
-- 3) AJUSTAR (NOT NULL, índices y FKs)
-- ============================================================================

ALTER TABLE `User` MODIFY `name` VARCHAR(80) NULL,
    MODIFY `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

ALTER TABLE `Group` MODIFY `name` VARCHAR(80) NOT NULL;

ALTER TABLE `Season` MODIFY `name` VARCHAR(80) NOT NULL,
    MODIFY `startDate` DATE NOT NULL,
    MODIFY `endDate` DATE NOT NULL,
    MODIFY `weeklyGoal` INTEGER NOT NULL DEFAULT 3;

ALTER TABLE `Exercise` MODIFY `slug` VARCHAR(80) NOT NULL,
    MODIFY `name` VARCHAR(100) NOT NULL;

ALTER TABLE `Activity` MODIFY `activityCategoryId` VARCHAR(191) NOT NULL,
    MODIFY `durationMinutes` INTEGER NOT NULL;

ALTER TABLE `Routine` MODIFY `name` VARCHAR(100) NOT NULL;

ALTER TABLE `RoutineExercise` MODIFY `position` INTEGER NOT NULL;

ALTER TABLE `ActivityExercise` MODIFY `position` INTEGER NOT NULL;

CREATE UNIQUE INDEX `Exercise_slug_key` ON `Exercise`(`slug`);
CREATE INDEX `Exercise_createdByUserId_idx` ON `Exercise`(`createdByUserId`);
CREATE UNIQUE INDEX `Activity_clientRequestId_key` ON `Activity`(`clientRequestId`);
CREATE UNIQUE INDEX `RoutineExercise_routineId_position_key` ON `RoutineExercise`(`routineId`, `position`);
CREATE UNIQUE INDEX `ActivityExercise_activityId_position_key` ON `ActivityExercise`(`activityId`, `position`);


-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonCategory` ADD CONSTRAINT `SeasonCategory_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonCategory` ADD CONSTRAINT `SeasonCategory_activityCategoryId_fkey` FOREIGN KEY (`activityCategoryId`) REFERENCES `ActivityCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonAward` ADD CONSTRAINT `SeasonAward_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonAwardWinner` ADD CONSTRAINT `SeasonAwardWinner_seasonAwardId_fkey` FOREIGN KEY (`seasonAwardId`) REFERENCES `SeasonAward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonAwardWinner` ADD CONSTRAINT `SeasonAwardWinner_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreEntry` ADD CONSTRAINT `ScoreEntry_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreEntry` ADD CONSTRAINT `ScoreEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreEntry` ADD CONSTRAINT `ScoreEntry_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonStanding` ADD CONSTRAINT `SeasonStanding_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonStanding` ADD CONSTRAINT `SeasonStanding_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exercise` ADD CONSTRAINT `Exercise_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseAlias` ADD CONSTRAINT `ExerciseAlias_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutineExercise` ADD CONSTRAINT `RoutineExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutineSet` ADD CONSTRAINT `RoutineSet_routineExerciseId_fkey` FOREIGN KEY (`routineExerciseId`) REFERENCES `RoutineExercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_activityCategoryId_fkey` FOREIGN KEY (`activityCategoryId`) REFERENCES `ActivityCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityExercise` ADD CONSTRAINT `ActivityExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivitySet` ADD CONSTRAINT `ActivitySet_activityExerciseId_fkey` FOREIGN KEY (`activityExerciseId`) REFERENCES `ActivityExercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BadgeLevel` ADD CONSTRAINT `BadgeLevel_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- 4) BORRAR (lo que v2 ya no usa)
-- ============================================================================

DROP INDEX `Season_groupId_isActive_idx` ON `Season`;
DROP INDEX `Activity_type_idx` ON `Activity`;

ALTER TABLE `Season` DROP COLUMN `allowedActivityTypes`,
    DROP COLUMN `basePointsPerActivity`,
    DROP COLUMN `endedAt`,
    DROP COLUMN `isActive`,
    DROP COLUMN `maxScoreableMinutesPerActivity`,
    DROP COLUMN `maxScoreableMinutesPerDay`,
    DROP COLUMN `perfectWeekBonus`,
    DROP COLUMN `weeklyStreakBonus`;

ALTER TABLE `Activity` DROP COLUMN `deletedAt`,
    DROP COLUMN `endedAt`,
    DROP COLUMN `isDeleted`,
    DROP COLUMN `source`,
    DROP COLUMN `type`;

ALTER TABLE `RoutineExercise` DROP COLUMN `durationSeconds`,
    DROP COLUMN `reps`,
    DROP COLUMN `sets`,
    DROP COLUMN `weightKg`;

ALTER TABLE `ActivityExercise` DROP COLUMN `durationSeconds`,
    DROP COLUMN `reps`,
    DROP COLUMN `sets`,
    DROP COLUMN `weightKg`;

-- Puntos, progreso semanal e insignias de v1: se recalculan, no se migran.
DROP TABLE `ActivitySeason`;
DROP TABLE `SeasonAllowedActivityType`;
DROP TABLE `ScoreEvent`;
DROP TABLE `SeasonWeekProgress`;
DROP TABLE `AwardEarned`;
DROP TABLE `AwardDefinition`;
