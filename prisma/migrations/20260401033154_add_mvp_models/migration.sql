/*
  Safe MVP migration for existing local dev data.
  - Avoids dropping/recreating old foreign keys
  - Backfills required columns before making them NOT NULL
  - Preserves season.minPerWeek into season.weeklyGoal
*/

-- AlterTable: activity
ALTER TABLE `activity`
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `durationMinutes` INTEGER NULL,
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `source` VARCHAR(32) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

UPDATE `activity`
SET `updatedAt` = NOW()
WHERE `updatedAt` IS NULL;

ALTER TABLE `activity`
  MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable: `group`
ALTER TABLE `group`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

UPDATE `group`
SET `updatedAt` = NOW()
WHERE `updatedAt` IS NULL;

ALTER TABLE `group`
  MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable: groupmember
ALTER TABLE `groupmember`
  ADD COLUMN `acceptedAt` DATETIME(3) NULL,
  ADD COLUMN `requestedAt` DATETIME(3) NULL,
  ADD COLUMN `respondedAt` DATETIME(3) NULL,
  ADD COLUMN `respondedBy` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('pending', 'accepted', 'rejected', 'removed') NOT NULL DEFAULT 'accepted';

-- AlterTable: routine
ALTER TABLE `routine`
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

UPDATE `routine`
SET `updatedAt` = NOW()
WHERE `updatedAt` IS NULL;

ALTER TABLE `routine`
  MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable: season
ALTER TABLE `season`
  ADD COLUMN `allowedActivityTypes` JSON NULL,
  ADD COLUMN `basePointsPerActivity` INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN `createdBy` VARCHAR(191) NULL,
  ADD COLUMN `endedAt` DATETIME(3) NULL,
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `maxScoreableMinutesPerActivity` INTEGER NULL,
  ADD COLUMN `maxScoreableMinutesPerDay` INTEGER NULL,
  ADD COLUMN `perfectWeekBonus` INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN `weeklyGoal` INTEGER NULL,
  ADD COLUMN `weeklyStreakBonus` INTEGER NOT NULL DEFAULT 5;

UPDATE `season`
SET `weeklyGoal` = `minPerWeek`
WHERE `weeklyGoal` IS NULL;

UPDATE `season` s
JOIN `group` g ON g.id = s.groupId
SET s.createdBy = g.createdBy
WHERE s.createdBy IS NULL;

ALTER TABLE `season`
  MODIFY `createdBy` VARCHAR(191) NOT NULL,
  MODIFY `weeklyGoal` INTEGER NOT NULL DEFAULT 2;

ALTER TABLE `season`
  DROP COLUMN `minPerWeek`;

-- AlterTable: user
ALTER TABLE `user`
  ADD COLUMN `timezone` VARCHAR(64) NULL,
  ADD COLUMN `weeklyGoal` INTEGER NOT NULL DEFAULT 3;

-- CreateTable: ActivityMedia
CREATE TABLE `ActivityMedia` (
  `id` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `storageKey` VARCHAR(255) NULL,
  `mimeType` VARCHAR(128) NULL,
  `sizeBytes` INTEGER NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ActivityMedia_activityId_idx`(`activityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ActivitySeason
CREATE TABLE `ActivitySeason` (
  `id` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NOT NULL,
  `seasonId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ActivitySeason_seasonId_idx`(`seasonId`),
  UNIQUE INDEX `ActivitySeason_activityId_seasonId_key`(`activityId`, `seasonId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ScoreEvent
CREATE TABLE `ScoreEvent` (
  `id` VARCHAR(191) NOT NULL,
  `seasonId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NULL,
  `weekStart` DATETIME(3) NULL,
  `type` ENUM('activity_base', 'weekly_streak_bonus', 'perfect_week_bonus', 'award_bonus', 'manual_adjustment', 'penalty') NOT NULL,
  `points` INTEGER NOT NULL,
  `reason` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ScoreEvent_seasonId_userId_idx`(`seasonId`, `userId`),
  INDEX `ScoreEvent_userId_idx`(`userId`),
  INDEX `ScoreEvent_activityId_idx`(`activityId`),
  INDEX `ScoreEvent_seasonId_weekStart_idx`(`seasonId`, `weekStart`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: SeasonWeekProgress
CREATE TABLE `SeasonWeekProgress` (
  `id` VARCHAR(191) NOT NULL,
  `seasonId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `weekStart` DATETIME(3) NOT NULL,
  `activitiesCount` INTEGER NOT NULL DEFAULT 0,
  `minutesTotal` INTEGER NOT NULL DEFAULT 0,
  `goalTarget` INTEGER NOT NULL,
  `goalReached` BOOLEAN NOT NULL DEFAULT false,
  `perfectWeek` BOOLEAN NOT NULL DEFAULT false,
  `streakCount` INTEGER NOT NULL DEFAULT 0,
  `pointsEarned` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `SeasonWeekProgress_seasonId_weekStart_idx`(`seasonId`, `weekStart`),
  INDEX `SeasonWeekProgress_userId_weekStart_idx`(`userId`, `weekStart`),
  UNIQUE INDEX `SeasonWeekProgress_seasonId_userId_weekStart_key`(`seasonId`, `userId`, `weekStart`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: AwardDefinition
CREATE TABLE `AwardDefinition` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `scope` ENUM('season', 'profile') NOT NULL DEFAULT 'season',
  `pointsBonus` INTEGER NOT NULL DEFAULT 0,
  `iconKey` VARCHAR(128) NULL,
  `criteria` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `AwardDefinition_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: AwardEarned
CREATE TABLE `AwardEarned` (
  `id` VARCHAR(191) NOT NULL,
  `awardId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `seasonId` VARCHAR(191) NULL,
  `activityId` VARCHAR(191) NULL,
  `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `metadata` JSON NULL,

  INDEX `AwardEarned_userId_idx`(`userId`),
  INDEX `AwardEarned_seasonId_userId_idx`(`seasonId`, `userId`),
  INDEX `AwardEarned_activityId_idx`(`activityId`),
  UNIQUE INDEX `AwardEarned_awardId_userId_seasonId_key`(`awardId`, `userId`, `seasonId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_type_idx` ON `Activity`(`type`);

-- CreateIndex
CREATE INDEX `Activity_routineId_idx` ON `Activity`(`routineId`);

-- CreateIndex
CREATE INDEX `Group_createdBy_idx` ON `Group`(`createdBy`);

-- CreateIndex
CREATE INDEX `GroupMember_groupId_status_idx` ON `GroupMember`(`groupId`, `status`);

-- CreateIndex
CREATE INDEX `Season_groupId_isActive_idx` ON `Season`(`groupId`, `isActive`);

-- CreateIndex
CREATE INDEX `Season_startDate_endDate_idx` ON `Season`(`startDate`, `endDate`);

-- AddForeignKey: only NEW tables
ALTER TABLE `ActivityMedia`
  ADD CONSTRAINT `ActivityMedia_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ActivitySeason`
  ADD CONSTRAINT `ActivitySeason_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ActivitySeason`
  ADD CONSTRAINT `ActivitySeason_seasonId_fkey`
  FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ScoreEvent`
  ADD CONSTRAINT `ScoreEvent_seasonId_fkey`
  FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ScoreEvent`
  ADD CONSTRAINT `ScoreEvent_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ScoreEvent`
  ADD CONSTRAINT `ScoreEvent_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SeasonWeekProgress`
  ADD CONSTRAINT `SeasonWeekProgress_seasonId_fkey`
  FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SeasonWeekProgress`
  ADD CONSTRAINT `SeasonWeekProgress_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AwardEarned`
  ADD CONSTRAINT `AwardEarned_awardId_fkey`
  FOREIGN KEY (`awardId`) REFERENCES `AwardDefinition`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AwardEarned`
  ADD CONSTRAINT `AwardEarned_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AwardEarned`
  ADD CONSTRAINT `AwardEarned_seasonId_fkey`
  FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AwardEarned`
  ADD CONSTRAINT `AwardEarned_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;