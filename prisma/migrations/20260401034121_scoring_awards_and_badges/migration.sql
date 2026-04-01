-- DropForeignKey
ALTER TABLE `activity` DROP FOREIGN KEY `Activity_userId_fkey`;

-- DropForeignKey
ALTER TABLE `activityexercise` DROP FOREIGN KEY `ActivityExercise_activityId_fkey`;

-- DropForeignKey
ALTER TABLE `activityexercise` DROP FOREIGN KEY `ActivityExercise_exerciseId_fkey`;

-- DropForeignKey
ALTER TABLE `exercisemuscle` DROP FOREIGN KEY `ExerciseMuscle_exerciseId_fkey`;

-- DropForeignKey
ALTER TABLE `exercisemuscle` DROP FOREIGN KEY `ExerciseMuscle_muscleId_fkey`;

-- DropForeignKey
ALTER TABLE `groupmember` DROP FOREIGN KEY `GroupMember_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `groupmember` DROP FOREIGN KEY `GroupMember_userId_fkey`;

-- DropForeignKey
ALTER TABLE `routine` DROP FOREIGN KEY `Routine_userId_fkey`;

-- DropForeignKey
ALTER TABLE `routineexercise` DROP FOREIGN KEY `RoutineExercise_exerciseId_fkey`;

-- DropForeignKey
ALTER TABLE `routineexercise` DROP FOREIGN KEY `RoutineExercise_routineId_fkey`;

-- DropForeignKey
ALTER TABLE `season` DROP FOREIGN KEY `Season_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `seasonmember` DROP FOREIGN KEY `SeasonMember_seasonId_fkey`;

-- DropForeignKey
ALTER TABLE `seasonmember` DROP FOREIGN KEY `SeasonMember_userId_fkey`;

-- AlterTable
ALTER TABLE `activity` MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `group` MODIFY `createdBy` VARCHAR(191) NULL,
    MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `routine` MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `season` MODIFY `createdBy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `seasonweekprogress` MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `updatedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Season_groupId_idx` ON `Season`(`groupId`);

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Season` ADD CONSTRAINT `Season_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonMember` ADD CONSTRAINT `SeasonMember_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonMember` ADD CONSTRAINT `SeasonMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseMuscle` ADD CONSTRAINT `ExerciseMuscle_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseMuscle` ADD CONSTRAINT `ExerciseMuscle_muscleId_fkey` FOREIGN KEY (`muscleId`) REFERENCES `Muscle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_routineId_fkey` FOREIGN KEY (`routineId`) REFERENCES `Routine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Routine` ADD CONSTRAINT `Routine_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutineExercise` ADD CONSTRAINT `RoutineExercise_routineId_fkey` FOREIGN KEY (`routineId`) REFERENCES `Routine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutineExercise` ADD CONSTRAINT `RoutineExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityExercise` ADD CONSTRAINT `ActivityExercise_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityExercise` ADD CONSTRAINT `ActivityExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `activityexercise` RENAME INDEX `ActivityExercise_exerciseId_fkey` TO `ActivityExercise_exerciseId_idx`;

-- RenameIndex
ALTER TABLE `exercisemuscle` RENAME INDEX `ExerciseMuscle_muscleId_fkey` TO `ExerciseMuscle_muscleId_idx`;

-- RenameIndex
ALTER TABLE `groupmember` RENAME INDEX `GroupMember_userId_fkey` TO `GroupMember_userId_idx`;

-- RenameIndex
ALTER TABLE `routine` RENAME INDEX `Routine_userId_fkey` TO `Routine_userId_idx`;

-- RenameIndex
ALTER TABLE `routineexercise` RENAME INDEX `RoutineExercise_exerciseId_fkey` TO `RoutineExercise_exerciseId_idx`;

-- RenameIndex
ALTER TABLE `routineexercise` RENAME INDEX `RoutineExercise_routineId_fkey` TO `RoutineExercise_routineId_idx`;

-- RenameIndex
ALTER TABLE `seasonmember` RENAME INDEX `SeasonMember_userId_fkey` TO `SeasonMember_userId_idx`;
