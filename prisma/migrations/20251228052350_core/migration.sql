-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'member') NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `GroupMember_groupId_userId_key`(`groupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Season` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('waiting', 'active', 'finished') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeasonMember` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `SeasonMember_seasonId_userId_key`(`seasonId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NULL,
    `type` ENUM('gym', 'run', 'sport', 'mobility', 'other') NOT NULL,
    `durationMin` INTEGER NOT NULL,
    `performedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Season` ADD CONSTRAINT `Season_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonMember` ADD CONSTRAINT `SeasonMember_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeasonMember` ADD CONSTRAINT `SeasonMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
