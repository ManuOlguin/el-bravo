/*
  Warnings:

  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `passwordHash` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
