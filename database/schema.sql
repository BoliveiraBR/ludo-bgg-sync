-- Schema para substituir arquivos de texto por tabelas relacionais
-- Criado para armazenar coleções de jogos de tabuleiro de usuários

-- Tabela para coleção da Ludopedia
CREATE TABLE IF NOT EXISTS ludopedia_collection (
    user_name VARCHAR(50) NOT NULL,
    game_id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'base',
    is_expansion BOOLEAN DEFAULT FALSE,
    year VARCHAR(4),
    rating INTEGER,
    favorite BOOLEAN DEFAULT FALSE,
    comment TEXT,
    link VARCHAR(500),
    thumbnail VARCHAR(500),
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_name, game_id)
);

-- Tabela para coleção do BoardGameGeek (BGG)
CREATE TABLE IF NOT EXISTS bgg_collection (
    user_name VARCHAR(50) NOT NULL,
    game_id VARCHAR(20) NOT NULL,
    version_id VARCHAR(20) NOT NULL DEFAULT '0',
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'base',
    is_expansion BOOLEAN DEFAULT FALSE,
    year VARCHAR(4),
    rating DECIMAL(3,1), -- Permite valores como 7.5
    comment TEXT,
    thumbnail VARCHAR(500),
    image VARCHAR(500),
    num_plays INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_name, game_id, version_id)
);

-- Índices para otimizar consultas comuns
CREATE INDEX IF NOT EXISTS idx_ludopedia_user ON ludopedia_collection(user_name);
CREATE INDEX IF NOT EXISTS idx_ludopedia_type ON ludopedia_collection(type);
CREATE INDEX IF NOT EXISTS idx_ludopedia_is_expansion ON ludopedia_collection(is_expansion);
CREATE INDEX IF NOT EXISTS idx_ludopedia_name ON ludopedia_collection(name);

CREATE INDEX IF NOT EXISTS idx_bgg_user_game ON bgg_collection(user_name, game_id);
CREATE INDEX IF NOT EXISTS idx_bgg_user ON bgg_collection(user_name);
CREATE INDEX IF NOT EXISTS idx_bgg_type ON bgg_collection(type);
CREATE INDEX IF NOT EXISTS idx_bgg_is_expansion ON bgg_collection(is_expansion);
CREATE INDEX IF NOT EXISTS idx_bgg_name ON bgg_collection(name);
CREATE INDEX IF NOT EXISTS idx_bgg_num_plays ON bgg_collection(num_plays);
CREATE INDEX IF NOT EXISTS idx_bgg_version ON bgg_collection(version_id);

-- Comentários das tabelas
COMMENT ON TABLE ludopedia_collection IS 'Coleção de jogos de tabuleiro dos usuários na plataforma Ludopedia';
COMMENT ON TABLE bgg_collection IS 'Coleção de jogos de tabuleiro dos usuários na plataforma BoardGameGeek';

-- Comentários das colunas principais
COMMENT ON COLUMN ludopedia_collection.user_name IS 'Nome do usuário na Ludopedia';
COMMENT ON COLUMN ludopedia_collection.game_id IS 'ID único do jogo na Ludopedia';
COMMENT ON COLUMN ludopedia_collection.type IS 'Tipo do jogo: base, expansion, etc.';
COMMENT ON COLUMN ludopedia_collection.is_expansion IS 'Indica se é uma expansão';
COMMENT ON COLUMN ludopedia_collection.rating IS 'Avaliação do usuário (1-10)';
COMMENT ON COLUMN ludopedia_collection.favorite IS 'Indica se é um jogo favorito';

COMMENT ON COLUMN bgg_collection.user_name IS 'Nome do usuário no BoardGameGeek';
COMMENT ON COLUMN bgg_collection.game_id IS 'ID único do jogo no BoardGameGeek';
COMMENT ON COLUMN bgg_collection.version_id IS 'ID da versão/edição específica do jogo no BGG';
COMMENT ON COLUMN bgg_collection.type IS 'Tipo do jogo: base, expansion, etc.';
COMMENT ON COLUMN bgg_collection.is_expansion IS 'Indica se é uma expansão';
COMMENT ON COLUMN bgg_collection.rating IS 'Avaliação do usuário (1-10, permite decimais)';
COMMENT ON COLUMN bgg_collection.num_plays IS 'Número de partidas jogadas';