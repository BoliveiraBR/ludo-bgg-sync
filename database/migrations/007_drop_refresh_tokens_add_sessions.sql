-- Migration: Drop refresh_tokens table and add user_sessions table
-- OBJETIVO: Remover tabela refresh_tokens desnecessária (Ludopedia não usa refresh tokens)
-- e adicionar tabela user_sessions para futuro gerenciamento de sessões JWT

-- Verificar se a tabela refresh_tokens existe antes de remover
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'refresh_tokens';

-- Dropar índices da tabela refresh_tokens
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_refresh_tokens_expires;

-- Dropar tabela refresh_tokens
DROP TABLE IF EXISTS refresh_tokens;

-- Criar tabela user_sessions para futuro gerenciamento de sessões JWT
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL, -- SEM FK para preservar dados
    jwt_jti VARCHAR(255) NOT NULL UNIQUE, -- JWT ID para revogação
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET
);

-- Criar índices para performance da nova tabela
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jwt_jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Adicionar comentários explicativos
COMMENT ON TABLE user_sessions IS 'Sessões de usuário com JWT para controle de acesso (sem refresh tokens)';
COMMENT ON COLUMN user_sessions.user_id IS 'ID do usuário (sem FK para preservar dados)';
COMMENT ON COLUMN user_sessions.jwt_jti IS 'JWT ID único para identificar e revogar sessões específicas';
COMMENT ON COLUMN user_sessions.user_agent IS 'User-Agent do navegador para identificação da sessão';
COMMENT ON COLUMN user_sessions.ip_address IS 'Endereço IP do usuário para auditoria';

-- Verificar se as mudanças foram aplicadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('refresh_tokens', 'user_sessions');

-- Verificar índices criados para a nova tabela
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'user_sessions'
  AND schemaname = 'public'
ORDER BY indexname;

-- Verificar comentários da nova tabela
SELECT 
    t.table_name,
    obj_description(c.oid) as table_comment
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
  AND t.table_name = 'user_sessions';