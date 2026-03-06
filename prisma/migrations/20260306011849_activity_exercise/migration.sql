-- DropForeignKey
ALTER TABLE `activity` DROP FOREIGN KEY `Activity_routineId_fkey`;

-- DropIndex
DROP INDEX `Activity_routineId_fkey` ON `activity`;

-- CreateTable
CREATE TABLE `ActivityExercise` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `sets` INTEGER NOT NULL,
    `reps` INTEGER NOT NULL,

    INDEX `ActivityExercise_activityId_idx`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityExercise` ADD CONSTRAINT `ActivityExercise_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityExercise` ADD CONSTRAINT `ActivityExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
