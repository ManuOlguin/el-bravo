-- DropForeignKey
ALTER TABLE `Season` DROP FOREIGN KEY `Season_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `Activity` DROP FOREIGN KEY `Activity_activityCategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `ActivitySeason` DROP FOREIGN KEY `ActivitySeason_activityId_fkey`;

-- DropForeignKey
ALTER TABLE `ActivitySeason` DROP FOREIGN KEY `ActivitySeason_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `RoutineExercise` DROP FOREIGN KEY `RoutineExercise_exerciseId_fkey`;

-- DropForeignKey
ALTER TABLE `ActivityExercise` DROP FOREIGN KEY `ActivityExercise_exerciseId_fkey`;

-- DropForeignKey
ALTER TABLE `SeasonAllowedActivityType` DROP FOREIGN KEY `SeasonAllowedActivityType_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `SeasonAllowedActivityType` DROP FOREIGN KEY `SeasonAllowedActivityType_activityCategoryId_fkey`;

-- DropForeignKey
ALTER TABLE `ScoreEvent` DROP FOREIGN KEY `ScoreEvent_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `ScoreEvent` DROP FOREIGN KEY `ScoreEvent_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ScoreEvent` DROP FOREIGN KEY `ScoreEvent_activityId_fkey`;

-- DropForeignKey
ALTER TABLE `SeasonWeekProgress` DROP FOREIGN KEY `SeasonWeekProgress_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `SeasonWeekProgress` DROP FOREIGN KEY `SeasonWeekProgress_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AwardEarned` DROP FOREIGN KEY `AwardEarned_awardId_fkey`;

-- DropForeignKey
ALTER TABLE `AwardEarned` DROP FOREIGN KEY `AwardEarned_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AwardEarned` DROP FOREIGN KEY `AwardEarned_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `AwardEarned` DROP FOREIGN KEY `AwardEarned_activityId_fkey`;

-- DropIndex
DROP INDEX `Season_groupId_isActive_idx` ON `Season`;

-- DropIndex
DROP INDEX `Activity_type_idx` ON `Activity`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `bio` VARCHAR(280) NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    MODIFY `name` VARCHAR(80) NULL,
    MODIFY `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- AlterTable
ALTER TABLE `Group` ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    MODIFY `name` VARCHAR(80) NOT NULL;

-- AlterTable
ALTER TABLE `Season` DROP COLUMN `allowedActivityTypes`,
    DROP COLUMN `basePointsPerActivity`,
    DROP COLUMN `endedAt`,
    DROP COLUMN `isActive`,
    DROP COLUMN `maxScoreableMinutesPerActivity`,
    DROP COLUMN `maxScoreableMinutesPerDay`,
    DROP COLUMN `perfectWeekBonus`,
    DROP COLUMN `weeklyStreakBonus`,
    ADD COLUMN `dayBasePoints` INTEGER NOT NULL DEFAULT 10,
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
    ADD COLUMN `weeklyGoalBonus` INTEGER NOT NULL DEFAULT 20,
    MODIFY `name` VARCHAR(80) NOT NULL,
    MODIFY `startDate` DATE NOT NULL,
    MODIFY `endDate` DATE NOT NULL,
    MODIFY `weeklyGoal` INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE `Exercise` ADD COLUMN `createdByUserId` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `equipment` ENUM('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'cardio', 'other') NOT NULL DEFAULT 'other',
    ADD COLUMN `instructions` JSON NULL,
    ADD COLUMN `mediaUrl` VARCHAR(2048) NULL,
    ADD COLUMN `nameEn` VARCHAR(100) NULL,
    ADD COLUMN `slug` VARCHAR(80) NOT NULL,
    ADD COLUMN `tracksWeight` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `name` VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE `Activity` DROP COLUMN `deletedAt`,
    DROP COLUMN `endedAt`,
    DROP COLUMN `isDeleted`,
    DROP COLUMN `source`,
    DROP COLUMN `type`,
    ADD COLUMN `clientRequestId` VARCHAR(64) NULL,
    MODIFY `activityCategoryId` VARCHAR(191) NOT NULL,
    MODIFY `durationMinutes` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ActivityMedia` ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('pending', 'ready') NOT NULL DEFAULT 'ready',
    ADD COLUMN `thumbUrl` VARCHAR(2048) NULL;

-- AlterTable
ALTER TABLE `Routine` ADD COLUMN `notes` TEXT NULL,
    MODIFY `name` VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE `RoutineExercise` DROP COLUMN `durationSeconds`,
    DROP COLUMN `reps`,
    DROP COLUMN `sets`,
    DROP COLUMN `weightKg`,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `position` INTEGER NOT NULL,
    ADD COLUMN `restSeconds` INTEGER NULL;

-- AlterTable
ALTER TABLE `ActivityExercise` DROP COLUMN `durationSeconds`,
    DROP COLUMN `reps`,
    DROP COLUMN `sets`,
    DROP COLUMN `weightKg`,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `position` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ActivityCategory` ADD COLUMN `usesExercises` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `ActivitySeason`;

-- DropTable
DROP TABLE `SeasonAllowedActivityType`;

-- DropTable
DROP TABLE `ScoreEvent`;

-- DropTable
DROP TABLE `SeasonWeekProgress`;

-- DropTable
DROP TABLE `AwardDefinition`;

-- DropTable
DROP TABLE `AwardEarned`;

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

-- CreateIndex
CREATE UNIQUE INDEX `Exercise_slug_key` ON `Exercise`(`slug`);

-- CreateIndex
CREATE INDEX `Exercise_createdByUserId_idx` ON `Exercise`(`createdByUserId`);

-- CreateIndex
CREATE UNIQUE INDEX `Activity_clientRequestId_key` ON `Activity`(`clientRequestId`);

-- CreateIndex
CREATE UNIQUE INDEX `RoutineExercise_routineId_position_key` ON `RoutineExercise`(`routineId`, `position`);

-- CreateIndex
CREATE UNIQUE INDEX `ActivityExercise_activityId_position_key` ON `ActivityExercise`(`activityId`, `position`);

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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

