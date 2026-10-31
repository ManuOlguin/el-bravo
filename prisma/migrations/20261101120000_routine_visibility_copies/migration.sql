-- AlterTable
ALTER TABLE `Routine` ADD COLUMN `copiedFromRoutineId` VARCHAR(191) NULL,
    ADD COLUMN `copiedFromUserName` VARCHAR(80) NULL,
    ADD COLUMN `visibility` ENUM('private', 'public') NOT NULL DEFAULT 'private';

-- CreateIndex
CREATE INDEX `Routine_copiedFromRoutineId_idx` ON `Routine`(`copiedFromRoutineId`);

-- AddForeignKey
ALTER TABLE `Routine` ADD CONSTRAINT `Routine_copiedFromRoutineId_fkey` FOREIGN KEY (`copiedFromRoutineId`) REFERENCES `Routine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
