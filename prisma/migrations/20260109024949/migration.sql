/*
  Warnings:

  - A unique constraint covering the columns `[routineId]` on the table `RoutineExercise` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `routineexercise` DROP FOREIGN KEY `RoutineExercise_routineId_fkey`;

-- DropIndex
DROP INDEX `RoutineExercise_routineId_exerciseId_key` ON `routineexercise`;

-- CreateIndex
CREATE UNIQUE INDEX `RoutineExercise_routineId_key` ON `RoutineExercise`(`routineId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
