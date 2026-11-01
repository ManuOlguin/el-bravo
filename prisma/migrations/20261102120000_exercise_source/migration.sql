-- AlterTable
ALTER TABLE `Exercise` ADD COLUMN `source` ENUM('catalog', 'user', 'ai') NOT NULL DEFAULT 'user';

-- Backfill: lo que no tiene dueño es el catálogo oficial.
UPDATE `Exercise` SET `source` = 'catalog' WHERE `createdByUserId` IS NULL;
