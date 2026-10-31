-- AlterTable
ALTER TABLE `ScoreEntry` MODIFY `kind` ENUM('workout', 'weekly_goal', 'streak', 'active_streak', 'award', 'adjustment') NOT NULL;

-- AlterTable
ALTER TABLE `Season` ADD COLUMN `activeStreakBonusCap` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `activeStreakBonusStep` INTEGER NOT NULL DEFAULT 2;
