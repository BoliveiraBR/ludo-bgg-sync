-- Migration: Add fl_jogou column to ludopedia_collection
-- This field tracks whether a game has been played according to Ludopedia data

-- Step 1: Add fl_jogou column (nullable initially for existing data)
ALTER TABLE ludopedia_collection ADD COLUMN fl_jogou INTEGER;

-- Step 2: Backfill existing rows with fl_jogou = 0 (not played by default)
UPDATE ludopedia_collection SET fl_jogou = 0 WHERE fl_jogou IS NULL;

-- Step 3: Make fl_jogou non-nullable with default value
ALTER TABLE ludopedia_collection ALTER COLUMN fl_jogou SET NOT NULL;
ALTER TABLE ludopedia_collection ALTER COLUMN fl_jogou SET DEFAULT 0;

-- Step 4: Create index for performance on played games queries
CREATE INDEX idx_ludopedia_fl_jogou ON ludopedia_collection(fl_jogou);

-- Add comment
COMMENT ON COLUMN ludopedia_collection.fl_jogou IS 'Flag indicando se o jogo já foi jogado (0=não jogado, 1=jogado) dos dados da Ludopedia';COMMENT ON COLUMN ludopedia_collection.fl_jogou IS 'Flag indicando se o jogo já foi jogado (0=, 1=jogado) from Ludopedia data';