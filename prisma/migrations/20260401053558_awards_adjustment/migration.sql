/*
  Safe migration for awards + muscles adjustments.
  - Avoids touching old foreign keys
  - Backfills new columns before making them unique / required
*/

-- AlterTable: awarddefinition
ALTER TABLE `awarddefinition`
  ADD COLUMN `category` VARCHAR(64) NULL,
  ADD COLUMN `level` INTEGER NULL;

-- AlterTable: awardearned
ALTER TABLE `awardearned`
  ADD COLUMN `dedupeKey` VARCHAR(255) NULL;

UPDATE `awardearned`
SET `dedupeKey` = CONCAT(
  'award:', `awardId`,
  ':user:', `userId`,
  ':season:', COALESCE(`seasonId`, 'global')
)
WHERE `dedupeKey` IS NULL;

-- AlterTable: muscle
ALTER TABLE `muscle`
  ADD COLUMN `groupKey` VARCHAR(64) NULL,
  ADD COLUMN `slug` VARCHAR(191) NULL;

UPDATE `muscle`
SET
  `slug` = CASE LOWER(`name`)
    WHEN 'abdominales' THEN 'abdominales'
    WHEN 'oblicuos' THEN 'oblicuos'
    WHEN 'lumbar' THEN 'lumbar'
    WHEN 'cuadriceps' THEN 'cuadriceps'
    WHEN 'isquiotibiales' THEN 'isquiotibiales'
    WHEN 'gluteos' THEN 'gluteos'
    WHEN 'glúteos' THEN 'gluteos'
    WHEN 'aductores' THEN 'aductores'
    WHEN 'gemelos' THEN 'gemelos'
    WHEN 'pecho' THEN 'pecho'
    WHEN 'hombros' THEN 'hombros'
    WHEN 'triceps' THEN 'triceps'
    WHEN 'tríceps' THEN 'triceps'
    WHEN 'espalda' THEN 'espalda'
    WHEN 'biceps' THEN 'biceps'
    WHEN 'bíceps' THEN 'biceps'
    WHEN 'trapecio' THEN 'trapecio'
    ELSE LOWER(REPLACE(REPLACE(REPLACE(`name`, ' ', '_'), 'á', 'a'), 'é', 'e'))
  END,
  `groupKey` = CASE LOWER(`name`)
    WHEN 'abdominales' THEN 'core'
    WHEN 'oblicuos' THEN 'core'
    WHEN 'lumbar' THEN 'core'
    WHEN 'cuadriceps' THEN 'legs'
    WHEN 'isquiotibiales' THEN 'legs'
    WHEN 'gluteos' THEN 'legs'
    WHEN 'glúteos' THEN 'legs'
    WHEN 'aductores' THEN 'legs'
    WHEN 'gemelos' THEN 'legs'
    WHEN 'pecho' THEN 'chest'
    WHEN 'hombros' THEN 'shoulders'
    WHEN 'triceps' THEN 'arms'
    WHEN 'tríceps' THEN 'arms'
    WHEN 'espalda' THEN 'back'
    WHEN 'biceps' THEN 'arms'
    WHEN 'bíceps' THEN 'arms'
    WHEN 'trapecio' THEN 'back'
    ELSE 'other'
  END
WHERE `slug` IS NULL OR `groupKey` IS NULL;

ALTER TABLE `awardearned`
  MODIFY `dedupeKey` VARCHAR(255) NOT NULL;

ALTER TABLE `muscle`
  MODIFY `groupKey` VARCHAR(64) NOT NULL,
  MODIFY `slug` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `AwardEarned_dedupeKey_key` ON `awardearned`(`dedupeKey`);
CREATE UNIQUE INDEX `Muscle_slug_key` ON `muscle`(`slug`);