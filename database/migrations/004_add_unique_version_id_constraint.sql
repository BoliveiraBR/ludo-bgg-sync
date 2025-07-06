-- Migration: Add unique constraint to version_id in bgg_collection
-- IMPORTANTE: version_id (collid) é a verdadeira chave única no BGG, não game_id
-- game_id pode ser repetido entre diferentes versões/edições do mesmo jogo

-- Verificar se há (user_name, version_id) duplicados antes de adicionar constraint
-- (este comando mostra duplicatas se existirem)
SELECT user_name, version_id, COUNT(*) as count 
FROM bgg_collection 
WHERE version_id IS NOT NULL 
GROUP BY user_name, version_id 
HAVING COUNT(*) > 1;

-- Se houver duplicatas, você precisará resolvê-las manualmente antes de continuar
-- Exemplo de como remover duplicatas (manter apenas o mais recente):
-- DELETE FROM bgg_collection bc1
-- WHERE EXISTS (
--     SELECT 1 FROM bgg_collection bc2
--     WHERE bc2.user_name = bc1.user_name 
--     AND bc2.version_id = bc1.version_id
--     AND bc2.created_at > bc1.created_at
-- );

-- Adicionar constraint única para (user_name, version_id)
-- NOTA: Isso garante que cada usuário não pode ter o mesmo version_id duplicado
-- O version_id (collid) é único por usuário, mas pode se repetir entre usuários diferentes
ALTER TABLE bgg_collection 
ADD CONSTRAINT unique_bgg_user_version_id 
UNIQUE (user_name, version_id);

-- Comentário explicativo
COMMENT ON CONSTRAINT unique_bgg_user_version_id ON bgg_collection 
IS 'Garante que cada usuário não pode ter o mesmo version_id (collid) duplicado em sua coleção. O version_id é a verdadeira chave única no BGG por usuário.';