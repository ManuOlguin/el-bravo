-- AlterTable
ALTER TABLE `activity` ADD COLUMN `routineId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_routineId_fkey` FOREIGN KEY (`routineId`) REFERENCES `Routine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
