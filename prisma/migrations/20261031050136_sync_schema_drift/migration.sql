-- Sincroniza tablas/columnas que estaban en schema.prisma pero nunca se migraron (cambios aplicados con db push)
-- DropForeignKey
ALTER TABLE `awardearned` DROP FOREIGN KEY `AwardEarned_awardId_fkey`;

-- DropIndex
DROP INDEX `AwardEarned_awardId_userId_seasonId_key` ON `awardearned`;

-- AlterTable
ALTER TABLE `activity` ADD COLUMN `activityCategoryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `activityexercise` ADD COLUMN `durationSeconds` INTEGER NULL,
    ADD COLUMN `weightKg` DOUBLE NULL,
    MODIFY `reps` INTEGER NULL;

-- AlterTable
ALTER TABLE `exercise` ADD COLUMN `measureType` ENUM('reps', 'duration') NOT NULL DEFAULT 'reps';

-- AlterTable
ALTER TABLE `routineexercise` ADD COLUMN `durationSeconds` INTEGER NULL,
    ADD COLUMN `weightKg` DOUBLE NULL,
    MODIFY `reps` INTEGER NULL;

-- AlterTable
ALTER TABLE `scoreevent` MODIFY `type` ENUM('activity_base', 'weekly_streak_bonus', 'perfect_week_bonus', 'award_bonus', 'manual_adjustment', 'penalty', 'final_longest_perfect_streak_bonus', 'final_longest_session_bonus') NOT NULL;

-- CreateTable
CREATE TABLE `ActivityCategory` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ActivityCategory_slug_key`(`slug`),
    INDEX `ActivityCategory_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonAllowedActivityType` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `activityCategoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeasonAllowedActivityType_activityCategoryId_idx`(`activityCategoryId`),
    UNIQUE INDEX `SeasonAllowedActivityType_seasonId_activityCategoryId_key`(`seasonId`, `activityCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Activity_activityCategoryId_idx` ON `Activity`(`activityCategoryId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_activityCategoryId_fkey` FOREIGN KEY (`activityCategoryId`) REFERENCES `ActivityCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonAllowedActivityType` ADD CONSTRAINT `SeasonAllowedActivityType_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonAllowedActivityType` ADD CONSTRAINT `SeasonAllowedActivityType_activityCategoryId_fkey` FOREIGN KEY (`activityCategoryId`) REFERENCES `ActivityCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardEarned` ADD CONSTRAINT `AwardEarned_awardId_fkey` FOREIGN KEY (`awardId`) REFERENCES `AwardDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
