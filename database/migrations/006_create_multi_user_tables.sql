-- Migration: Create multi-user tables for BoardGameGuru
-- OBJETIVO: Transformar sistema mono-usuário em multi-usuário
-- Adicionar tabelas para usuários, autenticação e tokens OAuth

-- Verificar se as tabelas já existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_oauth_tokens', 'refresh_tokens');

-- Criar tabela de usuários do BoardGameGuru
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bgg_username VARCHAR(100),
    ludopedia_username VARCHAR(100),
    preferred_platform VARCHAR(20) DEFAULT 'bgg' CHECK (preferred_platform IN ('bgg', 'ludopedia')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Criar tabela de tokens OAuth para serviços externos (Ludopedia)
CREATE TABLE IF NOT EXISTS user_oauth_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- SEM FK para preservar dados mesmo se usuário for deletado
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL, -- será criptografado pela aplicação
    expires_at TIMESTAMP,
    scope TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, provider)
);

-- Criar tabela de refresh tokens para logout remoto do BoardGameGuru
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL, -- SEM FK para preservar dados mesmo se usuário for deletado
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_bgg_username ON users(bgg_username);
CREATE INDEX IF NOT EXISTS idx_users_ludopedia_username ON users(ludopedia_username);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_provider ON user_oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Adicionar comentários explicativos
COMMENT ON TABLE users IS 'Usuários do BoardGameGuru com conexões para BGG e Ludopedia';
COMMENT ON COLUMN users.email IS 'Email único do usuário no BoardGameGuru';
COMMENT ON COLUMN users.password_hash IS 'Hash da senha do usuário (bcrypt/argon2)';
COMMENT ON COLUMN users.bgg_username IS 'Username público do usuário no BoardGameGeek';
COMMENT ON COLUMN users.ludopedia_username IS 'Username do usuário na Ludopedia, obtido via OAuth';
COMMENT ON COLUMN users.preferred_platform IS 'Plataforma preferida para manter coleção e partidas (bgg ou ludopedia)';

COMMENT ON TABLE user_oauth_tokens IS 'Tokens OAuth criptografados para serviços externos (Ludopedia)';
COMMENT ON COLUMN user_oauth_tokens.user_id IS 'ID do usuário (sem FK para preservar dados)';
COMMENT ON COLUMN user_oauth_tokens.access_token IS 'Token de acesso criptografado';
COMMENT ON COLUMN user_oauth_tokens.provider IS 'Provedor OAuth (ex: ludopedia)';

COMMENT ON TABLE refresh_tokens IS 'Tokens de refresh para logout remoto e controle de sessão';
COMMENT ON COLUMN refresh_tokens.user_id IS 'ID do usuário (sem FK para preservar dados)';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hash SHA256 do refresh token';

-- Verificar se as tabelas foram criadas
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'user_oauth_tokens', 'refresh_tokens')
ORDER BY table_name;

-- Verificar índices criados
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('users', 'user_oauth_tokens', 'refresh_tokens')
  AND schemaname = 'public'
ORDER BY tablename, indexname;