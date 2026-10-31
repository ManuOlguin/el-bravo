-- DropIndex
DROP INDEX `Exercise_name_key` ON `Exercise`;

-- CreateIndex
CREATE UNIQUE INDEX `Exercise_createdByUserId_name_key` ON `Exercise`(`createdByUserId`, `name`);
