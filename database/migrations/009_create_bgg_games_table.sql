-- Migration: Criar tabela bgg_games para armazenar ratings globais dos jogos do BGG
-- Tabela para armazenar todos os jogos e seus ratings do BoardGameGeek
CREATE TABLE IF NOT EXISTS bgg_games (
    id INTEGER PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    yearpublished INTEGER,
    rank INTEGER,
    bayesaverage DECIMAL(8,5),
    average DECIMAL(8,5),
    usersrated INTEGER,
    is_expansion BOOLEAN DEFAULT FALSE,
    abstracts_rank INTEGER,
    cgs_rank INTEGER,
    childrensgames_rank INTEGER,
    familygames_rank INTEGER,
    partygames_rank INTEGER,
    strategygames_rank INTEGER,
    thematic_rank INTEGER,
    wargames_rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimizar consultas comuns
CREATE INDEX IF NOT EXISTS idx_bgg_games_rank ON bgg_games(rank);
CREATE INDEX IF NOT EXISTS idx_bgg_games_name ON bgg_games(name);
CREATE INDEX IF NOT EXISTS idx_bgg_games_year ON bgg_games(yearpublished);
CREATE INDEX IF NOT EXISTS idx_bgg_games_bayesaverage ON bgg_games(bayesaverage);
CREATE INDEX IF NOT EXISTS idx_bgg_games_is_expansion ON bgg_games(is_expansion);
CREATE INDEX IF NOT EXISTS idx_bgg_games_strategygames_rank ON bgg_games(strategygames_rank);

-- Comentários da tabela
COMMENT ON TABLE bgg_games IS 'Jogos e rankings globais do BoardGameGeek importados dos data dumps oficiais';
COMMENT ON COLUMN bgg_games.id IS 'ID único do jogo no BoardGameGeek';
COMMENT ON COLUMN bgg_games.name IS 'Nome do jogo';
COMMENT ON COLUMN bgg_games.yearpublished IS 'Ano de publicação do jogo';
COMMENT ON COLUMN bgg_games.rank IS 'Ranking geral no BGG';
COMMENT ON COLUMN bgg_games.bayesaverage IS 'Média bayesiana calculada pelo BGG';
COMMENT ON COLUMN bgg_games.average IS 'Média simples das avaliações';
COMMENT ON COLUMN bgg_games.usersrated IS 'Número de usuários que avaliaram o jogo';
COMMENT ON COLUMN bgg_games.is_expansion IS 'Indica se é uma expansão (valor 1) ou jogo base (valor 0)';
COMMENT ON COLUMN bgg_games.abstracts_rank IS 'Ranking na categoria Abstract Games';
COMMENT ON COLUMN bgg_games.cgs_rank IS 'Ranking na categoria Customizable Games';
COMMENT ON COLUMN bgg_games.childrensgames_rank IS 'Ranking na categoria Children''s Games';
COMMENT ON COLUMN bgg_games.familygames_rank IS 'Ranking na categoria Family Games';
COMMENT ON COLUMN bgg_games.partygames_rank IS 'Ranking na categoria Party Games';
COMMENT ON COLUMN bgg_games.strategygames_rank IS 'Ranking na categoria Strategy Games';
COMMENT ON COLUMN bgg_games.thematic_rank IS 'Ranking na categoria Thematic Games';
COMMENT ON COLUMN bgg_games.wargames_rank IS 'Ranking na categoria War Games';