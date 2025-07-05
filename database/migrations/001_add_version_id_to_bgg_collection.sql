-- Migration: Add version_id to bgg_collection and update primary key
-- This handles BGG's support for multiple versions/editions of the same game

-- Step 1: Add version_id column (nullable initially for existing data)
ALTER TABLE bgg_collection ADD COLUMN version_id VARCHAR(20);

-- Step 2: Backfill existing rows with version_id = '0' (default version)
UPDATE bgg_collection SET version_id = '0' WHERE version_id IS NULL;

-- Step 3: Make version_id non-nullable
ALTER TABLE bgg_collection ALTER COLUMN version_id SET NOT NULL;

-- Step 4: Drop the old primary key constraint
ALTER TABLE bgg_collection DROP CONSTRAINT bgg_collection_pkey;

-- Step 5: Create new composite primary key
ALTER TABLE bgg_collection ADD CONSTRAINT bgg_collection_pkey 
PRIMARY KEY (user_name, game_id, version_id);

-- Step 6: Update indexes to include version_id
DROP INDEX IF EXISTS idx_bgg_user;
DROP INDEX IF EXISTS idx_bgg_type;
DROP INDEX IF EXISTS idx_bgg_is_expansion;
DROP INDEX IF EXISTS idx_bgg_name;
DROP INDEX IF EXISTS idx_bgg_num_plays;

-- Recreate indexes with version_id consideration
CREATE INDEX idx_bgg_user_game ON bgg_collection(user_name, game_id);
CREATE INDEX idx_bgg_user ON bgg_collection(user_name);
CREATE INDEX idx_bgg_type ON bgg_collection(type);
CREATE INDEX idx_bgg_is_expansion ON bgg_collection(is_expansion);
CREATE INDEX idx_bgg_name ON bgg_collection(name);
CREATE INDEX idx_bgg_num_plays ON bgg_collection(num_plays);
CREATE INDEX idx_bgg_version ON bgg_collection(version_id);

-- Add comment
COMMENT ON COLUMN bgg_collection.version_id IS 'BGG version/edition ID for the same game';