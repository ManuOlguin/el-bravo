/*
  Warnings:

  - You are about to drop the column `durationMin` on the `activity` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `activity` table. All the data in the column will be lost.
  - You are about to drop the column `performedAt` on the `activity` table. All the data in the column will be lost.
  - You are about to drop the column `seasonId` on the `activity` table. All the data in the column will be lost.
  - Added the required column `endedAt` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startedAt` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `activity` DROP FOREIGN KEY `Activity_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `activity` DROP FOREIGN KEY `Activity_seasonId_fkey`;

-- DropIndex
DROP INDEX `Activity_groupId_fkey` ON `activity`;

-- DropIndex
DROP INDEX `Activity_seasonId_fkey` ON `activity`;

-- AlterTable
ALTER TABLE `activity` DROP COLUMN `durationMin`,
    DROP COLUMN `groupId`,
    DROP COLUMN `performedAt`,
    DROP COLUMN `seasonId`,
    ADD COLUMN `endedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `startedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `group` ADD COLUMN `photoUrl` VARCHAR(2048) NULL;

-- AlterTable
ALTER TABLE `season` ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `photoUrl` VARCHAR(2048) NULL;

-- CreateIndex
CREATE INDEX `Activity_userId_startedAt_idx` ON `Activity`(`userId`, `startedAt`);

-- CreateIndex
CREATE INDEX `Activity_startedAt_idx` ON `Activity`(`startedAt`);
