-- Migration: Create collection_matches table
-- This replaces the matches.txt file with a database table for storing BGG/Ludopedia matches

-- Create the collection_matches table
CREATE TABLE IF NOT EXISTS collection_matches (
    id SERIAL PRIMARY KEY,
    bgg_user_name VARCHAR(50) NOT NULL,
    bgg_game_id VARCHAR(20) NOT NULL,
    bgg_version_id VARCHAR(20) NOT NULL,
    ludopedia_user_name VARCHAR(50) NOT NULL,
    ludopedia_game_id VARCHAR(20) NOT NULL,
    match_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'name', 'ai', 'manual'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys para garantir integridade referencial
    FOREIGN KEY (bgg_user_name, bgg_game_id, bgg_version_id) REFERENCES bgg_collection(user_name, game_id, version_id) ON DELETE CASCADE,
    FOREIGN KEY (ludopedia_user_name, ludopedia_game_id) REFERENCES ludopedia_collection(user_name, game_id) ON DELETE CASCADE,
    
    -- Constraint para evitar matches duplicados
    UNIQUE(bgg_user_name, bgg_game_id, bgg_version_id, ludopedia_user_name, ludopedia_game_id)
);

-- Índices para otimizar consultas de matches
CREATE INDEX IF NOT EXISTS idx_collection_matches_bgg ON collection_matches(bgg_user_name, bgg_game_id, bgg_version_id);
CREATE INDEX IF NOT EXISTS idx_collection_matches_ludo ON collection_matches(ludopedia_user_name, ludopedia_game_id);
CREATE INDEX IF NOT EXISTS idx_collection_matches_type ON collection_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_collection_matches_created ON collection_matches(created_at);

-- Comentários da tabela de matches
COMMENT ON TABLE collection_matches IS 'Pareamentos/matches entre jogos do BGG e Ludopedia';
COMMENT ON COLUMN collection_matches.bgg_user_name IS 'Nome do usuário no BGG';
COMMENT ON COLUMN collection_matches.bgg_game_id IS 'ID do jogo no BGG';
COMMENT ON COLUMN collection_matches.bgg_version_id IS 'ID da versão do jogo no BGG';
COMMENT ON COLUMN collection_matches.ludopedia_user_name IS 'Nome do usuário na Ludopedia';
COMMENT ON COLUMN collection_matches.ludopedia_game_id IS 'ID do jogo na Ludopedia';
COMMENT ON COLUMN collection_matches.match_type IS 'Tipo de match: name (automático por nome), ai (sugerido por IA), manual (feito manualmente)';