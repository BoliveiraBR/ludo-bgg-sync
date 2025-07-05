-- Migration: Add unique constraints to prevent duplicate matches
-- Ensures one BGG game can only match one Ludopedia game and vice-versa

-- First, let's check for existing duplicates before adding constraints
-- This will help identify problematic data

-- Remove duplicate matches, keeping only the most recent one for each BGG game
DELETE FROM collection_matches cm1
WHERE EXISTS (
    SELECT 1 FROM collection_matches cm2
    WHERE cm2.bgg_user_name = cm1.bgg_user_name
    AND cm2.bgg_game_id = cm1.bgg_game_id
    AND cm2.bgg_version_id = cm1.bgg_version_id
    AND cm2.id > cm1.id  -- Keep the newer match
);

-- Remove duplicate matches, keeping only the most recent one for each Ludopedia game
DELETE FROM collection_matches cm1
WHERE EXISTS (
    SELECT 1 FROM collection_matches cm2
    WHERE cm2.ludopedia_user_name = cm1.ludopedia_user_name
    AND cm2.ludopedia_game_id = cm1.ludopedia_game_id
    AND cm2.id > cm1.id  -- Keep the newer match
);

-- Add unique constraint for BGG games (one BGG game = one match)
ALTER TABLE collection_matches 
ADD CONSTRAINT unique_bgg_game_match 
UNIQUE (bgg_user_name, bgg_game_id, bgg_version_id);

-- Add unique constraint for Ludopedia games (one Ludopedia game = one match)
ALTER TABLE collection_matches 
ADD CONSTRAINT unique_ludopedia_game_match 
UNIQUE (ludopedia_user_name, ludopedia_game_id);

-- Add comments
COMMENT ON CONSTRAINT unique_bgg_game_match ON collection_matches 
IS 'Ensures each BGG game can only have one match';

COMMENT ON CONSTRAINT unique_ludopedia_game_match ON collection_matches 
IS 'Ensures each Ludopedia game can only have one match';